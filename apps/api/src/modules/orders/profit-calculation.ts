import { OrderCostCaptureStatus } from '@repo/shared';

export interface NetProfitInput {
  ebayEarnings: number;
  purchasePrice: number;
  amazonTax: number;
  amazonShipping: number;
}

/**
 * Net profit = ebayEarnings - purchasePrice - amazonTax - amazonShipping.
 * `ebayEarnings` (eBay totalDueSeller) is already net of eBay commission.
 * Returns null when purchase price is unknown (<=0) — caller should also set
 * status to PENDING/UNTRACKED rather than persist a meaningless number.
 */
export function computeNetProfit(input: NetProfitInput): number | null {
  const { ebayEarnings, purchasePrice, amazonTax, amazonShipping } = input;
  if (!purchasePrice || purchasePrice <= 0) {
    return null;
  }
  return Math.round((ebayEarnings - purchasePrice - amazonTax - amazonShipping) * 100) / 100;
}

export interface CostCaptureStatusInput {
  hasListingMatch: boolean;
  asinResolved: boolean;
  amazonLinked: boolean;
  amazonCostsCaptured: boolean;
  scrapeFailed: boolean;
}

/**
 * Derives the order's cost-capture confidence tier. Priority:
 *   scrapeFailed -> FAILED (prior values retained, flagged)
 *   amazonCostsCaptured -> LINKED (trusted)
 *   product cost resolvable (listing OR asin) but amazon not captured -> PROVISIONAL
 *   nothing resolvable -> UNTRACKED if not even a listing/asin, else PENDING
 */
export function deriveCostCaptureStatus(input: CostCaptureStatusInput): OrderCostCaptureStatus {
  const { hasListingMatch, asinResolved, amazonLinked, amazonCostsCaptured, scrapeFailed } = input;
  if (scrapeFailed) {
    return OrderCostCaptureStatus.FAILED;
  }
  if (amazonLinked && amazonCostsCaptured) {
    return OrderCostCaptureStatus.LINKED;
  }
  const productResolvable = hasListingMatch || asinResolved;
  if (productResolvable) {
    return OrderCostCaptureStatus.PROVISIONAL;
  }
  // No product match at all — if there's no listing AND no asin, source cost is unknowable.
  return OrderCostCaptureStatus.UNTRACKED;
}
