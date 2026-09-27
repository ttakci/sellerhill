import { KeepaStockStatus, SourceStockStatus, type ScraperProductResult } from '@repo/shared';

import { normalizeScraperCommerce } from './source-product-normalizer';

/**
 * Products claimed per 1-minute tick under the scraper provider. The tick
 * rate is fixed, so this IS the refresh throughput; the reserve keeps
 * headroom for seller-triggered creates (interactive lane).
 */
export function resolveScraperRefreshBatchSize(input: {
  proxyCount: number; perIpRequestsPerSecond: number; reservePercent: number; min: number; max: number;
}): number {
  const raw = Math.floor(input.perIpRequestsPerSecond * input.proxyCount * 60 * (1 - input.reservePercent / 100));
  return Math.min(Math.max(raw, input.min), input.max);
}

export interface RefreshRowState {
  price: number | null;
  stock: number | null;
  stockStatus: SourceStockStatus;
  maxOrderQuantity: number | null;
  removed: boolean;
}

export type ScraperRefreshPlan =
  | { kind: 'skip' }
  | { kind: 'data_failure' }
  | {
      kind: 'observed';
      price: number | null;
      stock: number | null;
      /** null = keep the stored status (observation was UNKNOWN). */
      stockStatus: SourceStockStatus | null;
      maxOrderQuantity: number | null;
      keepMaxOrderQuantity: boolean;
      removed: boolean;
      /** Price, stock or order limit moved → recompute and push listings. */
      commerceChanged: boolean;
    };

export function planScraperRefresh(
  row: RefreshRowState,
  result: ScraperProductResult | undefined,
  inStockFloor: number,
): ScraperRefreshPlan {
  if (!result) {
    return { kind: 'skip' };
  }
  const observation = normalizeScraperCommerce(result, inStockFloor);
  if (observation.kind === 'transport') {
    return { kind: 'skip' };
  }
  if (observation.kind === 'data_failure') {
    return { kind: 'data_failure' };
  }
  const c = observation.commerce;
  const unknown = c.stockStatus === SourceStockStatus.UNKNOWN;
  const price = c.price ?? row.price;
  const stock = unknown ? row.stock : c.stock;
  const maxOrderQuantity = unknown ? row.maxOrderQuantity : c.maxOrderQuantity;
  const commerceChanged =
    (price !== null && price !== row.price) ||
    (stock !== null && Number(stock) !== Number(row.stock ?? 0)) ||
    maxOrderQuantity !== row.maxOrderQuantity ||
    c.removed !== row.removed;
  return {
    kind: 'observed',
    price,
    stock,
    stockStatus: unknown ? null : c.stockStatus,
    maxOrderQuantity,
    keepMaxOrderQuantity: unknown,
    removed: c.removed,
    commerceChanged,
  };
}

export function keepaStockStatusToSource(status: KeepaStockStatus): SourceStockStatus | null {
  if (status === KeepaStockStatus.KNOWN) {
    return SourceStockStatus.EXACT;
  }
  if (status === KeepaStockStatus.OUT_OF_STOCK) {
    return SourceStockStatus.OUT_OF_STOCK;
  }
  return null;
}

/**
 * Keepa rollback: what to do with scraper-era columns Keepa itself never
 * writes to (`max_order_quantity`, `source_removed_at`).
 *
 * Keepa's own read is authoritative whenever it is not UNKNOWN — a rollback
 * to Keepa must not leave a listing permanently capped by a stale scraper
 * order-limit, nor flagged `source_removed_at` from a scraper-era 404 Keepa
 * cannot see at all. When Keepa itself returns UNKNOWN, none of this fires:
 * an unresolved observation is never evidence the scraper's own findings
 * were wrong, so the scraper-era columns are left exactly as they were.
 */
export interface KeepaRollbackPlan {
  /** Clear max_order_quantity + source_removed_at back to their Keepa defaults (both NULL). */
  clearScraperState: boolean;
  /** stock_status to persist (a COALESCE target — null keeps the stored value, i.e. UNKNOWN). */
  stockStatus: SourceStockStatus | null;
  /** A previously-set order cap disappearing changes the listed quantity, so it must fan out once. */
  commerceChangedByRollback: boolean;
}

export function planKeepaRollback(
  stockStatus: KeepaStockStatus,
  previousMaxOrderQuantity: number | null,
): KeepaRollbackPlan {
  const clearScraperState = stockStatus !== KeepaStockStatus.UNKNOWN;
  return {
    clearScraperState,
    stockStatus: keepaStockStatusToSource(stockStatus),
    commerceChangedByRollback: clearScraperState && previousMaxOrderQuantity !== null,
  };
}
