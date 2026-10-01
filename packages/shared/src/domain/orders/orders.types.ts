/**
 * What the seller actually needs to know about an order, in ONE value.
 *
 * The raw columns could not answer "did Amazon buy this, and do I need to do
 * something?" without the reader knowing the schema:
 *  - `orders.status` is the eBay-side state and says nothing about Amazon.
 *  - `auto_fulfill_status` has seven values, several of which are internal
 *    (`running`, `pending`) or operator-only (`dry_run`).
 *  - `amazon_cancelled_at` is a separate flag that overrides a `placed` order.
 *  - `cost_capture_status` is a THIRD axis, about cost confidence.
 * The list showed these side by side, so "which orders need me?" was unanswerable.
 *
 * Derived at read time (no column) by `deriveFulfillmentState`, and the single
 * vocabulary the list column, the detail page and the filter all speak.
 */
export enum OrderFulfillmentState {
  /** Bought on Amazon; nothing for the seller to do. */
  PURCHASED = 'purchased',
  /** Amazon cancelled after purchase — the eBay sale is still owed to the buyer. */
  AMAZON_CANCELLED = 'amazon_cancelled',
  /** Automation stopped on purpose (missing address, cap, captcha …). Seller must act. */
  ACTION_REQUIRED = 'action_required',
  /** Automation is mid-flight or queued. */
  IN_PROGRESS = 'in_progress',
  /** Automation is off for this order (store/account gate, or no eligible account). */
  NOT_AUTOMATED = 'not_automated',
  /** Operator dry-run only — never a real purchase. */
  SIMULATED = 'simulated',
  /** Fulfilled outside automation (manual Amazon link, or shipped already). */
  MANUAL = 'manual',
}

/**
 * ONE seller-facing status per order, derived from columns that already exist.
 * Answers "what is happening to this order, and do I need to act?" — which
 * neither the eBay status (`OrderStatus`) nor `OrderFulfillmentState` did on
 * its own. Priority order = enum order: `deriveOrderStage` returns the FIRST
 * matching member. See docs/superpowers/specs/2026-09-29-order-stages-design.md.
 */
export enum OrderStage {
  AMAZON_CANCELLED = 'amazon_cancelled',
  CANCELLED = 'cancelled',
  DELIVERED = 'delivered',
  TEST_RUN = 'test_run',
  SHIPPED = 'shipped',
  TRACKING_HELD = 'tracking_held',
  BUYING = 'buying',
  PURCHASED = 'purchased',
  /**
   * The Place Order click went out (`orders.auto_fulfill_submitted_at`) and no
   * confirmation came back. The Amazon order may exist, so nothing may buy it
   * again until the outcome is known — see the 2026-10-01 order-flow design.
   */
  PURCHASE_UNKNOWN = 'purchase_unknown',
  PURCHASE_BLOCKED = 'purchase_blocked',
  AWAITING_PAYMENT = 'awaiting_payment',
  TO_PURCHASE = 'to_purchase',
}

/** The list page's counted tabs — groupings over `OrderStage`. */
export enum OrderStageTab {
  ALL = 'all',
  ACTION = 'action',
  TO_PURCHASE = 'to_purchase',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

export enum OrderStatus {
  COMPLETED = 'completed',
  SHIPPED = 'shipped',
  PROCESSING = 'processing',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
  WAITING_SHIPMENT = 'waiting_shipment',
}

/**
 * Confidence/state of Amazon cost capture for an order.
 * Drives which profit tier an order belongs to on the dashboard.
 */
export enum OrderCostCaptureStatus {
  PENDING = 'pending', // eBay order in, nothing captured yet, product cost unknown
  LINKED = 'linked', // Amazon costs fully captured (scraped from a real Amazon order) — TRUSTED
  PROVISIONAL = 'provisional', // product/purchase cost known, Amazon tax+shipping not yet captured
  FAILED = 'failed', // Amazon scrape ran but returned no usable data; prior values retained
  UNTRACKED = 'untracked', // no listing match; source cost can never be known
}

/**
 * Lifecycle of automated Amazon fulfillment for an order.
 * pending  -> new order, not yet attempted / not eligible
 * running  -> checkout job in progress
 * placed   -> Amazon order placed, costs + amazon_order_id written, recomputeProfit queued
 * blocked  -> checkout attempted, hit a fail-closed obstacle (no charge); see blocked_reason
 * failed   -> unexpected error (transport/infra); BullMQ may retry
 * dry_run  -> dry-run account: full flow up to (not incl.) Place Order; review total captured
 * skipped  -> not eligible (auto off / no enabled account / coarse cap gate failed)
 */
export enum AutoFulfillStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PLACED = 'placed',
  BLOCKED = 'blocked',
  FAILED = 'failed',
  DRY_RUN = 'dry_run',
  SKIPPED = 'skipped',
}

/**
 * Fail-closed obstacle reasons for automated Amazon fulfillment.
 * Persisted on `orders.auto_fulfill_blocked_reason` when
 * `auto_fulfill_status = blocked`. String values mirror the writer in
 * `apps/api/src/modules/amazon/auto-fulfill-helpers.ts`.
 */
export enum AutoFulfillBlockedReason {
  NO_ASIN = 'no_asin',
  CAPTCHA = 'captcha',
  OTP = 'otp',
  LOGIN = 'login',
  OUT_OF_STOCK = 'out_of_stock',
  ADDRESS = 'address',
  PAYMENT = 'payment',
  CAP = 'cap',
  NO_CONFIRMATION = 'no_confirmation',
  /** Runtime proxy guard — auto-fulfill requires a configured residential proxy. */
  PROXY_REQUIRED = 'proxy_required',
  /** AO monthly quota exhausted — placed+reserved this period >= limit. */
  QUOTA_EXHAUSTED = 'quota_exhausted',
  /**
   * The account's subscription is past due, cancelled, or its trial has ended.
   * Deliberately NOT folded into QUOTA_EXHAUSTED: the two need different
   * actions from the seller ("pay the invoice" vs "upgrade the plan"), and
   * reporting one as the other sends them to the wrong screen — the same
   * reason CAP and REVIEW_UNREADABLE are separate below.
   */
  SUBSCRIPTION_SUSPENDED = 'subscription_suspended',
  /**
   * Cart-hygiene guard — the Amazon cart did not contain exactly the expected
   * item/quantity before checkout (stale leftovers from a blocked attempt or
   * the buyer's own items would be co-purchased). Fail-closed before payment.
   */
  CART = 'cart',
  /**
   * The review-step grand total could not be read from the page. Distinct from
   * CAP (a total that was read and exceeded the limit) so a selector break is
   * never misreported as the spend guard doing its job.
   */
  REVIEW_UNREADABLE = 'review_unreadable',
  /**
   * A fulfillment job started and found the row still RUNNING: the previous
   * attempt died without cleaning up (SIGKILL on deploy, OOM, host restart).
   * The Place Order click may already have gone out, so the checkout is NOT
   * re-entered — the seller checks Amazon and links the order by hand, or buys
   * it. Fail-closed: the alternative is a second Amazon order.
   */
  INTERRUPTED = 'interrupted',
  /**
   * The order's listing was outside the plan's listing limit when the order
   * arrived (only the oldest listings up to the limit are automated). Written
   * with status SKIPPED, not BLOCKED: it is the plan working as designed, not
   * something that went wrong, so it must not raise an action-required alarm.
   */
  LISTING_OVER_PLAN_LIMIT = 'listing_over_plan_limit',
  /**
   * eBay already reported the order as fulfilled (or part-fulfilled) when it
   * first reached us, so there is nothing left to buy — the seller shipped it
   * themselves, or another tool did. Written with status SKIPPED, not BLOCKED:
   * the buyer has been served, so nothing needs the seller's attention.
   *
   * This is the guard that stops a seller returning after a lapse from having
   * their whole settled backlog re-purchased on Amazon. The suspension-resume
   * sweep has always excluded SHIPPED/COMPLETED for exactly this reason
   * (`selectResumableOrders`); the insert path was missing the same rule.
   */
  ORDER_ALREADY_FULFILLED = 'order_already_fulfilled',
  /**
   * The buyer had not paid yet. Money must never leave on an order that may
   * still be cancelled for non-payment, so this fails closed — including when
   * eBay reports no fulfillment status at all, since an unreadable state is not
   * evidence of payment. The order-sync tick re-checks these against eBay and
   * releases them once payment settles, so the skip is not permanent.
   */
  ORDER_NOT_PAID = 'order_not_paid',
  /**
   * eBay cancelled the sale (`cancelStatus.cancelledDate`) before anything was
   * bought. Written with status SKIPPED: there is no buyer left to serve, so
   * nothing is purchased and nothing needs the seller. Checked at enqueue AND at
   * execution, because a cancellation can land while the job waits in the queue.
   */
  ORDER_CANCELLED = 'order_cancelled',
  /**
   * The eBay order holds more than one line item. The platform reads only the
   * first, so an automatic purchase would buy one item of several and leave the
   * order looking complete. Written with status SKIPPED: the seller buys and
   * ships every item by hand. Never manually retryable.
   */
  MULTI_ITEM_ORDER = 'multi_item_order',
  /**
   * The buyer asked eBay to cancel and the request is still open. Nothing is
   * bought for a sale that may be about to disappear. BLOCKED rather than
   * SKIPPED because the seller has to answer the request on eBay; retryable by
   * hand once it is settled.
   */
  CANCEL_REQUESTED = 'cancel_requested',
  /**
   * The Amazon total at the review step exceeded the eBay payout by more than
   * the store's `autoFulfillMaxLoss`. Stopped before the click; retryable by
   * hand (after raising the limit, or once the price falls).
   */
  LOSS_LIMIT = 'loss_limit',
}

/**
 * One step of an automatic Amazon purchase, as written to the append-only
 * `auto_fulfill_events` audit trail (migration 132). The trail is evidence for
 * "what did the automation do with this order's money" — it is never read back
 * to decide anything; the click boundary lives on
 * `orders.auto_fulfill_submitted_at`.
 */
export enum AutoFulfillEvent {
  ATTEMPT_STARTED = 'attempt_started',
  MANUAL_START = 'manual_start',
  EBAY_RECHECK_PASSED = 'ebay_recheck_passed',
  CART_VERIFIED = 'cart_verified',
  ADDRESS_VERIFIED = 'address_verified',
  PAYMENT_SELECTED = 'payment_selected',
  REVIEW_TOTAL_READ = 'review_total_read',
  CAP_CHECK_PASSED = 'cap_check_passed',
  LOSS_CHECK_PASSED = 'loss_check_passed',
  DRY_RUN_STOPPED = 'dry_run_stopped',
  SUBMIT_CLAIMED = 'submit_claimed',
  PLACE_ORDER_CLICKED = 'place_order_clicked',
  CONFIRMATION_DETECTED = 'confirmation_detected',
  ORDER_ID_DETECTED = 'order_id_detected',
  PLACED = 'placed',
  PURCHASE_UNKNOWN = 'purchase_unknown',
  BLOCKED = 'blocked',
  SKIPPED = 'skipped',
  FAILED = 'failed',
  RETRY_SCHEDULED = 'retry_scheduled',
  RECONCILIATION_LINKED = 'reconciliation_linked',
  CONFIRMED_NOT_PURCHASED = 'confirmed_not_purchased',
}

/**
 * The rows of the order detail page's timeline (`buildOrderTimeline`). The five
 * main steps are the order's path; `sale_cancelled` closes the timeline of a
 * sale eBay cancelled; the `message_*` rows are buyer messages the log proves
 * were sent (or failed), listed under the step they belong to.
 */
export enum OrderTimelineStepKey {
  RECEIVED = 'received',
  PURCHASE = 'purchase',
  AMAZON_SHIPPED = 'amazon_shipped',
  EBAY_TRACKING = 'ebay_tracking',
  DELIVERED = 'delivered',
  SALE_CANCELLED = 'sale_cancelled',
  MESSAGE_ORDER_RECEIVED = 'message_order_received',
  MESSAGE_SHIPPED = 'message_shipped',
  MESSAGE_DELIVERED = 'message_delivered',
  MESSAGE_FEEDBACK_REQUEST = 'message_feedback_request',
}

export enum OrderTimelineStepState {
  /** It happened. */
  DONE = 'done',
  /** The step the order is on; the platform (or the calendar) is working. */
  CURRENT = 'current',
  /** The step the order is on, and it needs the seller. */
  ATTENTION = 'attention',
  /** Not reached yet. */
  UPCOMING = 'upcoming',
  /** Did not happen through this platform, and will not any more. */
  SKIPPED = 'skipped',
}

/**
 * Which sentence a timeline step carries (`orders.timeline.note.<note>`).
 * `stage` means "the order's stage explains this step": the web renders
 * `orders.stage.<stage>.meaning` and, where the stage has one, its action and
 * the automatic-purchase reason.
 */
export enum OrderTimelineNote {
  STAGE = 'stage',
  RECEIVED = 'received',
  BOUGHT_AUTO = 'bought_auto',
  BOUGHT_LINKED = 'bought_linked',
  PURCHASE_NOT_RECORDED = 'purchase_not_recorded',
  AMAZON_SHIPPED = 'amazon_shipped',
  WAITING_SHIPMENT = 'waiting_shipment',
  SHIPMENT_NOT_OBSERVED = 'shipment_not_observed',
  UPCOMING_SHIPMENT = 'upcoming_shipment',
  TRACKING_PUSHED = 'tracking_pushed',
  TRACKING_NOT_BY_US = 'tracking_not_by_us',
  UPCOMING_TRACKING = 'upcoming_tracking',
  DELIVERED = 'delivered',
  WAITING_DELIVERY = 'waiting_delivery',
  DELIVERY_NOT_TRACKED = 'delivery_not_tracked',
  UPCOMING_DELIVERY = 'upcoming_delivery',
  MESSAGE_SENT = 'message_sent',
  MESSAGE_FAILED = 'message_failed',
}

/** One row of the order timeline — codes and facts only, never a sentence. */
export interface OrderTimelineStepDto {
  key: OrderTimelineStepKey;
  state: OrderTimelineStepState;
  note: OrderTimelineNote;
  /** When it happened (ISO), or null when it has not or the time is unknown. */
  at: string | null;
  /** An identifier that belongs to the step: the Amazon order number, the
   *  tracking number eBay received. */
  reference?: string | null;
  /** A buyer-message row, rendered as a sub-step. */
  isMessage?: boolean;
}

/**
 * Basis of the persisted `netProfit` value, derived from `costCaptureStatus`
 * at read time (no DB column). CONFIRMED = LINKED (real Amazon costs);
 * ESTIMATED = PROVISIONAL (purchase price + configured tax rate).
 */
export enum ProfitBasis {
  CONFIRMED = 'confirmed',
  ESTIMATED = 'estimated',
}

export interface OrderDto {
  id: string;
  ebayOrderId: string;
  /** The connected eBay store this order belongs to. Drives per-order currency resolution (multi-store sellers). */
  ebayAccountId?: string;
  createdAt: string;
  isTracked: boolean;

  // Buyer
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  buyerUsername?: string;

  // Status
  status: OrderStatus;
  orderFulfillmentStatus?: string;
  paymentStatus?: string;
  /** Confidence tier of Amazon cost capture (drives dashboard profit aggregation). */
  costCaptureStatus?: OrderCostCaptureStatus;
  /**
   * Basis of the persisted `netProfit` value, derived from `costCaptureStatus`
   * at read time (no DB column). CONFIRMED = LINKED (real Amazon costs);
   * ESTIMATED = PROVISIONAL (purchase price + configured tax rate); else null.
   */
  profitBasis?: ProfitBasis | null;
  /** Lifecycle state of automated Amazon fulfillment for this order. */
  autoFulfillStatus?: AutoFulfillStatus;
  /**
   * When `autoFulfillStatus = BLOCKED`, the fail-closed obstacle encountered.
   * Null/undefined otherwise. Drives the "needs attention" filter + chip tooltip.
   */
  autoFulfillBlockedReason?: AutoFulfillBlockedReason | null;
  /**
   * Set when the linked AMAZON purchase was observed cancelled by the tracker.
   * The local eBay order status is deliberately NOT changed — the eBay sale is
   * still live and must be fulfilled another way. Included in the
   * "needs attention" filter so the operator sees it.
   */
  amazonCancelledAt?: string | null;
  /**
   * Seller-facing fulfillment state, derived server-side from
   * `status` + `autoFulfillStatus` + `amazonOrderId` + `amazonCancelledAt`.
   * The one value the list column, detail page and filter all read, so the UI
   * never has to re-implement the precedence rules (an Amazon cancellation
   * outranking a placed order, a simulated order never counting as purchased).
   */
  fulfillmentState?: OrderFulfillmentState;
  /** The one seller-facing status — see `OrderStage` / `deriveOrderStage`. */
  stage: OrderStage;
  /** `orders.shipped_detected_at` (089): Amazon first observed shipped. Drives
   *  the "tracking held" badge's amber → red switch on the web. */
  shippedDetectedAt?: string | null;
  /** `orders.ebay_tracking_pushed_at` (089): eBay received the fulfillment. */
  ebayTrackingPushedAt?: string | null;
  /** True when `amazonOrderId` is a dry-run placeholder, not a real purchase. */
  isSimulated?: boolean;
  /**
   * Whether the seller may start the automatic Amazon purchase by hand —
   * `canStartAutoFulfillManually`, computed server-side so the button and the
   * endpoint (`POST /amazon/orders/:id/start-auto-fulfill`) never disagree.
   */
  canStartAutoFulfill?: boolean;
  /**
   * How many line items the eBay order holds. Above 1 the platform tracks only
   * the first one and never buys automatically — the detail page says so.
   */
  lineItemCount?: number | null;
  /** eBay's ship-by deadline for the (first) line item, or null. */
  shipByDate?: string | null;
  /**
   * The step-by-step timeline (`buildOrderTimeline`). Present on the single
   * order read only — the list never renders it.
   */
  timeline?: OrderTimelineStepDto[];

  // Product
  product?: {
    title: string;
    asin?: string;
    ebayItemId?: string;
    sku?: string;
    quantity: number;
    imageUrl?: string;
  };

  // Financial - eBay side
  salePrice: number;
  saleShipping: number;
  saleTax: number;
  saleTotal: number;
  ebayEarnings: number;

  // Financial - Amazon side
  purchasePrice: number;
  /**
   * The Amazon order this was bought on. Surfaced so a seller can reconcile the
   * eBay sale against their Amazon account without opening the detail page.
   * A `SIM-` prefix means a dry-run placeholder, not a real purchase.
   */
  amazonOrderId?: string | null;
  amazonOrderUrl?: string;
  amazonTrackingUrl?: string;
  /**
   * Amazon's own tracking number, and the converted number the eBay buyer
   * actually sees. Both are needed to answer "can this order's tracking still
   * be converted?" — there must be a source number, and it must not already
   * have been converted (a conversion is paid for and must never be bought
   * twice for one shipment).
   */
  amazonTrackingNumber?: string | null;
  convertedTrackingNumber?: string | null;
  /**
   * What eBay actually received via `createShippingFulfillment`. eBay's
   * Fulfillment API is POST-only with no update endpoint, so once this is
   * set the buyer's tracking number is permanent — the convert action must
   * never be offered once it is non-null. See `TrackingConversionService`.
   */
  ebayTrackingPushedNumber?: string | null;
  /**
   * The provider's own code for the latest tracking problem, when one is
   * open. Raw and unmapped — the caller must never render it directly; map
   * it to a localized sentence and fall back to a generic message for a
   * code outside `AquilineProblemCode` (the provider may add codes we do
   * not know about yet). NULL for every order until the webhook receiver
   * that writes it ships (a later, separate plan).
   */
  trackingProblemCode?: string | null;
  amazonTax?: number;
  amazonShipping?: number;

  // Financial - Calculated
  netProfit: number;
  transactionFee: number;
  adFee: number;
  /**
   * eBay's own reported final value fee total (migration 098), captured from
   * the same `getOrders` response order sync already downloads. NULL means
   * eBay had not reported it when this order was last synced — `transactionFee`
   * above (the seller's own configured fee-percent estimate) is what to show
   * instead in that case. When present, this is the real number and should
   * be preferred everywhere `transactionFee` would otherwise be shown.
   */
  ebayMarketplaceFee?: number | null;
  /**
   * The sales tax eBay collected from the buyer and remits directly — never
   * part of the seller's earnings. Usually equal to `saleTax`, captured
   * separately because eBay reports it distinctly and NULL here specifically
   * means "not confirmed from this field yet" (see CLAUDE.md's Collect & Remit
   * note), not that no tax was charged.
   */
  ebayCollectRemitTax?: number | null;
  /**
   * When eBay cancelled the order (`cancelStatus.cancelledDate`), or null. Set by
   * the order re-sync; a cancelled order also carries `status = cancelled`.
   */
  ebayCancelledAt?: string | null;
  /**
   * Sum of `paymentSummary.refunds[].amount` — what eBay reports was refunded to
   * the buyer, as "the seller's net amount" (eBay-collected tax is not in it).
   * NULL = eBay reported no refund.
   */
  ebayRefundedAmount?: number | null;
  /** The latest `refunds[].refundDate`, or null. */
  ebayRefundedAt?: string | null;

  // Shipping
  // Buyer ship-to address. `fullName`/`street2`/`phone` are optional because
  // eBay does not always supply them, but auto-fulfill needs them to match a
  // saved Amazon address (or fill the add-address form) for the RIGHT recipient.
  shippingAddress?: {
    fullName?: string;
    street: string;
    street2?: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
    phone?: string;
  };

  // Detailed breakdown (from eBay order API)
  details?: {
    purchaseSummary?: {
      subtotal?: number;
      shipping?: number;
      tax?: number;
      total?: number;
      paymentMethod?: string;
    };
    ebaySummary?: {
      subtotal?: number;
      shipping?: number;
      tax?: number;
      total?: number;
      earnings?: number;
    };
  };

  // Fee breakdown
  fees?: {
    transactionFee?: number;
    advertisingFee?: number;
  };
}

export interface OrderStatsDto {
  totalSales: number;
  totalProfit: number;
  totalOrders: number;
  activeOrders: number;
  todayOrders: number;
  todayRevenue: number;
  salesGrowth?: number;
  profitGrowth?: number;
  returnRate?: number;
}

/** `GET /orders/stage-counts` — every stage is present, 0 when empty, so the
 *  tabs never render an undefined count. */
export type OrderStageCountsDto = Record<OrderStage, number>;

/**
 * `POST /amazon/orders/:orderId/start-auto-fulfill` — the purchase was queued.
 * `dryRun` is the chosen Amazon account's test-run flag, so the page can say
 * "test run started, nothing will be bought" instead of implying a purchase.
 */
export interface StartAutoFulfillResultDto {
  queued: true;
  dryRun: boolean;
}

/**
 * `POST /amazon/orders/:orderId/confirm-not-purchased` — the click stamp was
 * cleared: the order left the `purchase_unknown` stage and the automatic
 * purchase may be started again.
 */
export interface ConfirmNotPurchasedResultDto {
  cleared: true;
}

export interface OrderFiltersDto {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: OrderStatus;
  /** Filter by connected eBay store (ebay_accounts.id). */
  ebayAccountId?: string;
  /** Filter to one or more stages (`?stage=a,b`). The list page's tabs send
   *  a group, the Status select sends one. Unknown values are dropped by the
   *  controller. */
  stages?: OrderStage[];
  /**
   * When true, restrict to orders whose automated Amazon fulfillment hit a
   * fail-closed obstacle (`auto_fulfill_status IN ('blocked','failed')`) so
   * the operator can fall back to manual linking.
   */
  autoFulfillNeedsAttention?: boolean;
  /**
   * Filter by the derived seller-facing fulfillment state. Preferred over
   * `autoFulfillNeedsAttention`, which could only express one boolean question
   * and left "which orders were actually bought on Amazon?" unanswerable.
   */
  fulfillmentState?: OrderFulfillmentState;
  /**
   * Filter by whether the order matched a SellerHill listing (`listing_id`).
   * An unmatched order — e.g. a seller migrating from another tool, whose
   * eBay item was never imported here — is never priced/stocked/auto-ordered
   * by this platform; `cost_capture_status` stays `untracked` forever. This
   * is independent of `fulfillmentState`: an order CAN have a matched listing
   * and still report `NOT_AUTOMATED` (auto-fulfill simply off/pending), so
   * `fulfillmentState` alone cannot answer "is this even one of ours".
   */
  isTracked?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface OrderSyncResponseDto {
  orders: OrderDto[];
  total: number;
  stats: OrderStatsDto;
  message: string;
}
