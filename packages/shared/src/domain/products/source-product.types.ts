/**
 * Product data provider selection + the Amazon scraper service's wire contract.
 *
 * `ProductDataProviderKind` decides which provider `apps/api` reads product
 * data from (`product.dataProvider` platform setting) — Keepa or our own
 * scraper service. Everything below it is the scraper's request/response
 * shape, fixed by the scraper service itself (spec
 * 2026-09-26-amazon-scraper-provider); `apps/api` maps it onto `ProductData`.
 *
 * `formatSourceStock` (see `utils/source-stock.ts`) is unit-tested in
 * `apps/api/src/modules/listings/source-stock.spec.ts` — the Jest harness
 * runs from `apps/api`, same arrangement as `ebay-eps.spec.ts`.
 */

/** Which provider `apps/api` reads Amazon product data from. */
export enum ProductDataProviderKind {
  KEEPA = 'keepa',
  SCRAPER = 'scraper',
}

/**
 * How precisely a stock quantity is known.
 *
 * `AT_LEAST` covers Amazon's own "Only N left" cap (never shown above 20) and
 * a seller's own per-order quantity limit — both mean "at least this many",
 * never an exact count. `UNKNOWN` is never persisted; it means "keep the
 * previous row" (see migration 124).
 */
export enum SourceStockStatus {
  EXACT = 'exact',
  AT_LEAST = 'at_least',
  OUT_OF_STOCK = 'out_of_stock',
  UNKNOWN = 'unknown',
}

/** How a single ASIN fetch against the scraper resolved. */
export enum SourceFetchOutcome {
  FOUND = 'found',
  NOT_FOUND = 'not_found',
  BLOCKED = 'blocked',
  PARSE_FAILED = 'parse_failed',
  NO_PROXY = 'no_proxy',
}

/** `full` fetches title/description/specs/images too; `commerce` is price+stock only. */
export enum ScraperFetchMode {
  FULL = 'full',
  COMMERCE = 'commerce',
}

/** Priority lane a scrape request runs on — seller-triggered vs. background refresh. */
export enum ScraperLane {
  INTERACTIVE = 'interactive',
  BACKGROUND = 'background',
}

/** Price/stock/Buy Box signals extracted from an Amazon product page. */
export interface ScraperSignals {
  price: number | null;
  currency: string | null;
  availabilityText: string | null;
  isInStock: boolean | null;
  onlyLeft: number | null;
  quantityMax: number | null;
  buyboxSellerId: string | null;
  buyboxSellerName: string | null;
  soldByAmazon: boolean | null;
}

/** Catalog content extracted from an Amazon product page (`mode: 'full'` only). */
export interface ScraperContent {
  title: string | null;
  brand: string | null;
  manufacturer: string | null;
  bullets: string[];
  description: string | null;
  aplusRaw: string | null;
  images: string[];
  categories: string[];
  specs: Record<string, string>;
  identifiers: Record<string, string>;
  /**
   * The twister selection for THIS asin (`{ Color: 'Black' }`). Optional: an
   * older service build omits it, and a non-variation page sends `{}`.
   */
  variationAttributes?: Record<string, string>;
}

/** One ASIN's result from the scraper service. */
export interface ScraperProductResult {
  asin: string;
  outcome: SourceFetchOutcome;
  fetchedAt: string | null;
  signals: ScraperSignals | null;
  content: ScraperContent | null;
}

/** Request body sent to the scraper service's products endpoint. */
export interface ScraperProductsRequest {
  marketplace: string;
  asins: string[];
  mode: ScraperFetchMode;
  lane: ScraperLane;
  proxies: string[];
  perIpRequestsPerSecond: number;
}

/** Outcome counts over a time window, as reported by the scraper's stats endpoint. */
export interface ScraperOutcomeCounts {
  found: number;
  notFound: number;
  blocked: number;
  parseFailed: number;
  noProxy: number;
  /**
   * Resolved at the deadline (queued or in flight), reported to the caller as
   * `blocked` but NOT Amazon blocking us. Optional: an older service omits it.
   */
  expired?: number;
  /** Transport/proxy failure (dead exit, auth 407, repeated 5xx), also `blocked` on the wire. */
  proxyError?: number;
}

/** Why a lightweight proxy connectivity check failed. Never carries the proxy value. */
export enum ProxyVerifyErrorKind {
  /** Not shaped like `scheme://[user:pass@]host:port` — never probed. */
  INVALID = 'invalid',
  /** The proxy itself refused the connection or its credentials (incl. HTTP 407). */
  PROXY = 'proxy',
  TIMEOUT = 'timeout',
  DNS = 'dns',
  UNREACHABLE = 'unreachable',
  OTHER = 'other',
}

/**
 * Result of probing ONE proxy with a small, non-Amazon request (the scraper's
 * `POST /v1/proxies/verify`). `id` is `host:port` only — the credential is
 * never returned, logged or rendered.
 */
export interface ProxyVerifyResult {
  id: string;
  ok: boolean;
  errorKind: ProxyVerifyErrorKind | null;
  latencyMs: number | null;
}

/** Scraper service health/usage snapshot (admin observability). */
export interface ScraperStats {
  window1h: ScraperOutcomeCounts;
  window24h: ScraperOutcomeCounts;
  meanLatencyMs: number | null;
  proxies: Array<{ id: string; requests1h: number; blocked1h: number; coolingDown: boolean }>;
  /** The service may fetch without a proxy (`SCRAPER_ALLOW_DIRECT=1`). Optional: an older service omits it. */
  directAllowed?: boolean;
}

/**
 * The commerce facts `apps/api` derives from a scraper result and merges onto
 * a product row — price, stock precision and whether the product page is
 * still reachable at all.
 */
export interface SourceCommerce {
  price: number | null;
  stockStatus: SourceStockStatus;
  stock: number | null;
  maxOrderQuantity: number | null;
  removed: boolean;
}
