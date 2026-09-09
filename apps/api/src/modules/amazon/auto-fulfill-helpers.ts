import {
  AutoFulfillBlockedReason as AutoFulfillBlockedReasonEnum,
  AutoFulfillStatus,
  OrderStatus,
} from '@repo/shared';

/**
 * Fail-closed obstacle reasons. Derived from the shared enum
 * (`packages/shared/src/domain/orders/orders.types.ts`) so the writer (this
 * module), the persisted `orders.auto_fulfill_blocked_reason` column, and the
 * FE chip mapping all reference ONE source of truth — a future enum edit can
 * never silently desync the union. String values mirror the enum members
 * (`no_asin` | `captcha` | `otp` | `login` | `out_of_stock` | `address` |
 * `payment` | `cap` | `no_confirmation` | `proxy_required` |
 * `quota_exhausted` | `cart`).
 */
export type AutoFulfillBlockedReason = `${AutoFulfillBlockedReasonEnum}`;

/**
 * Coarse pre-filter using the eBay sale_total. This is NOT the hard cap — the
 * hard cap is the Amazon review-step grand-total check. This only avoids
 * enqueueing orders that obviously exceed the cap.
 */
export function meetsCoarseCapGate(saleTotal: number, capTotal: number | null): boolean {
  if (capTotal === null) {
    return false;
  }
  return saleTotal > 0 && saleTotal <= capTotal;
}

/**
 * Round-robin selection: the enabled account with the oldest lastUsedAt
 * (null treated as 0 = oldest). Ties broken by id ascending. Deterministic.
 */
export function pickRoundRobinAccount<T extends { id: string; lastUsedAt: Date | null }>(
  accounts: T[],
): T | null {
  if (accounts.length === 0) {
    return null;
  }
  return [...accounts].sort((a, b) => {
    const at = a.lastUsedAt ? a.lastUsedAt.getTime() : 0;
    const bt = b.lastUsedAt ? b.lastUsedAt.getTime() : 0;
    if (at !== bt) {
      return at - bt;
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
}

/**
 * Idempotency guard. The fulfillment job re-reads status on start; if the
 * order is already in a terminal/no-op state, do nothing (prevents a BullMQ
 * retry from double-ordering or re-running a deliberate stop).
 */
export function shouldSkipFulfillStart(status: AutoFulfillStatus): boolean {
  return (
    status === AutoFulfillStatus.PLACED ||
    status === AutoFulfillStatus.BLOCKED ||
    status === AutoFulfillStatus.DRY_RUN ||
    status === AutoFulfillStatus.SKIPPED
  );
}

export interface ResumableOrderRow {
  ebay_order_id: string;
  auto_fulfill_status: string;
  auto_fulfill_blocked_reason: string | null;
  /** `orders.status` — eBay-side fulfillment state. */
  status: string;
  /** Non-null once *anything* bought this item (manual link, dry run). */
  amazon_order_id: string | null;
}

/**
 * Which blocked orders may be retried once the account is entitled again.
 *
 * Scoped to SUBSCRIPTION_SUSPENDED alone. Every other blocked reason describes
 * a condition payment does not change — and CAP is a spend guard, so reviving
 * one would place a purchase the seller capped.
 *
 * DUPLICATE-PURCHASE GUARD — this predicate (and the sweep SELECT that mirrors
 * it) is the ONLY thing in the codebase that moves a `blocked` order back to
 * `pending`, so it is the only place that can re-arm an order for a real Amazon
 * purchase. If a seller bought the item by hand during the lapse to save the
 * eBay sale, re-enqueueing here ships a duplicate. Two independent signals of
 * "already handled", because they catch different cases:
 *   - `amazon_order_id` set — someone bought/linked it; a blocked order never
 *     reached a purchase, so a non-null id is always a manual link or dry run.
 *     Catches an order still sitting at `processing` after a hand purchase.
 *   - `status` SHIPPED / COMPLETED — the buyer has been served (eBay tracking
 *     pushed, or delivery observed). Catches a hand purchase not yet linked.
 */
export function selectResumableOrders(rows: ResumableOrderRow[]): ResumableOrderRow[] {
  // The enum-typed columns hold enum string values; cast so each comparison is
  // against the shared enum, not a bare string (`no-unsafe-enum-comparison`).
  return rows.filter(
    (row) =>
      (row.auto_fulfill_status as AutoFulfillStatus) === AutoFulfillStatus.BLOCKED &&
      (row.auto_fulfill_blocked_reason as AutoFulfillBlockedReasonEnum | null) ===
        AutoFulfillBlockedReasonEnum.SUBSCRIPTION_SUSPENDED &&
      row.amazon_order_id === null &&
      (row.status as OrderStatus) !== OrderStatus.SHIPPED &&
      (row.status as OrderStatus) !== OrderStatus.COMPLETED,
  );
}

/** Sticky residential-proxy session token — per user (default) or per account. */
export function proxySessionToken(
  strategy: 'perUser' | 'perAccount',
  userId: string,
  amazonAccountId: string,
): string {
  return strategy === 'perAccount' ? amazonAccountId : userId;
}
