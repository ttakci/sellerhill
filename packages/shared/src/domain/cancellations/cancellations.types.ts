// packages/shared/src/domain/cancellations/cancellations.types.ts
//
// eBay buyer cancellation requests as SellerHill shows them, read from the
// Post-Order API (docs/ebay-reference/post-order/post-order_v2_cancellation_*.txt).
// `state` / `status` / `reason` / `closeReason` are eBay's `CancelStateEnum`,
// `CancelStatusEnum`, `CancelReasonEnum` and `CancelCloseReasonEnum` — none of
// whose value pages is in the local reference — so they are carried as
// strings and nothing switches on them. The grouping is derived from dates and
// `requestorType` alone (`cancellation-bucket.ts`).

/** SellerHill's own grouping of a cancellation request. Derived, never stored. */
export enum CancellationBucket {
  /** Open as of the last sweep that saw it, but eBay has not confirmed it since. */
  UNCONFIRMED = 'unconfirmed',
  /** A buyer's request with a seller response date that has passed. */
  ACTION_OVERDUE = 'action_overdue',
  /** A buyer's request eBay is waiting on the seller to answer (`sellerResponseDueDate`). */
  ACTION_DUE = 'action_due',
  /**
   * The seller answered from SellerHill (`seller_answered_at`) and eBay has not
   * closed the request yet. eBay keeps sending `sellerResponseDueDate` while it
   * processes the answer, so without this the request read as ACTION_DUE.
   */
  ANSWERED = 'answered',
  /** Open, nothing due from the seller right now. */
  IN_PROGRESS = 'in_progress',
  /** eBay closed the request (`cancelCloseDate`), whatever the outcome. */
  CLOSED = 'closed',
}

/** Tabs on the cancellations page (`CANCELLATION_TABS` maps each to its buckets). */
export enum CancellationTab {
  ALL = 'all',
  ACTION = 'action',
  IN_PROGRESS = 'in_progress',
  CLOSED = 'closed',
}

/**
 * `cancelState` value that means the request is over — the value the search
 * page's own samples carry on every closed request. The bucket also reads
 * `cancelCloseDate`, which is documented ("returned if/when the cancellation
 * request is closed (regardless of outcome)"), so this is a second signal only.
 */
export const EBAY_CANCEL_STATE_CLOSED = 'CLOSED';

/** `requestorType` (`PartyEnum`, listed on the search page): the buyer opened the request. */
export const EBAY_CANCEL_REQUESTOR_BUYER = 'BUYER';

/**
 * `activityParty` of a seller step in `activityHistories[]` (`PartyEnum`). A
 * live request whose history already holds a SELLER step was answered — on
 * SellerHill or on eBay's own site (observed 2026-10-07: `SELLER_APPROVE`).
 */
export const EBAY_CANCEL_PARTY_SELLER = 'SELLER';

/**
 * The two answers SellerHill sends itself, each a documented Post-Order call:
 * - approve → `POST /post-order/v2/cancellation/{cancelId}/approve` (no payload)
 * - reject  → `POST /post-order/v2/cancellation/{cancelId}/reject`  (`{}` or shipment date + tracking)
 */
export enum EbayCancellationAction {
  APPROVE = 'approve',
  REJECT = 'reject',
}

const ACTION_VALUES: readonly string[] = Object.values(EbayCancellationAction);

export function isEbayCancellationAction(value: unknown): value is EbayCancellationAction {
  return typeof value === 'string' && ACTION_VALUES.includes(value);
}

/** The product of the linked order's listing — the same join the returns page uses. */
export interface EbayCancellationProductDto {
  title: string | null;
  imageUrl: string | null;
  asin: string | null;
  /** The listing's eBay item id. */
  ebayItemId: string | null;
}

export interface EbayCancellationDto {
  /** `ebay_cancellations.id`. */
  id: string;
  /** eBay's cancel id. */
  cancelId: string;
  ebayAccountId: string;
  /** eBay's `legacyOrderId` — the order the request was filed against. */
  legacyOrderId: string | null;
  /** SellerHill's order row, when that eBay order is one we hold. */
  orderId: string | null;
  bucket: CancellationBucket;
  /** eBay `CancelStateEnum`, as sent. */
  state: string | null;
  /** eBay `CancelStatusEnum`, as sent. */
  status: string | null;
  /** eBay `CancelReasonEnum`, as sent. */
  reason: string | null;
  /** eBay `CancelCloseReasonEnum`, as sent. */
  closeReason: string | null;
  /** `BUYER` | `SELLER` (eBay `PartyEnum`). */
  requestorType: string | null;
  buyerLoginName: string | null;
  requestedAt: string | null;
  sellerRespondBy: string | null;
  closedAt: string | null;
  /** `requestRefundAmount.value` — what the buyer expects back if the order is cancelled. */
  requestedRefundAmount: number | null;
  currency: string | null;
  lastSyncedAt: string;
  /** The answer SellerHill sent and eBay accepted; null when the seller has not answered from SellerHill. */
  sellerAnswer: EbayCancellationAction | null;
  sellerAnsweredAt: string | null;
  /** Operator switch `ebay.cancellations.actionsEnabled` — the card hides the buttons when false. */
  actionsEnabled: boolean;
  /** Empty unless the bucket is action_due / action_overdue and `actionsEnabled`. */
  availableActions: EbayCancellationAction[];
  /** Linked order → listing → product; null when the request is not linked or the order has no listing. */
  product: EbayCancellationProductDto | null;
}

export interface CancellationsQueryDto {
  page?: number;
  limit?: number;
  tab?: CancellationTab;
  ebayAccountId?: string;
  /** Matches the eBay cancel id, the eBay order id (`legacyOrderId`) or the product title. */
  search?: string;
  /** SellerHill order id — the requests filed against one order. */
  orderId?: string;
  /** Omitted = the default order (requests awaiting an answer first, soonest deadline first). */
  sortBy?: 'requestedAt' | 'dueBy' | 'refund';
  sortOrder?: 'asc' | 'desc';
}

export type CancellationBucketCountsDto = Record<CancellationBucket, number>;

/** One `activityHistories[]` entry of `GET /post-order/v2/cancellation/{cancelId}`. */
export interface EbayCancellationHistoryEntryDto {
  /** `activityType` (`CancelActivityTypeEnum`, not in the local reference), as sent. */
  activity: string | null;
  /** `activityParty` (`PartyEnum`: `BUYER` | `SELLER` | `UNKNOWN`), as sent. */
  party: string | null;
  /** `actionDate.value`. */
  at: string | null;
  /** `stateFrom` / `stateTo` (`CancelStateEnum`), as sent. */
  fromState: string | null;
  toState: string | null;
}

/**
 * One request in full: the stored row plus what a live
 * `GET /post-order/v2/cancellation/{cancelId}` said a moment ago. When that
 * read fails `live` is false, the live-only parts are empty and no answer is
 * offered.
 */
export interface EbayCancellationDetailDto extends EbayCancellationDto {
  /** True when eBay answered the detail read; false = stored row only, no actions. */
  live: boolean;
  /** `activityHistories[]`, oldest first. */
  history: EbayCancellationHistoryEntryDto[];
  /** `refundInfo.actualRefundDetail.actualRefund.totalAmount.value` — what eBay refunded the buyer. */
  actualRefundAmount: number | null;
  /** `payoutRecoupInfo.amountToRecoup.value` — eBay's "Amount you owe". */
  amountToRecoup: number | null;
  /** `paymentStatus` (`PaymentStatusEnum`), as sent. */
  paymentStatus: string | null;
  /** eBay's own page for the request (`buildEbayCancellationUrl`). */
  ebayUrl: string | null;
  /** The order on eBay's Seller Hub (`buildEbayOrderUrl`); null when the request names no order. */
  ebayOrderUrl: string | null;
}

/** `GET /v1/cancellations` — the seller's BUYER requests, those awaiting an answer first. */
export interface PaginatedCancellationsDto {
  items: EbayCancellationDto[];
  total: number;
  page: number;
  limit: number;
}

export interface EbayCancellationActionResultDto {
  action: EbayCancellationAction;
}

/**
 * Optional body of a REJECT: the shipment the seller enters on the decline form
 * (eBay's own decline page asks for the same two fields). Both optional; when
 * neither is sent the API falls back to the shipment already pushed to eBay.
 */
export interface EbayCancellationActionRequestDto {
  /** `YYYY-MM-DD`, the day the order shipped. */
  shipmentDate?: string;
  trackingNumber?: string;
}

/** i18n keys the API answers a refused or failed action with (`message`), in the `cancellations` namespace. */
export const CANCELLATION_ACTION_ERROR_KEY = {
  /** The operator has not switched in-app actions on. */
  ACTIONS_DISABLED: 'cancellations.errors.actionsDisabled',
  /** The LIVE request is not a buyer's open request awaiting the seller. */
  NOT_OFFERED: 'cancellations.errors.actionNotAvailable',
  SUSPENDED: 'cancellations.errors.suspended',
  /** eBay refused the call (a 4xx). */
  EBAY_REJECTED: 'cancellations.errors.ebayRejected',
  /** eBay could not be reached, or answered with an error of its own. */
  UNAVAILABLE: 'cancellations.errors.unavailable',
  /** The Post-Order API has no Sandbox. */
  SANDBOX: 'cancellations.errors.sandbox',
  NOT_FOUND: 'cancellations.errors.notFound',
} as const;

export type CancellationActionErrorKey =
  (typeof CANCELLATION_ACTION_ERROR_KEY)[keyof typeof CANCELLATION_ACTION_ERROR_KEY];
