import { StoreSettingsService } from './store-settings.service';

/**
 * "Back to the global settings" deletes ONE store's own row — scoped to the
 * caller and never the global row — and the store then resolves to the global
 * row for everything.
 */
describe('StoreSettingsService.resetStoreSettings', () => {
  it('deletes only the caller’s own row for that store, never the global row', async () => {
    const db = { query: jest.fn().mockResolvedValue([{ id: 'store-row' }]) };
    const result = await new StoreSettingsService(db as never).resetStoreSettings('user-1', 'acc-1');

    expect(result).toEqual({ reset: true });
    const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/DELETE FROM store_settings/);
    expect(sql).toMatch(/user_id = \$1/);
    expect(sql).toMatch(/store_id = \$2/);
    expect(sql).toMatch(/is_global = FALSE/);
    expect(params).toEqual(['user-1', 'acc-1']);
  });

  it('reports nothing reset when the store had no row of its own', async () => {
    const db = { query: jest.fn().mockResolvedValue([]) };
    await expect(new StoreSettingsService(db as never).resetStoreSettings('user-1', 'acc-1')).resolves.toEqual({
      reset: false,
    });
  });

  it('after the reset the store resolves to the global row', async () => {
    const globalRow = {
      id: 'global',
      user_id: 'user-1',
      store_id: null,
      is_global: true,
      country: 'US',
      state: 'WY',
      zip_code: '82801',
      check_blacklist: true,
      blacklist: '[]',
      amazon_tax_rate: 7,
      auto_fulfill_enabled: true,
      auto_fulfill_max_loss: null,
      tracking_conversion_provider: 'aquiline',
      tracking_conversion_scope: 'amazon_logistics_only',
      tracking_convert_manual_orders: true,
      buyer_messaging: null,
      blocked_asins: null,
      created_at: new Date(),
      updated_at: new Date(),
    };
    const db = {
      query: jest.fn((sql: string) => Promise.resolve(/is_global = TRUE/.test(sql) ? [globalRow] : [])),
    };
    const resolved = await new StoreSettingsService(db as never).getResolvedSettings('user-1', 'acc-1');
    expect(resolved.amazonTaxRate).toBe(7);
    expect(resolved.autoFulfillEnabled).toBe(true);
  });
});
