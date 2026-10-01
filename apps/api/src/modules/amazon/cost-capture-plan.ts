import type { AmazonListOrderRow } from './amazon-scraping.service';
import { AMAZON_ORDER_EARLY_SLACK_DAYS, CLICK_PROXIMITY_DAYS } from './order-matcher';
import { pickBestMatch, type CandidateEbayOrderRow } from './pick-best-match';

const DAY_MS = 86_400_000;

/** First-scan look-back when an account has never been scanned. */
export const FIRST_SCAN_LOOKBACK_DAYS = 30;

/** An order row that already holds an Amazon order id. */
export interface AmazonOrderIdHolder {
  id: string;
  amazon_order_id: string;
}

export interface CostCaptureLink {
  amazon: AmazonListOrderRow;
  orderId: string;
  ebayOrderId: string;
  /**
   * `held` — the eBay order already carried this Amazon order id (a hand link
   * whose costs could not be read); only its costs are filled in.
   * `matched` — the strict matcher attributed the Amazon order to it.
   */
  via: 'held' | 'matched';
  /** The automatic checkout clicked for this order: linking it proves the purchase. */
  clicked: boolean;
}

/**
 * An Amazon order that MAY be the one an unconfirmed automatic purchase
 * produced, but which the strict matcher would not link (typically because the
 * ship-to recipient could not be read). It is not linked — that would be a
 * guess — but it is remembered on the eBay order, and while it stands the
 * seller cannot declare the purchase "not on Amazon".
 */
export interface CostCaptureSuspect {
  orderId: string;
  ebayOrderId: string;
  amazonOrderId: string;
}

export interface CostCapturePlan {
  links: CostCaptureLink[];
  suspects: CostCaptureSuspect[];
}

/**
 * From which date an account's "Your Orders" list has to be read.
 *
 * Normally the later of the watermark and "the oldest candidate's sale, less
 * the matcher's slack": an Amazon order placed before every waiting sale can
 * match none of them, and one placed before the watermark was read already.
 *
 * Two kinds of candidate pull the start BACK to their own sale, whatever the
 * watermark says:
 *  - one that already NAMES its Amazon order (a hand link with unreadable
 *    costs) — the seller may have linked an order placed before the watermark;
 *  - one the automatic checkout CLICKED for — while its outcome is unknown the
 *    days around the click are read again on every scan, so "the scan found
 *    nothing" keeps meaning "it is not there" rather than "we stopped looking".
 */
export function resolveScanSince(input: {
  watermark: Date | null;
  candidates: Pick<CandidateEbayOrderRow, 'order_date' | 'amazon_order_id' | 'auto_fulfill_submitted_at'>[];
  now: Date;
}): Date {
  const { watermark, candidates, now } = input;
  const base = watermark ?? new Date(now.getTime() - FIRST_SCAN_LOOKBACK_DAYS * DAY_MS);
  const slackMs = AMAZON_ORDER_EARLY_SLACK_DAYS * DAY_MS;
  const times = candidates.map((c) => new Date(c.order_date).getTime()).filter((t) => Number.isFinite(t));
  if (times.length === 0) {
    return base;
  }
  const oldest = Math.min(...times) - slackMs;
  let since = Math.max(base.getTime(), oldest);
  for (const c of candidates) {
    const sale = new Date(c.order_date).getTime();
    if ((c.amazon_order_id || c.auto_fulfill_submitted_at) && Number.isFinite(sale)) {
      since = Math.min(since, sale - slackMs);
    }
  }
  return new Date(since);
}

/**
 * Decide which scraped Amazon orders are written to which eBay orders. Pure —
 * the service performs the writes.
 *
 * Rules, in order, per Amazon order:
 *  1. Its id is ALREADY HELD by an order row:
 *     - by a candidate (hand-linked, costs still unknown) → fill that order;
 *     - by anything else (already linked, another seller's order) → skip. One
 *       Amazon order pays for one eBay order: without this, a repeat buyer's
 *       second sale matched the Amazon order that had fulfilled the first and
 *       read as purchased without ever being bought.
 *  2. Otherwise the strict matcher picks among the candidates that do NOT yet
 *     name an Amazon order and were not given one earlier in this run. No pick
 *     → nothing is linked (never force-link).
 *  3. An Amazon order that was not linked, but has the ASIN of an order the
 *     automatic checkout clicked for and is dated around that click on the
 *     account the click was made on, is reported as a SUSPECT for that order.
 */
export function planCostCaptureLinks(input: {
  amazonOrders: AmazonListOrderRow[];
  candidates: CandidateEbayOrderRow[];
  holders: AmazonOrderIdHolder[];
  tolerancePct: number;
  windowDays: number;
  accountId: string;
}): CostCapturePlan {
  const { amazonOrders, candidates, holders, tolerancePct, windowDays, accountId } = input;
  const heldBy = new Map(holders.map((h) => [h.amazon_order_id, h.id]));
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const consumed = new Set<string>();
  const links: CostCaptureLink[] = [];
  const unlinked: AmazonListOrderRow[] = [];

  for (const amazon of amazonOrders) {
    if (!amazon.amazonOrderId) {
      continue;
    }
    const holderId = heldBy.get(amazon.amazonOrderId);
    if (holderId !== undefined) {
      const holder = byId.get(holderId);
      if (!holder || consumed.has(holder.id)) {
        continue;
      }
      consumed.add(holder.id);
      links.push({
        amazon,
        orderId: holder.id,
        ebayOrderId: holder.ebay_order_id,
        via: 'held',
        clicked: !!holder.auto_fulfill_submitted_at,
      });
      continue;
    }

    // Only candidates that do not name an Amazon order and were not already
    // given one in this run: an order linked a moment ago must not shadow the
    // next-best candidate for a second Amazon order.
    const matchable = candidates.filter((c) => !c.amazon_order_id && !consumed.has(c.id));
    const best = pickBestMatch({ amazon, candidates: matchable, tolerancePct, windowDays, accountId });
    if (!best) {
      unlinked.push(amazon);
      continue;
    }
    consumed.add(best.orderId);
    links.push({
      amazon,
      orderId: best.orderId,
      ebayOrderId: best.ebayOrderId,
      via: 'matched',
      clicked: !!byId.get(best.orderId)?.auto_fulfill_submitted_at,
    });
  }

  const suspects: CostCaptureSuspect[] = [];
  for (const c of candidates) {
    if (!c.auto_fulfill_submitted_at || c.amazon_order_id || consumed.has(c.id) || !c.asin) {
      continue;
    }
    // A click made on another account cannot have produced an order here.
    if (c.amazon_account_id && c.amazon_account_id !== accountId) {
      continue;
    }
    const clickedAt = c.auto_fulfill_submitted_at.getTime();
    const suspect = unlinked.find(
      (amazon) =>
        amazon.asin === c.asin &&
        Math.abs(amazon.orderDate.getTime() - clickedAt) / DAY_MS <= CLICK_PROXIMITY_DAYS
    );
    if (suspect) {
      suspects.push({ orderId: c.id, ebayOrderId: c.ebay_order_id, amazonOrderId: suspect.amazonOrderId });
    }
  }

  return { links, suspects };
}
