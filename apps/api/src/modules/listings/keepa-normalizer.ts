import { KeepaStockStatus } from '@repo/shared';

/**
 * Pure normalization helpers for raw Keepa /product responses.
 *
 * Ground truth (verified against live Keepa responses, 2026-07-28):
 * - Keepa price fields use integer cents; sentinels are negative:
 *   `-1` = no data, `-2` = no Buy Box / suppressed. Neither is a real price.
 * - `images` is now an array of `{ l, m, ... }` filename objects; the legacy
 *   `imagesCSV` string can be null on the same product. Both must be supported.
 * - With `offers=N&stock=1`, each live offer may carry `stockCSV`
 *   (`[keepaTime, qty, keepaTime, qty, ...]` — last pair = latest observation).
 * - `liveOffersOrder` lists indices into `offers` ranked like Amazon's offer
 *   page; null when Keepa has no live-offer data.
 * - `stats.buyBoxSellerId === 'ATVPDKIKX0DER'` means Amazon itself holds the
 *   Buy Box. `stats.stockBuyBox` / `stats.stockAmazon` cap at 1000 (Amazon
 *   reports "≥1000" as 1000).
 * - `offersSuccessful` (boolean) reports whether the live offer retrieval
 *   succeeded; when false/absent the offer-derived data may be stale.
 * - `tokensConsumed` is conditional (0 when offers were cached <1h, 6/page
 *   when refreshed, +2 for fresh stock) — accounting must always use the
 *   reported value, never a per-ASIN estimate.
 */

export const AMAZON_SELLER_ID = 'ATVPDKIKX0DER';

/** Keepa csv/current indices actually consumed by Zonds. */
export enum KeepaCsvIndex {
  AMAZON = 0,
  NEW = 1,
  BUY_BOX_SHIPPING = 18,
}

export interface KeepaRawOffer {
  sellerId?: string;
  isPrime?: boolean;
  isFBA?: boolean;
  isAmazon?: boolean;
  condition?: number;
  lastSeen?: number;
  /** [keepaTime, qty, keepaTime, qty, ...] */
  stockCSV?: number[];
  offerCSV?: number[];
}

export interface KeepaRawImage {
  l?: string;
  m?: string;
}

export interface KeepaRawProduct {
  asin?: string;
  title?: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  model?: string;
  categoryTree?: Array<{ name: string }>;
  imagesCSV?: string | null;
  images?: KeepaRawImage[];
  features?: string[];
  offers?: KeepaRawOffer[];
  liveOffersOrder?: number[] | null;
  offersSuccessful?: boolean;
  lastStockUpdate?: number;
  stats?: {
    buyBoxPrice?: number;
    buyBoxShipping?: number;
    buyBoxSellerId?: string;
    buyBoxIsAmazon?: boolean | null;
    stockBuyBox?: number;
    stockAmazon?: number;
    totalOfferCount?: number;
    avg30?: number[];
    avg90?: number[];
    current?: number[];
  };
}

export interface NormalizedCommerce {
  /** USD incl. shipping; null = no usable price observation. */
  price: number | null;
  /** Observed Buy Box quantity; null iff stockStatus === UNKNOWN. */
  stock: number | null;
  stockStatus: KeepaStockStatus;
  sellerId?: string;
  buyBoxIsAmazon?: boolean;
}

/** A Keepa cent value is usable only when strictly positive (sentinels are <0). */
function usableCents(value: number | undefined): number | null {
  return typeof value === 'number' && value > 0 ? value : null;
}

/** Latest quantity from a stockCSV [time, qty, ...] pair list. */
export function latestStockFromCsv(stockCSV: number[] | undefined): number | null {
  if (!Array.isArray(stockCSV) || stockCSV.length < 2 || stockCSV.length % 2 !== 0) {
    return null;
  }
  const qty = stockCSV[stockCSV.length - 1];
  return typeof qty === 'number' && qty >= 0 ? qty : null;
}

/** Live offers resolved via liveOffersOrder (falls back to all offers). */
export function liveOffers(product: KeepaRawProduct): KeepaRawOffer[] {
  const offers = product.offers ?? [];
  const order = product.liveOffersOrder;
  if (!Array.isArray(order)) {
    return offers;
  }
  return order.map((i) => offers[i]).filter((o): o is KeepaRawOffer => Boolean(o));
}

/**
 * Extract the Buy Box price + Buy Box seller stock from a raw Keepa product.
 *
 * Stock policy (agreed contract — unknown must never be collapsed to 0):
 * 1. Buy Box offer matched by sellerId with a stockCSV observation → KNOWN.
 * 2. stats.stockBuyBox / stats.stockAmazon (when Amazon holds the Buy Box)
 *    present → KNOWN.
 * 3. Live-offer retrieval succeeded and there is no live offer and no Buy Box
 *    price → OUT_OF_STOCK (0).
 * 4. Anything else → UNKNOWN (null); the caller preserves the previous value.
 */
export function extractCommerce(product: KeepaRawProduct): NormalizedCommerce {
  const stats = product.stats ?? {};

  // --- price ---
  let price: number | null = null;
  const sellerId =
    typeof stats.buyBoxSellerId === 'string' && stats.buyBoxSellerId.length > 0 ? stats.buyBoxSellerId : undefined;
  const buyBoxCents = usableCents(stats.buyBoxPrice);
  if (buyBoxCents !== null) {
    const shipping = usableCents(stats.buyBoxShipping) ?? 0;
    price = (buyBoxCents + shipping) / 100;
  } else {
    const fallback =
      usableCents(stats.current?.[KeepaCsvIndex.BUY_BOX_SHIPPING]) ??
      usableCents(stats.current?.[KeepaCsvIndex.NEW]) ??
      usableCents(stats.current?.[KeepaCsvIndex.AMAZON]);
    price = fallback !== null ? fallback / 100 : null;
  }

  const buyBoxIsAmazon = stats.buyBoxIsAmazon === true || sellerId === AMAZON_SELLER_ID || undefined;

  // --- stock ---
  const live = liveOffers(product);

  // 1. Buy Box offer's own stock observation.
  if (sellerId) {
    const buyBoxOffer = live.find((o) => o.sellerId === sellerId);
    const observed = latestStockFromCsv(buyBoxOffer?.stockCSV);
    if (observed !== null) {
      return { price, stock: observed, stockStatus: KeepaStockStatus.KNOWN, sellerId, buyBoxIsAmazon };
    }
  }

  // 2. Stats-level stock (populated by Keepa's stock collection).
  if (typeof stats.stockBuyBox === 'number' && stats.stockBuyBox >= 0) {
    return { price, stock: stats.stockBuyBox, stockStatus: KeepaStockStatus.KNOWN, sellerId, buyBoxIsAmazon };
  }
  if (buyBoxIsAmazon && typeof stats.stockAmazon === 'number' && stats.stockAmazon >= 0) {
    return { price, stock: stats.stockAmazon, stockStatus: KeepaStockStatus.KNOWN, sellerId, buyBoxIsAmazon };
  }

  // 3. Confirmed no live offer at all → genuinely out of stock.
  const offerRetrievalSucceeded = product.offersSuccessful === true || Array.isArray(product.liveOffersOrder);
  if (offerRetrievalSucceeded && live.length === 0 && price === null) {
    return { price, stock: 0, stockStatus: KeepaStockStatus.OUT_OF_STOCK, sellerId, buyBoxIsAmazon };
  }

  // 4. Unknown — never a fabricated zero.
  return { price, stock: null, stockStatus: KeepaStockStatus.UNKNOWN, sellerId, buyBoxIsAmazon };
}

/**
 * Image URLs from either the modern `images` array (preferred, large size) or
 * the legacy `imagesCSV` string — live responses can carry either.
 */
export function extractImageUrls(product: KeepaRawProduct): string[] {
  if (Array.isArray(product.images) && product.images.length > 0) {
    return product.images
      .map((img) => img.l || img.m)
      .filter((name): name is string => Boolean(name))
      .map((name) => `https://images-na.ssl-images-amazon.com/images/I/${name}`);
  }
  if (product.imagesCSV) {
    return product.imagesCSV.split(',').map((img) => `https://images-na.ssl-images-amazon.com/images/I/${img}`);
  }
  return [];
}

/** Deduplicate ASINs preserving order (Keepa charges per requested product). */
export function dedupeAsins(asins: string[]): string[] {
  return [...new Set(asins.map((a) => a.trim()).filter((a) => a.length > 0))];
}

/** Split into Keepa's 100-ASIN-per-request chunks. */
export function chunkAsins(asins: string[], chunkSize = 100): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < asins.length; i += chunkSize) {
    chunks.push(asins.slice(i, i + chunkSize));
  }
  return chunks;
}
