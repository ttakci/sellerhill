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
  sale_total: string | number;
  order_date: Date;
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
 * `null` when no candidate passes the strict matcher — caller MUST treat that
 * as a no-op (never force-link). Pure function — extracted so it is unit-tested
 * independently of the BullMQ/DB-coupled `AmazonOrderSyncService`.
 */
export function pickBestMatch(input: PickBestMatchInput): MatchPick | null {
  const { amazon, candidates, tolerancePct, windowDays } = input;
  let best: MatchPick | null = null;
  for (const c of candidates) {
    const result = scoreAmazonOrderMatch({
      amazon: {
        asin: amazon.asin,
        quantity: amazon.quantity,
        grandTotal: amazon.grandTotal,
        orderDate: amazon.orderDate.toISOString(),
      },
      ebay: {
        asin: c.asin ?? undefined,
        quantity: c.quantity,
        saleTotal: Number(c.sale_total),
        orderDate: c.order_date.toISOString(),
      },
      tolerancePct,
      windowDays,
    });
    if (result.match && (!best || result.score > best.score)) {
      best = { orderId: c.id, ebayOrderId: c.ebay_order_id, score: result.score };
    }
  }
  return best;
}
