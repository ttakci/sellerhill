// apps/api/src/modules/ebay-returns/post-order.types.ts
//
// The response of `GET /post-order/v2/return/search`, exactly as eBay's
// reference documents it (docs/ebay-reference/post-order/
// post-order_v2_return_search__get.txt, "Payload model"). Only documented
// fields are listed, and only the ones this module reads or may need to
// reason about — nothing here is inferred from a live response.
//
// Every field is optional: the reference marks almost all of them
// "Conditionally" returned, and the enumerations carry the note "Code so that
// your app gracefully handles any future changes to this list", so enum fields
// are plain strings.

/** eBay `DateTime`. `value` is "formatted as an ISO 8601 string". */
export interface PostOrderDateTime {
  value?: string;
  formattedValue?: string;
}

/** eBay `Amount`. `currency` is "a three-letter ISO 4217 code". */
export interface PostOrderAmount {
  value?: number;
  currency?: string;
}

/** eBay `TotalRefundAmountType`. */
export interface PostOrderTotalRefundAmount {
  estimatedRefundAmount?: PostOrderAmount;
  actualRefundAmount?: PostOrderAmount;
}

/** eBay `ReturnResponseDueType`. */
export interface PostOrderReturnResponseDue {
  /** `ActivityOptionEnum`. */
  activityDue?: string;
  respondByDate?: PostOrderDateTime;
}

/** eBay `ReturnItemType`. */
export interface PostOrderReturnItem {
  itemId?: string;
  transactionId?: string;
  returnQuantity?: number;
}

/** eBay `Text`. */
export interface PostOrderText {
  content?: string;
  language?: string;
}

/** eBay `ReturnCreationInfoType`. */
export interface PostOrderReturnCreationInfo {
  comments?: PostOrderText;
  creationDate?: PostOrderDateTime;
  item?: PostOrderReturnItem;
  /** `ReturnReasonEnum`. */
  reason?: string;
  /** `ReturnReasonTypeEnum`. */
  reasonType?: string;
  /** `ReturnTypeEnum`. */
  type?: string;
}

/** eBay `EscalationInfoType` (only the field this module reads). */
export interface PostOrderEscalationInfo {
  caseId?: string;
}

/** eBay `AvailableOptionType`. */
export interface PostOrderAvailableOption {
  actionType?: string;
  actionURL?: string;
}

/** eBay `ReturnSummaryType` — one entry of `members[]`. */
export interface PostOrderReturnSummary {
  returnId?: string;
  orderId?: string;
  /** `ReturnStateEnum`. */
  state?: string;
  /** `ReturnStatusEnum`. */
  status?: string;
  /** `ReturnTypeEnum`. */
  currentType?: string;
  buyerLoginName?: string;
  sellerLoginName?: string;
  creationInfo?: PostOrderReturnCreationInfo;
  sellerResponseDue?: PostOrderReturnResponseDue;
  buyerResponseDue?: PostOrderReturnResponseDue;
  sellerTotalRefund?: PostOrderTotalRefundAmount;
  buyerTotalRefund?: PostOrderTotalRefundAmount;
  escalationInfo?: PostOrderEscalationInfo;
  sellerAvailableOptions?: PostOrderAvailableOption[];
  timeoutDate?: PostOrderDateTime;
}

/** eBay `PaginationOutput`. */
export interface PostOrderPaginationOutput {
  limit?: number;
  offset?: number;
  totalEntries?: number;
  totalPages?: number;
}

/** eBay `GetSummaryResponse`. */
export interface PostOrderReturnSearchResponse {
  members?: PostOrderReturnSummary[];
  paginationOutput?: PostOrderPaginationOutput;
}

export interface ReturnSearchParams {
  /** ISO 8601, e.g. `2021-05-15T03:52:39.000Z` (the reference's own example). */
  creationDateFrom: string;
}

/* ── GET /post-order/v2/return/{returnId} (fieldgroups=FULL → `detail` only) ── */

/** eBay `ResponseHistoryAttributesType` (only the fields this module reads). */
export interface PostOrderResponseHistoryAttributes {
  partialRefundAmount?: PostOrderAmount;
  RMA?: string;
  updatedTrackingNumber?: string;
}

/** eBay `ReturnResponseHistoryType`. */
export interface PostOrderResponseHistoryEntry {
  /** `ActivityOptionEnum`. */
  activity?: string;
  attributes?: PostOrderResponseHistoryAttributes;
  author?: string;
  creationDate?: PostOrderDateTime;
  fromState?: string;
  notes?: string;
  toState?: string;
}

/** eBay `ShipmentTrackingType` (only the fields this module reads). */
export interface PostOrderShipmentTracking {
  carrierName?: string;
  carrierUsed?: string;
  trackingNumber?: string;
  actualShipDate?: PostOrderDateTime;
  actualDeliveryDate?: PostOrderDateTime;
  deliveryStatus?: string;
  markAsReceived?: boolean;
  labelId?: string;
}

/** eBay `ShipmentType`. */
export interface PostOrderReturnShipmentInfo {
  allShipmentTrackings?: PostOrderShipmentTracking[];
}

/** eBay `ReturnCloseInfoType`. */
export interface PostOrderReturnCloseInfo {
  returnCloseDate?: PostOrderDateTime;
  returnCloseReason?: string;
}

/** eBay `ReturnItemDetailType` (only the field this module reads). */
export interface PostOrderReturnItemDetail {
  itemPrice?: PostOrderAmount;
}

/**
 * eBay `ReturnDetailType` — the `detail` container. It carries every field of
 * the search summary (same names) plus the history, the shipment and the
 * closing information.
 */
export interface PostOrderReturnDetail extends PostOrderReturnSummary {
  responseHistory?: PostOrderResponseHistoryEntry[];
  returnShipmentInfo?: PostOrderReturnShipmentInfo;
  closeInfo?: PostOrderReturnCloseInfo;
  itemDetail?: PostOrderReturnItemDetail;
}

/** eBay `GetDetailResponse`. */
export interface PostOrderReturnDetailResponse {
  detail?: PostOrderReturnDetail;
}

/* ── Write bodies (docs/ebay-reference/post-order/post-order_v2_return-returnid_*__post.txt) ── */

/** `POST …/decide` — `DecideReturnRequest`. Only the documented APPROVE decision is sent. */
export interface PostOrderDecideReturnRequest {
  decision: 'APPROVE';
  comments?: PostOrderText;
}

/** `POST …/issue_refund` — `IssueRefundRequest`. */
export interface PostOrderIssueRefundRequest {
  refundDetail: {
    itemizedRefundDetail: Array<{
      refundAmount: PostOrderAmount;
      /** `RefundFeeTypeEnum`; the reference's own sample uses `PURCHASE_PRICE`. */
      refundFeeType: string;
    }>;
    /** "should equal the sum of the values in the itemizedRefundDetail.refundAmount field(s)". */
    totalAmount: PostOrderAmount;
  };
  comments?: PostOrderText;
}

/** `POST …/mark_as_received` — comments only. */
export interface PostOrderMarkReceivedRequest {
  comments?: PostOrderText;
}

/** `refundStatus` in the decide / issue_refund answers (`Refund_MoneyMovementStatusEnum`). */
export interface PostOrderRefundStatusResponse {
  refundStatus?: string;
}

/* ── Cancellations (docs/ebay-reference/post-order/post-order_v2_cancellation_*.txt) ── */

/**
 * eBay `CancelSummary` — one `cancellations[]` entry of
 * `GET /post-order/v2/cancellation/search`. `cancelState`, `cancelStatus`,
 * `cancelReason` and `cancelCloseReason` are enums whose value pages are not
 * in the local reference: strings, never switched on.
 */
export interface PostOrderCancellationSummary {
  cancelId?: string;
  legacyOrderId?: string;
  marketplaceId?: string;
  cancelState?: string;
  cancelStatus?: string;
  cancelReason?: string;
  cancelCloseReason?: string;
  /** `PartyEnum`: `BUYER` | `SELLER` | `UNKNOWN`. */
  requestorType?: string;
  buyerLoginName?: string;
  sellerLoginName?: string;
  cancelRequestDate?: PostOrderDateTime;
  cancelCloseDate?: PostOrderDateTime;
  sellerResponseDueDate?: PostOrderDateTime;
  buyerResponseDueDate?: PostOrderDateTime;
  requestRefundAmount?: PostOrderAmount;
  /** `PaymentStatusEnum`. */
  paymentStatus?: string;
  /** `PartialOrderTypeEnum` — "should be FULL_ORDER". */
  partialOrderType?: string;
  shipmentDate?: PostOrderDateTime;
}

/** eBay `FindCancelResponse`. */
export interface PostOrderCancellationSearchResponse {
  cancellations?: PostOrderCancellationSummary[];
  paginationOutput?: PostOrderPaginationOutput;
  total?: number;
}

/** eBay `CancelActivityHistory` (fieldgroups=FULL). */
export interface PostOrderCancelActivityHistory {
  actionDate?: PostOrderDateTime;
  activityParty?: string;
  activityType?: string;
  stateFrom?: string;
  stateTo?: string;
}

/**
 * eBay `CancelDetail` — the `cancelDetail` container of
 * `GET /post-order/v2/cancellation/{cancelId}`: the summary's fields plus the
 * history, the buyer refund eBay issued and what eBay recoups from the seller
 * (only the fields read; `moneyMovementInfo` is not).
 */
export interface PostOrderCancellationDetail extends PostOrderCancellationSummary {
  activityHistories?: PostOrderCancelActivityHistory[];
  refundInfo?: {
    actualRefundDetail?: {
      /** `ActualRefund.totalAmount` — "the total amount of the buyer refund". */
      actualRefund?: { totalAmount?: PostOrderAmount };
    };
  };
  /** `PayoutRecoupInfo` — "will not be returned for unpaid orders". */
  payoutRecoupInfo?: {
    /** "the amount of the seller payout which must be recouped from the seller by eBay". */
    amountToRecoup?: PostOrderAmount;
  };
}

/**
 * `POST …/cancellation/{cancelId}/reject` — `RejectCancelRequest`. Both fields
 * optional; "If you do not include either of these fields, you must submit a
 * payload consisting of just the opening and closing braces ({ })."
 */
export interface PostOrderRejectCancelRequest {
  shipmentDate?: { value: string };
  trackingNumber?: string;
}

export interface CancellationSearchParams {
  /** ISO 8601; "Do not set the start date more than 18 months in the past." */
  creationDateFrom: string;
}
