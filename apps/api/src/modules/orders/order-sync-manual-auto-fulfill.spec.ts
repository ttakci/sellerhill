import { AutoFulfillBlockedReason, AutoFulfillStatus, OrderStatus } from '@repo/shared';

import { OrderSyncService } from './order-sync.service';

/**
 * `OrderSyncService.startAutoFulfillManually` against a fake database that
 * answers by statement shape. What it must guarantee: a refusal changes
 * nothing, the store toggle does not decide (the fake store has it OFF), the
 * claim is a compare-and-set on the approved state, and exactly one job is
 * queued per successful claim.
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
  auto_fulfill_submitted_at?: Date | null;
  ebay_line_item_count?: number | null;
  suspect_unclaimed?: boolean;
}

interface AccountFake {
  id: string;
  status?: string;
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
  /** The product's current Amazon unit price (default 10). `null` = unknown. */
  unitPrice?: number | null;
  quantity?: number;
}) {
  const statements: { sql: string; params: unknown[] }[] = [];
  const db = {
    query: jest.fn((sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.includes('suspect_unclaimed') && sql.trim().startsWith('SELECT')) {
        return Promise.resolve(opts.row ? [opts.row] : []);
      }
      if (sql.includes('SELECT listing_id, quantity, ebay_account_id FROM orders')) {
        return Promise.resolve([{ listing_id: opts.row?.listing_id ?? null, quantity: opts.quantity ?? 1 }]);
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
  // The store's automatic-order toggle is OFF. A manual start must go through
  // anyway: the toggle means "buy new sales on their own", a click is a request
  // for this one order. (The settings ARE read — for the Amazon tax rate the
  // cost estimate uses.)
  const storeSettings = {
    getResolvedSettings: jest.fn(() => Promise.resolve({ autoFulfillEnabled: false, amazonTaxRate: 0 })),
  };
  const products = {
    getProductPriceAndImageByListingId: jest.fn(() =>
      Promise.resolve(opts.unitPrice === null ? null : { purchasePrice: opts.unitPrice ?? 10, productImageUrl: null })
    ),
  };
  const events = { record: jest.fn(() => Promise.resolve()) };
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
    products as never,
    {} as never,
    storeSettings as never,
    queue as never,
    quota as never,
    {} as never,
    events as never
  );
  const recompute = jest.spyOn(service, 'recomputeProfit').mockResolvedValue(undefined);
  const writes = () => statements.filter((s) => s.sql.trim().startsWith('UPDATE'));
  return { service, statements, writes, queue, quota, storeSettings, recompute, events };
}

const accounts: AccountFake[] = [
  { id: 'acc-a', last_used_at: null, auto_fulfill_cap_total: '50', auto_fulfill_dry_run: false },
  { id: 'acc-b', last_used_at: new Date(), auto_fulfill_cap_total: '50', auto_fulfill_dry_run: true },
];

describe('OrderSyncService.startAutoFulfillManually', () => {
  it('queues a payment-blocked order on the account it was last tried on, although the store toggle is off', async () => {
    const h = harness({ row: blockedRow(), accounts });

    const result = await h.service.startAutoFulfillManually('user-1', 'order-1');

    expect(result).toEqual({ ok: true, dryRun: true });
    expect(h.queue.enqueueManual).toHaveBeenCalledTimes(1);
    expect(h.queue.enqueueManual).toHaveBeenCalledWith('17-15222-04697', 'acc-b');
    expect(h.queue.enqueue).not.toHaveBeenCalled();

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
      false,
    ]);
    expect(claim?.sql).not.toContain('amazon_order_id = NULL');
    // The claim matches the click stamp it read (none here), so a row stamped
    // in between is not taken, and it never clears a stamp it did not see.
    expect(claim?.sql).toContain('AND (auto_fulfill_submitted_at IS NOT NULL) = $8::boolean');
    expect(claim?.sql).not.toContain('auto_fulfill_submitted_at = NULL');
  });

  it('restarts a purchase not confirmed — the seller checked Amazon — and clears the click stamp in the claim', async () => {
    const clickedAt = new Date('2026-10-01T10:00:00Z');
    const h = harness({
      row: blockedRow({
        auto_fulfill_blocked_reason: AutoFulfillBlockedReason.NO_CONFIRMATION,
        auto_fulfill_submitted_at: clickedAt,
      }),
      accounts,
    });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).resolves.toEqual({ ok: true, dryRun: true });

    const claim = h.statements.find((s) => s.sql.includes('RETURNING ebay_order_id'));
    expect(claim?.sql).toContain('auto_fulfill_submitted_at = NULL');
    expect(claim?.sql).toContain('auto_fulfill_suspect_amazon_order_id = NULL');
    // Matched against the stamp it read, and re-checked against a suspect order in SQL.
    expect(claim?.params[7]).toBe(true);
    expect(claim?.sql).toContain('AND NOT (auto_fulfill_suspect_amazon_order_id IS NOT NULL');
    expect(h.queue.enqueueManual).toHaveBeenCalledTimes(1);
    expect(h.events.record).toHaveBeenCalledWith(
      '17-15222-04697',
      'confirmed_not_purchased',
      expect.objectContaining({ userId: 'user-1' })
    );
  });

  it('refuses a purchase not confirmed while a scan saw a matching Amazon order, and changes nothing', async () => {
    const h = harness({
      row: blockedRow({
        auto_fulfill_blocked_reason: AutoFulfillBlockedReason.NO_CONFIRMATION,
        auto_fulfill_submitted_at: new Date('2026-10-01T10:00:00Z'),
        suspect_unclaimed: true,
      }),
      accounts,
    });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      errorKey: 'orders.errors.purchaseFoundOnAmazon',
    });
    expect(h.writes()).toHaveLength(0);
    expect(h.queue.enqueueManual).not.toHaveBeenCalled();
  });

  it('refuses a multi-item order — the checkout would buy one item of several', async () => {
    const h = harness({ row: blockedRow({ ebay_line_item_count: 2 }), accounts });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      errorKey: 'orders.errors.autoFulfillNotRestartable',
    });
    expect(h.queue.enqueueManual).not.toHaveBeenCalled();
  });

  it('prefers a healthy account over an older one that needs re-authentication', async () => {
    const h = harness({
      row: blockedRow({ amazon_account_id: 'gone' }),
      accounts: [
        { ...accounts[0], status: 'needs_reauth' },
        { ...accounts[1], status: 'active' },
      ],
    });

    await h.service.startAutoFulfillManually('user-1', 'order-1');

    expect(h.queue.enqueueManual).toHaveBeenCalledWith('17-15222-04697', 'acc-b');
  });

  // The coarse cap compares the ESTIMATED AMAZON COST (unit price x quantity),
  // not the eBay sale total: a $60 sale whose product costs $10 is under a $50 cap.
  it('passes the cap gate on the Amazon cost estimate even when the eBay sale is above the cap', async () => {
    const h = harness({ row: blockedRow({ sale_total: '60.00' }), accounts, unitPrice: 10 });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).resolves.toEqual({ ok: true, dryRun: true });
  });

  it('multiplies the unit price by the quantity for the cap gate', async () => {
    const h = harness({ row: blockedRow(), accounts, unitPrice: 20, quantity: 3 });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      errorKey: 'orders.errors.autoFulfillOverCap',
    });
  });

  it('lets an unknown price through to the review-step cap', async () => {
    const h = harness({ row: blockedRow(), accounts, unitPrice: null });

    await expect(h.service.startAutoFulfillManually('user-1', 'order-1')).resolves.toEqual({ ok: true, dryRun: true });
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

  it('refuses no_confirmation WITHOUT a click stamp and changes nothing — only the stamp opens that state', async () => {
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
      'estimated Amazon cost over the account cap',
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
