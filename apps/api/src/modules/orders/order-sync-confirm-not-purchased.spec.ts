import { AutoFulfillStatus, OrderStatus } from '@repo/shared';

import { OrderSyncService } from './order-sync.service';

/**
 * `OrderSyncService.confirmNotPurchased` is the ONLY thing that clears the
 * Place Order click stamp, i.e. the only way an order whose purchase may exist
 * can be bought again. It needs two independent facts — a scan of the Amazon
 * account's orders that started AFTER the click and found nothing, and the
 * seller's call — and it must refuse while a scan has seen an Amazon order that
 * may be the purchase.
 */

const CLICKED_AT = new Date('2026-10-01T10:00:00Z');

interface OrderFake {
  ebay_order_id: string;
  status: OrderStatus;
  auto_fulfill_status: AutoFulfillStatus;
  amazon_order_id: string | null;
  amazon_account_id: string | null;
  auto_fulfill_submitted_at: Date | null;
  suspect_unclaimed: boolean;
}

function unknownOrder(overrides: Partial<OrderFake> = {}): OrderFake {
  return {
    ebay_order_id: '17-15222-04697',
    status: OrderStatus.WAITING_SHIPMENT,
    auto_fulfill_status: AutoFulfillStatus.BLOCKED,
    amazon_order_id: null,
    amazon_account_id: 'acc-1',
    auto_fulfill_submitted_at: CLICKED_AT,
    suspect_unclaimed: false,
    ...overrides,
  };
}

function harness(opts: {
  row?: OrderFake;
  accounts?: Array<{ id: string; last_orders_sync_at: Date | null }>;
  clearSucceeds?: boolean;
  storeMaxLoss?: number | null;
  globalMaxLoss?: number | null;
}) {
  const statements: { sql: string; params: unknown[] }[] = [];
  const db = {
    query: jest.fn((sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.includes('suspect_unclaimed')) {
        return Promise.resolve(opts.row ? [opts.row] : []);
      }
      if (sql.includes('FROM amazon_accounts')) {
        return Promise.resolve(opts.accounts ?? []);
      }
      if (sql.includes('SET auto_fulfill_submitted_at = NULL')) {
        return Promise.resolve(opts.clearSucceeds === false ? [] : [{ ebay_order_id: opts.row?.ebay_order_id }]);
      }
      return Promise.resolve([]);
    }),
  };
  const storeSettings = {
    getResolvedSettings: jest.fn((_userId: string, storeId: string | null) =>
      Promise.resolve(
        storeId
          ? { isGlobal: false, autoFulfillMaxLoss: opts.storeMaxLoss ?? null }
          : { isGlobal: true, autoFulfillMaxLoss: opts.globalMaxLoss ?? null }
      )
    ),
  };
  const events = { record: jest.fn(() => Promise.resolve()) };
  const service = new OrderSyncService(
    db as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    storeSettings as never,
    {} as never,
    {} as never,
    {} as never,
    events as never
  );
  const clears = () => statements.filter((s) => s.sql.includes('SET auto_fulfill_submitted_at = NULL'));
  return { service, statements, clears, events, storeSettings };
}

const scannedAfter = [{ id: 'acc-1', last_orders_sync_at: new Date('2026-10-01T10:06:00Z') }];
const scannedBefore = [{ id: 'acc-1', last_orders_sync_at: new Date('2026-10-01T09:00:00Z') }];

describe('OrderSyncService.confirmNotPurchased', () => {
  it('clears the stamp once the account was scanned after the click and the seller confirms', async () => {
    const h = harness({ row: unknownOrder(), accounts: scannedAfter });

    await expect(h.service.confirmNotPurchased('user-1', 'order-1')).resolves.toEqual({ ok: true });

    expect(h.clears()).toHaveLength(1);
    // FAILED with no reason: why the click produced no order is not known.
    expect(h.clears()[0].params[2]).toBe(AutoFulfillStatus.FAILED);
    expect(h.clears()[0].sql).toContain('auto_fulfill_blocked_reason = NULL');
    // The write re-checks the state it approved.
    expect(h.clears()[0].sql).toContain('AND auto_fulfill_submitted_at IS NOT NULL');
    expect(h.clears()[0].sql).toContain('AND amazon_order_id IS NULL');
  });

  it('refuses before a scan has run since the click, names the account to scan, and writes nothing', async () => {
    const h = harness({ row: unknownOrder(), accounts: scannedBefore });

    await expect(h.service.confirmNotPurchased('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      errorKey: 'orders.errors.purchaseNotYetChecked',
      accountsToScan: ['acc-1'],
    });
    expect(h.clears()).toHaveLength(0);
  });

  it('refuses when the account was never scanned', async () => {
    const h = harness({ row: unknownOrder(), accounts: [{ id: 'acc-1', last_orders_sync_at: null }] });

    const result = await h.service.confirmNotPurchased('user-1', 'order-1');

    expect(result).toMatchObject({ ok: false, errorKey: 'orders.errors.purchaseNotYetChecked' });
    expect(h.clears()).toHaveLength(0);
  });

  // A row stamped by migration 132 has no click account: then EVERY account of
  // the seller must have been scanned after the click.
  it('with no click account, one unscanned account is enough to refuse', async () => {
    const h = harness({
      row: unknownOrder({ amazon_account_id: null }),
      accounts: [
        { id: 'acc-1', last_orders_sync_at: new Date('2026-10-01T10:06:00Z') },
        { id: 'acc-2', last_orders_sync_at: new Date('2026-10-01T09:00:00Z') },
      ],
    });

    const result = await h.service.confirmNotPurchased('user-1', 'order-1');

    expect(result).toMatchObject({ ok: false, errorKey: 'orders.errors.purchaseNotYetChecked' });
    expect(h.clears()).toHaveLength(0);
  });

  it('refuses while a scan has seen an Amazon order that may be this purchase', async () => {
    const h = harness({ row: unknownOrder({ suspect_unclaimed: true }), accounts: scannedAfter });

    await expect(h.service.confirmNotPurchased('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      errorKey: 'orders.errors.purchaseFoundOnAmazon',
    });
    expect(h.clears()).toHaveLength(0);
  });

  it.each([
    ['no click was stamped', { auto_fulfill_submitted_at: null }],
    ['an Amazon order is linked', { amazon_order_id: '113-1234567-1234567' }],
    ['the order is placed', { auto_fulfill_status: AutoFulfillStatus.PLACED }],
    ['a job is running', { auto_fulfill_status: AutoFulfillStatus.RUNNING }],
    ['the eBay sale is cancelled', { status: OrderStatus.CANCELLED }],
  ])('refuses when %s', async (_label, patch) => {
    const h = harness({ row: unknownOrder(patch as Partial<OrderFake>), accounts: scannedAfter });

    await expect(h.service.confirmNotPurchased('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      errorKey: 'orders.errors.purchaseNotUnknown',
    });
    expect(h.clears()).toHaveLength(0);
  });

  it('reports a lost race (linked or restarted between the read and the write) as not unknown', async () => {
    const h = harness({ row: unknownOrder(), accounts: scannedAfter, clearSucceeds: false });

    await expect(h.service.confirmNotPurchased('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      errorKey: 'orders.errors.purchaseNotUnknown',
    });
    expect(h.events.record).not.toHaveBeenCalled();
  });

  it('reports a missing order as not found', async () => {
    const h = harness({ accounts: scannedAfter });

    await expect(h.service.confirmNotPurchased('user-1', 'order-1')).resolves.toEqual({
      ok: false,
      notFound: true,
      errorKey: 'orders.errors.notFound',
    });
  });
});

describe('OrderSyncService.resolveAutoFulfillMaxLoss', () => {
  it('uses the store row when it carries a limit — including 0', async () => {
    await expect(harness({ storeMaxLoss: 5, globalMaxLoss: 20 }).service.resolveAutoFulfillMaxLoss('u', 'store-1')).resolves.toBe(5);
    await expect(harness({ storeMaxLoss: 0, globalMaxLoss: 20 }).service.resolveAutoFulfillMaxLoss('u', 'store-1')).resolves.toBe(0);
  });

  // A store row created by a focused drawer never mentions this field. Its NULL
  // must not switch off a limit the seller set globally.
  it('inherits the global limit when the store row has none', async () => {
    await expect(harness({ storeMaxLoss: null, globalMaxLoss: 20 }).service.resolveAutoFulfillMaxLoss('u', 'store-1')).resolves.toBe(20);
  });

  it('is null — no limit — when neither is set', async () => {
    await expect(harness({}).service.resolveAutoFulfillMaxLoss('u', 'store-1')).resolves.toBeNull();
    await expect(harness({}).service.resolveAutoFulfillMaxLoss('u', null)).resolves.toBeNull();
  });
});
