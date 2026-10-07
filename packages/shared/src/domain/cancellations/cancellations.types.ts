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
  /** Open, nothing due from the seller right now. */
  IN_PROGRESS = 'in_progress',
  /** eBay closed the request (`cancelCloseDate`), whatever the outcome. */
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
  /** Operator switch `ebay.cancellations.actionsEnabled` — the card hides the buttons when false. */
  actionsEnabled: boolean;
  /** Empty unless the bucket is action_due / action_overdue and `actionsEnabled`. */
  availableActions: EbayCancellationAction[];
}

/** `GET /v1/cancellations` — the seller's requests, newest first (the fallback for unlinked rows). */
export interface PaginatedCancellationsDto {
  items: EbayCancellationDto[];
  total: number;
  page: number;
  limit: number;
}

export interface EbayCancellationActionResultDto {
  action: EbayCancellationAction;
}

/** i18n keys the API answers a refused or failed action with (`message`), in the `orders` namespace. */
export const CANCELLATION_ACTION_ERROR_KEY = {
  /** The operator has not switched in-app actions on. */
  ACTIONS_DISABLED: 'orders.cancellation.errors.actionsDisabled',
  /** The LIVE request is not a buyer's open request awaiting the seller. */
  NOT_OFFERED: 'orders.cancellation.errors.actionNotAvailable',
  SUSPENDED: 'orders.cancellation.errors.suspended',
  /** eBay refused the call (a 4xx). */
  EBAY_REJECTED: 'orders.cancellation.errors.ebayRejected',
  /** eBay could not be reached, or answered with an error of its own. */
  UNAVAILABLE: 'orders.cancellation.errors.unavailable',
  /** The Post-Order API has no Sandbox. */
  SANDBOX: 'orders.cancellation.errors.sandbox',
  NOT_FOUND: 'orders.cancellation.errors.notFound',
} as const;

export type CancellationActionErrorKey =
  (typeof CANCELLATION_ACTION_ERROR_KEY)[keyof typeof CANCELLATION_ACTION_ERROR_KEY];
