// packages/shared/src/domain/returns/returns.types.ts
//
// eBay returns as SellerHill shows them. The raw values (`state`, `status`,
// `reason`, `reasonType`, `sellerActivityDue`) are eBay's own enumerations from
// the Post-Order API (docs/ebay-reference/post-order/types/*.txt) and are
// carried as strings: eBay adds values over time, and an unknown one must be
// stored and shown generically, never dropped.

/**
 * SellerHill's own grouping of a return — what the seller needs to know first.
 * Derived by `deriveReturnBucket`, never stored.
 */
export enum ReturnBucket {
  /**
   * Open as of the last time eBay reported it, but eBay has not confirmed it
   * since (see `resolveReturnFreshnessHours`). Whatever the row last said
   * about an action or a deadline is not shown as current.
   */
  UNCONFIRMED = 'unconfirmed',
  /** A seller action is due and its deadline has passed. */
  ACTION_OVERDUE = 'action_overdue',
  /** eBay reports a next action the seller is responsible for. */
  ACTION_DUE = 'action_due',
  /** The return was escalated to an eBay case. */
  ESCALATED = 'escalated',
  /** Open, nothing due from the seller right now. */
  IN_PROGRESS = 'in_progress',
  /** eBay closed the return. */
  CLOSED = 'closed',
}

/** Tabs on the returns page. */
export enum ReturnTab {
  ALL = 'all',
  ACTION = 'action',
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed',
}

/**
 * eBay `ReturnReasonTypeEnum` (docs/ebay-reference/post-order/types/ReturnReasonTypeEnum.txt).
 * The category of the buyer's reason — the complete documented list.
 */
export enum EbayReturnReasonType {
  /** "a cancellation request was made by the buyer after the item was already shipped" */
  CANCEL = 'CANCEL',
  /** In-Store Pickup / Click and Collect return. */
  INSTORE = 'INSTORE',
  /** Buyer's remorse — "nothing actually wrong with the item". */
  REMORSE = 'REMORSE',
  /** Significantly Not As Described. */
  SNAD = 'SNAD',
  UNKNOWN = 'UNKNOWN',
}

/**
 * The `ActivityOptionEnum` values that name something the SELLER does
 * (docs/ebay-reference/post-order/types/ActivityOptionEnum.txt). eBay returns
 * one of these — or another value of that enum — in `sellerResponseDue.activityDue`.
 * Only these are localized; any other value renders the generic
 * "respond on eBay" wording.
 */
export enum EbayReturnSellerActivity {
  SELLER_APPROVE_REQUEST = 'SELLER_APPROVE_REQUEST',
  SELLER_DECLINE_REQUEST = 'SELLER_DECLINE_REQUEST',
  SELLER_ISSUE_REFUND = 'SELLER_ISSUE_REFUND',
  SELLER_MARK_AS_RECEIVED = 'SELLER_MARK_AS_RECEIVED',
  SELLER_MARK_REFUND_SENT = 'SELLER_MARK_REFUND_SENT',
  SELLER_OFFER_PARTIAL_REFUND = 'SELLER_OFFER_PARTIAL_REFUND',
  SELLER_PRINT_SHIPPING_LABEL = 'SELLER_PRINT_SHIPPING_LABEL',
  SELLER_PROVIDE_LABEL = 'SELLER_PROVIDE_LABEL',
  SELLER_PROVIDE_RMA = 'SELLER_PROVIDE_RMA',
  SELLER_RETRY_REFUND = 'SELLER_RETRY_REFUND',
  REMINDER_FOR_REFUND = 'REMINDER_FOR_REFUND',
  REMINDER_FOR_REFUND_NO_SHIPPING = 'REMINDER_FOR_REFUND_NO_SHIPPING',
  REMINDER_FOR_RMA = 'REMINDER_FOR_RMA',
  REMINDER_SELLER_TO_RESPOND = 'REMINDER_SELLER_TO_RESPOND',
  SELLER_SEND_MESSAGE = 'SELLER_SEND_MESSAGE',
  SELLER_ESCALATE = 'SELLER_ESCALATE',
  SELLER_OFFER_REPLACEMENT = 'SELLER_OFFER_REPLACEMENT',
}

/**
 * The `ActivityOptionEnum` values the return history localizes (past tense,
 * `returns.history.<value>`). Any other value renders as a generic "buyer /
 * seller / eBay step" line by its prefix — never the raw enum.
 */
export const EBAY_RETURN_HISTORY_ACTIVITIES = [
  'BUYER_CREATE_RETURN',
  'BUYER_PRINT_SHIPPING_LABEL',
  'BUYER_PROVIDE_TRACKING_INFO',
  'BUYER_MARK_RETURN_SHIPPED',
  'BUYER_ESCALATE',
  'BUYER_CLOSE_RETURN',
  'BUYER_SEND_MESSAGE',
  'BUYER_ACCEPTS_PARTIAL_REFUND',
  'BUYER_DECLINE_PARTIAL_REFUND',
  'BUYER_MARK_REFUND_RECEIVED',
  'SELLER_APPROVE_REQUEST',
  'SELLER_DECLINE_REQUEST',
  'SELLER_ISSUE_REFUND',
  'SELLER_MARK_AS_RECEIVED',
  'SELLER_OFFER_PARTIAL_REFUND',
  'SELLER_PROVIDE_RMA',
  'SELLER_PROVIDE_LABEL',
  'SELLER_SEND_MESSAGE',
  'SELLER_ESCALATE',
  'SELLER_OFFER_REPLACEMENT',
  'SELLER_PROVIDE_TRACKING_INFO',
  'SYSTEM_CREATE_RETURN',
  'SYSTEM_CLOSE_RETURN',
  'SYSTEM_IMMEDIATE_REFUND',
  'SYSTEM_INITIATED_REFUND',
  'EBAY_RULE_AUTO_APPROVE',
] as const;

/** eBay `ReturnTypeEnum` (docs/ebay-reference/post-order/types/ReturnTypeEnum.txt). */
export const EBAY_RETURN_TYPES = ['MONEY_BACK', 'REPLACEMENT', 'EXCHANGE'] as const;

/** `closeInfo.returnCloseReason` values the page localizes; the enum's own page is not in the local reference. */
export const EBAY_RETURN_CLOSE_REASONS = ['FULL_REFUNDED', 'PARTIAL_REFUNDED', 'NO_REFUND'] as const;

/** eBay `ReturnStateEnum` / `ReturnStatusEnum` value that means the return is over. */
export const EBAY_RETURN_CLOSED = 'CLOSED';
/** eBay `ReturnStatusEnum` value: "the return request has been escalated to a return case". */
export const EBAY_RETURN_STATUS_ESCALATED = 'ESCALATED';

export interface EbayReturnProductDto {
  title: string | null;
  imageUrl: string | null;
  asin: string | null;
}

export interface EbayReturnDto {
  id: string;
  /** eBay's return id. */
  returnId: string;
  ebayAccountId: string;
  /** eBay's order id the return was filed against. */
  ebayOrderId: string | null;
  /** SellerHill's order row, when that eBay order is one we hold. */
  orderId: string | null;
  ebayItemId: string | null;
  returnQuantity: number | null;
  bucket: ReturnBucket;
  /** eBay `ReturnStateEnum`. */
  state: string | null;
  /** eBay `ReturnStatusEnum`. */
  status: string | null;
  /** eBay `ReturnReasonEnum`. */
  reason: string | null;
  /** eBay `ReturnReasonTypeEnum` — see `EbayReturnReasonType`. */
  reasonType: string | null;
  /** The buyer's own words (`creationInfo.comments.content`). */
  buyerComment: string | null;
  buyerLoginName: string | null;
  /** eBay `ActivityOptionEnum` — the next action the seller is responsible for. */
  sellerActivityDue: string | null;
  /** Deadline for `sellerActivityDue`, when eBay sets one. */
  sellerRespondBy: string | null;
  /** `sellerTotalRefund.estimatedRefundAmount`. */
  estimatedRefundAmount: number | null;
  /** `sellerTotalRefund.actualRefundAmount` — set once a refund was issued. */
  actualRefundAmount: number | null;
  currency: string | null;
  createdOnEbayAt: string | null;
  lastSyncedAt: string;
  product: EbayReturnProductDto | null;
}

export interface ReturnsQueryDto {
  page?: number;
  limit?: number;
  tab?: ReturnTab;
  ebayAccountId?: string;
  /** Matches the eBay return id, the eBay order id or the product title. */
  search?: string;
  /** Omitted = the default order (what needs the seller first, soonest deadline first). */
  sortBy?: 'openedAt' | 'dueBy' | 'refund';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedReturnsDto {
  items: EbayReturnDto[];
  total: number;
  page: number;
  limit: number;
}

export type ReturnBucketCountsDto = Record<ReturnBucket, number>;

/**
 * The return actions SellerHill performs itself, each one a documented
 * Post-Order call (docs/ebay-reference/post-order/):
 * - approve        → `POST /post-order/v2/return/{returnId}/decide` with `APPROVE`
 * - mark_received  → `POST /post-order/v2/return/{returnId}/mark_as_received`
 * - issue_refund   → `POST /post-order/v2/return/{returnId}/issue_refund`
 * Offered only while eBay lists the matching option on the return
 * (`resolveReturnActions`) and the operator's switch is on.
 */
export enum EbayReturnAction {
  APPROVE = 'approve',
  MARK_RECEIVED = 'mark_received',
  ISSUE_REFUND = 'issue_refund',
}

/** One entry of eBay's `responseHistory` — what happened to the return, by whom, when. */
export interface EbayReturnHistoryEntryDto {
  /** eBay `ActivityOptionEnum`, carried as sent. */
  activity: string | null;
  /** Who acted, as eBay names them (a login name, or eBay itself). */
  author: string | null;
  at: string | null;
  fromState: string | null;
  toState: string | null;
  notes: string | null;
  /** A partial-refund offer made in this step. */
  partialRefundAmount: number | null;
  trackingNumber: string | null;
  rma: string | null;
}

/** One return shipment eBay tracks (`returnShipmentInfo.allShipmentTrackings[]`). */
export interface EbayReturnShipmentDto {
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  /** eBay's delivery status, carried as sent. */
  deliveryStatus: string | null;
  markedReceived: boolean;
  labelId: string | null;
}

/**
 * One return in full: the stored row plus what a live
 * `GET /post-order/v2/return/{returnId}` said a moment ago. When that read
 * fails `live` is false and the live-only parts are empty — the page then
 * shows the stored row and offers no action.
 */
export interface EbayReturnDetailDto extends EbayReturnDto {
  /** True when eBay answered the detail read; false = stored data only. */
  live: boolean;
  /** The operator's switch for in-app actions. */
  actionsEnabled: boolean;
  /** In-app actions eBay lists on the return right now (empty while the switch is off). */
  availableActions: EbayReturnAction[];
  /** Every `sellerAvailableOptions[].actionType` eBay listed, carried as sent. */
  ebayOptions: string[];
  /** The eBay page for the next action (`sellerAvailableOptions[].actionURL`), when eBay gave one. */
  ebayUrl: string | null;
  history: EbayReturnHistoryEntryDto[];
  shipments: EbayReturnShipmentDto[];
  /** eBay `ReturnTypeEnum` (`currentType`), carried as sent. */
  returnType: string | null;
  itemPrice: number | null;
  /** eBay `closeInfo.returnCloseReason`, carried as sent. */
  closeReason: string | null;
  closedAt: string | null;
}

export interface EbayReturnActionResultDto {
  action: EbayReturnAction;
  /** `refundStatus` from eBay's answer, when the call returns one (decide / issue_refund). */
  refundStatus: string | null;
}
