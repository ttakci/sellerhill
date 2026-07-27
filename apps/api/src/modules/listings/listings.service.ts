import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ListingJobStatus,
  ListingStatus,
  OrderStatus,
  type CreateListingsRequest,
  type ListingDto,
  type ListingJobDto,
  type ListingJobItemDto,
  type ListingsQueryDto,
  type PaginatedListingsDto,
  type ProductData,
  type UpdateListingRequest,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import { EbayService } from '../ebay/ebay.service';

import { ListingStrategyService } from './listing-strategy.service';
import { ListingJobEntity, ListingJobItemEntity } from './listings.entities';

/** Row type for getListings / getListing queries (listings JOIN products) */
interface ListingQueryRow {
  id: string;
  user_id: string;
  asin: string;
  product_id: string;
  title: string;
  price: string;
  purchase_price: string | null;
  estimated_profit: string | null;
  profit_margin: string | null;
  roi: string | null;
  sold_count: string | number;
  watch_count: string | number;
  view_count: string | number;
  quantity: number;
  source_stock: number | null;
  image_urls: string[] | null;
  ebay_item_id: string | null;
  listing_settings_group_id: string;
  ebay_category_name: string | null;
  product_category: string | null;
  brand: string | null;
  manufacturer?: string | null;
  features?: string[] | string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  payment_policy_id: string | null;
  shipping_policy_id: string | null;
  return_policy_id: string | null;
  product_description?: string | null;
  group_name?: string | null;
  ebay_account_id?: string | null;
  last_sale_at?: Date | null;
  disable_ordering?: boolean;
  disable_repricing?: boolean;
  lock_price?: boolean;
  lock_quantity?: boolean;
  price_override?: string | null;
  quantity_override?: number | null;
  margin_percent_override?: string | null;
  margin_fixed_override?: string | null;
}

/** Row type for getUserProducts query */
interface ProductQueryRow {
  id: string;
  asin: string;
  title: string;
  description: string | null;
  price: string | ProductPriceData;
  currency: string;
  image_urls: string[] | string;
  brand: string | null;
  category: string | null;
  features: string[] | string | null;
  stock: number;
  raw_provider_data: string | Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date | string;
}

/** Price data stored in JSONB price column */
interface ProductPriceData {
  current: number;
  avg30?: number;
  currency?: string;
}

/** Row type for endListings query */
interface EbayItemIdRow {
  ebay_item_id: string;
}

/** Row type for deleteListings transaction query */
interface DeleteListingRow {
  ebay_item_id: string;
  status: ListingStatus;
  product_id: string | null;
}

/** Helper to safely extract error message from unknown errors */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ebayService: EbayService,
    private readonly strategyService: ListingStrategyService,
    private readonly quotaEnforcement: QuotaEnforcementService
  ) {}

  /**
   * Create a final listing record after successful eBay creation
   */
  async createListing(data: {
    userId: string;
    asin: string;
    productId: string;
    listingSettingsGroupId: string;
    paymentPolicyId: string;
    shippingPolicyId: string;
    returnPolicyId: string;
    /** Null for draft listings not yet published to eBay. */
    ebayItemId?: string | null;
    title: string;
    price: number;
    quantity: number;
    purchasePrice?: number;
    estimatedProfit?: number;
    profitMargin?: number;
    roi?: number;
    soldCount?: number;
    watchCount?: number;
    viewCount?: number;
    ebayCategoryName?: string;
    ebayAccountId?: string;
    status?: ListingStatus;
  }): Promise<string> {
    const status = data.status ?? ListingStatus.ACTIVE;
    const result = await this.databaseService.query<{ id: string }>(
      `
      INSERT INTO listings (
        user_id, asin, product_id, listing_settings_group_id, 
        payment_policy_id, shipping_policy_id, return_policy_id,
        ebay_item_id, title, price, quantity, status,
        purchase_price, estimated_profit, profit_margin, roi,
        sold_count, watch_count, view_count, ebay_category_name,
        ebay_account_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING id
    `,
      [
        data.userId,
        data.asin,
        data.productId,
        data.listingSettingsGroupId,
        data.paymentPolicyId,
        data.shippingPolicyId,
        data.returnPolicyId,
        data.ebayItemId ?? null,
        data.title,
        data.price,
        data.quantity,
        status,
        data.purchasePrice || 0,
        data.estimatedProfit || 0,
        data.profitMargin || 0,
        data.roi || 0,
        data.soldCount || 0,
        data.watchCount || 0,
        data.viewCount || 0,
        data.ebayCategoryName || '',
        data.ebayAccountId || null,
      ]
    );

    return result[0].id;
  }

  private mapListingRow(row: ListingQueryRow): ListingDto {
    return {
      id: row.id,
      userId: row.user_id,
      asin: row.asin,
      productId: row.product_id,
      title: row.title,
      description: row.product_description ?? undefined,
      price: parseFloat(row.price),
      purchasePrice: row.purchase_price ? parseFloat(row.purchase_price) : 0,
      estimatedProfit: row.estimated_profit ? parseFloat(row.estimated_profit) : 0,
      profitMargin: row.profit_margin ? parseFloat(row.profit_margin) : 0,
      roi: row.roi ? parseFloat(row.roi) : 0,
      soldCount: parseInt(String(row.sold_count), 10) || 0,
      watchCount: parseInt(String(row.watch_count), 10) || 0,
      viewCount: parseInt(String(row.view_count), 10) || 0,
      quantity: row.quantity,
      sourceStock: row.source_stock ?? undefined,
      imageUrls: row.image_urls || [],
      ebayListingId: row.ebay_item_id ?? undefined,
      listingSettingsGroupId: row.listing_settings_group_id,
      listingSettingsGroupName: row.group_name ?? undefined,
      category: row.ebay_category_name || row.product_category || '',
      brand: row.brand || '',
      features: this.parseFeatures(row.features),
      specs: this.buildSpecs(row),
      status: row.status as ListingStatus,
      ebayAccountId: row.ebay_account_id ?? undefined,
      lastSaleAt: row.last_sale_at ? row.last_sale_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      paymentPolicyId: row.payment_policy_id || '',
      shippingPolicyId: row.shipping_policy_id || '',
      returnPolicyId: row.return_policy_id || '',
      disableOrdering: Boolean(row.disable_ordering),
      disableRepricing: Boolean(row.disable_repricing),
      lockPrice: Boolean(row.lock_price),
      lockQuantity: Boolean(row.lock_quantity),
      priceOverride:
        row.price_override !== undefined && row.price_override !== null
          ? parseFloat(String(row.price_override))
          : null,
      quantityOverride: row.quantity_override ?? null,
      marginPercentOverride:
        row.margin_percent_override !== undefined && row.margin_percent_override !== null
          ? parseFloat(String(row.margin_percent_override))
          : null,
      marginFixedOverride:
        row.margin_fixed_override !== undefined && row.margin_fixed_override !== null
          ? parseFloat(String(row.margin_fixed_override))
          : null,
    };
  }

  private parseFeatures(raw: string[] | string | null | undefined): string[] {
    if (!raw) {
      return [];
    }
    if (Array.isArray(raw)) {
      return raw.map(String).filter(Boolean);
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
    } catch {
      return [];
    }
  }

  private buildSpecs(row: ListingQueryRow): Record<string, string> {
    const specs: Record<string, string> = {};
    if (row.brand) {
      specs.Brand = row.brand;
    }
    // Parse "Key: Value" style features into specs
    for (const feature of this.parseFeatures(row.features)) {
      const match = feature.match(/^([^:]{2,40}):\s*(.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();
        if (key && value && value.length < 65 && !specs[key]) {
          specs[key] = value;
        }
      }
    }
    return specs;
  }

  /**
   * Resolve FE sort keys to safe SQL expressions (whitelist only).
   */
  private resolveListingsSort(sortBy?: string): string {
    const map: Record<string, string> = {
      product: 'l.title',
      title: 'l.title',
      prices: 'l.price',
      price: 'l.price',
      purchasePrice: 'l.purchase_price',
      profit: 'l.estimated_profit',
      estimatedProfit: 'l.estimated_profit',
      roi: 'l.roi',
      profitMargin: 'l.profit_margin',
      sold: 'l.sold_count',
      soldCount: 'l.sold_count',
      watch: 'l.watch_count',
      watchCount: 'l.watch_count',
      views: 'l.view_count',
      viewCount: 'l.view_count',
      quantity: 'l.quantity',
      sourceStock: 'p.stock',
      category: 'COALESCE(l.ebay_category_name, p.category)',
      status: 'l.status',
      createdAt: 'l.created_at',
      updatedAt: 'l.updated_at',
      lastSale: 'last_sale_at',
      lastSaleAt: 'last_sale_at',
    };
    return (sortBy && map[sortBy]) || 'l.created_at';
  }

  /**
   * Paginated, filterable listings for the current user.
   * Server-side only — clients must not load the full catalog for table UIs.
   */
  async getListings(
    userId: string,
    query: ListingsQueryDto = {},
    options?: { maxLimit?: number }
  ): Promise<PaginatedListingsDto> {
    const page = Math.max(1, Number(query.page) || 1);
    const maxLimit = options?.maxLimit ?? 100;
    const limit = Math.min(maxLimit, Math.max(1, Number(query.limit) || 20));
    const offset = (page - 1) * limit;
    const sortExpr = this.resolveListingsSort(query.sortBy);
    const sortOrder = query.sortOrder?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const conditions: string[] = ['l.user_id = $1'];
    const params: (string | number | null)[] = [userId];
    let paramIndex = 2;

    const pushEq = (sql: string, value: string | number | undefined) => {
      if (value === undefined || value === null || value === '') {
        return;
      }
      conditions.push(`${sql} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    };

    const pushRange = (column: string, min?: number, max?: number) => {
      if (min !== undefined && !Number.isNaN(min)) {
        conditions.push(`${column} >= $${paramIndex}`);
        params.push(min);
        paramIndex++;
      }
      if (max !== undefined && !Number.isNaN(max)) {
        conditions.push(`${column} <= $${paramIndex}`);
        params.push(max);
        paramIndex++;
      }
    };

    if (query.search?.trim()) {
      conditions.push(
        `(l.title ILIKE $${paramIndex} OR l.asin ILIKE $${paramIndex} OR l.ebay_item_id ILIKE $${paramIndex})`
      );
      params.push(`%${query.search.trim()}%`);
      paramIndex++;
    }

    if (query.status) {
      pushEq('l.status', query.status);
    } else {
      // Operational lists never mix drafts — drafts only via status=draft
      conditions.push(`l.status <> '${ListingStatus.DRAFT}'`);
    }

    // stockPreset kept for API compat — prefer quantityMin/Max from advanced filters
    if (query.stockPreset === 'in_stock') {
      conditions.push('l.quantity > 0');
    } else if (query.stockPreset === 'oos') {
      conditions.push('l.quantity = 0');
    }

    if (query.ebayAccountId?.trim()) {
      pushEq('l.ebay_account_id', query.ebayAccountId.trim());
    }

    if (query.category?.trim()) {
      conditions.push(
        `(COALESCE(l.ebay_category_name, p.category) = $${paramIndex})`
      );
      params.push(query.category.trim());
      paramIndex++;
    }

    pushRange('l.price', query.priceMin, query.priceMax);
    pushRange('l.purchase_price', query.purchasePriceMin, query.purchasePriceMax);
    pushRange('l.estimated_profit', query.estimatedProfitMin, query.estimatedProfitMax);
    pushRange('l.roi', query.roiMin, query.roiMax);
    pushRange('l.profit_margin', query.profitMarginMin, query.profitMarginMax);
    pushRange('l.sold_count', query.soldCountMin, query.soldCountMax);
    pushRange('l.watch_count', query.watchCountMin, query.watchCountMax);
    pushRange('l.view_count', query.viewCountMin, query.viewCountMax);
    pushRange('l.quantity', query.quantityMin, query.quantityMax);
    pushRange('p.stock', query.sourceStockMin, query.sourceStockMax);

    // Listings with ≥1 non-cancelled order in [soldFrom, soldTo] (soldTo inclusive as date)
    if (query.soldFrom?.trim() || query.soldTo?.trim()) {
      const soldConds: string[] = [
        'o_sold.listing_id = l.id',
        'o_sold.user_id = l.user_id',
        `o_sold.status <> '${OrderStatus.CANCELLED}'`,
      ];
      if (query.soldFrom?.trim()) {
        soldConds.push(`o_sold.order_date >= $${paramIndex}::date`);
        params.push(query.soldFrom.trim());
        paramIndex++;
      }
      if (query.soldTo?.trim()) {
        soldConds.push(`o_sold.order_date < ($${paramIndex}::date + INTERVAL '1 day')`);
        params.push(query.soldTo.trim());
        paramIndex++;
      }
      conditions.push(`EXISTS (SELECT 1 FROM orders o_sold WHERE ${soldConds.join(' AND ')})`);
    }

    const whereClause = conditions.join(' AND ');
    const fromJoin = `
      FROM listings l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE ${whereClause}
    `;

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count ${fromJoin}`,
      params
    );
    const total = parseInt(countResult[0]?.count || '0', 10);

    const results = await this.databaseService.query<ListingQueryRow>(
      `
      SELECT l.*,
             p.image_urls,
             p.category as product_category,
             p.stock as source_stock,
             p.brand,
             (SELECT MAX(o.order_date) FROM orders o WHERE o.listing_id = l.id) AS last_sale_at
      ${fromJoin}
      ORDER BY ${sortExpr} ${sortOrder}, l.id ASC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...params, limit, offset]
    );

    const categoryRows = await this.databaseService.query<{ category: string }>(
      `
      SELECT DISTINCT COALESCE(l.ebay_category_name, p.category) AS category
      FROM listings l
      LEFT JOIN products p ON l.product_id = p.id
      WHERE l.user_id = $1
        AND COALESCE(l.ebay_category_name, p.category) IS NOT NULL
        AND COALESCE(l.ebay_category_name, p.category) <> ''
      ORDER BY category ASC
      `,
      [userId]
    );

    return {
      items: results.map((row) => this.mapListingRow(row)),
      total,
      page,
      limit,
      categories: categoryRows.map((r) => r.category),
    };
  }

  /**
   * CSV export for current filters (dedicated endpoint — not the UI page size).
   * Cap at 5_000 rows to protect the API; clients should narrow filters for large catalogs.
   */
  async exportListingsCsv(userId: string, query: ListingsQueryDto = {}): Promise<string> {
    const result = await this.getListings(
      userId,
      { ...query, page: 1, limit: 5000 },
      { maxLimit: 5000 }
    );

    const headers = [
      'id',
      'title',
      'asin',
      'ebayListingId',
      'category',
      'brand',
      'price',
      'purchasePrice',
      'estimatedProfit',
      'roi',
      'profitMargin',
      'soldCount',
      'watchCount',
      'viewCount',
      'quantity',
      'sourceStock',
      'status',
      'createdAt',
    ] as const;

    const escape = (v: string | number | undefined | null): string => {
      const s = v === undefined || v === null ? '' : String(v);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const lines = [headers.join(',')];
    for (const item of result.items) {
      lines.push(
        [
          item.id,
          item.title,
          item.asin,
          item.ebayListingId ?? '',
          item.category ?? '',
          item.brand ?? '',
          item.price,
          item.purchasePrice ?? '',
          item.estimatedProfit ?? '',
          item.roi ?? '',
          item.profitMargin ?? '',
          item.soldCount ?? '',
          item.watchCount ?? '',
          item.viewCount ?? '',
          item.quantity,
          item.sourceStock ?? '',
          item.status,
          item.createdAt,
        ]
          .map(escape)
          .join(',')
      );
    }

    return lines.join('\n');
  }

  /**
   * Check if an ASIN is already active or draft for a user (blocks re-import).
   * Inactive/error rows do not block creating a new listing.
   */
  async isAsinListed(userId: string, asin: string): Promise<boolean> {
    const results = await this.databaseService.query(
      `
      SELECT id FROM listings 
      WHERE user_id = $1 AND asin = $2
        AND status IN ('${ListingStatus.ACTIVE}', '${ListingStatus.DRAFT}')
    `,
      [userId, asin]
    );

    return results.length > 0;
  }

  /**
   * Get all unique products for a user from their listings
   */
  async getUserProducts(userId: string): Promise<ProductData[]> {
    const results = await this.databaseService.query<ProductQueryRow>(
      `
      SELECT DISTINCT p.*
      FROM products p
      INNER JOIN listings l ON p.id = l.product_id
      WHERE l.user_id = $1
      ORDER BY p.created_at DESC
    `,
      [userId]
    );

    return results.map((row) => ({
      asin: row.asin,
      title: row.title,
      description: row.description ?? '',
      price: {
        current: typeof row.price === 'string' ? (JSON.parse(row.price) as ProductPriceData).current : row.price.current,
        avg30: typeof row.price === 'string' ? (JSON.parse(row.price) as ProductPriceData).avg30 || 0 : row.price.avg30 || 0,
        currency: row.currency || 'USD',
      },
      imageUrls: Array.isArray(row.image_urls) ? row.image_urls : (JSON.parse(row.image_urls || '[]') as string[]),
      brand: row.brand ?? '',
      category: row.category ?? undefined,
      manufacturer: row.brand ?? undefined, // Fallback
      features: Array.isArray(row.features) ? row.features : (JSON.parse(row.features || '[]') as string[]),
      updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    }));
  }

  /**
   * Get a single listing by ID
   */
  async getListing(userId: string, id: string): Promise<ListingDto | null> {
    const results = await this.databaseService.query<ListingQueryRow>(
      `
      SELECT
        l.*,
        p.image_urls,
        p.category AS product_category,
        p.stock AS source_stock,
        p.brand,
        p.features,
        p.description AS product_description,
        g.name AS group_name,
        (SELECT MAX(o.order_date) FROM orders o WHERE o.listing_id = l.id) AS last_sale_at
      FROM listings l
      LEFT JOIN products p ON l.product_id = p.id
      LEFT JOIN listing_settings_groups g ON l.listing_settings_group_id = g.id
      WHERE l.id = $1 AND l.user_id = $2
    `,
      [id, userId]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapListingRow(results[0]);
  }

  /**
   * Update listing customizations (title, strategy group, eBay policies).
   * Does not push title/policy changes to eBay Inventory API yet — DB source of truth
   * for group/policies; price/qty still driven by Keepa refresh + strategy group.
   */
  async updateListing(userId: string, id: string, body: UpdateListingRequest): Promise<ListingDto> {
    const existing = await this.getListing(userId, id);
    if (!existing) {
      throw new NotFoundException('Listing not found');
    }

    const title = body.title?.trim();
    if (title !== undefined && title.length === 0) {
      throw new BadRequestException('Title cannot be empty');
    }

    const sets: string[] = [];
    const params: (string | number | null | boolean)[] = [];
    let i = 1;

    if (title !== undefined) {
      sets.push(`title = $${i++}`);
      params.push(title.slice(0, 80));
    }
    if (body.listingSettingsGroupId !== undefined) {
      sets.push(`listing_settings_group_id = $${i++}`);
      params.push(body.listingSettingsGroupId);
    }
    if (body.paymentPolicyId !== undefined) {
      sets.push(`payment_policy_id = $${i++}`);
      params.push(body.paymentPolicyId);
    }
    if (body.shippingPolicyId !== undefined) {
      sets.push(`shipping_policy_id = $${i++}`);
      params.push(body.shippingPolicyId);
    }
    if (body.returnPolicyId !== undefined) {
      sets.push(`return_policy_id = $${i++}`);
      params.push(body.returnPolicyId);
    }

    const boolFields: Array<[keyof UpdateListingRequest, string]> = [
      ['disableOrdering', 'disable_ordering'],
      ['disableRepricing', 'disable_repricing'],
      ['lockPrice', 'lock_price'],
      ['lockQuantity', 'lock_quantity'],
    ];
    for (const [key, col] of boolFields) {
      if (body[key] !== undefined) {
        sets.push(`${col} = $${i++}`);
        params.push(Boolean(body[key]));
      }
    }

    const numNullable: Array<[keyof UpdateListingRequest, string]> = [
      ['priceOverride', 'price_override'],
      ['quantityOverride', 'quantity_override'],
      ['marginPercentOverride', 'margin_percent_override'],
      ['marginFixedOverride', 'margin_fixed_override'],
    ];
    for (const [key, col] of numNullable) {
      if (body[key] !== undefined) {
        sets.push(`${col} = $${i++}`);
        const v = body[key] as number | null | undefined;
        params.push(v === null || v === undefined ? null : v);
      }
    }

    if (sets.length === 0) {
      return existing;
    }

    sets.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id, userId);

    await this.databaseService.query(
      `
      UPDATE listings
      SET ${sets.join(', ')}
      WHERE id = $${i++} AND user_id = $${i}
      `,
      params
    );

    const updated = await this.getListing(userId, id);
    if (!updated) {
      throw new NotFoundException('Listing not found after update');
    }
    return updated;
  }

  /**
   * Get cached product info by ASIN
   */
  async getProductByAsin(asin: string): Promise<{ id: string; data: ProductData } | null> {
    const results = await this.databaseService.query<ProductQueryRow>(
      `
      SELECT id, asin, title, description, price, image_urls, brand, category, stock, raw_provider_data
      FROM products WHERE asin = $1
    `,
      [asin]
    );

    if (results.length === 0) {
      return null;
    }

    const row = results[0];

    const data: ProductData = {
      asin: row.asin,
      title: row.title,
      description: row.description ?? '',
      price: {
        current: typeof row.price === 'string' ? (JSON.parse(row.price) as ProductPriceData).current : row.price.current,
        avg30: typeof row.price === 'string' ? (JSON.parse(row.price) as ProductPriceData).avg30 || 0 : row.price.avg30 || 0,
        currency: row.currency || 'USD',
      },
      imageUrls: Array.isArray(row.image_urls) ? row.image_urls : (JSON.parse(String(row.image_urls) || '[]') as string[]),
      brand: row.brand ?? '',
      category: row.category ?? undefined,
      manufacturer: row.brand ?? undefined, // Fallback
      features: row.features ? (Array.isArray(row.features) ? row.features : (JSON.parse(String(row.features)) as string[])) : [],
      stock: row.stock || 0,
      raw: row.raw_provider_data
        ? typeof row.raw_provider_data === 'string'
          ? JSON.parse(row.raw_provider_data) as Record<string, unknown>
          : row.raw_provider_data
        : undefined,
    };

    return { id: row.id, data };
  }

  /**
   * Create a new listing job
   */
  async createJob(
    userId: string,
    request: CreateListingsRequest
  ): Promise<ListingJobDto & { items: Array<{ id: string; asin: string }> }> {
    const { asins } = request;

    // Filter out ASINs that are already actively listed
    const uniqueAsins = [...new Set(asins)];
    const toProcess: string[] = [];

    for (const asin of uniqueAsins) {
      const exists = await this.isAsinListed(userId, asin);
      if (!exists) {
        toProcess.push(asin);
      } else {
        this.logger.warn(`ASIN ${asin} already exists in active listings for user ${userId}. Skipping.`);
      }
    }

    // Create job record
    const jobResult = await this.databaseService.query<ListingJobEntity>(
      `
      INSERT INTO listing_jobs (user_id, total_asins, status)
      VALUES ($1, $2, $3)
      RETURNING *
    `,
      [userId, toProcess.length, toProcess.length === 0 ? ListingJobStatus.COMPLETED : ListingJobStatus.PENDING]
    );

    const job = jobResult[0];
    const items: Array<{ id: string; asin: string }> = [];

    // Create job items for each ASIN (capture ids for quota reservation keys)
    for (const asin of toProcess) {
      const itemRows = await this.databaseService.query<{ id: string }>(
        `
        INSERT INTO listing_job_items (job_id, asin, status)
        VALUES ($1, $2, $3)
        RETURNING id
      `,
        [job.id, asin, ListingStatus.DRAFT]
      );
      items.push({ id: itemRows[0].id, asin });
    }

    return { ...this.mapJobToDto(job), items };
  }

  /**
   * Get job status
   */
  async getJobStatus(userId: string, jobId: string): Promise<ListingJobDto | null> {
    const results = await this.databaseService.query<ListingJobEntity>(
      `
      SELECT * FROM listing_jobs
      WHERE id = $1 AND user_id = $2
    `,
      [jobId, userId]
    );

    if (results.length === 0) {
      return null;
    }

    return this.mapJobToDto(results[0]);
  }

  /**
   * Get all listing jobs for a user
   */
  async getJobs(userId: string): Promise<ListingJobDto[]> {
    const results = await this.databaseService.query<ListingJobEntity>(
      `
      SELECT * FROM listing_jobs
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
      [userId]
    );

    return results.map((row) => this.mapJobToDto(row));
  }

  /**
   * Get job items
   */
  async getJobItems(userId: string, jobId: string): Promise<ListingJobItemDto[]> {
    // Verify job belongs to user
    const jobCheck = await this.databaseService.query(
      `
      SELECT id FROM listing_jobs WHERE id = $1 AND user_id = $2
    `,
      [jobId, userId]
    );

    if (jobCheck.length === 0) {
      return [];
    }

    const items = await this.databaseService.query<ListingJobItemEntity>(
      `
      SELECT * FROM listing_job_items
      WHERE job_id = $1
      ORDER BY created_at ASC
    `,
      [jobId]
    );

    return items.map((item) => this.mapJobItemToDto(item));
  }

  async findOrCreateProduct(asin: string, productData: ProductData): Promise<string> {
    const result = await this.databaseService.query<{ id: string }>(
      `
      INSERT INTO products (
        asin, title, price, currency, image_urls, description,
        brand, category, features, stock, raw_provider_data, raw_keepa_data, next_refresh_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW() + INTERVAL '12 hours')
      ON CONFLICT (asin) DO UPDATE SET
        title = EXCLUDED.title,
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        image_urls = EXCLUDED.image_urls,
        description = EXCLUDED.description,
        brand = EXCLUDED.brand,
        category = EXCLUDED.category,
        features = EXCLUDED.features,
        stock = EXCLUDED.stock,
        raw_provider_data = EXCLUDED.raw_provider_data,
        raw_keepa_data = COALESCE(EXCLUDED.raw_keepa_data, products.raw_keepa_data),
        last_sync_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `,
      [
        asin,
        productData.title,
        JSON.stringify(productData.price),
        productData.price.currency || 'USD',
        JSON.stringify(productData.imageUrls),
        productData.description,
        productData.brand || null,
        productData.category || productData.manufacturer || null,
        JSON.stringify(productData.features || []),
        productData.stock || 0,
        JSON.stringify(productData.raw || productData),
        productData.rawKeepaData ? JSON.stringify(productData.rawKeepaData) : null,
      ]
    );

    return result[0].id;
  }

  /**
   * Update job item processing result
   */
  async updateJobItemResult(
    jobId: string,
    asin: string,
    data: {
      productId?: string;
      listingId?: string;
      status: ListingStatus;
      ebayItemId?: string;
      errorMessage?: string;
    }
  ): Promise<void> {
    await this.databaseService.query(
      `
      UPDATE listing_job_items
      SET product_id = COALESCE($1, product_id),
          listing_id = COALESCE($2, listing_id),
          status = $3,
          ebay_item_id = $4,
          error_message = $5,
          updated_at = CURRENT_TIMESTAMP
      WHERE job_id = $6 AND asin = $7
    `,
      [
        data.productId || null,
        data.listingId || null,
        data.status,
        data.ebayItemId || null,
        data.errorMessage || null,
        jobId,
        asin,
      ]
    );

    await this.updateJobCounts(jobId);
  }

  /**
   * Update job counts and status
   */
  private async updateJobCounts(jobId: string): Promise<void> {
    const counts = await this.databaseService.query<{
      total: string | number;
      success: string | number;
      failed: string | number;
      retrying: string | number;
    }>(
      `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = '${ListingStatus.ACTIVE}') as success,
        COUNT(*) FILTER (WHERE status = '${ListingStatus.ERROR}') as failed,
        COUNT(*) FILTER (WHERE status = '${ListingStatus.RETRYING}') as retrying
      FROM listing_job_items
      WHERE job_id = $1
    `,
      [jobId]
    );

    const total = Number(counts[0].total);
    const success = Number(counts[0].success);
    const failed = Number(counts[0].failed);
    const _retrying = Number(counts[0].retrying);

    // Processed count only includes FINAL terminal states
    const processed = success + failed;

    let jobStatus = ListingJobStatus.PROCESSING;
    if (processed >= total) {
      jobStatus = failed === total ? ListingJobStatus.FAILED : ListingJobStatus.COMPLETED;
      this.logger.log(`Job ${jobId} finished with status: ${jobStatus} (${success} success, ${failed} failed)`);
    }

    await this.databaseService.query(
      `
      UPDATE listing_jobs
      SET processed_count = $1,
          success_count = $2,
          failed_count = $3,
          status = $4,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `,
      [processed, success, failed, jobStatus, jobId]
    );
  }

  /**
   * Map job entity to DTO
   */
  private mapJobToDto(entity: ListingJobEntity): ListingJobDto {
    return {
      id: entity.id,
      userId: entity.user_id,
      totalAsins: entity.total_asins,
      processedCount: entity.processed_count,
      successCount: entity.success_count,
      failedCount: entity.failed_count,
      status: entity.status as ListingJobStatus,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
    };
  }

  /**
   * Map job item entity to DTO
   */
  private mapJobItemToDto(entity: ListingJobItemEntity): ListingJobItemDto {
    return {
      id: entity.id,
      jobId: entity.job_id,
      asin: entity.asin,
      productId: entity.product_id || undefined,
      listingId: entity.listing_id || undefined,
      status: entity.status as ListingStatus,
      ebayItemId: entity.ebay_item_id || undefined,
      errorMessage: entity.error_message || undefined,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
    };
  }

  /**
   * Publish a draft listing to eBay (create live offer + mark ACTIVE).
   */
  async publishListing(userId: string, listingId: string): Promise<ListingDto> {
    const listing = await this.getListing(userId, listingId);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.status !== ListingStatus.DRAFT) {
      throw new BadRequestException('Only draft listings can be published');
    }

    // Block if another ACTIVE listing already exists for this ASIN
    const activeDup = await this.databaseService.query(
      `
      SELECT id FROM listings
      WHERE user_id = $1 AND asin = $2 AND status = '${ListingStatus.ACTIVE}' AND id <> $3
      LIMIT 1
    `,
      [userId, listing.asin, listingId]
    );
    if (activeDup.length > 0) {
      throw new BadRequestException('An active listing for this ASIN already exists');
    }

    const product = await this.getProductByAsin(listing.asin);
    if (!product) {
      throw new BadRequestException('Product data missing for this draft — cannot publish');
    }

    const ebayAccountId =
      listing.ebayAccountId || (await this.ebayService.getActiveAccountId(userId)) || null;

    // Recompute price/qty from strategy (no AI on publish — draft already has prepared title)
    const prepared = await this.strategyService.prepareListingData(
      userId,
      product.data,
      listing.listingSettingsGroupId,
      ebayAccountId,
      { applyContentAi: false }
    );

    // Prefer user-edited draft title; keep draft economics if lock overrides apply
    let finalPrice = prepared.price;
    let finalQty = prepared.quantity;
    let purchasePrice = prepared.purchasePrice;
    let estimatedProfit = prepared.estimatedProfit;
    let profitMargin = prepared.profitMargin;
    let roi = prepared.roi;

    if (listing.disableOrdering) {
      finalQty = 0;
    } else if (listing.lockQuantity) {
      finalQty =
        listing.quantityOverride !== null && listing.quantityOverride !== undefined
          ? Number(listing.quantityOverride)
          : Number(listing.quantity ?? 0);
    }

    if (listing.disableRepricing || listing.lockPrice) {
      if (listing.priceOverride !== null && listing.priceOverride !== undefined) {
        finalPrice = Number(listing.priceOverride);
      } else {
        finalPrice = Number(listing.price);
      }
      purchasePrice = prepared.purchasePrice;
      estimatedProfit = finalPrice - (purchasePrice ?? 0);
      profitMargin = finalPrice > 0 ? (estimatedProfit / finalPrice) * 100 : 0;
      roi = purchasePrice && purchasePrice > 0 ? (estimatedProfit / purchasePrice) * 100 : 0;
    }

    if (finalQty === 0) {
      throw new BadRequestException(
        'Cannot publish: quantity is 0. Adjust stock settings or wait for Amazon restock.'
      );
    }

    const listingData = {
      ...prepared,
      title: listing.title?.trim() || prepared.title,
      price: finalPrice,
      quantity: finalQty,
      purchasePrice,
      estimatedProfit,
      profitMargin,
      roi,
    };

    // Billing-quota gate (BILLING_ENFORCEMENT_ENABLED): reserve an active-
    // listings slot for this publish, race-safe (advisory-locked). Throws
    // QuotaExhaustedError if the limit would be exceeded — the controller
    // surfaces it as a structured 4xx and no eBay call is made.
    await this.quotaEnforcement.reserveForPublish(userId, listingId);

    try {
      const { listingId: ebayItemId, categoryName } = await this.ebayService.createListingWithRest(
        userId,
        product.id,
        listingData,
        {
          paymentId: listing.paymentPolicyId,
          shippingId: listing.shippingPolicyId,
          returnId: listing.returnPolicyId,
        },
        listing.asin
      );

      await this.databaseService.query(
        `
        UPDATE listings SET
          ebay_item_id = $1,
          status = '${ListingStatus.ACTIVE}',
          price = $2,
          quantity = $3,
          purchase_price = $4,
          estimated_profit = $5,
          profit_margin = $6,
          roi = $7,
          title = $8,
          ebay_category_name = COALESCE(NULLIF($9, ''), ebay_category_name),
          ebay_account_id = COALESCE(ebay_account_id, $10),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $11 AND user_id = $12
      `,
        [
          ebayItemId,
          finalPrice,
          finalQty,
          purchasePrice ?? 0,
          estimatedProfit ?? 0,
          profitMargin ?? 0,
          roi ?? 0,
          listingData.title,
          categoryName || '',
          ebayAccountId,
          listingId,
          userId,
        ]
      );

      // Publish succeeded — consume the reservation (idempotent, fail-soft).
      this.quotaEnforcement.consumeForPublish(userId, listingId);

      const updated = await this.getListing(userId, listingId);
      if (!updated) {
        throw new NotFoundException('Listing not found after publish');
      }
      this.logger.log(`Published draft ${listingId} as eBay item ${ebayItemId}`);
      return updated;
    } catch (err) {
      // Any failure between reserve and consume releases the held slot so the
      // next publish attempt can re-reserve cleanly. QuotaExhaustedError from
      // the reserve above is NOT re-caught here (it threw before this block).
      await this.quotaEnforcement.releaseForPublish(userId, listingId);
      throw err;
    }
  }

  /**
   * Bulk publish draft listings. Continues on individual failures.
   */
  async publishListings(userId: string, listingIds: string[]): Promise<number> {
    let successCount = 0;
    for (const id of listingIds) {
      try {
        await this.publishListing(userId, id);
        successCount++;
      } catch (error: unknown) {
        this.logger.error(`Failed to publish listing ${id}: ${getErrorMessage(error)}`);
      }
    }
    return successCount;
  }

  /**
   * End multiple listings on eBay
   */
  async endListings(userId: string, listingIds: string[]): Promise<number> {
    this.logger.log(`Ending ${listingIds.length} listings for user ${userId}`);

    let successCount = 0;

    for (const listingId of listingIds) {
      try {
        // 1. Get listing from DB to get the eBay item ID
        const results = await this.databaseService.query<EbayItemIdRow>(
          `
          SELECT ebay_item_id FROM listings
          WHERE id = $1 AND user_id = $2
        `,
          [listingId, userId]
        );

        if (results.length === 0) {continue;}

        const ebayItemId = results[0].ebay_item_id;

        // 2. Call eBay to end the item
        await this.ebayService.withdrawOffer(userId, ebayItemId);

        // 3. Update status in DB
        await this.databaseService.query(
          `
          UPDATE listings
          SET status = '${ListingStatus.INACTIVE}', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
        `,
          [listingId]
        );

        successCount++;
      } catch (error: unknown) {
        this.logger.error(`Failed to end listing ${listingId}: ${getErrorMessage(error)}`);
        // Continue with others
      }
    }

    return successCount;
  }

  /**
   * Bulk delete listings (ends them on eBay first)
   */
  async deleteListings(userId: string, listingIds: string[]): Promise<number> {
    this.logger.log(`Deleting ${listingIds.length} listings for user ${userId}`);

    let successCount = 0;

    for (const listingId of listingIds) {
      try {
        await this.databaseService.transaction(async (client) => {
          // 1. Get listing from DB (including product_id)
          const results = await client.query<DeleteListingRow>(
            `
            SELECT ebay_item_id, status, product_id FROM listings
            WHERE id = $1 AND user_id = $2
          `,
            [listingId, userId]
          );

          if (results.rows.length === 0) {return;}

          const { ebay_item_id: ebayItemId, status, product_id: productId } = results.rows[0];

          // 2. If it's active, try to end it on eBay first
          if (status === ListingStatus.ACTIVE && ebayItemId) {
            try {
              await this.ebayService.withdrawOffer(userId, ebayItemId);
            } catch (ebayError: unknown) {
              this.logger.error(
                `Failed to end listing ${listingId} on eBay, but proceeding with DB deletion: ${getErrorMessage(ebayError)}`
              );
            }
          }

          // 3. Delete listing from DB
          await client.query(
            `
            DELETE FROM listings WHERE id = $1
          `,
            [listingId]
          );

          // 4. Check if the product is used by any other listing
          if (productId) {
            const usageCheck = await client.query(
              `
              SELECT 1 FROM listings WHERE product_id = $1 LIMIT 1
            `,
              [productId]
            );

            // 5. If no more records use this product, delete it from system
            if (usageCheck.rows.length === 0) {
              this.logger.log(`Product ${productId} is no longer used by any listing. Removing from products table.`);
              await client.query(`DELETE FROM products WHERE id = $1`, [productId]);
            }
          }
        });

        successCount++;
      } catch (error: unknown) {
        this.logger.error(`Failed to delete listing ${listingId}: ${getErrorMessage(error)}`);
      }
    }

    return successCount;
  }
}
