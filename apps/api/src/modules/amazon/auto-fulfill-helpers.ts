import {
  AutoFulfillBlockedReason as AutoFulfillBlockedReasonEnum,
  AutoFulfillStatus,
  OrderStatus,
  isOrderAlreadyFulfilled,
} from '@repo/shared';

/**
 * Fail-closed obstacle reasons. Derived from the shared enum
 * (`packages/shared/src/domain/orders/orders.types.ts`) so the writer (this
 * module), the persisted `orders.auto_fulfill_blocked_reason` column, and the
 * FE chip mapping all reference ONE source of truth — a future enum edit can
 * never silently desync the union. String values mirror the enum members
 * (`no_asin` | `captcha` | `otp` | `login` | `out_of_stock` | `address` |
 * `payment` | `cap` | `no_confirmation` | `proxy_required` |
 * `quota_exhausted` | `cart`).
 */
export type AutoFulfillBlockedReason = `${AutoFulfillBlockedReasonEnum}`;

/**
 * What the Amazon purchase is expected to cost: the product's last known
 * price times the quantity, plus the seller's configured Amazon tax rate.
 * Shipping is not estimated. Null when the price is unknown — never a guess.
 */
export function estimateAmazonOrderCost(input: {
  unitPrice: number | null | undefined;
  quantity: number | null | undefined;
  taxRatePct: number | null | undefined;
}): number | null {
  const unitPrice = Number(input.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
    return null;
  }
  const quantity = Math.max(1, Math.floor(Number(input.quantity) || 1));
  const taxRate = Math.max(0, Number(input.taxRatePct) || 0);
  return Math.round(unitPrice * quantity * (1 + taxRate / 100) * 100) / 100;
}

/**
 * Coarse pre-filter on the ESTIMATED AMAZON COST. This is NOT the hard cap —
 * the hard cap is the Amazon review-step grand-total check. This only avoids
 * enqueueing orders that obviously exceed the cap.
 *
 * It used to compare the eBay sale total, which is revenue: a sale above the
 * cap whose Amazon cost sat below it was refused for no reason. An unknown
 * estimate passes — the review-step cap is the guard, and refusing on "we do
 * not know the price" would stop every order of a product with a blank price.
 */
export function meetsCoarseCapGate(estimatedCost: number | null, capTotal: number | null): boolean {
  if (capTotal === null) {
    return false;
  }
  if (estimatedCost === null) {
    return true;
  }
  return estimatedCost <= capTotal;
}

/**
 * Round-robin selection: the enabled account with the oldest lastUsedAt
 * (null treated as 0 = oldest). Ties broken by id ascending. Deterministic.
 *
 * HEALTHY ACCOUNTS FIRST: an account marked `healthy: false` is picked only
 * when no healthy one exists. Picking a `needs_reauth` / `locked` account
 * while a working one sat idle blocked the order on `login` for nothing; the
 * fallback keeps the old behaviour (try it, and let the block name the real
 * problem).
 */
export function pickRoundRobinAccount<T extends { id: string; lastUsedAt: Date | null; healthy?: boolean }>(
  accounts: T[],
): T | null {
  if (accounts.length === 0) {
    return null;
  }
  const healthy = accounts.filter((a) => a.healthy !== false);
  const pool = healthy.length > 0 ? healthy : accounts;
  return [...pool].sort((a, b) => {
    const at = a.lastUsedAt ? a.lastUsedAt.getTime() : 0;
    const bt = b.lastUsedAt ? b.lastUsedAt.getTime() : 0;
    if (at !== bt) {
      return at - bt;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
}

export type AutoFulfillEligibility =
  | { eligible: true }
  | { eligible: false; reason: AutoFulfillBlockedReasonEnum };

/**
 * May an Amazon purchase be made for an order in this eBay state?
 *
 * ONLY `WAITING_SHIPMENT` — paid, and nothing shipped yet — is eligible.
 * Everything else fails closed, because both other directions cost real money:
 *
 *  - SHIPPED / COMPLETED / PROCESSING: fulfilment has already happened or
 *    begun, so a purchase buys a second copy of an item the buyer is already
 *    getting. This is what makes a returning seller's settled backlog safe:
 *    their orders arrive already fulfilled and are skipped, rather than each
 *    one triggering a real Amazon order.
 *  - PENDING: the buyer has not paid. eBay cancels unpaid orders after four
 *    days, and we would be holding the stock. PENDING also covers "eBay sent
 *    no fulfilment status at all", which is deliberately treated the same way —
 *    an unreadable state is not evidence of payment.
 *
 * Read from the MAPPED `OrderStatus` rather than eBay's raw pair so that the
 * value this decision is made on is the same one persisted on the row and
 * shown to the seller; the two cannot disagree about why nothing was bought.
 */
export function resolveAutoFulfillEligibility(status: OrderStatus): AutoFulfillEligibility {
  // A cancelled sale first: it is neither unpaid (the recheck sweep would keep
  // asking eBay about it) nor fulfilled.
  if (status === OrderStatus.CANCELLED) {
    return { eligible: false, reason: AutoFulfillBlockedReasonEnum.ORDER_CANCELLED };
  }
  if (isOrderAlreadyFulfilled(status)) {
    return { eligible: false, reason: AutoFulfillBlockedReasonEnum.ORDER_ALREADY_FULFILLED };
  }
  if (status === OrderStatus.WAITING_SHIPMENT) {
    return { eligible: true };
  }
  return { eligible: false, reason: AutoFulfillBlockedReasonEnum.ORDER_NOT_PAID };
}

/**
 * Idempotency guard. The fulfillment job re-reads status on start; if the
 * order is already in a terminal/no-op state, do nothing (prevents a BullMQ
 * retry from double-ordering or re-running a deliberate stop).
 */
export function shouldSkipFulfillStart(status: AutoFulfillStatus): boolean {
  return (
    status === AutoFulfillStatus.PLACED ||
    status === AutoFulfillStatus.BLOCKED ||
    status === AutoFulfillStatus.DRY_RUN ||
    status === AutoFulfillStatus.SKIPPED
  );
}

export enum FulfillStartDecision {
  /** Terminal state already reached — no-op. */
  SKIP = 'skip',
  /** Nothing bought yet — run the checkout. */
  PROCEED = 'proceed',
  /**
   * The Place Order click was stamped (`orders.auto_fulfill_submitted_at`) and
   * the order is not PLACED: a previous run clicked and never proved the
   * purchase. The Amazon order may exist, so the checkout is NOT entered — the
   * order is settled as unknown and reconciled against "Your Orders".
   */
  UNKNOWN_OUTCOME = 'unknown_outcome',
}

/**
 * The one decision a starting fulfillment job makes, from the stored status
 * AND the click stamp.
 *
 * The stamp is written, as a compare-and-set, immediately before the Place
 * Order click. That makes "was the click sent?" a fact in the database instead
 * of an inference from the status:
 *  - stamp set, not PLACED → UNKNOWN_OUTCOME, whatever the status says.
 *  - RUNNING with NO stamp → PROCEED. The previous process died (deploy
 *    SIGKILL, OOM) BEFORE the click, so nothing was bought and re-entering is
 *    safe. This used to block every such order as `interrupted`, although
 *    almost all of them died long before the click.
 */
export function decideFulfillStart(
  status: AutoFulfillStatus,
  submittedAt: Date | string | null | undefined,
): FulfillStartDecision {
  if (status === AutoFulfillStatus.PLACED) {
    return FulfillStartDecision.SKIP;
  }
  if (submittedAt) {
    return FulfillStartDecision.UNKNOWN_OUTCOME;
  }
  if (shouldSkipFulfillStart(status)) {
    return FulfillStartDecision.SKIP;
  }
  return FulfillStartDecision.PROCEED;
}

/** eBay's `cancelState` when nobody asked to cancel (documented: "always returned"). */
export const EBAY_CANCEL_STATE_NONE_REQUESTED = 'NONE_REQUESTED';

export type PrePurchaseDecision =
  | { proceed: true }
  | {
      proceed: false;
      status: AutoFulfillStatus.SKIPPED | AutoFulfillStatus.BLOCKED;
      reason: AutoFulfillBlockedReasonEnum;
    };

/**
 * The last look at the eBay sale, taken from a LIVE `getOrder` read right
 * before the checkout starts. The stored row can be 20 minutes stale, and a
 * buyer who cancels usually does so in the first minutes after buying.
 *
 *  - cancelled / already fulfilled / not paid → the same answers the ingest
 *    gate gives (`resolveAutoFulfillEligibility`), SKIPPED.
 *  - more than one line item → SKIPPED `multi_item_order`: the checkout buys
 *    ONE line and the order would then look complete.
 *  - an open cancel request → BLOCKED `cancel_requested`. Read without relying
 *    on an enum list (the value pages are not obtainable): `cancelState` is
 *    documented as `NONE_REQUESTED` when there is no request, and `getOrder`
 *    populates `cancelRequests`. A request the seller REJECTED cannot be told
 *    apart from an open one by documented fields, so a MANUAL start — the
 *    seller saying "buy this one" — skips this hold; it never skips the rest.
 */
export function decidePrePurchase(input: {
  status: OrderStatus;
  cancelState: string | null;
  cancelRequestCount: number;
  lineItemCount: number;
  manual: boolean;
}): PrePurchaseDecision {
  const eligibility = resolveAutoFulfillEligibility(input.status);
  if (!eligibility.eligible) {
    return { proceed: false, status: AutoFulfillStatus.SKIPPED, reason: eligibility.reason };
  }
  if (input.lineItemCount > 1) {
    return {
      proceed: false,
      status: AutoFulfillStatus.SKIPPED,
      reason: AutoFulfillBlockedReasonEnum.MULTI_ITEM_ORDER,
    };
  }
  const cancelRequested =
    input.cancelRequestCount > 0 ||
    (input.cancelState !== null && input.cancelState !== '' && input.cancelState !== EBAY_CANCEL_STATE_NONE_REQUESTED);
  if (cancelRequested && !input.manual) {
    return {
      proceed: false,
      status: AutoFulfillStatus.BLOCKED,
      reason: AutoFulfillBlockedReasonEnum.CANCEL_REQUESTED,
    };
  }
  return { proceed: true };
}

/**
 * Loss guard at the review step. `maxLoss` null = the seller did not set one.
 * True when the Amazon total exceeds the eBay payout by MORE than the limit.
 * An unknown payout (0 / not finite) never blocks: the guard exists to stop a
 * known loss, and eBay can report earnings late.
 */
export function exceedsLossLimit(input: {
  grandTotal: number;
  ebayEarnings: number | null | undefined;
  maxLoss: number | null | undefined;
}): boolean {
  if (input.maxLoss === null || input.maxLoss === undefined) {
    return false;
  }
  const maxLoss = Number(input.maxLoss);
  const earnings = Number(input.ebayEarnings);
  if (!Number.isFinite(maxLoss) || maxLoss < 0 || !Number.isFinite(earnings) || earnings <= 0) {
    return false;
  }
  return input.grandTotal - earnings > maxLoss + 0.001;
}

/** A RUNNING row older than this is settled by the stale-run sweep. */
export const STALE_RUNNING_MINUTES = 60;

export interface ResumableOrderRow {
  ebay_order_id: string;
  auto_fulfill_status: string;
  auto_fulfill_blocked_reason: string | null;
  /** `orders.status` — eBay-side fulfillment state. */
  status: string;
  /** Non-null once *anything* bought this item (manual link, dry run). */
  amazon_order_id: string | null;
  /** The click stamp — a stamped row may already be bought, so it never resumes. */
  auto_fulfill_submitted_at?: Date | string | null;
}

/**
 * Which blocked orders may be retried once the account is entitled again.
 *
 * Scoped to SUBSCRIPTION_SUSPENDED alone. Every other blocked reason describes
 * a condition payment does not change — and CAP is a spend guard, so reviving
 * one would place a purchase the seller capped.
 *
 * DUPLICATE-PURCHASE GUARD — this predicate (and the sweep SELECT that mirrors
 * it) is the ONLY thing in the codebase that moves a `blocked` order back to
 * `pending`, so it is the only place that can re-arm an order for a real Amazon
 * purchase. If a seller bought the item by hand during the lapse to save the
 * eBay sale, re-enqueueing here ships a duplicate. Two independent signals of
 * "already handled", because they catch different cases:
 *   - `amazon_order_id` set — someone bought/linked it; a blocked order never
 *     reached a purchase, so a non-null id is always a manual link or dry run.
 *     Catches an order still sitting at `processing` after a hand purchase.
 *   - `status` SHIPPED / COMPLETED — the buyer has been served (eBay tracking
 *     pushed, or delivery observed). Catches a hand purchase not yet linked.
 */
export function selectResumableOrders(rows: ResumableOrderRow[]): ResumableOrderRow[] {
  // The enum-typed columns hold enum string values; cast so each comparison is
  // against the shared enum, not a bare string (`no-unsafe-enum-comparison`).
  return rows.filter(
    (row) =>
      (row.auto_fulfill_status as AutoFulfillStatus) === AutoFulfillStatus.BLOCKED &&
      (row.auto_fulfill_blocked_reason as AutoFulfillBlockedReasonEnum | null) ===
        AutoFulfillBlockedReasonEnum.SUBSCRIPTION_SUSPENDED &&
      row.amazon_order_id === null &&
      !row.auto_fulfill_submitted_at &&
      (row.status as OrderStatus) !== OrderStatus.SHIPPED &&
      (row.status as OrderStatus) !== OrderStatus.COMPLETED &&
      (row.status as OrderStatus) !== OrderStatus.CANCELLED,
  );
}

/** Sticky residential-proxy session token — per user (default) or per account. */
export function proxySessionToken(
  strategy: 'perUser' | 'perAccount',
  userId: string,
  amazonAccountId: string,
): string {
  return strategy === 'perAccount' ? amazonAccountId : userId;
}
