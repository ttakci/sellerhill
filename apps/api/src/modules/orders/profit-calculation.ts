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

export interface EstimateInput {
  ebayEarnings: number;
  purchasePrice: number;
  amazonTaxRatePct: number;
}

/**
 * Estimated net profit for provisional orders (Amazon order not yet placed).
 * Uses the product's last known Amazon price + a user-configured tax rate.
 * Shipping is NOT estimated (variable; often $0 on Prime) — disclosed in UI.
 * Returns null when purchase price is unknown (<=0).
 */
export function estimateProvisionalNetProfit(input: EstimateInput): number | null {
  const { ebayEarnings, purchasePrice, amazonTaxRatePct } = input;
  if (!purchasePrice || purchasePrice <= 0) {
    return null;
  }
  const estimatedTax = purchasePrice * (Math.max(0, amazonTaxRatePct) / 100);
  return Math.round((ebayEarnings - purchasePrice - estimatedTax) * 100) / 100;
}

/**
 * Maps a cost-capture status to the profit basis label shown in the UI.
 * - LINKED    -> 'confirmed'  (Amazon costs fully scraped)
 * - PROVISIONAL -> 'estimated' (purchase price known, tax estimated from store setting)
 * - anything else -> null      (no meaningful profit number to label)
 */
export function deriveProfitBasis(status: OrderCostCaptureStatus): 'confirmed' | 'estimated' | null {
  switch (status) {
    case OrderCostCaptureStatus.LINKED:
      return 'confirmed';
    case OrderCostCaptureStatus.PROVISIONAL:
      return 'estimated';
    default:
      return null;
  }
}
