/**
 * Listings Domain Types
 */

import type { ProductData, ProductIdentifiers } from '../products/product-data.types';

import type { ListingFailureCode, ListingFailureDetails } from './listing-failure.types';

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

export enum ListingTrackingState {
  TRACKED = 'tracked',
  UNTRACKED = 'untracked',
}

export enum EbayListingApiModel {
  LEGACY = 'legacy',
  INVENTORY = 'inventory',
  UNKNOWN = 'unknown',
}

/**
 * Listing Job Status
 */
export enum ListingJobKind {
  CREATE = 'create',
  EXISTING_IMPORT = 'existing_import',
}

export enum ListingJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  /**
   * Stopped by the seller. Terminal, and NOT a failure.
   *
   * Whatever had already been published stays published — cancelling stops the
   * remaining ASINs, it does not undo the ones that already cost eBay quota.
   */
  CANCELLED = 'cancelled',
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
  /** Selling currency resolved from the listing's eBay store marketplace. */
  currency: string;
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
  trackingState: ListingTrackingState;
  ebayApiModel?: EbayListingApiModel;
  importedFromEbay?: boolean;
  purchasePrice?: number;
  estimatedProfit?: number;
  profitMargin?: number;
  roi?: number;
  soldCount?: number;
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
  kind: ListingJobKind;
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
  createdAt: string;
  updatedAt: string;
  /**
   * Structured reason this item failed; the ONLY failure signal a seller sees.
   *
   * The raw provider text is intentionally absent from this DTO — it is eBay's
   * internal wording and is exposed to operators only, via the admin listing
   * failures panel.
   */
  failureCode?: ListingFailureCode;
  failureDetails?: ListingFailureDetails;
}

/**
 * Create Listings Request (Bulk)
 */
export interface CreateListingsRequest {
  asins: string[];
  ebayAccountId: string;
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
  trackingState?: ListingTrackingState;
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
  /**
   * Active listings whose source product is quarantined
   * (`products.consecutive_failures >= LISTING_SOURCE_UNAVAILABLE_FAILURE_THRESHOLD`).
   * Deep-link-only filter for the Action Center's `LISTING_SOURCE_UNAVAILABLE`
   * item — not exposed as its own UI control, same as `soldFrom`/`soldTo`.
   */
  sourceUnavailable?: boolean;
}

/**
 * Consecutive Keepa refresh failures before a listing's source product counts
 * as "unavailable at the source" (usually delisted). Mirrors the refresh
 * pipeline's quarantine default (`KEEPA_REFRESH_MAX_FAILURES`). Shared so the
 * Action Center's count and the `sourceUnavailable` listings filter it links
 * to can never disagree about which listings qualify.
 */
export const LISTING_SOURCE_UNAVAILABLE_FAILURE_THRESHOLD = 5;

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

export interface EbayListingSyncResult {
  discovered: number;
  untracked: number;
  ended: number;
}

export interface ListingImportDefaults {
  listingSettingsGroupId: string;
  paymentPolicyId: string;
  shippingPolicyId: string;
  returnPolicyId: string;
}

export interface ListingImportResult {
  jobId: string;
  total: number;
}

/**
 * Query for `GET /listings/jobs`.
 *
 * Jobs used to be returned as an unbounded array and filtered/sliced in the
 * browser, so an account with a long import history downloaded (and re-polled
 * every 5s) its entire job table to show ten rows.
 */
export interface ListingJobsQueryDto {
  page?: number;
  /** Page size (default 20, clamped to 100). */
  limit?: number;
  /** Matches an ASIN among the job's items — a job has no other seller-meaningful id of its own. */
  search?: string;
  status?: ListingJobStatus | string;
  /** Inclusive `YYYY-MM-DD` lower bound on the job's created date, from the date-range preset filter. */
  dateFrom?: string;
  /** Inclusive `YYYY-MM-DD` upper bound on the job's created date. */
  dateTo?: string;
  /**
   * Jobs with `failed_count > 0`. Distinct from `status=failed` — a job is
   * only marked FAILED when EVERY item failed, so a batch with 24 successes
   * and 1 failure stays COMPLETED and would be invisible to a status filter.
   * Deep-link target for the Action Center's `LISTING_JOB_FAILURES` item.
   */
  hasFailures?: boolean;
}

/**
 * Date-range presets for the jobs list filter (`?datePreset=`). A free-text
 * search box is not how anyone discovers "type a date to filter" — this is a
 * discoverable dropdown instead, resolved to `dateFrom`/`dateTo` client-side.
 */
export enum ListingJobDatePreset {
  ALL = 'all',
  TODAY = 'today',
  LAST_7_DAYS = 'last7Days',
  LAST_30_DAYS = 'last30Days',
  THIS_MONTH = 'thisMonth',
}

/** Paginated listing-jobs response. */
export interface PaginatedListingJobsDto {
  items: ListingJobDto[];
  total: number;
  page: number;
  limit: number;
}

/**
 * One price/quantity change, written only when the value actually moved (see
 * `ProductSyncService.recordRevisions`) — never a per-refresh-tick no-op row.
 */
export interface ListingRevisionDto {
  id: string;
  previousPrice: number;
  newPrice: number;
  previousQuantity: number;
  newQuantity: number;
  recordedAt: string;
}

/** Query for `GET /listings/:id/revisions`. */
export interface ListingRevisionsQueryDto {
  page?: number;
  /** Page size (default 20, clamped to 100). */
  limit?: number;
}

/** Paginated listing-revisions response. */
export interface PaginatedListingRevisionsDto {
  items: ListingRevisionDto[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Query for `GET /listings/products`.
 * Same rationale as `ListingJobsQueryDto` — the products endpoint returned the
 * user's whole distinct-product catalog on every page load.
 */
export interface UserProductsQueryDto {
  page?: number;
  /** Page size (default 20, clamped to 100). */
  limit?: number;
  /** Matches product title, ASIN or brand. */
  search?: string;
}

/** Paginated user-products response. */
export interface PaginatedProductsDto {
  items: ProductData[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Listing Queue Job Data
 */
export interface ExistingListingImportQueueData {
  kind: ListingJobKind.EXISTING_IMPORT;
  jobId: string;
  listingJobItemId: string;
  userId: string;
  asin: string;
  ebayItemId: string;
  ebayAccountId: string;
  listingSettingsGroupId: string;
  paymentPolicyId: string;
  shippingPolicyId: string;
  returnPolicyId: string;
}

/**
 * Listing Creation Data - used by eBay service for creating listings
 * Replaces `any` types in eBay service methods
 */
/**
 * A chunk of ASINs created together through eBay's bulk Inventory endpoints.
 *
 * Every ASIN in a listing job shares one eBay store (store selection is
 * mandatory on step 1), so the producer can chunk the known set up front — 25
 * is eBay's per-call maximum. There is deliberately NO accumulation window:
 * a job of 3 ASINs ships one call with 3 entries immediately rather than
 * waiting for a 25th that may never come.
 *
 * Discriminated by the BullMQ job name (`create-listing-batch`), not by
 * `ListingJobKind`, which maps to a DB column describing the job's origin.
 */
export interface ListingBatchQueueJobData {
  jobId: string;
  userId: string;
  ebayAccountId: string;
  listingSettingsGroupId: string;
  paymentPolicyId: string;
  shippingPolicyId: string;
  returnPolicyId: string;
  /**
   * Drafts run through the same batch, they just stop before the eBay writes.
   *
   * A draft costs ZERO eBay calls — the quota is paid once, later, at publish —
   * so batching them buys no quota. It exists so there is one create pipeline
   * instead of two: same duplicate check, same Keepa resolution, same pricing
   * and content rules, with the write stage skipped.
   */
  asDraft: boolean;
  items: Array<{ asin: string; listingJobItemId: string }>;
}

export interface ListingCreationData {
  title: string;
  description: string;
  brand: string;
  specs?: Record<string, string>;
  /** UPC/EAN/MPN/model — sent to eBay for catalog matching + identifier aspects. */
  identifiers?: ProductIdentifiers;
  asin?: string;
  /** Amazon leaf category name, used as a category-resolution hint. */
  category?: string;
  /** Full Amazon category path — the key the eBay category mapping is cached under. */
  categoryPath?: string;
  features?: string[];
  quantity: number;
  imageUrls: string[];
  price: number;
  currency: string;
  // Seller address, resolved from store settings (Store > Global). eBay builds
  // the inventory location from these; a `STORE` location requires ALL of
  // addressLine1 + city + stateOrProvince + postalCode + country.
  country: string;
  postalCode?: string;
  /** State / province. Was ALSO used as the city for a long time — eBay
   *  received `city === stateOrProvince` on every listing — which is why `city`
   *  below exists as its own field. */
  location?: string;
  city?: string;
  /** Derived by `buildStoreStreetLine`, not collected from the seller. Empty
   *  only when city and state are both missing, which
   *  `isStoreAddressComplete` already refuses. */
  address1?: string;
  // Calculated metrics
  purchasePrice?: number;
  estimatedProfit?: number;
  profitMargin?: number;
  roi?: number;
}
