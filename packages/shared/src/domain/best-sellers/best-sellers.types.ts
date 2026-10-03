/**
 * Amazon Best Sellers browsing (2026-09-29).
 *
 * The seller browses Amazon's own "zeitgeist" lists (Best Sellers, New Releases,
 * Movers & Shakers, Most Wished For, Most Gifted) inside the app, ticks the
 * products they want and is sent to the Add Listings drawer with those ASINs
 * pre-filled. Nothing here reads eBay — it is Amazon-side only, fetched by the
 * scraper service through the SAME proxy pool the product refresh uses, so the
 * list data is shared across every seller (one cache per list/category/page)
 * and a per-seller daily miss cap keeps one account from spending the pool.
 *
 * Wire contract with `services/amazon-scraper` (`POST /v1/best-sellers`) and the
 * seller-facing `GET /v1/best-sellers` DTOs live together here so the Python
 * service, the API and the web app cannot drift on field names.
 */
import { AmazonMarketplace } from '../amazon/amazon.enums';
import { ScraperLane, SourceFetchOutcome } from '../products/source-product.types';

/** Amazon's five ranking lists. The value is the wire name the scraper expects. */
export enum BestSellersListType {
  BEST_SELLERS = 'best_sellers',
  NEW_RELEASES = 'new_releases',
  MOVERS_AND_SHAKERS = 'movers_and_shakers',
  MOST_WISHED_FOR = 'most_wished_for',
  MOST_GIFTED = 'most_gifted',
}

/** Display/tab order of the lists. */
export const BEST_SELLERS_LIST_TYPE_ORDER: readonly BestSellersListType[] = [
  BestSellersListType.BEST_SELLERS,
  BestSellersListType.NEW_RELEASES,
  BestSellersListType.MOVERS_AND_SHAKERS,
  BestSellersListType.MOST_WISHED_FOR,
  BestSellersListType.MOST_GIFTED,
];

/** Amazon renders 100 products per list as two pages of 50. */
export const BEST_SELLERS_PAGE_SIZE = 50;
export const BEST_SELLERS_MAX_PAGE = 2;

/**
 * A category alias as Amazon writes it in the list URL: `electronics`,
 * `electronics/172541`, or `""` for the root (all departments). Same grammar
 * the scraper validates (`refs.resolve_bestseller_category`).
 */
export const BEST_SELLERS_CATEGORY_REGEX = /^[a-z0-9-]+(\/\d+)?$/;
export const BEST_SELLERS_CATEGORY_MAX_LENGTH = 120;
export const BEST_SELLERS_ROOT_CATEGORY = '';

/** One ranked product on a list. Field names mirror the scraper's JSON exactly. */
export interface BestSellersItemDto {
  rank: number | null;
  asin: string;
  title: string | null;
  /** Absolute Amazon product URL. */
  link: string | null;
  /** Full-size image URL (size modifier stripped), or null when the card had none. */
  image: string | null;
  rating: { average: number | null; count: number | null } | null;
  price: { amount: number; currency: string } | null;
  priceText: string | null;
  /** Movers & Shakers only. */
  rankChangePercent: number | null;
  previousRank: number | null;
  salesRank: number | null;
}

/** One entry of the category tree Amazon renders beside a list. */
export interface BestSellersCategoryDto {
  name: string;
  /** Category alias usable as the `category` query param, or null for the root. */
  path: string | null;
  link: string | null;
  isSelected: boolean;
  isRoot: boolean;
  /**
   * Nesting level in Amazon's sidebar (0 = "Any Department", 1 = a
   * department, …). On a LEAF category Amazon lists the leaf among its
   * siblings, so document order alone cannot tell a sibling from an
   * ancestor; the level can. Absent on answers cached before it existed —
   * readers fall back to the flat reading.
   */
  level?: number | null;
}

export interface BestSellersRelatedListDto {
  name: string;
  link: string | null;
}

export interface BestSellersPaginationDto {
  page: number;
  itemsPerPage: number;
  totalPages: number;
  totalCount: number;
}

/** A fetched list page. */
export interface BestSellersListDto {
  title: string | null;
  category: string | null;
  listType: BestSellersListType;
  link: string | null;
  items: BestSellersItemDto[];
  categories: BestSellersCategoryDto[];
  relatedLists: BestSellersRelatedListDto[];
  pagination: BestSellersPaginationDto;
}

// ---------------------------------------------------------------------------
// Scraper wire contract (`POST /v1/best-sellers` on services/amazon-scraper)
// ---------------------------------------------------------------------------

export interface ScraperBestSellersRequest {
  /** Amazon country code, e.g. `US` (same field the products call uses). */
  marketplace: string;
  listType: BestSellersListType;
  /** Category alias or `""` for the root. */
  category: string;
  /** 1 or 2. */
  page: number;
  lane: ScraperLane;
  proxies: string[];
  perIpRequestsPerSecond: number;
  /** Read the page for its category tree only: one request, no ACP hydration, `items` empty. */
  treeOnly?: boolean;
}

export interface ScraperBestSellersResponse {
  /** `blocked` also covers the service's `expired` / `proxy_error` (transient). */
  outcome: SourceFetchOutcome;
  /** ISO timestamp of the fetch, null when nothing was fetched. */
  fetchedAt: string | null;
  /** Present only when `outcome === found`. */
  list: BestSellersListDto | null;
}

// ---------------------------------------------------------------------------
// Seller-facing API (`GET /v1/best-sellers`)
// ---------------------------------------------------------------------------

export interface BestSellersQueryDto {
  listType?: BestSellersListType;
  /** Category alias; omitted or empty = root. */
  category?: string;
  /** 1-based, max `BEST_SELLERS_MAX_PAGE`. */
  page?: number;
  marketplace?: AmazonMarketplace;
}

/**
 * The seller's Best Sellers PRODUCT allowance for the current billing period
 * (`BillingLimitKey.BEST_SELLERS_PRODUCTS_PER_MONTH`): products viewed so far
 * against the effective ceiling (plan allowance + top-ups bought this period).
 *
 * `limit` is `BILLING_UNLIMITED` (-1) when nothing meters the seller — quota
 * enforcement off, no subscription, or a plan without the limit — and then
 * `remaining` is also -1 and nothing is ever locked. Cached and live pages count
 * the same; the same list page reopened on the same UTC day is not recounted.
 */
export interface BestSellersBrowseAllowanceDto {
  used: number;
  limit: number;
  remaining: number;
  /** Extra allowance from top-up packs credited to this period; 0 when none. */
  creditValue: number;
}

/** `GET /v1/best-sellers`. */
export interface BestSellersPageDto {
  outcome: SourceFetchOutcome;
  list: BestSellersListDto | null;
  /** When the answer came from the shared cache, the time it was fetched; null on a live fetch. */
  cachedAt: string | null;
  fetchedAt: string | null;
  allowance: BestSellersBrowseAllowanceDto;
  /**
   * Products on this page the seller's allowance did NOT cover. They are
   * removed from `list.items` SERVER-SIDE (never blurred client-side over real
   * data — that would leak them to anyone opening devtools), and the page
   * renders this many locked placeholder rows with an upgrade / top-up prompt.
   * 0 whenever the whole page was covered or the seller is unmetered.
   */
  lockedCount: number;
}

/** `GET /v1/best-sellers/categories` query. */
export interface BestSellersCategoriesQueryDto {
  listType?: BestSellersListType;
  /** The node whose sub-categories are wanted; omitted or `''` = the department list. */
  category?: string;
  marketplace?: AmazonMarketplace;
}

/**
 * `GET /v1/best-sellers/categories`: the category tree beside one node (the
 * department list when no category is given), with no products. A chevron
 * expands a branch with it without opening that branch's list, and a deep
 * link uses it for the department level. It charges nothing against the
 * product allowance, which meters products seen, not the tree beside them.
 * Answered from a long-lived tree cache first (categories change far more
 * slowly than rankings). `categories` is empty unless `outcome` is FOUND.
 */
export interface BestSellersCategoriesDto {
  outcome: SourceFetchOutcome;
  categories: BestSellersCategoryDto[];
}

/** i18n keys the API returns as the `message` of a refused request (mapped to HTTP statuses in the controller). */
export enum BestSellersErrorKey {
  /** 404 — the operator switched the feature off. */
  DISABLED = 'bestSellers.errors.disabled',
  /**
   * 429 — the per-seller daily cap on LIVE fetches (cache misses) is spent.
   * This is the platform's anti-abuse brake on proxy capacity
   * (`bestSellers.dailyFetchLimit`, hidden from sellers and set far above real
   * use), NOT the seller-facing product allowance — that one never refuses,
   * it locks rows instead (`BestSellersPageDto.lockedCount`).
   */
  DAILY_LIMIT_REACHED = 'bestSellers.errors.dailyLimitReached',
  /** 503 — the scraper service could not be reached. */
  UNAVAILABLE = 'bestSellers.errors.unavailable',
  /** 400 — a marketplace outside `SUPPORTED_AMAZON_MARKETPLACES`. */
  UNSUPPORTED_MARKETPLACE = 'bestSellers.errors.unsupportedMarketplace',
}
