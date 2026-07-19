/**
 * Orders Service
 * Database-backed order management with real eBay order data
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AutoFulfillBlockedReason,
  AutoFulfillStatus,
  EbayAccountStatus,
  OrderCostCaptureStatus,
  OrderStatus,
  type OrderDto,
  type OrderFiltersDto,
  type OrderStatsDto,
  type UpdateOrderAmazonDetailsDto,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

import { OrderSyncQueueService } from './order-sync-queue.service';
import { OrderSyncService } from './order-sync.service';
import { deriveProfitBasis } from './profit-calculation';

interface OrderRow {
  id: string;
  user_id: string;
  ebay_account_id: string;
  ebay_order_id: string;
  buyer_username: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  status: string;
  order_fulfillment_status: string;
  payment_status: string;
  listing_id: string | null;
  quantity: number;
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
  cost_capture_status: string;
  auto_fulfill_status: string | null;
  auto_fulfill_blocked_reason: string | null;
  shipping_address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    [key: string]: unknown;
  } | null;
  order_date: Date | null;
  last_ebay_event_at: Date | null;
  updated_at: Date;
  // Listing/Product JOIN fields (from findOne)
  listing_asin?: string;
  listing_ebay_item_id?: string;
  listing_title?: string;
  product_image_urls?: string[] | string;
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
export class OrdersService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly orderSyncService: OrderSyncService,
    private readonly orderSyncQueueService: OrderSyncQueueService
  ) {}

  /**
   * Get all orders for a user with optional filters
   */
  async findAll(userId: string, filters?: OrderFiltersDto): Promise<{ orders: OrderDto[]; total: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;
    const sortBy = filters?.sortBy || 'order_date';
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

    if (filters?.ebayAccountId) {
      conditions.push(`o.ebay_account_id = $${paramIndex}`);
      params.push(filters.ebayAccountId);
      paramIndex++;
    }

    if (filters?.search) {
      conditions.push(
        `(o.ebay_order_id ILIKE $${paramIndex}
          OR o.buyer_name ILIKE $${paramIndex}
          OR o.buyer_email ILIKE $${paramIndex}
          OR l.title ILIKE $${paramIndex}
          OR l.asin ILIKE $${paramIndex})`
      );
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    if (filters?.dateFrom) {
      conditions.push(`o.order_date >= $${paramIndex}::date`);
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters?.dateTo) {
      // Inclusive end date: treat as full calendar day
      conditions.push(`o.order_date < ($${paramIndex}::date + INTERVAL '1 day')`);
      params.push(filters.dateTo);
      paramIndex++;
    }

    if (filters?.autoFulfillNeedsAttention) {
      // Surface orders whose automated Amazon fulfillment hit a fail-closed
      // obstacle so the operator can fall back to manual linking.
      conditions.push(
        `o.auto_fulfill_status IN ('${AutoFulfillStatus.BLOCKED}', '${AutoFulfillStatus.FAILED}')`
      );
    }

    const whereClause = conditions.join(' AND ');
    const fromJoin = `
      FROM orders o
      LEFT JOIN listings l ON o.listing_id = l.id
      LEFT JOIN products p ON l.product_id = p.id
    `;

    // Validate sort column to prevent SQL injection
    const allowedSortColumns = ['order_date', 'sale_total', 'net_profit', 'status'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'order_date';
    const safeSortOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    // Count query (same joins so search on listing fields works)
    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*) as count ${fromJoin} WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || '0', 10);

    // Data query — enrich with listing + product (title, ASIN, eBay item, image)
    const results = await this.databaseService.query<OrderRow>(
      `SELECT o.*,
              l.asin as listing_asin,
              l.ebay_item_id as listing_ebay_item_id,
              l.title as listing_title,
              p.image_urls as product_image_urls
       ${fromJoin}
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
       WHERE user_id = $1 AND order_date >= CURRENT_DATE`,
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
   * Get a single order by ID with listing→product enrichment
   */
  async findOne(userId: string, id: string): Promise<OrderDto> {
    const results = await this.databaseService.query<OrderRow>(
      `SELECT o.*,
              l.asin as listing_asin,
              l.ebay_item_id as listing_ebay_item_id,
              l.title as listing_title,
              p.image_urls as product_image_urls
       FROM orders o
       LEFT JOIN listings l ON o.listing_id = l.id
       LEFT JOIN products p ON l.product_id = p.id
       WHERE o.id = $1 AND o.user_id = $2`,
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

    if (updateDto.purchasePrice !== undefined) {
      updates.push(`purchase_price = $${paramIndex}`);
      params.push(updateDto.purchasePrice);
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
    await this.orderSyncService.recomputeProfit(order.ebay_order_id);

    // Fetch updated order
    const updated = await this.databaseService.query<OrderRow>(
      `SELECT * FROM orders WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    return this.mapRowToDto(updated[0]);
  }

  /**
   * Trigger manual order sync for a user via queue and return fresh data
   */
  async triggerSync(userId: string): Promise<{ orders: OrderDto[]; total: number; stats: OrderStatsDto; message: string }> {
    const accounts = await this.databaseService.query<{ id: string }>(
      `SELECT id FROM ebay_accounts WHERE user_id = $1 AND status = $2`,
      [userId, EbayAccountStatus.ACTIVE]
    );

    if (accounts.length === 0) {
      const { orders, total } = await this.findAll(userId);
      const stats = await this.getStats(userId);
      return { orders, total, stats, message: 'No active eBay accounts found' };
    }

    // Queue the sync job (high priority) and wait for it to complete
    await this.orderSyncQueueService.triggerUserSync(userId);

    // Give the processor time to pick up and complete the job
    // The queue processes with concurrency=3, so this is typically fast
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Return fresh data from DB
    const { orders, total } = await this.findAll(userId);
    const stats = await this.getStats(userId);
    return { orders, total, stats, message: 'Orders synced' };
  }

  private resolveImageUrl(raw: string[] | string | undefined): string | undefined {
    if (!raw) {return undefined;}
    const urls = Array.isArray(raw) ? raw : (() => {
      try {
        const parsed: unknown = JSON.parse(String(raw));
        return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
      } catch {
        return [];
      }
    })();
    return urls[0] || undefined;
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

    const hasListing = !!row.listing_id;

    return {
      id: row.id,
      ebayOrderId: row.ebay_order_id,
      createdAt: (row.order_date || row.updated_at).toISOString(),
      isTracked: !!row.listing_id,
      buyerName: row.buyer_name || undefined,
      buyerEmail: row.buyer_email || undefined,
      buyerPhone: row.buyer_phone || undefined,
      buyerUsername: row.buyer_username || undefined,
      status: row.status as OrderStatus,
      costCaptureStatus: row.cost_capture_status
        ? (row.cost_capture_status as OrderCostCaptureStatus)
        : undefined,
      profitBasis: deriveProfitBasis(
        row.cost_capture_status as OrderCostCaptureStatus,
      ),
      autoFulfillStatus: row.auto_fulfill_status
        ? (row.auto_fulfill_status as AutoFulfillStatus)
        : undefined,
      autoFulfillBlockedReason: row.auto_fulfill_blocked_reason
        ? (row.auto_fulfill_blocked_reason as AutoFulfillBlockedReason)
        : null,
      orderFulfillmentStatus: row.order_fulfillment_status || undefined,
      paymentStatus: row.payment_status || undefined,
      product: hasListing
        ? {
            title: row.listing_title || 'Unknown Product',
            asin: row.listing_asin || undefined,
            ebayItemId: row.listing_ebay_item_id || undefined,
            quantity: row.quantity || 1,
            imageUrl: this.resolveImageUrl(row.product_image_urls),
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
      details: {
        purchaseSummary: {
          subtotal: parseFloat(row.sale_price) || 0,
          shipping: parseFloat(row.sale_shipping) || 0,
          tax: parseFloat(row.sale_tax) || 0,
          total: parseFloat(row.sale_total) || 0,
        },
        ebaySummary: {
          subtotal: parseFloat(row.sale_price) || 0,
          shipping: parseFloat(row.sale_shipping) || 0,
          tax: parseFloat(row.sale_tax) || 0,
          total: parseFloat(row.sale_total) || 0,
          earnings: parseFloat(row.ebay_earnings) || 0,
        },
      },
      fees: {
        transactionFee: parseFloat(row.transaction_fee) || 0,
        advertisingFee: parseFloat(row.ad_fee) || 0,
      },
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
