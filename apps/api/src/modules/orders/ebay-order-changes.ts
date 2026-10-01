// apps/api/src/modules/orders/ebay-order-changes.ts
//
// Pure readers for what changes on an eBay order AFTER it was first ingested:
// a cancellation, a refund, a fulfilment status moving on. Order sync filters on
// `lastmodifieddate`, so the same order arrives again whenever eBay touches it;
// these functions decide what the second (third, …) arrival may change.
//
// Every field read here is documented in
// docs/ebay-reference/sell-fulfillment-v1-oas3.json (Order, CancelStatus,
// PaymentSummary, OrderRefund). The enum VALUE pages are not obtainable
// (README "Not obtainable"), so nothing below depends on an enum list: a
// cancellation is read from `cancelledDate`, a refund from `refunds[]`.

import { AutoFulfillStatus, OrderStatus } from '@repo/shared';

export interface EbayCancelStatus {
  /** "always returned"; `NONE_REQUESTED` when no cancel request was made. */
  cancelState?: string;
  /** "The date and time the order was cancelled, if applicable." */
  cancelledDate?: string;
  /**
   * The buyer's cancellation requests. Documented as "always empty" on
   * `getOrders` and "fully populated" on `getOrder`, so only the single-order
   * read before a purchase can count them.
   */
  cancelRequests?: unknown[];
}

export interface EbayOrderRefund {
  /** "the seller's net amount received from the sale/transaction" — eBay-collected tax is not in it. */
  amount?: { value?: string; currency?: string };
  /** "This field is not returned until the refund has been issued." */
  refundDate?: string;
  refundId?: string;
  refundStatus?: string;
}

/**
 * The `cancelState` a really cancelled production order carried on 2026-09-30
 * (observed, together with a `cancelledDate`). Used only as a second signal
 * beside `cancelledDate`, which is the documented one.
 */
export const EBAY_CANCEL_STATE_CANCELED = 'CANCELED';

const parseDate = (value: string | undefined): Date | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
};

export interface OrderCancellation {
  cancelState: string | null;
  cancelledAt: Date | null;
  isCancelled: boolean;
  /** How many cancel requests the payload lists (0 on `getOrders`, by contract). */
  cancelRequestCount: number;
}

export function readCancellation(cancelStatus: EbayCancelStatus | undefined | null): OrderCancellation {
  const cancelState = cancelStatus?.cancelState?.trim() || null;
  const cancelledAt = parseDate(cancelStatus?.cancelledDate);
  return {
    cancelState,
    cancelledAt,
    isCancelled: cancelledAt !== null || cancelState === EBAY_CANCEL_STATE_CANCELED,
    cancelRequestCount: Array.isArray(cancelStatus?.cancelRequests) ? cancelStatus.cancelRequests.length : 0,
  };
}

/** eBay's ship-by deadline for a line item, or null when absent or unparseable. */
export function readShipByDate(value: string | undefined | null): Date | null {
  return parseDate(value ?? undefined);
}

export interface OrderRefundSummary {
  /** Sum of the issued refunds, or null when eBay reports none. */
  refundedAmount: number | null;
  /** The latest `refundDate`, or null. */
  refundedAt: Date | null;
}

/**
 * Only an ISSUED refund counts: eBay documents `refundDate` as "not returned
 * until the refund has been issued", so an entry without one is a refund still
 * being processed and its amount is not money that has left yet.
 */
export function readRefunds(refunds: EbayOrderRefund[] | undefined | null): OrderRefundSummary {
  let total = 0;
  let count = 0;
  let latest: Date | null = null;
  for (const refund of refunds ?? []) {
    const issuedAt = parseDate(refund?.refundDate);
    const amount = Number.parseFloat(refund?.amount?.value ?? '');
    if (!issuedAt || !Number.isFinite(amount) || amount < 0) {
      continue;
    }
    total += amount;
    count += 1;
    if (!latest || issuedAt.getTime() > latest.getTime()) {
      latest = issuedAt;
    }
  }
  return {
    refundedAmount: count > 0 ? Math.round(total * 100) / 100 : null,
    refundedAt: latest,
  };
}

/**
 * How far along an order is. eBay never reports COMPLETED (that is written
 * locally when Amazon reports delivery), so a re-synced order must not fall
 * back from it — nor from SHIPPED to an earlier state.
 */
const STATUS_RANK: Readonly<Record<OrderStatus, number>> = {
  [OrderStatus.PENDING]: 0,
  [OrderStatus.WAITING_SHIPMENT]: 1,
  [OrderStatus.PROCESSING]: 2,
  [OrderStatus.SHIPPED]: 3,
  [OrderStatus.COMPLETED]: 4,
  // Not on the ladder: a cancellation is handled before the rank is consulted.
  [OrderStatus.CANCELLED]: 5,
};

/**
 * The status a re-synced order ends up with.
 *
 *  - eBay says cancelled → cancelled, whatever we held (the sale is void).
 *  - we hold cancelled   → stays cancelled.
 *  - otherwise the order only ever moves FORWARD: a status we advanced
 *    ourselves (SHIPPED after our tracking push, COMPLETED on delivery) is
 *    never rewound by eBay's coarser view.
 */
export function mergeSyncedOrderStatus(current: OrderStatus | null, incoming: OrderStatus): OrderStatus {
  if (incoming === OrderStatus.CANCELLED || current === null) {
    return incoming;
  }
  if (current === OrderStatus.CANCELLED) {
    return current;
  }
  return STATUS_RANK[incoming] >= STATUS_RANK[current] ? incoming : current;
}

/**
 * SQL twin of `mergeSyncedOrderStatus` for the `ON CONFLICT DO UPDATE` clause,
 * generated from the same rank table so the two cannot drift. Only enum
 * constants are interpolated.
 */
export function buildSyncedStatusSql(): string {
  const rank = (column: string): string =>
    `CASE ${column}::text ${Object.entries(STATUS_RANK)
      .map(([status, value]) => `WHEN '${status}' THEN ${value}`)
      .join(' ')} ELSE 0 END`;
  return `CASE
          WHEN EXCLUDED.status::text = '${OrderStatus.CANCELLED}' THEN EXCLUDED.status
          WHEN orders.status::text = '${OrderStatus.CANCELLED}' THEN orders.status
          WHEN (${rank('EXCLUDED.status')}) >= (${rank('orders.status')}) THEN EXCLUDED.status
          ELSE orders.status
        END`;
}

/** Automation for a brand-new sale is only started while the sale is recent. */
export const FRESH_SALE_WINDOW_DAYS = 7;

export interface IngestDecision {
  /**
   * The order may be written. False for an order created before the store was
   * connected that we do not already hold: re-reading by modification date
   * surfaces old orders eBay happened to touch, and admitting an arbitrary
   * subset of pre-connection history would make the dashboard inconsistent.
   */
  mayInsert: boolean;
  /**
   * A genuinely new, recent sale — the only case in which the one-time side
   * effects (stock decrement, automatic purchase, the "order received"
   * message) may run. An order first seen long after it was placed is recorded
   * and nothing else: buying it now, or thanking the buyer weeks late, would
   * be acting on stale news.
   */
  isFreshSale: (inserted: boolean) => boolean;
}

/**
 * The automation status a NEW order row is inserted with.
 *
 * `pending` means "a purchase job is about to be queued" and reads as the
 * `buying` stage. The column's default used to hand it to EVERY new row, so a
 * sale the platform will never buy — no SellerHill listing behind it, or first
 * seen long after it was placed — said "buying on Amazon" for ever, with no
 * job anywhere. A row now starts at `pending` only when the automatic-purchase
 * gate in the sync loop (`freshSale && listingId && entity.quantity > 0`) is
 * about to run for it; every other row starts at `skipped` (no reason: nothing
 * went wrong, automation simply does not apply). Keep this predicate equal to
 * that gate.
 */
export function initialAutoFulfillStatus(input: {
  /** `IngestDecision.isFreshSale(true)` — what the sale is IF this is an insert. */
  freshIfInserted: boolean;
  hasListing: boolean;
  quantity: number;
}): AutoFulfillStatus {
  return input.freshIfInserted && input.hasListing && input.quantity > 0
    ? AutoFulfillStatus.PENDING
    : AutoFulfillStatus.SKIPPED;
}

export function decideIngest(input: {
  orderCreatedAt: Date | null;
  storeConnectedAt: Date;
  now: Date;
}): IngestDecision {
  const { orderCreatedAt, storeConnectedAt, now } = input;
  const createdAfterConnect = orderCreatedAt !== null && orderCreatedAt.getTime() >= storeConnectedAt.getTime();
  const recent =
    orderCreatedAt !== null && now.getTime() - orderCreatedAt.getTime() <= FRESH_SALE_WINDOW_DAYS * 86_400_000;
  return {
    mayInsert: createdAfterConnect,
    isFreshSale: (inserted: boolean) => inserted && createdAfterConnect && recent,
  };
}
