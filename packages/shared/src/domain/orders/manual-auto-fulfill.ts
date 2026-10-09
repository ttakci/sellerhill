import { isSimulatedAmazonOrderId } from './fulfillment-state';
import { AutoFulfillBlockedReason, AutoFulfillStatus, OrderStatus } from './orders.types';

/**
 * Blocked reasons the seller may retry with the "Start automatic order" button.
 *
 * An ALLOWLIST, not a denylist: a reason added to the enum later is not
 * retryable until someone decides it is. Every member here stops the checkout
 * BEFORE the Place Order click, so a retry can never buy the item twice — the
 * obstacle (no money on the card, a captcha, a wrong address, stock, the cap)
 * is simply met again or, once the seller fixed it, passed.
 *
 * Deliberately absent:
 *  - NO_CONFIRMATION — the click went out and no Amazon order id came back.
 *  - INTERRUPTED — the process died mid-checkout; same ambiguity.
 *    Both carry the click stamp, and a stamped row is decided by the stamp
 *    branch of `canStartAutoFulfillManually`, never by this list.
 *  - The SKIPPED-only reasons (order cancelled / unpaid / already fulfilled /
 *    listing over the plan limit): each describes the eBay sale or the plan,
 *    and a click changes none of them.
 */
export const MANUALLY_RETRYABLE_BLOCKED_REASONS: readonly AutoFulfillBlockedReason[] = [
  AutoFulfillBlockedReason.NO_ASIN,
  AutoFulfillBlockedReason.CAPTCHA,
  AutoFulfillBlockedReason.OTP,
  AutoFulfillBlockedReason.LOGIN,
  AutoFulfillBlockedReason.OUT_OF_STOCK,
  AutoFulfillBlockedReason.ADDRESS,
  AutoFulfillBlockedReason.PAYMENT,
  AutoFulfillBlockedReason.CAP,
  AutoFulfillBlockedReason.PROXY_REQUIRED,
  AutoFulfillBlockedReason.QUOTA_EXHAUSTED,
  AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED,
  AutoFulfillBlockedReason.CART,
  AutoFulfillBlockedReason.REVIEW_UNREADABLE,
  AutoFulfillBlockedReason.CANCEL_REQUESTED,
  AutoFulfillBlockedReason.LOSS_LIMIT,
];

export interface ManualAutoFulfillInput {
  /** `orders.status` — eBay's view of the sale. */
  status: OrderStatus;
  /** `listing_id IS NOT NULL` — without a listing there is no ASIN to buy. */
  isTracked: boolean;
  /** `orders.listing_over_plan_limit` — fixed at first ingest. */
  listingOverPlanLimit: boolean;
  autoFulfillStatus: AutoFulfillStatus | null;
  autoFulfillBlockedReason: AutoFulfillBlockedReason | null;
  /** A real id means someone already bought it; a `SIM-` id is a dry run. */
  amazonOrderId: string | null;
  /**
   * `orders.auto_fulfill_submitted_at` — the Place Order click went out. While
   * it is set the purchase may exist, whatever the status and reason say.
   */
  submittedAt?: string | Date | null;
  /** `orders.ebay_line_item_count` — above 1 the checkout would buy one item of several. */
  lineItemCount?: number | null;
  /**
   * A scan of the Amazon orders saw an order that may be this purchase (same
   * product, dated around the click) and could not tie it to a sale with
   * certainty (`auto_fulfill_suspect_amazon_order_id`, not held by any order).
   * While it stands, an unconfirmed purchase is not started again.
   */
  suspectOnAmazon?: boolean;
}

/**
 * May the seller start the automatic Amazon purchase for this order by hand?
 *
 * The ONE rule behind the order detail page's button (`OrderDto.canStartAutoFulfill`)
 * and the endpoint that acts on it, so an offered button can never be refused
 * for a reason the page did not know about.
 *
 * Allowed states — each one means "nothing was bought":
 *  - BLOCKED with a reason in `MANUALLY_RETRYABLE_BLOCKED_REASONS`;
 *  - FAILED — transport errors exhausted their retries; no error escapes the
 *    checkout after the Place Order click, so FAILED never hides a purchase;
 *  - DRY_RUN — a test run; its `SIM-` placeholder is cleared first;
 *  - SKIPPED with NO reason — automation was off, no Amazon account was ready,
 *    or the sale was over the account's cap. The reasoned SKIPPED states
 *    describe the sale itself and are refused.
 *
 * One state where something MAY have been bought: the purchase not confirmed
 * (`purchase_unknown`, the click stamp set, no Amazon order id). The seller
 * checks Amazon and decides; the page asks before it acts, and a scan that saw
 * a matching Amazon order (`suspectOnAmazon`) still refuses.
 *
 * Never PENDING or RUNNING: a job may be queued or mid-checkout, and a second
 * one could buy twice. Never PLACED. And always only for a paid, unshipped,
 * uncancelled sale of a tracked listing inside the plan limit, with no real
 * Amazon order attached.
 */
export function canStartAutoFulfillManually(input: ManualAutoFulfillInput): boolean {
  if (input.status !== OrderStatus.WAITING_SHIPMENT) {
    return false;
  }
  if (!input.isTracked || input.listingOverPlanLimit) {
    return false;
  }
  if (input.amazonOrderId && !isSimulatedAmazonOrderId(input.amazonOrderId)) {
    return false;
  }
  // The checkout buys ONE line; a second click would not change that.
  if ((input.lineItemCount ?? 1) > 1) {
    return false;
  }
  // The click stamp outranks every status and reason below: the Place Order
  // click went out and no confirmation came back, so the order may exist on
  // Amazon. The seller may still start it again (operator decision,
  // 2026-10-09: they check Amazon, then either link the order or buy again;
  // the page asks "did you check?" first) — but never while a scan saw a
  // matching Amazon order, and never while a job may be queued or mid-checkout.
  if (input.submittedAt) {
    return (
      !input.suspectOnAmazon &&
      input.autoFulfillStatus !== AutoFulfillStatus.PLACED &&
      input.autoFulfillStatus !== AutoFulfillStatus.PENDING &&
      input.autoFulfillStatus !== AutoFulfillStatus.RUNNING
    );
  }
  switch (input.autoFulfillStatus) {
    case AutoFulfillStatus.BLOCKED:
      return (
        input.autoFulfillBlockedReason !== null &&
        MANUALLY_RETRYABLE_BLOCKED_REASONS.includes(input.autoFulfillBlockedReason)
      );
    case AutoFulfillStatus.FAILED:
    case AutoFulfillStatus.DRY_RUN:
      return true;
    case AutoFulfillStatus.SKIPPED:
      return input.autoFulfillBlockedReason === null;
    default:
      return false;
  }
}
