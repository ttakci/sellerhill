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
  /** True when `amazonOrderId` is a dry-run placeholder, not a real purchase. */
  isSimulated?: boolean;

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
  amazonTax?: number;
  amazonShipping?: number;

  // Financial - Calculated
  netProfit: number;
  transactionFee: number;
  adFee: number;

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

export interface OrderFiltersDto {
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: OrderStatus;
  /** Filter by connected eBay store (ebay_accounts.id). */
  ebayAccountId?: string;
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
