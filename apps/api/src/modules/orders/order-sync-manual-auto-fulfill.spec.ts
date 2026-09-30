import { AutoFulfillBlockedReason, AutoFulfillStatus, OrderStatus } from '@repo/shared';

import { OrderSyncService } from './order-sync.service';

/**
 * `OrderSyncService.startAutoFulfillManually` against a fake database that
 * answers by statement shape. What it must guarantee: a refusal changes
 * nothing, the store toggle is never consulted, the claim is a compare-and-set
 * on the approved state, and exactly one job is queued per successful claim.
 */

interface OrderRowFake {
  ebay_order_id: string;
  sale_total: string;
  status: OrderStatus;
  listing_id: string | null;
  listing_over_plan_limit: boolean;
  auto_fulfill_status: AutoFulfillStatus;
  auto_fulfill_blocked_reason: AutoFulfillBlockedReason | null;
  amazon_order_id: string | null;
  amazon_account_id: string | null;
}

interface AccountFake {
  id: string;
  last_used_at: Date | null;
  auto_fulfill_cap_total: string;
  auto_fulfill_dry_run: boolean;
}

function blockedRow(overrides: Partial<OrderRowFake> = {}): OrderRowFake {
  return {
    ebay_order_id: '17-15222-04697',
    sale_total: '12.50',
    status: OrderStatus.WAITING_SHIPMENT,
    listing_id: 'listing-1',
    listing_over_plan_limit: false,
    auto_fulfill_status: AutoFulfillStatus.BLOCKED,
    auto_fulfill_blocked_reason: AutoFulfillBlockedReason.PAYMENT,
    amazon_order_id: null,
    amazon_account_id: 'acc-b',
    ...overrides,
  };
}

function harness(opts: {
  row?: OrderRowFake;
  accounts?: AccountFake[];
  claimSucceeds?: boolean;
  suspended?: boolean;
  quotaAllowed?: boolean;
  enqueueThrows?: boolean;
}) {
  const statements: { sql: string; params: unknown[] }[] = [];
  const db = {
    query: jest.fn((sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.includes('FROM orders') && sql.includes('WHERE id = $1 AND user_id = $2') && sql.trim().startsWith('SELECT')) {
        return Promise.resolve(opts.row ? [opts.row] : []);
      }
      if (sql.includes('FROM amazon_accounts')) {
        return Promise.resolve(opts.accounts ?? []);
      }
      if (sql.includes('RETURNING ebay_order_id')) {
        return Promise.resolve(opts.claimSucceeds === false ? [] : [{ ebay_order_id: opts.row?.ebay_order_id }]);
      }
      return Promise.resolve([]);
    }),
  };
  const storeSettings = {
    getResolvedSettings: jest.fn(() => Promise.reject(new Error('the store toggle must not be read'))),
  };
  const queue = {
    enqueue: jest.fn(() => Promise.resolve()),
    enqueueManual: jest.fn(() => (opts.enqueueThrows ? Promise.reject(new Error('redis down')) : Promise.resolve())),
  };
  const quota = {
    isSuspended: jest.fn(() => Promise.resolve(opts.suspended === true)),
    reserveAmazonOrder: jest.fn(() =>
      Promise.resolve(opts.quotaAllowed === false ? { allowed: false } : { allowed: true })
    ),
    releaseAmazonOrder: jest.fn(() => Promise.resolve()),
  };
  const service = new OrderSyncService(
    db as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    storeSettings as never,
    queue as never,
    quota as never,
    {} as never
  );
  const recompute = jest.spyOn(service, 'recomputeProfit').mockResolvedValue(undefined);
  const writes = () => statements.filter((s) => s.sql.trim().startsWith('UPDATE'));
  return { service, statements, writes, queue, quota, storeSettings, recompute };
}

const accounts: AccountFake[] = [
  { id: 'acc-a', last_used_at: null, auto_fulfill_cap_total: '50', auto_fulfill_dry_run: false },
  { id: 'acc-b', last_used_at: new Date(), auto_fulfill_cap_total: '50', auto_fulfill_dry_run: true },
];

describe('OrderSyncService.startAutoFulfillManually', () => {
  it('queues a payment-blocked order on the account it was last tried on, without reading the store toggle', async () => {
    const h = harness({ row: blockedRow(), accounts });

    const result = await h.service.startAutoFulfillManually('user-1', 'order-1');

    expect(result).toEqual({ ok: true, dryRun: true });
    expect(h.queue.enqueueManual).toHaveBeenCalledTimes(1);
    expect(h.queue.enqueueManual).toHaveBeenCalledWith('17-15222-04697', 'acc-b');
    expect(h.queue.enqueue).not.toHaveBeenCalled();
    expect(h.storeSettings.getResolvedSettings).not.toHaveBeenCalled();

    const claim = h.statements.find((s) => s.sql.includes('RETURNING ebay_order_id'));
    expect(claim?.sql).toContain('auto_fulfill_blocked_reason IS NOT DISTINCT FROM $6');
    expect(claim?.params).toEqual([
      AutoFulfillStatus.PENDING,
      'order-1',
      'user-1',
      OrderStatus.WAITING_SHIPMENT,
      AutoFulfillStatus.BLOCKED,
      AutoFulfillBlockedReason.PAYMENT,
      null,
    ]);
    expect(claim?.sql).not.toContain('amazon_order_id = NULL');
  });

  it('falls back to round-robin when the last account is no longer usable', async () => {
    const h = harness({ row: blockedRow({ amazon_account_id: 'gone' }), accounts });

    await h.service.startAutoFulfillManually('user-1', 'order-1');

    expect(h.queue.enqueueManual).toHaveBeenCalledWith('17-15222-04697', 'acc-a');
  });

  it('reports a missing order as not found', async () => {
    const h = harness({ accounts });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      notFound: true,
      errorKey: 'orders.errors.notFound',
    });
  });

  it('refuses no_confirmation and changes nothing — the order may already exist on Amazon', async () => {
    const h = harness({
      row: blockedRow({ auto_fulfill_blocked_reason: AutoFulfillBlockedReason.NO_CONFIRMATION }),
      accounts,
    });

    const result = await h.service.startAutoFulfillManually('user-1', 'order-1');

    expect(result).toEqual({ ok: false, errorKey: 'orders.errors.autoFulfillNotRestartable' });
    expect(h.writes()).toHaveLength(0);
    expect(h.queue.enqueueManual).not.toHaveBeenCalled();
  });

  it.each([
    ['no usable account', { accounts: [] }, 'orders.errors.autoFulfillNoAccount'],
    [
      'sale over the account cap',
      { accounts: [{ ...accounts[1], auto_fulfill_cap_total: '5' }] },
      'orders.errors.autoFulfillOverCap',
    ],
    ['suspended subscription', { accounts, suspended: true }, 'billing.errors.subscriptionSuspendedOrders'],
  ])('refuses on %s before claiming', async (_label, extra, errorKey) => {
    const h = harness({ row: blockedRow(), ...extra });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).resolves.toEqual({ ok: false, errorKey });
    expect(h.writes()).toHaveLength(0);
    expect(h.queue.enqueueManual).not.toHaveBeenCalled();
  });

  it('a lost compare-and-set (double click, second tab) queues nothing', async () => {
    const h = harness({ row: blockedRow(), accounts, claimSucceeds: false });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      errorKey: 'orders.errors.autoFulfillAlreadyStarted',
    });
    expect(h.quota.reserveAmazonOrder).not.toHaveBeenCalled();
    expect(h.queue.enqueueManual).not.toHaveBeenCalled();
  });

  it('clears a dry run placeholder in the claim and recomputes profit', async () => {
    const h = harness({
      row: blockedRow({
        auto_fulfill_status: AutoFulfillStatus.DRY_RUN,
        auto_fulfill_blocked_reason: null,
        amazon_order_id: 'SIM-114-1234567-1234567',
      }),
      accounts,
    });

    await h.service.startAutoFulfillManually('user-1', 'order-1');

    const claim = h.statements.find((s) => s.sql.includes('RETURNING ebay_order_id'));
    expect(claim?.sql).toContain('amazon_order_id = NULL');
    expect(claim?.params[6]).toBe('SIM-114-1234567-1234567');
    expect(h.recompute).toHaveBeenCalledWith('17-15222-04697');
  });

  it('a refused quota blocks the order and queues nothing', async () => {
    const h = harness({ row: blockedRow(), accounts, quotaAllowed: false });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      errorKey: 'orders.errors.autoFulfillQuotaExhausted',
    });
    expect(h.queue.enqueueManual).not.toHaveBeenCalled();
    const blocked = h.writes().find((s) => s.params[0] === AutoFulfillStatus.BLOCKED);
    expect(blocked?.params).toContain(AutoFulfillBlockedReason.QUOTA_EXHAUSTED);
  });

  it('a failed enqueue leaves the order FAILED (retryable) and releases the slot', async () => {
    const h = harness({ row: blockedRow(), accounts, enqueueThrows: true });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).rejects.toThrow('redis down');
    const failed = h.writes().find((s) => s.params[0] === AutoFulfillStatus.FAILED);
    expect(failed).toBeDefined();
    expect(h.quota.releaseAmazonOrder).toHaveBeenCalledWith('user-1', '17-15222-04697');
  });
});
