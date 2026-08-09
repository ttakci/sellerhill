import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ListingFailureCode,
  ListingJobKind,
  ListingJobStatus,
  ListingStatus,
  ListingTrackingState,
  EbayCallPriority,
  EbayListingApiModel,
  OrderStatus,
  PlatformSettingKey,
  type CreateListingsRequest,
  type ListingDto,
  type ListingJobDto,
  type ListingFailureDetails,
  type ListingJobItemDto,
  type ListingJobsQueryDto,
  type ListingsQueryDto,
  type PaginatedListingJobsDto,
  type PaginatedListingsDto,
  type PaginatedProductsDto,
  type ProductData,
  type ProductIdentifiers,
  type UserProductsQueryDto,
  type UpdateListingRequest,
} from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';
import { PlatformSettingsService } from '../../common/settings/platform-settings.service';
import { QuotaEnforcementService } from '../billing/quota-enforcement.service';
import {
  EbayBulkService,
  type BulkListingDraft,
  type BulkListingOutcome,
} from '../ebay/ebay-bulk.service';
import { EbayService } from '../ebay/ebay.service';

import { summarizeAspectResolution } from './aspect-audit';
import { extractProductAttributes, type KeepaRawProduct } from './keepa-normalizer';
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
  category_path: string | null;
  features: string[] | string | null;
  specs: Record<string, string> | string | null;
  identifiers: ProductIdentifiers | string | null;
  raw_keepa_data?: string | Record<string, unknown> | null;
  manufacturer: string | null;
  stock: number;
  raw_provider_data: string | Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date | string;
}

/**
 * Read a JSONB column that node-pg may hand back either parsed (jsonb) or as a
 * string (older rows written as text). Malformed JSON falls back to the default
 * rather than failing the listing create.
 */
function parseJsonColumn<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
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

/**
 * A draft that passed every local check and holds a quota slot, waiting on the
 * batched write. Carries the resolved store because a bulk call takes exactly
 * one seller token, so drafts have to be grouped by account before anything
 * goes out.
 */
interface PreparedPublish {
  listingId: string;
  accountId: string;
  merchantLocationKey: string;
  ebayAccountId: string | null;
  data: BulkListingDraft['data'];
  draft: BulkListingDraft;
}

/**
 * Per-listing result of a publish run.
 *
 * `error` keeps the original throw rather than a message so the single-listing
 * endpoint can rethrow it and preserve its HTTP status.
 */
interface PublishOutcome {
  listingId: string;
  ok: boolean;
  error?: unknown;
}

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly ebayService: EbayService,
    private readonly ebayBulkService: EbayBulkService,
    private readonly strategyService: ListingStrategyService,
    private readonly quotaEnforcement: QuotaEnforcementService,
    private readonly platformSettings: PlatformSettingsService
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
    /**
     * The SKU eBay knows this listing by, and the offer behind it.
     *
     * Both are what `bulk_update_price_quantity` addresses rows by (migration
     * 067). Recording them at create is the whole point of that migration: the
     * SKU is NOT derivable after the fact — sandbox mints a timestamped one —
     * and without the offer id every price push re-pays a lookup call.
     * Null on drafts, which have neither until they publish.
     */
    sku?: string | null;
    ebayOfferId?: string | null;
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
    ebayCategoryId?: string;
    /** Which layer resolved each item specific (see AspectResolution). */
    aspectResolution?: Record<string, unknown> | null;
    /** Count of specifics filled by the terminal fallback — drives the review badge. */
    aspectAutofilledCount?: number;
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
        ebay_account_id, ebay_category_id, aspect_resolution, aspect_autofilled_count,
        sku, ebay_offer_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23::jsonb, $24, $25, $26)
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
        data.ebayCategoryId || null,
        data.aspectResolution ? JSON.stringify(data.aspectResolution) : null,
        data.aspectAutofilledCount ?? 0,
        data.sku ?? null,
        data.ebayOfferId ?? null,
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
      trackingState: ListingTrackingState.TRACKED,
      importedFromEbay: Boolean((row as ListingQueryRow & { imported_from_ebay?: boolean }).imported_from_ebay),
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
    if (query.trackingState === ListingTrackingState.UNTRACKED) {
      return this.getUntrackedListings(userId, query, page, Math.min(maxLimit, Math.max(1, Number(query.limit) || 20)));
    }
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

  private async getUntrackedListings(
    userId: string,
    query: ListingsQueryDto,
    page: number,
    limit: number
  ): Promise<PaginatedListingsDto> {
    const conditions = [`d.user_id=$1`, `d.tracking_state=$2`, `d.ended_at IS NULL`];
    const params: Array<string | number> = [userId, ListingTrackingState.UNTRACKED];
    if (query.search?.trim()) {
      params.push(`%${query.search.trim()}%`);
      conditions.push(`(d.title ILIKE $${params.length} OR d.ebay_item_id ILIKE $${params.length} OR d.sku ILIKE $${params.length})`);
    }
    if (query.ebayAccountId?.trim()) {
      params.push(query.ebayAccountId.trim());
      conditions.push(`d.ebay_account_id=$${params.length}`);
    }
    const where = conditions.join(' AND ');
    const count = await this.databaseService.query<{ count: string }>(`SELECT COUNT(*)::text count FROM ebay_listing_discoveries d WHERE ${where}`, params);
    const rows = await this.databaseService.query<{
      id: string; user_id: string; ebay_account_id: string; ebay_item_id: string; title: string;
      price: string; quantity: number; quantity_sold: number; image_url: string | null;
      api_model: EbayListingApiModel; discovered_at: Date; last_seen_at: Date;
    }>(`SELECT d.* FROM ebay_listing_discoveries d WHERE ${where} ORDER BY d.last_seen_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, (page - 1) * limit]);
    return {
      items: rows.map((row) => ({
        id: row.id, userId: row.user_id, asin: '', productId: '', title: row.title,
        price: Number(row.price), quantity: row.quantity, imageUrls: row.image_url ? [row.image_url] : [],
        ebayListingId: row.ebay_item_id, listingSettingsGroupId: '', paymentPolicyId: '',
        shippingPolicyId: '', returnPolicyId: '', status: ListingStatus.ACTIVE,
        trackingState: ListingTrackingState.UNTRACKED, ebayApiModel: row.api_model,
        soldCount: row.quantity_sold, ebayAccountId: row.ebay_account_id,
        createdAt: row.discovered_at.toISOString(), updatedAt: row.last_seen_at.toISOString(),
      })),
      total: Number(count[0]?.count ?? 0), page, limit, categories: [],
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
  /**
   * Distinct products behind a user's listings, paginated.
   *
   * Was an unbounded `SELECT DISTINCT` that returned the whole catalog on every
   * page load while the browser sliced ten rows out of it.
   */
  async getUserProducts(userId: string, query: UserProductsQueryDto = {}): Promise<PaginatedProductsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const params: (string | number | null)[] = [userId];
    const conditions = ['l.user_id = $1'];
    const search = query.search?.trim();
    if (search) {
      params.push(`%${search}%`);
      conditions.push(
        `(p.title ILIKE $${params.length} OR p.asin ILIKE $${params.length} OR p.brand ILIKE $${params.length})`
      );
    }

    const fromJoin = `
      FROM products p
      INNER JOIN listings l ON p.id = l.product_id
      WHERE ${conditions.join(' AND ')}
    `;

    // COUNT(DISTINCT p.id) — a product with several listings must count once,
    // matching the DISTINCT in the page query.
    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(DISTINCT p.id)::text AS count ${fromJoin}`,
      params
    );
    const total = parseInt(countResult[0]?.count || '0', 10);

    const results = await this.databaseService.query<ProductQueryRow>(
      `
      SELECT DISTINCT p.*
      ${fromJoin}
      ORDER BY p.created_at DESC, p.id ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );

    const items: ProductData[] = results.map((row) => ({
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

    return { items, total, page, limit };
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
   * Item specifics for a cached product row.
   *
   * Rows cached before attribute extraction existed carry an empty `specs`
   * map. Re-deriving them from the stored raw Keepa payload costs no tokens and
   * means an existing catalog produces full item specifics on the next listing
   * create, instead of waiting for a refresh cycle to touch the row.
   */
  private resolveCachedAttributes(row: ProductQueryRow): {
    specs: Record<string, string>;
    identifiers: ProductIdentifiers;
  } {
    const specs = parseJsonColumn<Record<string, string>>(row.specs, {});
    const identifiers = parseJsonColumn<ProductIdentifiers>(row.identifiers, {});

    if (Object.keys(specs).length > 0 || !row.raw_keepa_data) {
      return { specs, identifiers };
    }

    const raw = parseJsonColumn<KeepaRawProduct | null>(row.raw_keepa_data, null);
    if (!raw) {
      return { specs, identifiers };
    }

    const derived = extractProductAttributes(raw);
    return {
      specs: derived.specs,
      identifiers: Object.keys(identifiers).length > 0 ? identifiers : derived.identifiers,
    };
  }

  /**
   * Get cached product info by ASIN
   */
  async getProductByAsin(asin: string): Promise<{ id: string; data: ProductData } | null> {
    const results = await this.databaseService.query<ProductQueryRow>(
      `
      SELECT id, asin, title, description, price, currency, image_urls, brand, manufacturer,
             category, category_path, features, specs, identifiers, stock,
             raw_provider_data, raw_keepa_data
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
      categoryPath: row.category_path ?? undefined,
      manufacturer: row.manufacturer ?? row.brand ?? undefined,
      features: row.features ? (Array.isArray(row.features) ? row.features : (JSON.parse(String(row.features)) as string[])) : [],
      // Item specifics + catalog identifiers must survive a cache hit; without
      // them a re-listed ASIN published with almost no eBay item specifics.
      ...this.resolveCachedAttributes(row),
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
      INSERT INTO listing_jobs (
        user_id, total_asins, status,
        listing_settings_group_id, payment_policy_id, shipping_policy_id, return_policy_id,
        ebay_account_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `,
      [
        userId,
        toProcess.length,
        toProcess.length === 0 ? ListingJobStatus.COMPLETED : ListingJobStatus.PENDING,
        // Kept so a single failed ASIN can be re-queued later; the BullMQ
        // payload that used to hold these is gone once the job completes.
        request.listingSettingsGroupId,
        request.paymentPolicyId,
        request.shippingPolicyId,
        request.returnPolicyId,
        request.ebayAccountId,
      ]
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
  /**
   * Import jobs for a user, paginated + filtered server-side.
   *
   * This endpoint is polled every 5s by the jobs page, so returning the whole
   * job table (and filtering it in the browser) meant the payload grew without
   * bound for the life of the account.
   */
  async getJobs(userId: string, query: ListingJobsQueryDto = {}): Promise<PaginatedListingJobsDto> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const offset = (page - 1) * limit;

    const params: (string | number | null)[] = [userId];
    const conditions = ['user_id = $1'];

    const status = typeof query.status === 'string' ? query.status.trim() : query.status;
    if (status) {
      params.push(String(status).toLowerCase());
      conditions.push(`LOWER(status) = $${params.length}`);
    }

    // The UI searches by the short id shown on the card, which is a prefix of
    // the uuid — so match against the text form rather than casting the input.
    const search = query.search?.trim();
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      conditions.push(`LOWER(id::text) LIKE $${params.length}`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM listing_jobs ${whereClause}`,
      params
    );
    const total = parseInt(countResult[0]?.count || '0', 10);

    const results = await this.databaseService.query<ListingJobEntity>(
      `
      SELECT * FROM listing_jobs
      ${whereClause}
      ORDER BY created_at DESC, id ASC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `,
      [...params, limit, offset]
    );

    return { items: results.map((row) => this.mapJobToDto(row)), total, page, limit };
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
    // The refresh cadence is operator-tunable at runtime (admin → Settings), and
    // RefreshProcessorService already honours it. This path used to hardcode
    // 12 hours, so lowering the interval in the panel silently applied to the
    // existing catalog but not to anything created afterwards.
    const intervalMinutes = await this.platformSettings.getNumber(
      PlatformSettingKey.KEEPA_REFRESH_INTERVAL_MINUTES
    );

    const result = await this.databaseService.query<{ id: string }>(
      `
      INSERT INTO products (
        asin, title, price, currency, image_urls, description,
        brand, manufacturer, category, features, specs, identifiers,
        stock, raw_provider_data, raw_keepa_data, category_path, next_refresh_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
              NOW() + make_interval(mins => $17::int))
      ON CONFLICT (asin) DO UPDATE SET
        title = EXCLUDED.title,
        price = EXCLUDED.price,
        currency = EXCLUDED.currency,
        image_urls = EXCLUDED.image_urls,
        description = EXCLUDED.description,
        brand = EXCLUDED.brand,
        manufacturer = COALESCE(EXCLUDED.manufacturer, products.manufacturer),
        category = EXCLUDED.category,
        features = EXCLUDED.features,
        -- Attribute maps only ever grow richer: a later fetch that resolved
        -- fewer specs must not erase specifics an earlier one captured.
        specs = CASE WHEN EXCLUDED.specs = '{}'::jsonb THEN products.specs ELSE EXCLUDED.specs END,
        identifiers = CASE WHEN EXCLUDED.identifiers = '{}'::jsonb
                           THEN products.identifiers ELSE EXCLUDED.identifiers END,
        stock = EXCLUDED.stock,
        raw_provider_data = EXCLUDED.raw_provider_data,
        raw_keepa_data = COALESCE(EXCLUDED.raw_keepa_data, products.raw_keepa_data),
        -- Keep the last known path when a fetch resolved none, same grow-only
        -- rule as specs/identifiers: an absent category tree is not evidence
        -- the product left its niche.
        category_path = COALESCE(EXCLUDED.category_path, products.category_path),
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
        productData.manufacturer || null,
        productData.category || productData.manufacturer || null,
        JSON.stringify(productData.features || []),
        JSON.stringify(productData.specs || {}),
        JSON.stringify(productData.identifiers || {}),
        productData.stock || 0,
        JSON.stringify(productData.raw || productData),
        productData.rawKeepaData ? JSON.stringify(productData.rawKeepaData) : null,
        productData.categoryPath || null,
        intervalMinutes,
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
      failureCode?: ListingFailureCode;
      failureDetails?: ListingFailureDetails;
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
          failure_code = $8,
          failure_details = $9::jsonb,
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
        data.failureCode || null,
        data.failureDetails ? JSON.stringify(data.failureDetails) : null,
      ]
    );

    await this.updateJobCounts(jobId);
  }

  // getJobItemForRetry / resetJobItemForRetry were REMOVED (2026-08-09) with
  // the seller-facing per-item retry. eBay quota is metered per application, so
  // re-attempting an item whose input eBay already rejected spends a shared
  // resource on the case with the lowest chance of succeeding.

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

    // CANCELLED is terminal and set deliberately by the seller, so counts keep
    // updating (an in-flight batch may still land) but the status must not be
    // recomputed back to PROCESSING/COMPLETED/FAILED underneath them.
    await this.databaseService.query(
      `
      UPDATE listing_jobs
      SET processed_count = $1,
          success_count = $2,
          failed_count = $3,
          status = CASE WHEN status = $6 THEN status ELSE $4 END,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
    `,
      [processed, success, failed, jobStatus, jobId, ListingJobStatus.CANCELLED]
    );
  }

  /**
   * Has the seller stopped this job?
   *
   * Checked by the worker before each batch. This — not queue surgery — is what
   * actually stops the work: BullMQ jobs are enqueued without stable ids, so
   * finding and removing them would mean scanning the whole shared queue on
   * every cancel. Letting the already-queued jobs drain as one-DB-read no-ops
   * is bounded and cannot miss a job.
   */
  async isJobCancelled(jobId: string): Promise<boolean> {
    const rows = await this.databaseService.query<{ status: ListingJobStatus }>(
      `SELECT status FROM listing_jobs WHERE id = $1`,
      [jobId]
    );
    return rows[0]?.status === ListingJobStatus.CANCELLED;
  }

  /**
   * Stop a running job: nothing already published is touched, everything not
   * yet processed is closed out.
   *
   * Returns the job-item ids that were still holding a billing reservation, so
   * the caller can release them — a slot reserved for an ASIN we will never
   * list must not stay counted against the seller's plan.
   */
  async cancelJob(userId: string, jobId: string): Promise<{ cancelledItemIds: string[] }> {
    const jobs = await this.databaseService.query<{ status: ListingJobStatus }>(
      `SELECT status FROM listing_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );
    const job = jobs[0];
    if (!job) {
      throw new NotFoundException('Listing job not found');
    }
    if (
      job.status === ListingJobStatus.COMPLETED ||
      job.status === ListingJobStatus.FAILED ||
      job.status === ListingJobStatus.CANCELLED
    ) {
      throw new BadRequestException('This job has already finished.');
    }

    // Close out only items that have not reached a terminal state. An ASIN that
    // already published keeps its ACTIVE row and its listing — "what went out,
    // went out".
    const cancelled = await this.databaseService.query<{ id: string }>(
      `UPDATE listing_job_items
       SET status = $1,
           failure_code = $2,
           failure_details = '{"retryable": false}'::jsonb,
           error_message = 'Cancelled by the seller before this ASIN was processed.',
           updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $3 AND status NOT IN ($4, $1)
       RETURNING id`,
      [
        ListingStatus.ERROR,
        ListingFailureCode.CANCELLED,
        jobId,
        ListingStatus.ACTIVE,
      ]
    );

    await this.databaseService.query(
      `UPDATE listing_jobs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [ListingJobStatus.CANCELLED, jobId]
    );
    await this.updateJobCounts(jobId);

    this.logger.log(`Job ${jobId} cancelled by user ${userId}; ${cancelled.length} pending item(s) stopped`);
    return { cancelledItemIds: cancelled.map((row) => row.id) };
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
      kind: (entity.kind ?? ListingJobKind.CREATE) as ListingJobKind,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
    };
  }

  /**
   * Map job item entity to DTO
   */
  /**
   * Customer-facing job item.
   *
   * The raw provider text in `error_message` is deliberately NOT mapped: it is
   * eBay's or Keepa's own wording (SKUs, error ids, internal field names) and
   * means nothing to a seller, who needs to know what to DO. The UI renders the
   * localized message for `failureCode` instead, and the raw text stays in the
   * database for the operator panel (`GET /v1/admin/listing-failures`).
   *
   * A row with no `failureCode` — written before the taxonomy existed — falls
   * back to the generic "could not be created" copy rather than leaking the
   * provider string.
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
      failureCode:
        (entity.failure_code as ListingFailureCode) ||
        (entity.error_message ? ListingFailureCode.UNKNOWN : undefined),
      failureDetails: entity.failure_details
        ? parseJsonColumn<ListingFailureDetails>(entity.failure_details, {})
        : undefined,
      createdAt: entity.created_at.toISOString(),
      updatedAt: entity.updated_at.toISOString(),
    };
  }

  /**
   * Publish a draft listing to eBay (create live offer + mark ACTIVE).
   */
  async publishListing(userId: string, listingId: string): Promise<ListingDto> {
    const [outcome] = await this.publishDrafts(userId, [listingId]);

    if (!outcome || !outcome.ok) {
      // Rethrown as-is so NotFound/BadRequest keep the status codes this
      // endpoint has always returned; the batched caller records them per item.
      const error = outcome?.error;
      throw error instanceof Error ? error : new BadRequestException(String(error ?? 'Publish failed'));
    }

    const updated = await this.getListing(userId, listingId);
    if (!updated) {
      throw new NotFoundException('Listing not found after publish');
    }
    return updated;
  }

  /**
   * Bulk publish draft listings. Continues on individual failures.
   */
  async publishListings(userId: string, listingIds: string[]): Promise<number> {
    const outcomes = await this.publishDrafts(userId, listingIds);
    return outcomes.filter((outcome) => outcome.ok).length;
  }

  /**
   * Publish drafts through the same batched create the listing queue uses.
   *
   * There is ONE create implementation. The per-listing path this replaced was
   * a second one: it rebuilt the same eBay bodies, ran its own aspect self-heal
   * loop, and spent three calls per draft — 100 drafts cost 300 calls where a
   * batch costs 12 — while charging the call budget nothing at all, so draft
   * publishing was invisible to the quota governor. Two implementations of the
   * rules that have each broken live listings once (GTIN check digits, the
   * BrandMPN pair, tag-safe truncation) is precisely the drift
   * `listing-invariants.guard.spec.ts` exists to prevent.
   *
   * Preparation stays per listing: a draft carries seller edits (its title, and
   * price/quantity locks) that a shared write path must not flatten.
   */
  private async publishDrafts(userId: string, listingIds: string[]): Promise<PublishOutcome[]> {
    const outcomes: PublishOutcome[] = [];
    // A bulk call carries exactly one seller token, so drafts are grouped by
    // the store they publish through before anything is written.
    const byAccount = new Map<string, PreparedPublish[]>();
    const locationKeys = new Map<string, string>();

    for (const listingId of listingIds) {
      try {
        const prepared = await this.prepareDraftForPublish(userId, listingId);
        byAccount.set(prepared.accountId, [...(byAccount.get(prepared.accountId) ?? []), prepared]);
        locationKeys.set(prepared.accountId, prepared.merchantLocationKey);
      } catch (error: unknown) {
        this.logger.error(`Failed to publish listing ${listingId}: ${getErrorMessage(error)}`);
        outcomes.push({ listingId, ok: false, error });
      }
    }

    for (const [accountId, prepared] of byAccount) {
      outcomes.push(
        ...(await this.writePreparedPublishes(
          userId,
          accountId,
          locationKeys.get(accountId) ?? 'default',
          prepared
        ))
      );
    }

    return outcomes;
  }

  /**
   * Everything a draft needs settled before eBay is written to.
   *
   * Makes no write call. The quota slot is reserved here because the reserve
   * must precede the publish it guards, and is handed straight back if the
   * (read-only) category and aspect resolution then fails.
   */
  private async prepareDraftForPublish(userId: string, listingId: string): Promise<PreparedPublish> {
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
      const draft = await this.ebayService.prepareListingDraft(
        userId,
        listingData,
        listing.asin,
        ebayAccountId ?? undefined
      );

      return {
        listingId,
        accountId: draft.accountId,
        merchantLocationKey: draft.merchantLocationKey,
        ebayAccountId,
        data: listingData,
        draft: {
          key: listingId,
          asin: listing.asin,
          sku: draft.sku,
          data: listingData,
          policies: {
            paymentId: listing.paymentPolicyId,
            shippingId: listing.shippingPolicyId,
            returnId: listing.returnPolicyId,
          },
          categoryId: draft.categoryId,
          categoryName: draft.categoryName,
          categoryAspects: draft.categoryAspects,
          resolution: draft.resolution,
        },
      };
    } catch (error: unknown) {
      // Nothing was written, so the held slot goes back rather than blocking
      // the next attempt at a listing that does not exist yet.
      await this.quotaEnforcement.releaseForPublish(userId, listingId);
      throw error;
    }
  }

  /**
   * Write one store's prepared drafts to eBay and record what landed.
   *
   * Every prepared draft has to end terminal: a slot released on failure, or
   * consumed against a real eBay item id. An item eBay never answered for is a
   * failure, never a silent skip — the same rule the batch worker applies.
   */
  private async writePreparedPublishes(
    userId: string,
    accountId: string,
    merchantLocationKey: string,
    prepared: PreparedPublish[]
  ): Promise<PublishOutcome[]> {
    const outcomes: PublishOutcome[] = [];
    const byKey = new Map(prepared.map((item) => [item.listingId, item]));

    let results: BulkListingOutcome[];
    try {
      results = await this.ebayBulkService.createListings(
        accountId,
        merchantLocationKey,
        prepared.map((item) => item.draft),
        // A seller is waiting on this one, so it draws against the full daily
        // ceiling rather than the background reserve.
        EbayCallPriority.INTERACTIVE
      );
    } catch (error: unknown) {
      // Transport failure: nothing in this group landed.
      for (const item of prepared) {
        await this.quotaEnforcement.releaseForPublish(userId, item.listingId);
        this.logger.error(`Failed to publish listing ${item.listingId}: ${getErrorMessage(error)}`);
        outcomes.push({ listingId: item.listingId, ok: false, error });
      }
      return outcomes;
    }

    const answered = new Set<string>();
    for (const result of results) {
      const item = byKey.get(result.key);
      if (!item) {
        this.logger.error(`Bulk create answered for ${result.key}, which this publish did not send`);
        continue;
      }
      answered.add(result.key);

      if (!result.ok || !result.listingId) {
        // A published row with an empty eBay item id is unrepairable: it does
        // not exist on eBay, order sync keys on that column, and the ASIN then
        // counts as already listed. Leave the listing a DRAFT instead.
        await this.quotaEnforcement.releaseForPublish(userId, item.listingId);
        const error = new Error(result.error ?? 'eBay did not return a listing id for this item.');
        if (result.errorName) {
          // Restores the typed failure the classifier keys on.
          error.name = result.errorName;
        }
        this.logger.error(`Failed to publish listing ${item.listingId}: ${error.message}`);
        outcomes.push({ listingId: item.listingId, ok: false, error });
        continue;
      }

      try {
        await this.markDraftPublished(userId, item, result);
        outcomes.push({ listingId: item.listingId, ok: true });
      } catch (error: unknown) {
        await this.quotaEnforcement.releaseForPublish(userId, item.listingId);
        this.logger.error(
          `Listing ${item.listingId} published to eBay as ${result.listingId} but could not be ` +
            `recorded locally: ${getErrorMessage(error)}`
        );
        outcomes.push({ listingId: item.listingId, ok: false, error });
      }
    }

    for (const item of prepared) {
      if (answered.has(item.listingId)) {
        continue;
      }
      await this.quotaEnforcement.releaseForPublish(userId, item.listingId);
      const error = new Error('eBay returned no result for this item in the bulk response.');
      this.logger.error(`Failed to publish listing ${item.listingId}: ${error.message}`);
      outcomes.push({ listingId: item.listingId, ok: false, error });
    }

    return outcomes;
  }

  /** Flip a draft row to ACTIVE against the eBay item id that now exists. */
  private async markDraftPublished(
    userId: string,
    item: PreparedPublish,
    result: BulkListingOutcome
  ): Promise<void> {
    const aspectAudit = summarizeAspectResolution(result.resolution);

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
          ebay_category_id = $13,
          aspect_resolution = $14::jsonb,
          aspect_autofilled_count = $15,
          -- A draft had neither until now. The SKU is not derivable after the
          -- fact (sandbox timestamps it) and the offer id would otherwise cost
          -- a lookup call on every later price push — migration 067's point.
          sku = $16,
          ebay_offer_id = $17,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $11 AND user_id = $12
      `,
      [
        result.listingId,
        item.data.price,
        item.data.quantity,
        item.data.purchasePrice ?? 0,
        item.data.estimatedProfit ?? 0,
        item.data.profitMargin ?? 0,
        item.data.roi ?? 0,
        item.data.title,
        result.categoryName || '',
        item.ebayAccountId,
        item.listingId,
        userId,
        result.categoryId,
        JSON.stringify(aspectAudit.summary),
        aspectAudit.autofilledCount,
        item.draft.sku,
        result.offerId ?? null,
      ]
    );

    // Publish succeeded — consume the reservation (idempotent, fail-soft).
    this.quotaEnforcement.consumeForPublish(userId, item.listingId);
    this.logger.log(`Published draft ${item.listingId} as eBay item ${result.listingId}`);
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
