import { OrderSyncService } from './order-sync.service';

/**
 * `OrderSyncService.resolveAutoFulfillMaxLoss` — the loss limit the checkout
 * reads at the review step, resolved Store > Global with one difference from
 * the other store settings: a store row with NO limit inherits the global one.
 */
function harness(opts: { storeMaxLoss?: number | null; globalMaxLoss?: number | null }) {
  const storeSettings = {
    getResolvedSettings: jest.fn((_userId: string, storeId: string | null) =>
      Promise.resolve(
        storeId
          ? { isGlobal: false, autoFulfillMaxLoss: opts.storeMaxLoss ?? null }
          : { isGlobal: true, autoFulfillMaxLoss: opts.globalMaxLoss ?? null }
      )
    ),
  };
  const service = new OrderSyncService(
    { query: jest.fn(() => Promise.resolve([])) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    storeSettings as never,
    {} as never,
    {} as never,
    {} as never,
    { record: jest.fn(() => Promise.resolve()) } as never
  );
  return { service };
}

describe('OrderSyncService.resolveAutoFulfillMaxLoss', () => {
  it('uses the store row when it carries a limit — including 0', async () => {
    await expect(
      harness({ storeMaxLoss: 5, globalMaxLoss: 20 }).service.resolveAutoFulfillMaxLoss('u', 'store-1')
    ).resolves.toBe(5);
    await expect(
      harness({ storeMaxLoss: 0, globalMaxLoss: 20 }).service.resolveAutoFulfillMaxLoss('u', 'store-1')
    ).resolves.toBe(0);
  });

  // A store row created by a focused drawer never mentions this field. Its NULL
  // must not switch off a limit the seller set globally.
  it('inherits the global limit when the store row has none', async () => {
    await expect(
      harness({ storeMaxLoss: null, globalMaxLoss: 20 }).service.resolveAutoFulfillMaxLoss('u', 'store-1')
    ).resolves.toBe(20);
  });

  it('is null — no limit — when neither is set', async () => {
    await expect(harness({}).service.resolveAutoFulfillMaxLoss('u', 'store-1')).resolves.toBeNull();
    await expect(harness({}).service.resolveAutoFulfillMaxLoss('u', null)).resolves.toBeNull();
  });
});
