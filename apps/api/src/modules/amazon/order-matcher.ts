import { recipientMatchesBuyer } from './address-match';

export interface AmazonMatchCandidate {
  asin?: string;
  quantity: number;
  grandTotal: number;
  orderDate: string; // ISO date
  /** "Ship to" name Amazon printed on the order. */
  recipientName?: string | null;
  /** 5-digit postcode of the order's ship-to address. */
  recipientZip?: string | null;
}
export interface EbayMatchCandidate {
  asin?: string;
  quantity: number;
  /**
   * What the Amazon purchase is expected to cost (the order's provisional
   * `purchase_price`). Never the eBay sale total — that is revenue, and it sits
   * a whole margin away from what Amazon charges.
   */
  expectedCost?: number | null;
  orderDate: string; // ISO date
  buyerName?: string | null;
  buyerZip?: string | null;
}
export interface ScoreInput {
  amazon: AmazonMatchCandidate;
  ebay: EbayMatchCandidate;
  tolerancePct: number;
  windowDays: number;
}
export interface ScoreResult {
  match: boolean;
  score: number;
}

const DAY_MS = 86_400_000;

/**
 * Strict multi-signal matcher. Requires ALL of: same ASIN, same quantity, the
 * Amazon ship-to recipient is the eBay buyer (postcode + name), and the date
 * within the window. Any miss -> no match (never force-link, to avoid wrong
 * cost attribution).
 *
 * The amount is NOT a gate. It used to be — Amazon's grand total against the
 * eBay sale total — which compared cost with revenue, so no real order ever
 * passed (26–27 % apart on the first two live orders). It now only adds a
 * small bonus when the Amazon total lands within `tolerancePct` of the expected
 * cost, which ranks two otherwise-equal candidates.
 */
export function scoreAmazonOrderMatch(input: ScoreInput): ScoreResult {
  const { amazon, ebay, tolerancePct, windowDays } = input;
  let score = 0;

  if (!amazon.asin || !ebay.asin || amazon.asin !== ebay.asin) {
    return { match: false, score: 0 };
  }
  score += 40;

  if (amazon.quantity !== ebay.quantity) {
    return { match: false, score: 0 };
  }
  score += 20;

  if (
    !recipientMatchesBuyer(
      { name: amazon.recipientName, zip: amazon.recipientZip },
      { name: ebay.buyerName, zip: ebay.buyerZip },
    )
  ) {
    return { match: false, score: 0 };
  }
  score += 20;

  const aTime = new Date(amazon.orderDate).getTime();
  const eTime = new Date(ebay.orderDate).getTime();
  if (Number.isNaN(aTime) || Number.isNaN(eTime)) {
    return { match: false, score: 0 };
  }
  const dayDiff = Math.abs(aTime - eTime) / DAY_MS;
  if (dayDiff > windowDays) {
    return { match: false, score: 0 };
  }
  score += Math.max(0, 20 - Math.round(dayDiff));

  const expected = ebay.expectedCost ?? 0;
  if (expected > 0 && amazon.grandTotal > 0) {
    const diffPct = (Math.abs(amazon.grandTotal - expected) / expected) * 100;
    if (diffPct <= tolerancePct) {
      score += 10;
    }
  }

  return { match: true, score };
}
