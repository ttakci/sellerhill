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
}

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
}

export interface PaginatedReturnsDto {
  items: EbayReturnDto[];
  total: number;
  page: number;
  limit: number;
}

export type ReturnBucketCountsDto = Record<ReturnBucket, number>;
