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
 *    The order may exist; retrying could buy it a second time. A card declined
 *    AFTER the click lands here too, which is why the seller checks Amazon and
 *    links the order by hand instead.
 *  - INTERRUPTED — the process died mid-checkout; same ambiguity.
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
}

export interface ConfirmNotPurchasedInput {
  status: OrderStatus;
  autoFulfillStatus: AutoFulfillStatus | null;
  amazonOrderId: string | null;
  /** `orders.auto_fulfill_submitted_at`. */
  submittedAt: string | Date | null;
  /** `amazon_accounts.last_orders_sync_at` of the account the click was made on. */
  accountScannedAt: string | Date | null;
}

/** Why the seller may not (yet) declare an unconfirmed purchase "not bought". */
export enum ConfirmNotPurchasedRefusal {
  /** The order is not in the unknown-outcome state at all. */
  NOT_UNKNOWN = 'not_unknown',
  /** No scan of the Amazon account's orders has completed since the click. */
  NOT_YET_CHECKED = 'not_yet_checked',
}

/**
 * May the seller declare "the click produced no Amazon order" and get the
 * automatic purchase back? This is the ONLY thing that ever clears the click
 * stamp, so it needs two independent facts: a scan of that Amazon account's
 * order list completed AFTER the click (and linked nothing — a linked order
 * has an id and is refused here), and the seller's own confirmation (the
 * endpoint call). Neither alone re-arms a purchase.
 */
export function resolveConfirmNotPurchased(input: ConfirmNotPurchasedInput): ConfirmNotPurchasedRefusal | null {
  const unknown =
    !!input.submittedAt &&
    !input.amazonOrderId &&
    input.status === OrderStatus.WAITING_SHIPMENT &&
    input.autoFulfillStatus !== AutoFulfillStatus.PLACED &&
    input.autoFulfillStatus !== AutoFulfillStatus.PENDING &&
    input.autoFulfillStatus !== AutoFulfillStatus.RUNNING;
  if (!unknown) {
    return ConfirmNotPurchasedRefusal.NOT_UNKNOWN;
  }
  const clickedAt = new Date(input.submittedAt as string | Date).getTime();
  const scannedAt = input.accountScannedAt ? new Date(input.accountScannedAt).getTime() : Number.NaN;
  if (!Number.isFinite(scannedAt) || !Number.isFinite(clickedAt) || scannedAt <= clickedAt) {
    return ConfirmNotPurchasedRefusal.NOT_YET_CHECKED;
  }
  return null;
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
  // The click stamp outranks every status and reason below: the order may
  // exist on Amazon. Only `resolveConfirmNotPurchased` + the seller clear it.
  if (input.submittedAt) {
    return false;
  }
  // The checkout buys ONE line; a second click would not change that.
  if ((input.lineItemCount ?? 1) > 1) {
    return false;
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
