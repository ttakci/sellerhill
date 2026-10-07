// apps/api/src/modules/ebay-returns/return-mapper.ts
//
// eBay `ReturnSummaryType` (one `members[]` entry of
// `GET /post-order/v2/return/search`) → one `ebay_returns` row.
//
// Pure and total: every field is optional in eBay's reference, enumerations
// are carried as eBay sent them (an unknown future value is stored, never
// dropped), and nothing here throws. The ONLY input that maps to nothing is a
// member without a `returnId` — there is no key to store it under.

/** The mapped columns of an `ebay_returns` row (migration 128). */
export interface EbayReturnRow {
  returnId: string;
  ebayOrderId: string | null;
  ebayItemId: string | null;
  ebayTransactionId: string | null;
  returnQuantity: number | null;
  state: string | null;
  status: string | null;
  currentType: string | null;
  reason: string | null;
  reasonType: string | null;
  buyerComment: string | null;
  buyerLoginName: string | null;
  sellerActivityDue: string | null;
  /** ISO 8601, or null when eBay sent none / an unparseable one. */
  sellerRespondBy: string | null;
  estimatedRefundAmount: number | null;
  actualRefundAmount: number | null;
  currency: string | null;
  escalationCaseId: string | null;
  /** ISO 8601, or null when eBay sent none / an unparseable one. */
  createdOnEbayAt: string | null;
}

export type RawRecord = Record<string, unknown>;

export const asRecord = (value: unknown): RawRecord | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as RawRecord) : null;

/** A non-empty string, trimmed. An id eBay serialised as a number is kept as its digits. */
export function asText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** The buyer's own words: a string only, kept verbatim apart from surrounding whitespace. */
function asFreeText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** A finite number, given as a number or a numeric string. */
export function asNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Largest value a Postgres INTEGER column holds. */
const PG_INT_MAX = 2_147_483_647;

/** `returnQuantity` is documented as an integer; anything else is not a quantity. */
function asQuantity(value: unknown): number | null {
  const parsed = asNumber(value);
  return parsed !== null && Number.isInteger(parsed) && parsed >= 0 && parsed <= PG_INT_MAX ? parsed : null;
}

/** eBay `DateTime.value` ("formatted as an ISO 8601 string") → normalised ISO, or null. */
export function asIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const time = new Date(value.trim()).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

/** eBay `Amount.currency`: "a three-letter ISO 4217 code". Anything else is not stored. */
export function asCurrency(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const upper = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(upper) ? upper : null;
}

export function mapReturnSummary(member: unknown): EbayReturnRow | null {
  const root = asRecord(member);
  if (!root) {
    return null;
  }
  const returnId = asText(root.returnId);
  if (returnId === null) {
    return null;
  }

  const creationInfo = asRecord(root.creationInfo);
  const item = asRecord(creationInfo?.item);
  const comments = asRecord(creationInfo?.comments);
  const creationDate = asRecord(creationInfo?.creationDate);
  const sellerResponseDue = asRecord(root.sellerResponseDue);
  const respondByDate = asRecord(sellerResponseDue?.respondByDate);
  const sellerTotalRefund = asRecord(root.sellerTotalRefund);
  const estimated = asRecord(sellerTotalRefund?.estimatedRefundAmount);
  const actual = asRecord(sellerTotalRefund?.actualRefundAmount);
  const escalationInfo = asRecord(root.escalationInfo);

  return {
    returnId,
    ebayOrderId: asText(root.orderId),
    ebayItemId: asText(item?.itemId),
    ebayTransactionId: asText(item?.transactionId),
    returnQuantity: asQuantity(item?.returnQuantity),
    state: asText(root.state),
    status: asText(root.status),
    currentType: asText(root.currentType),
    reason: asText(creationInfo?.reason),
    reasonType: asText(creationInfo?.reasonType),
    buyerComment: asFreeText(comments?.content),
    buyerLoginName: asText(root.buyerLoginName),
    sellerActivityDue: asText(sellerResponseDue?.activityDue),
    sellerRespondBy: asIsoDate(respondByDate?.value),
    estimatedRefundAmount: asNumber(estimated?.value),
    actualRefundAmount: asNumber(actual?.value),
    // Both amounts of one `sellerTotalRefund` are the same money; the actual
    // amount's code is read only when the estimate carries none.
    currency: asCurrency(estimated?.currency) ?? asCurrency(actual?.currency),
    escalationCaseId: asText(escalationInfo?.caseId),
    createdOnEbayAt: asIsoDate(creationDate?.value),
  };
}
