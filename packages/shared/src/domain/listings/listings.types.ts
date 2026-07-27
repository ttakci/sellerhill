/**
 * Listings Domain Types
 */

/**
 * eBay Business Policy Type
 */
export enum PolicyType {
  PAYMENT = 'payment',
  SHIPPING = 'shipping',
  RETURN = 'return',
}

/**
 * Listing Status
 */
export enum ListingStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  RETRYING = 'retrying',
}

/**
 * Listing Job Status
 */
export enum ListingJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Listing DTO
 */
export interface ListingDto {
  id: string;
  userId: string;
  asin: string;
  productId: string;
  title: string;
  description?: string;
  price: number;
  quantity: number;
  imageUrls: string[];
  ebayListingId?: string;
  listingSettingsGroupId: string;
  /** Resolved group name (detail / enriched payloads). */
  listingSettingsGroupName?: string;
  paymentPolicyId: string;
  shippingPolicyId: string;
  returnPolicyId: string;
  status: ListingStatus;
  purchasePrice?: number;
  estimatedProfit?: number;
  profitMargin?: number;
  roi?: number;
  soldCount?: number;
  watchCount?: number;
  viewCount?: number;
  category?: string;
  brand?: string;
  manufacturer?: string;
  /** Keepa bullet features (product content). */
  features?: string[];
  /** Structured item specs (Brand, Model, …) for detail + eBay aspects. */
  specs?: Record<string, string>;
  sourceStock?: number;
  /** eBay account / store this listing belongs to (multi-store). */
  ebayAccountId?: string;
  /** Latest matched order date for this listing (from orders.listing_id). */
  lastSaleAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Per-listing overrides (easync-style) */
  disableOrdering?: boolean;
  disableRepricing?: boolean;
  lockPrice?: boolean;
  lockQuantity?: boolean;
  priceOverride?: number | null;
  quantityOverride?: number | null;
  marginPercentOverride?: number | null;
  marginFixedOverride?: number | null;
}

/**
 * Partial update for a single listing (detail page customizations).
 * All fields optional; only provided keys are applied.
 */
export interface UpdateListingRequest {
  title?: string;
  listingSettingsGroupId?: string;
  paymentPolicyId?: string;
  shippingPolicyId?: string;
  returnPolicyId?: string;
  disableOrdering?: boolean;
  disableRepricing?: boolean;
  lockPrice?: boolean;
  lockQuantity?: boolean;
  priceOverride?: number | null;
  quantityOverride?: number | null;
  marginPercentOverride?: number | null;
  marginFixedOverride?: number | null;
}

/**
 * Listing Job DTO (tracks bulk listing creation)
 */
export interface ListingJobDto {
  id: string;
  userId: string;
  totalAsins: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  status: ListingJobStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Listing Job Item DTO (individual ASIN in a job)
 */
export interface ListingJobItemDto {
  id: string;
  jobId: string;
  asin: string;
  productId?: string;
  listingId?: string;
  status: ListingStatus;
  ebayItemId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Create Listings Request (Bulk)
 */
export interface CreateListingsRequest {
  asins: string[];
  listingSettingsGroupId: string;
  paymentPolicyId: string;
  shippingPolicyId: string;
  returnPolicyId: string;
  /**
   * When true, prepare product + pricing in DB as draft listings
   * without publishing to eBay. User can publish later from detail / drafts list.
   */
  asDraft?: boolean;
}

/**
 * eBay Business Policy DTO
 */
export interface EbayBusinessPolicyDto {
  id: string;
  name: string;
  description?: string;
  type: PolicyType;
}

/**
 * Server-side listings list query (pagination + filter + sort).
 * Mirrors orders list pattern — never load the full catalog for table UIs.
 */
/** Stock/preset filter used by listings all (easync-style). in_stock = quantity > 0, oos = quantity = 0. */
export const LISTINGS_STOCK_PRESETS = ['all', 'in_stock', 'oos'] as const;
export type ListingsStockPreset = (typeof LISTINGS_STOCK_PRESETS)[number];

/** Type guard for query-param parsing (raw string -> ListingsStockPreset | undefined). */
export function isListingsStockPreset(value: unknown): value is ListingsStockPreset {
  return typeof value === 'string' && (LISTINGS_STOCK_PRESETS as readonly string[]).includes(value);
}

export interface ListingsQueryDto {
  page?: number;
  /** Page size (default 20, max 100 for UI; export may use higher via dedicated path later). */
  limit?: number;
  search?: string;
  status?: ListingStatus | string;
  /**
   * @deprecated Prefer quantityMin/quantityMax — kept for API compat; FE no longer sends this.
   * in_stock = quantity > 0, oos = quantity = 0
   */
  stockPreset?: ListingsStockPreset;
  /** Filter by connected eBay store (ebay_accounts.id). */
  ebayAccountId?: string;
  category?: string;
  /** FE column key or DB field — server maps/whitelists. */
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  priceMin?: number;
  priceMax?: number;
  purchasePriceMin?: number;
  purchasePriceMax?: number;
  estimatedProfitMin?: number;
  estimatedProfitMax?: number;
  roiMin?: number;
  roiMax?: number;
  profitMarginMin?: number;
  profitMarginMax?: number;
  soldCountMin?: number;
  soldCountMax?: number;
  watchCountMin?: number;
  watchCountMax?: number;
  viewCountMin?: number;
  viewCountMax?: number;
  quantityMin?: number;
  quantityMax?: number;
  sourceStockMin?: number;
  sourceStockMax?: number;
  /**
   * Listings that have ≥1 non-cancelled order with order_date in [soldFrom, soldTo].
   * ISO date strings (YYYY-MM-DD). Used for dashboard period filters.
   */
  soldFrom?: string;
  soldTo?: string;
}

/**
 * Paginated listings response.
 */
export interface PaginatedListingsDto {
  items: ListingDto[];
  total: number;
  page: number;
  limit: number;
  /** Distinct categories for filter dropdown (current user). */
  categories: string[];
}

/**
 * Listing Queue Job Data
 */
export interface ListingQueueJobData {
  jobId: string;
  userId: string;
  asin: string;
  listingSettingsGroupId: string;
  paymentPolicyId: string;
  shippingPolicyId: string;
  returnPolicyId: string;
  /** Skip eBay publish; store listing as draft. */
  asDraft?: boolean;
  /**
   * The `listing_job_items.id` for this ASIN. Used by the worker to
   * consume/release the billing-quota reservation keyed on this id.
   * Always present when the job is created via the standard queue-service path.
   */
  listingJobItemId?: string;
}

/**
 * Listing Creation Data - used by eBay service for creating listings
 * Replaces `any` types in eBay service methods
 */
export interface ListingCreationData {
  title: string;
  description: string;
  brand: string;
  specs?: Record<string, string>;
  features?: string[];
  quantity: number;
  imageUrls: string[];
  price: number;
  currency: string;
  country: string;
  postalCode?: string;
  location?: string;
  address1?: string;
  // Calculated metrics
  purchasePrice?: number;
  estimatedProfit?: number;
  profitMargin?: number;
  roi?: number;
}
