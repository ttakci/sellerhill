import { StoreSettingsService } from './store-settings.service';

/**
 * Store > Global for buyer messaging: a store row that never saved a messaging
 * config (created by another drawer, e.g. the blacklist) uses the "all stores"
 * one; a store row that did save one uses its own — even when it says "off".
 */

const GLOBAL_MESSAGING = { enabled: true, events: {} };
const STORE_MESSAGING_OFF = { enabled: false, events: {} };

function row(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'row',
    user_id: 'user-1',
    store_id: null,
    is_global: false,
    country: 'US',
    state: 'WY',
    zip_code: '82801',
    check_blacklist: true,
    blacklist: '[]',
    amazon_tax_rate: 0,
    auto_fulfill_enabled: false,
    auto_fulfill_max_loss: null,
    tracking_conversion_provider: 'aquiline',
    tracking_conversion_scope: 'amazon_logistics_only',
    tracking_convert_manual_orders: true,
    buyer_messaging: null,
    listing_rules: null,
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

function build(storeRow: Record<string, unknown> | null) {
  const globalRow = row({ id: 'global', is_global: true, buyer_messaging: GLOBAL_MESSAGING });
  const db = {
    query: jest.fn((sql: string) => {
      if (/is_global = TRUE/.test(sql)) {
        return Promise.resolve([globalRow]);
      }
      if (/store_id = \$2/.test(sql)) {
        return Promise.resolve(storeRow ? [storeRow] : []);
      }
      return Promise.resolve([]);
    }),
  };
  return new StoreSettingsService(db as never);
}

describe('StoreSettingsService.getResolvedSettings — buyer messaging', () => {
  it('a store with no row of its own uses the all-stores config', async () => {
    const resolved = await build(null).getResolvedSettings('user-1', 'acc-1');
    expect(resolved.buyerMessaging?.enabled).toBe(true);
  });

  it('a store row that never saved a messaging config uses the all-stores config', async () => {
    const resolved = await build(row({ id: 'store', store_id: 'acc-1' })).getResolvedSettings('user-1', 'acc-1');
    expect(resolved.buyerMessaging?.enabled).toBe(true);
  });

  it("a store row that saved its own messaging config keeps it, even when it is off", async () => {
    const resolved = await build(
      row({ id: 'store', store_id: 'acc-1', buyer_messaging: STORE_MESSAGING_OFF }),
    ).getResolvedSettings('user-1', 'acc-1');
    expect(resolved.buyerMessaging?.enabled).toBe(false);
  });
});
