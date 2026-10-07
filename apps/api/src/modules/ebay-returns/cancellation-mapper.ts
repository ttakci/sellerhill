// apps/api/src/modules/ebay-returns/cancellation-mapper.ts
//
// eBay `CancelSummary` (a `cancellations[]` entry of
// `GET /post-order/v2/cancellation/search`) or `CancelDetail` (the
// `cancelDetail` container of `GET …/cancellation/{cancelId}` — same field
// names) → one `ebay_cancellations` row.
//
// Pure and total, like `return-mapper.ts` (whose coercions it reuses): enum
// fields are carried as eBay sent them and nothing here throws. The ONLY input
// that maps to nothing is one without a `cancelId` — there is no key to store
// it under.

import { asCurrency, asIsoDate, asNumber, asRecord, asText } from './return-mapper';

/** The mapped columns of an `ebay_cancellations` row (migration 145). */
export interface EbayCancellationRow {
  cancelId: string;
  legacyOrderId: string | null;
  marketplaceId: string | null;
  requestorType: string | null;
  state: string | null;
  status: string | null;
  reason: string | null;
  closeReason: string | null;
  buyerLoginName: string | null;
  /** ISO 8601, or null when eBay sent none / an unparseable one (every date below too). */
  requestedAt: string | null;
  sellerRespondBy: string | null;
  buyerRespondBy: string | null;
  closedAt: string | null;
  requestedRefundAmount: number | null;
  currency: string | null;
  paymentStatus: string | null;
}

/** eBay `DateTime.value`, from its container. */
const dateValue = (container: unknown): string | null => asIsoDate(asRecord(container)?.value);

export function mapCancellation(entry: unknown): EbayCancellationRow | null {
  const root = asRecord(entry);
  if (!root) {
    return null;
  }
  const cancelId = asText(root.cancelId);
  if (cancelId === null) {
    return null;
  }
  const refund = asRecord(root.requestRefundAmount);
  return {
    cancelId,
    legacyOrderId: asText(root.legacyOrderId),
    marketplaceId: asText(root.marketplaceId),
    requestorType: asText(root.requestorType),
    state: asText(root.cancelState),
    status: asText(root.cancelStatus),
    reason: asText(root.cancelReason),
    closeReason: asText(root.cancelCloseReason),
    buyerLoginName: asText(root.buyerLoginName),
    requestedAt: dateValue(root.cancelRequestDate),
    sellerRespondBy: dateValue(root.sellerResponseDueDate),
    buyerRespondBy: dateValue(root.buyerResponseDueDate),
    closedAt: dateValue(root.cancelCloseDate),
    requestedRefundAmount: asNumber(refund?.value),
    currency: asCurrency(refund?.currency),
    paymentStatus: asText(root.paymentStatus),
  };
}
