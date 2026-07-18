import { AutoFulfillStatus } from '@repo/shared';

/** Fail-closed obstacle reasons. Each maps to a blocked_reason string + a UI message. */
export type AutoFulfillBlockedReason =
  | 'no_asin'
  | 'captcha'
  | 'otp'
  | 'login'
  | 'out_of_stock'
  | 'address'
  | 'payment'
  | 'cap'
  | 'no_confirmation';

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

/** Sticky residential-proxy session token — per user (default) or per account. */
export function proxySessionToken(
  strategy: 'perUser' | 'perAccount',
  userId: string,
  amazonAccountId: string,
): string {
  return strategy === 'perAccount' ? amazonAccountId : userId;
}
