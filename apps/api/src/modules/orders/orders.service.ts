/**
 * Orders Service
 * Database-backed order management with real eBay order data
 */

import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import {
  EbayAccountStatus,
  OrderStatus,
  type OrderDto,
  type OrderFiltersDto,
  type OrderStatsDto,
  type UpdateOrderAmazonDetailsDto,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

import { OrderSyncService, type EbayAccountForSync } from './order-sync.service';

interface OrderRow {
  id: string;
  user_id: string;
  ebay_account_id: string;
  ebay_order_id: string;
  order_number: string;
  buyer_username: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  status: string;
  order_fulfillment_status: string;
  payment_status: string;
  listing_id: string;
  asin: string;
  ebay_item_id: string;
  sku: string;
  product_title: string;
  product_image_url: string;
  quantity: number;
  is_tracked: boolean;
  sale_price: string;
  sale_shipping: string;
  sale_tax: string;
  sale_total: string;
  ebay_earnings: string;
  purchase_price: string;
  amazon_order_url: string;
  amazon_tracking_url: string;
  amazon_tax: string;
  amazon_shipping: string;
  transaction_fee: string;
  ad_fee: string;
  net_profit: string;
  shipping_address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    [key: string]: unknown;
  } | null;
  created_at: Date;
  updated_at: Date;
}

/** Shape of a parsed shipping address */
interface ShippingAddressData {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

@Injectable()
export class OrdersService implements OnModuleInit {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly orderSyncService: OrderSyncService
  ) {}

  async onModuleInit() {
    await this.ensureTablesExist();
  }

  private async ensureTablesExist() {
    this.logger.log('Ensuring orders table exists...');

    await this.databaseService.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ebay_account_id UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
        ebay_order_id VARCHAR(50) NOT NULL UNIQUE,
        order_number VARCHAR(100),

        buyer_username VARCHAR(255),
        buyer_name VARCHAR(255),
        buyer_email VARCHAR(255),
        buyer_phone VARCHAR(50),

        status VARCHAR(30) NOT NULL DEFAULT '${OrderStatus.PENDING}',
        order_fulfillment_status VARCHAR(30),
        payment_status VARCHAR(30),

        listing_id UUID REFERENCES listings(id) ON DELETE SET NULL,
        asin VARCHAR(10),
        ebay_item_id VARCHAR(50),
        sku VARCHAR(100),
        product_title TEXT,
        product_image_url TEXT,
        quantity INT DEFAULT 1,
        is_tracked BOOLEAN DEFAULT FALSE,

        sale_price DECIMAL(12,2) NOT NULL DEFAULT 0,
        sale_shipping DECIMAL(12,2) DEFAULT 0,
        sale_tax DECIMAL(12,2) DEFAULT 0,
        sale_total DECIMAL(12,2) NOT NULL DEFAULT 0,
        ebay_earnings DECIMAL(12,2) DEFAULT 0,

        purchase_price DECIMAL(12,2) DEFAULT 0,
        amazon_tax DECIMAL(12,2) DEFAULT 0,
        amazon_shipping DECIMAL(12,2) DEFAULT 0,
        amazon_order_url TEXT,
        amazon_tracking_url TEXT,

        transaction_fee DECIMAL(12,2) DEFAULT 0,
        ad_fee DECIMAL(12,2) DEFAULT 0,
        net_profit DECIMAL(12,2) DEFAULT 0,

        shipping_address JSONB,

        last_synced_at TIMESTAMP WITH TIME ZONE,
        ebay_created_at TIMESTAMP WITH TIME ZONE,
        ebay_updated_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Indexes
    await this.databaseService.query(`
      CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
      CREATE INDEX IF NOT EXISTS idx_orders_ebay_order_id ON orders(ebay_order_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_ebay_account_id ON orders(ebay_account_id);
      CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_orders_is_tracked ON orders(is_tracked);
    `);

    this.logger.log('Orders table ensured');
  }

  /**
   * Get all orders for a user with optional filters
   */
  async findAll(userId: string, filters?: OrderFiltersDto): Promise<{ orders: OrderDto[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;
    const sortBy = filters?.sortBy || 'created_at';
    const sortOrder = filters?.sortOrder || 'desc';

    // Build WHERE clause
    const conditions: string[] = ['o.user_id = $1'];
    const params: (string | number | boolean | null)[] = [userId];
    let paramIndex = 2;

    if (filters?.status) {
      conditions.push(`o.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters?.dateFrom) {
      conditions.push(`o.created_at >= $${paramIndex}`);
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters?.dateTo) {
      conditions.push(`o.created_at <= $${paramIndex}`);
      params.push(filters.dateTo);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Validate sort column to prevent SQL injection
    const allowedSortColumns = ['created_at', 'sale_total', 'net_profit', 'status', 'product_title'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count query
    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM orders o WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || '0', 10);

    // Data query
    const results = await this.databaseService.query<OrderRow>(
      `SELECT o.* FROM orders o
       WHERE ${whereClause}
       ORDER BY o.${safeSortBy} ${safeSortOrder}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      orders: results.map((row) => this.mapRowToDto(row)),
      total,
    };
  }

  /**
   * Get order statistics for a user
   */
  async getStats(userId: string): Promise<OrderStatsDto> {
    // Main aggregation
    const stats = await this.databaseService.query<{
      total_sales: string;
      total_profit: string;
      total_orders: string;
      active_orders: string;
    }>(
      `SELECT
        COALESCE(SUM(sale_total), 0) as total_sales,
        COALESCE(SUM(net_profit), 0) as total_profit,
        COUNT(*) as total_orders,
        COUNT(*) FILTER (WHERE status IN ('pending', 'processing', 'waiting_shipment')) as active_orders
       FROM orders WHERE user_id = $1`,
      [userId]
    );

    // Today's stats
    const todayStats = await this.databaseService.query<{
      today_orders: string;
      today_revenue: string;
    }>(
      `SELECT
        COUNT(*) as today_orders,
        COALESCE(SUM(sale_total), 0) as today_revenue
       FROM orders
       WHERE user_id = $1 AND created_at >= CURRENT_DATE`,
      [userId]
    );

    return {
      totalSales: parseFloat(stats[0]?.total_sales || '0'),
      totalProfit: parseFloat(stats[0]?.total_profit || '0'),
      totalOrders: parseInt(stats[0]?.total_orders || '0', 10),
      activeOrders: parseInt(stats[0]?.active_orders || '0', 10),
      todayOrders: parseInt(todayStats[0]?.today_orders || '0', 10),
      todayRevenue: parseFloat(todayStats[0]?.today_revenue || '0'),
    };
  }

  /**
   * Get a single order by ID
   */
  async findOne(userId: string, id: string): Promise<OrderDto> {
    const results = await this.databaseService.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (results.length === 0) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    return this.mapRowToDto(results[0]);
  }

  /**
   * Update Amazon order details and recalculate profit
   */
  async updateAmazonDetails(
    userId: string,
    id: string,
    updateDto: UpdateOrderAmazonDetailsDto
  ): Promise<OrderDto> {
    // Verify ownership
    const existing = await this.databaseService.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (existing.length === 0) {
      throw new NotFoundException(`Order with ID ${id} not found`);
    }

    const order = existing[0];

    // Build update query dynamically
    const updates: string[] = [];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (updateDto.amazonOrderUrl !== undefined) {
      updates.push(`amazon_order_url = $${paramIndex}`);
      params.push(updateDto.amazonOrderUrl);
      paramIndex++;
    }

    if (updateDto.amazonTrackingUrl !== undefined) {
      updates.push(`amazon_tracking_url = $${paramIndex}`);
      params.push(updateDto.amazonTrackingUrl);
      paramIndex++;
    }

    if (updateDto.amazonTax !== undefined) {
      updates.push(`amazon_tax = $${paramIndex}`);
      params.push(updateDto.amazonTax);
      paramIndex++;
    }

    if (updateDto.amazonShipping !== undefined) {
      updates.push(`amazon_shipping = $${paramIndex}`);
      params.push(updateDto.amazonShipping);
      paramIndex++;
    }

    if (updates.length === 0) {
      return this.mapRowToDto(order);
    }

    // Update status to waiting_shipment if Amazon order URL provided
    if (updateDto.amazonOrderUrl) {
      updates.push(`status = 'waiting_shipment'`);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    // Add WHERE clause params
    params.push(id, userId);

    await this.databaseService.query(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`,
      params
    );

    // Recalculate profit
    await this.orderSyncService.recalculateProfit(order.ebay_order_id);

    // Fetch updated order
    const updated = await this.databaseService.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return this.mapRowToDto(updated[0]);
  }

  /**
   * Trigger manual order sync for a user
   */
  async triggerSync(userId: string): Promise<{ message: string }> {
    const accounts = await this.databaseService.query<{
      id: string;
      marketplace_id: string;
      created_at: Date;
      status: string;
    }>(
      `SELECT id, marketplace_id, created_at, status
       FROM ebay_accounts WHERE user_id = $1 AND status = '${EbayAccountStatus.ACTIVE}'`,
      [userId]
    );

    if (accounts.length === 0) {
      return { message: 'No active eBay accounts found' };
    }

    let totalSynced = 0;
    for (const account of accounts) {
      // Get full account with tokens for sync
      const fullAccount = await this.databaseService.query<EbayAccountForSync>(
        `SELECT * FROM ebay_accounts WHERE id = $1`,
        [account.id]
      );

      if (fullAccount.length > 0) {
        const count = await this.orderSyncService.syncOrdersForAccount(fullAccount[0]);
        totalSynced += count;
      }
    }

    return { message: `Synced ${totalSynced} orders` };
  }

  /**
   * Map database row to OrderDto
   */
  private mapRowToDto(row: OrderRow): OrderDto {
    const shippingAddress = row.shipping_address
      ? typeof row.shipping_address === 'string'
        ? (JSON.parse(row.shipping_address) as ShippingAddressData)
        : (row.shipping_address as ShippingAddressData)
      : undefined;

    return {
      id: row.id,
      ebayOrderId: row.ebay_order_id,
      orderNumber: row.order_number || undefined,
      createdAt: row.created_at.toISOString(),
      isTracked: row.is_tracked,
      buyerName: row.buyer_name || undefined,
      buyerEmail: row.buyer_email || undefined,
      buyerPhone: row.buyer_phone || undefined,
      buyerUsername: row.buyer_username || undefined,
      status: row.status as OrderStatus,
      orderFulfillmentStatus: row.order_fulfillment_status || undefined,
      paymentStatus: row.payment_status || undefined,
      product: row.product_title
        ? {
            title: row.product_title,
            asin: row.asin || undefined,
            ebayItemId: row.ebay_item_id || undefined,
            sku: row.sku || undefined,
            quantity: row.quantity || 1,
            imageUrl: row.product_image_url || undefined,
          }
        : undefined,
      salePrice: parseFloat(row.sale_price) || 0,
      saleShipping: parseFloat(row.sale_shipping) || 0,
      saleTax: parseFloat(row.sale_tax) || 0,
      saleTotal: parseFloat(row.sale_total) || 0,
      ebayEarnings: parseFloat(row.ebay_earnings) || 0,
      purchasePrice: parseFloat(row.purchase_price) || 0,
      amazonOrderUrl: row.amazon_order_url || undefined,
      amazonTrackingUrl: row.amazon_tracking_url || undefined,
      amazonTax: row.amazon_tax ? parseFloat(row.amazon_tax) : undefined,
      amazonShipping: row.amazon_shipping ? parseFloat(row.amazon_shipping) : undefined,
      netProfit: parseFloat(row.net_profit) || 0,
      transactionFee: parseFloat(row.transaction_fee) || 0,
      adFee: parseFloat(row.ad_fee) || 0,
      shippingAddress: shippingAddress
        ? {
            street: shippingAddress.street || '',
            city: shippingAddress.city || '',
            state: shippingAddress.state || '',
            zipCode: shippingAddress.zipCode || '',
            country: shippingAddress.country || '',
          }
        : undefined,
    };
  }
}
