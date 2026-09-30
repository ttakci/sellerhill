import type { AmazonListOrderRow } from './amazon-scraping.service';
import { scoreAmazonOrderMatch } from './order-matcher';

/**
 * A pending/provisional eBay order row that could be matched against a scraped
 * Amazon order. Mirrors the columns selected in `AmazonOrderSyncService.runForAccount`.
 */
export interface CandidateEbayOrderRow {
  id: string;
  ebay_order_id: string;
  asin: string | null;
  quantity: number;
  /** Provisional product cost — compared with Amazon's total as a tie-break only. */
  purchase_price: string | number | null;
  order_date: Date;
  buyer_name: string | null;
  /** The orders `shipping_address` JSONB (the eBay buyer's ship-to). */
  shipping_address: { fullName?: string; zipCode?: string } | null;
}

/**
 * The chosen eBay candidate for an Amazon order: the eBay order's DB `id`,
 * its `ebay_order_id`, and the matcher score that won.
 */
export interface MatchPick {
  orderId: string;
  ebayOrderId: string;
  score: number;
}

export interface PickBestMatchInput {
  amazon: AmazonListOrderRow;
  candidates: CandidateEbayOrderRow[];
  tolerancePct: number;
  windowDays: number;
}

/**
 * Pick the highest-scoring eBay candidate for a scraped Amazon order. Returns
 * `null` when no candidate passes the strict matcher, AND when two different
 * eBay orders share the top score — a tie means we cannot tell which order this
 * Amazon purchase paid for, and a wrong link is worse than none (the seller
 * links it by hand). The caller MUST treat `null` as a no-op. Pure function —
 * extracted so it is unit-tested independently of the BullMQ/DB-coupled
 * `AmazonOrderSyncService`.
 */
export function pickBestMatch(input: PickBestMatchInput): MatchPick | null {
  const { amazon, candidates, tolerancePct, windowDays } = input;
  let best: MatchPick | null = null;
  let tied = false;
  for (const c of candidates) {
    const result = scoreAmazonOrderMatch({
      amazon: {
        asin: amazon.asin,
        quantity: amazon.quantity,
        grandTotal: amazon.grandTotal,
        orderDate: amazon.orderDate.toISOString(),
        recipientName: amazon.recipientName,
        recipientZip: amazon.recipientZip,
      },
      ebay: {
        asin: c.asin ?? undefined,
        quantity: c.quantity,
        expectedCost: c.purchase_price === null ? null : Number(c.purchase_price),
        orderDate: c.order_date.toISOString(),
        buyerName: c.shipping_address?.fullName || c.buyer_name,
        buyerZip: c.shipping_address?.zipCode ?? null,
      },
      tolerancePct,
      windowDays,
    });
    if (!result.match) {
      continue;
    }
    if (!best || result.score > best.score) {
      best = { orderId: c.id, ebayOrderId: c.ebay_order_id, score: result.score };
      tied = false;
    } else if (result.score === best.score && c.ebay_order_id !== best.ebayOrderId) {
      tied = true;
    }
  }
  return tied ? null : best;
}
