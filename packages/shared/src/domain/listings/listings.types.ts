/**
 * Listings Domain Types
 */

import type { ProductData, ProductIdentifiers } from '../products/product-data.types';
import type { SourceStockStatus } from '../products/source-product.types';

import type { ListingFailureCode, ListingFailureDetails } from './listing-failure.types';
import type { ListingSchedule } from './listing-schedule';

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
 * Why SellerHill ended a listing on its own (the seller's clean-up rules).
 * Absent on a listing the seller ended, or one eBay reported gone.
 */
export enum ListingAutoEndReason {
  /** Stayed at quantity 0 for the seller's configured number of days. */
  OUT_OF_STOCK = 'out_of_stock',
  /** No sale within the seller's configured window. */
  NOT_SELLING = 'not_selling',
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
  /**
   * Draft → live publish. Written synchronously by the drafts page's bulk
   * publish (no BullMQ worker — the seller is waiting), purely as a record so
   * per-item failures get the same job-detail view as create/import.
   */
  PUBLISH = 'publish',
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
  /** How precisely `sourceStock` is known (exact / at-least / out-of-stock). */
  sourceStockStatus?: SourceStockStatus;
  /** True when the Amazon source product page is no longer reachable (404). */
  sourceRemoved?: boolean;
  /** eBay account / store this listing belongs to (multi-store). */
  ebayAccountId?: string;
  /** Latest matched order date for this listing (from orders.listing_id). */
  lastSaleAt?: string | null;
  /** When the Amazon source product was last read successfully (a check, whether or not anything changed). */
  lastSyncedAt?: string | null;
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
  /** Campaign joined through this listing's own eBay store; present on detail reads. */
  adCampaign?: {
    campaignId: string;
    name: string;
    status: string;
    fundingModel: string | null;
    adRateStrategy: string | null;
    adRate: number | null;
    appliedAdRate: number;
  } | null;
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
  /**
   * ASINs dropped from THIS submission because they were already ACTIVE or
   * DRAFT for the user — never counted in `totalAsins`, no job item written.
   * Only meaningful on `createJob`'s own response; a later read of the job
   * (status polling, the jobs list) leaves it undefined.
   */
  skippedDuplicateCount?: number;
  /** When the last group of a scheduled job is due to start (ISO). Absent on a job that runs at once. */
  scheduledUntil?: string;
  /**
   * The eBay store the job works on (`listing_jobs.ebay_account_id`). Null on
   * a job written without one (a publish run spanning stores, or a row older
   * than the column).
   */
  ebayAccountId: string | null;
}

/**
 * Listing Job Item DTO (individual ASIN in a job)
 */
export interface ListingJobItemDto {
  id: string;
  jobId: string;
  asin: string;
  /** Product identity used by the same card/row anatomy as the listings screen. */
  productTitle?: string;
  imageUrls?: string[];
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
  /**
   * When the item completed, the listing it became — the same record the
   * listings screen renders, so a completed job card IS a listing card.
   * Absent on failed / queued items.
   */
  listing?: ListingDto | null;
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
  /**
   * Spread the job over time instead of running it at once: at most `perDay`
   * products a day, inside a daily window. Absent (or unusable) = run now.
   * See `listing-schedule.ts`.
   */
  schedule?: ListingSchedule;
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
  /** Listings created in [createdFrom, createdTo] (ISO dates, createdTo inclusive). */
  createdFrom?: string;
  createdTo?: string;
  /**
   * Active listings whose source product is quarantined
   * (`products.consecutive_failures >= LISTING_SOURCE_UNAVAILABLE_FAILURE_THRESHOLD`).
   * Deep-link-only filter for the Action Center's `LISTING_SOURCE_UNAVAILABLE`
   * item — not exposed as its own UI control, same as `soldFrom`/`soldTo`.
   */
  sourceUnavailable?: boolean;
  /**
   * Listings with no sale inside the seller's own "not selling" window
   * (`ListingRulesConfig.coldListingDays`). Deep-link-only filter for the
   * Action Center's `LISTING_NOT_SELLING` item; matches nothing while the
   * seller is not watching.
   */
  notSelling?: boolean;
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
  /** Only jobs of this eBay store (`listing_jobs.ebay_account_id`). A UUID; anything else is a 400. */
  ebayAccountId?: string;
  /** Frontend column key; the API maps it to a fixed SQL expression. */
  sortBy?: 'status' | 'progress' | 'stats' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
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
 * One price/quantity revision. Either a real change (`ProductSyncService.recordRevisions`)
 * or a "checked, nothing moved" row with previous = new
 * (`ProductSyncService.recordUnchangedChecks`) that shows the refresh ran.
 */
export interface ListingRevisionDto {
  id: string;
  previousPrice: number;
  newPrice: number;
  /** The quantity sent to eBay (the quantity formula's result), before / after. */
  previousQuantity: number;
  newQuantity: number;
  /**
   * The AMAZON stock the product carried at this check, before / after
   * (migration 134). `previous*` is what the listing's prior revision
   * recorded; both are `null` on rows written before the column existed.
   * The status is what makes "20+" render as "20+" (`formatSourceStock`).
   */
  previousSourceStock: number | null;
  previousSourceStockStatus: SourceStockStatus | null;
  newSourceStock: number | null;
  newSourceStockStatus: SourceStockStatus | null;
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
  /**
   * The product's own `last_successful_refresh_at`, regardless of whether it
   * produced a revision. Lets the drawer say "checked, no change" instead of
   * looking stale between real price/quantity moves.
   */
  lastCheckedAt?: string | null;
  /**
   * True when `lastCheckedAt` is newer than the most recent revision (or
   * nothing has ever changed but a check has happened) — see
   * `hasUncommittedRefreshCheck` in `apps/api`.
   */
  hasUncommittedCheck?: boolean;
}

/**
 * One price/quantity change with the listing/product context a cross-listing
 * view needs (the per-listing `ListingRevisionDto` above already has an
 * implicit listing from the URL, so it carries none of this).
 */
export interface ListingRevisionWithListingDto extends ListingRevisionDto {
  listingId: string;
  asin: string;
  title: string;
  imageUrl?: string;
  ebayAccountId?: string;
  /** Store label, when the listing belongs to a connected eBay account. */
  storeName?: string;
  /** Resolved from the listing's eBay store marketplace, same as `ListingDto.currency`. */
  currency: string;
}

/** Query for `GET /listings/revisions` (all listings, one seller). */
export interface AllListingRevisionsQueryDto {
  page?: number;
  /** Page size (default 20, clamped to 100). */
  limit?: number;
  /** Case-insensitive substring match against the product's ASIN. */
  search?: string;
  /** Scope to one connected eBay store. */
  ebayAccountId?: string;
}

/** Paginated response for `GET /listings/revisions`. */
export interface PaginatedListingRevisionsWithListingDto {
  items: ListingRevisionWithListingDto[];
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
  /** Only products with at least one of the seller's listings on this eBay store. A UUID; anything else is a 400. */
  ebayAccountId?: string;
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
  /**
   * A group of a SCHEDULED job: its plan slots were not reserved when the job
   * was created (they would have sat reserved for days), so the worker
   * reserves them as the group starts.
   */
  reserveAtRun?: boolean;
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
