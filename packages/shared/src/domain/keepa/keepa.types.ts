import type { ProductData } from '../products/product-data.types';

/**
 * Confidence of a Keepa stock observation. `UNKNOWN` must never be written as a
 * real 0 — callers preserve the previous stock value instead (CLAUDE.md:
 * unknown ≠ zero, same principle as nullable net_profit).
 */
export enum KeepaStockStatus {
  /** Buy Box offer matched and a stock quantity was observed. */
  KNOWN = 'known',
  /** Offer retrieval succeeded and no live offer exists — genuinely unavailable. */
  OUT_OF_STOCK = 'out_of_stock',
  /** Offer retrieval failed / no observation — keep the previous value. */
  UNKNOWN = 'unknown',
}

export interface KeepaProduct {
  asin: string;
  /** Current Buy Box price in USD (incl. shipping); null = no price data. */
  price: number | null;
  /** Observed Buy Box stock quantity; null when stockStatus is UNKNOWN. */
  stock: number | null;
  stockStatus: KeepaStockStatus;
  sellerId?: string; // Buy Box seller ID
  /** True when the Buy Box is held by Amazon itself. */
  buyBoxIsAmazon?: boolean;
  lastSync: Date;
  raw?: Record<string, unknown>; // Raw API response
  // Normalized metadata (populated by bulk fetch; used by the refresh worker to
  // update the shared products cache without a second Keepa call).
  title?: string;
  description?: string;
  imageUrls?: string[];
  brand?: string;
  category?: string;
  features?: string[];
}

/**
 * Token consumption metadata returned by every Keepa API call.
 * Keepa includes `tokensConsumed` (top-level) on each `/product` response, plus
 * optional `tokensLeft` / `refillIn` for the shared token balance. Captured so
 * per-user cost can be logged (ad-split across the users sharing an ASIN).
 */
export interface KeepaApiMeta {
  /**
   * Response-reported token spend. Keepa's cost is conditional (0 when its
   * offer cache is fresh, 6/found-offer-page on refresh, +2 for fresh stock),
   * so this must never be locally estimated from ASIN count.
   */
  tokensConsumed: number;
  tokensLeft?: number;
  refillIn?: number; // milliseconds until the next token is refilled
  refillRate?: number; // tokens generated per minute (plan tier)
}

/** Result of a single-ASIN Keepa fetch (product + token metadata). */
export type KeepaSingleResult = { product: ProductData | null; meta: KeepaApiMeta };

/**
 * Result of a bulk Keepa fetch (products + aggregated token metadata).
 * Inputs larger than Keepa's 100-ASIN-per-request limit are chunked internally;
 * `meta` aggregates tokensConsumed across chunks and carries the last chunk's
 * balance snapshot.
 */
export type KeepaBulkResult = { products: KeepaProduct[]; meta: KeepaApiMeta };

/**
 * Source of a Keepa token spend, used for attribution in `keepa_usage_log`.
 * Stored as VARCHAR(20) in the DB; never as a raw string literal (CLAUDE.md rule 10).
 */
export enum KeepaUsageSource {
  /** Stale-driven refresh pipeline (batch worker). */
  REFRESH = 'refresh',
  /** Initial product/listing creation. */
  CREATE = 'create',
}
