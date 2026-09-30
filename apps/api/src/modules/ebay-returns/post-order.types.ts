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
