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
  /**
   * When the automatic checkout sent the Place Order click for this order
   * (`orders.auto_fulfill_submitted_at`), or null. An order with a click is
   * matched against the click, not just the sale: the Amazon order must be
   * dated around it and come from the account the click was made on.
   */
  submittedAt?: string | null;
  /**
   * Whether the Amazon order list being read belongs to the account the click
   * was made on. `false` refuses the match; `undefined` = no click / unknown.
   */
  clickedOnThisAccount?: boolean;
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
 * How far BEFORE the eBay sale an Amazon order's date may fall. A purchase
 * cannot precede the sale it fulfils; the slack exists only because Amazon's
 * order list prints a DATE (no time, in the account's own timezone) while the
 * eBay order carries an instant — the two can sit up to a day and a bit apart
 * for a purchase made minutes after the sale.
 */
export const AMAZON_ORDER_EARLY_SLACK_DAYS = 2;

/** An order with a click stamp must be dated within this many days of the click. */
export const CLICK_PROXIMITY_DAYS = 2;

/**
 * An Amazon total more than this factor above — or below one over it — the
 * expected cost is not the same purchase. Deliberately wide: tax, shipping, a
 * coupon or a price move shift the total, and those must still link.
 */
export const AMOUNT_SANITY_FACTOR = 3;

const NO_MATCH: ScoreResult = { match: false, score: 0 };

/**
 * Strict multi-signal matcher. Requires ALL of: same ASIN, same quantity, the
 * Amazon ship-to recipient is the eBay buyer (postcode + name), and a date
 * that fits. Any miss -> no match (never force-link, to avoid wrong cost
 * attribution).
 *
 * The DATE gate is one-sided: from `AMAZON_ORDER_EARLY_SLACK_DAYS` before the
 * eBay sale to `windowDays` after it. It used to be a symmetric window, which
 * let last week's Amazon order for the same buyer and product match this
 * week's eBay sale — and that sale then read as purchased without being bought.
 *
 * The AMOUNT is not an equality gate — Amazon's total against the expected
 * cost differs by tax, shipping and price moves — but it is a sanity bound
 * (`AMOUNT_SANITY_FACTOR`), and inside `tolerancePct` it adds a small bonus
 * that ranks two otherwise-equal candidates.
 */
export function scoreAmazonOrderMatch(input: ScoreInput): ScoreResult {
  const { amazon, ebay, tolerancePct, windowDays } = input;
  let score = 0;

  if (!amazon.asin || !ebay.asin || amazon.asin !== ebay.asin) {
    return NO_MATCH;
  }
  score += 40;

  if (amazon.quantity !== ebay.quantity) {
    return NO_MATCH;
  }
  score += 20;

  if (
    !recipientMatchesBuyer(
      { name: amazon.recipientName, zip: amazon.recipientZip },
      { name: ebay.buyerName, zip: ebay.buyerZip },
    )
  ) {
    return NO_MATCH;
  }
  score += 20;

  const aTime = new Date(amazon.orderDate).getTime();
  const eTime = new Date(ebay.orderDate).getTime();
  if (Number.isNaN(aTime) || Number.isNaN(eTime)) {
    return NO_MATCH;
  }
  const daysAfterSale = (aTime - eTime) / DAY_MS;
  if (daysAfterSale < -AMAZON_ORDER_EARLY_SLACK_DAYS || daysAfterSale > windowDays) {
    return NO_MATCH;
  }
  score += Math.max(0, 20 - Math.round(Math.abs(daysAfterSale)));

  // An order the automatic checkout clicked for: the Amazon order must be the
  // one that click produced — same account, dated around the click.
  if (ebay.submittedAt) {
    if (ebay.clickedOnThisAccount === false) {
      return NO_MATCH;
    }
    const cTime = new Date(ebay.submittedAt).getTime();
    if (Number.isNaN(cTime) || Math.abs(aTime - cTime) / DAY_MS > CLICK_PROXIMITY_DAYS) {
      return NO_MATCH;
    }
  }

  const expected = ebay.expectedCost ?? 0;
  if (expected > 0 && amazon.grandTotal > 0) {
    // The sanity bound does NOT apply to an order the automatic checkout
    // clicked for: account, click date, ASIN, quantity and recipient already
    // pin it, and refusing the genuine order over a price move would leave it
    // looking "not found" — which is what invites a second purchase.
    const ratio = amazon.grandTotal / expected;
    if (!ebay.submittedAt && (ratio > AMOUNT_SANITY_FACTOR || ratio < 1 / AMOUNT_SANITY_FACTOR)) {
      return NO_MATCH;
    }
    const diffPct = (Math.abs(amazon.grandTotal - expected) / expected) * 100;
    if (diffPct <= tolerancePct) {
      score += 10;
    }
  }

  return { match: true, score };
}
