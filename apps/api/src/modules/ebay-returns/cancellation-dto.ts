// apps/api/src/modules/ebay-returns/cancellation-dto.ts
//
// ONE `ebay_cancellations` row → `EbayCancellationDto` mapping, shared by the
// `cancellations` routes and the orders list / detail (`OrdersService`), so
// the order card and the fallback list can never disagree on a bucket or on
// which answers are offered.

import {
  ACTIONABLE_CANCELLATION_BUCKETS,
  CancellationBucket,
  EbayCancellationAction,
  EbayCancellationDto,
} from '@repo/shared';

import { buildStoreScopedCancellationBucketSql } from './return-store-scope';

/** The columns `cancellationColumnsSql` selects. Dates/amounts arrive as pg types or as JSON (row_to_json). */
export interface CancellationDtoRow {
  id: string;
  cancel_id: string;
  ebay_account_id: string;
  legacy_order_id: string | null;
  order_id: string | null;
  bucket: string;
  state: string | null;
  status: string | null;
  reason: string | null;
  close_reason: string | null;
  requestor_type: string | null;
  buyer_login_name: string | null;
  requested_at: Date | string | null;
  seller_respond_by: Date | string | null;
  closed_at: Date | string | null;
  requested_refund_amount: string | number | null;
  currency: string | null;
  last_synced_at: Date | string;
}

/** The SELECT list over an `ebay_cancellations` alias, with the store-scoped bucket. */
export function cancellationColumnsSql(alias: string, freshnessHours: number): string {
  const columns = [
    'id',
    'cancel_id',
    'ebay_account_id',
    'legacy_order_id',
    'order_id',
    'state',
    'status',
    'reason',
    'close_reason',
    'requestor_type',
    'buyer_login_name',
    'requested_at',
    'seller_respond_by',
    'closed_at',
    'requested_refund_amount',
    'currency',
    'last_synced_at',
  ].map((column) => `${alias}.${column}`);
  return `${columns.join(', ')}, ${buildStoreScopedCancellationBucketSql(alias, freshnessHours)} AS bucket`;
}

const BUCKETS: readonly string[] = Object.values(CancellationBucket);

const iso = (value: Date | string | null): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

export function toCancellationDto(row: CancellationDtoRow, actionsEnabled: boolean): EbayCancellationDto {
  const bucket = BUCKETS.includes(row.bucket) ? (row.bucket as CancellationBucket) : CancellationBucket.UNCONFIRMED;
  const amount = row.requested_refund_amount === null ? null : Number(row.requested_refund_amount);
  return {
    id: row.id,
    cancelId: row.cancel_id,
    ebayAccountId: row.ebay_account_id,
    legacyOrderId: row.legacy_order_id,
    orderId: row.order_id,
    bucket,
    state: row.state,
    status: row.status,
    reason: row.reason,
    closeReason: row.close_reason,
    requestorType: row.requestor_type,
    buyerLoginName: row.buyer_login_name,
    requestedAt: iso(row.requested_at),
    sellerRespondBy: iso(row.seller_respond_by),
    closedAt: iso(row.closed_at),
    requestedRefundAmount: amount !== null && Number.isFinite(amount) ? amount : null,
    currency: row.currency,
    lastSyncedAt: iso(row.last_synced_at) ?? new Date(0).toISOString(),
    actionsEnabled,
    // Offered on the stored bucket; `act` re-checks against a LIVE read.
    availableActions:
      actionsEnabled && ACTIONABLE_CANCELLATION_BUCKETS.includes(bucket)
        ? [EbayCancellationAction.APPROVE, EbayCancellationAction.REJECT]
        : [],
  };
}
