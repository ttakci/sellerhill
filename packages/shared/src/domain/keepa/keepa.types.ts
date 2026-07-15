import type { ProductData } from '../products/product-data.types';

export interface KeepaProduct {
  asin: string;
  price: number; // Current price in USD
  stock: number; // 0=out of stock, >0=quantity
  sellerId?: string; // Cheapest seller ID
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
  tokensConsumed: number;
  tokensLeft?: number;
  refillIn?: number; // milliseconds until the next token is refilled
}

/** Result of a single-ASIN Keepa fetch (product + token metadata). */
export type KeepaSingleResult = { product: ProductData | null; meta: KeepaApiMeta };

/** Result of a bulk (≤100 ASIN) Keepa fetch (products + token metadata). */
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
