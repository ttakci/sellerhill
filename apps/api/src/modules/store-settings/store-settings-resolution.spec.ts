import { readFileSync } from 'fs';
import { join } from 'path';

import { TrackingConversionProvider } from '@repo/shared';

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
    blocked_asins: null,
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

describe('StoreSettingsService.saveSettings — a new store row starts as a copy of "all stores"', () => {
  const SOURCE = readFileSync(join(__dirname, 'store-settings.service.ts'), 'utf8');

  it('seeds every field the caller did not send from the global row', () => {
    expect(SOURCE).toMatch(/LEFT JOIN store_settings g ON g\.user_id = \$1 AND g\.is_global = TRUE/);
    for (const column of [
      'check_blacklist',
      'blacklist',
      'amazon_tax_rate',
      'auto_fulfill_enabled',
      'tracking_conversion_provider',
      'tracking_conversion_scope',
      'tracking_convert_manual_orders',
    ]) {
      expect(SOURCE).toMatch(new RegExp(String.raw`COALESCE\(\$\d+::\w+, g\.${column},`));
    }
  });

  it("never falls back to the 'local' provider (that pushed the raw Amazon number to eBay)", () => {
    expect(SOURCE).not.toMatch(/COALESCE\([^)]*'local'\)/);
  });

  it('an omitted tax rate leaves the stored one alone', () => {
    expect(SOURCE).not.toMatch(/amazon_tax_rate = EXCLUDED\.amazon_tax_rate/);
  });
});

describe('StoreSettingsService.getResolvedSettings — allowCrossStoreAsins is Store > Global > off', () => {
  function buildWith(globalValue: boolean | null, storeRow: Record<string, unknown> | null) {
    const globalRow = row({ id: 'global', is_global: true, allow_cross_store_asins: globalValue });
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

  it('a store row holding NULL inherits the global value (true and false)', async () => {
    for (const globalValue of [true, false]) {
      const resolved = await buildWith(
        globalValue,
        row({ id: 'store', store_id: 'acc-1', allow_cross_store_asins: null }),
      ).getResolvedSettings('user-1', 'acc-1');
      expect(resolved.allowCrossStoreAsins).toBe(globalValue);
    }
  });

  it('a store with no row of its own follows the global value', async () => {
    const resolved = await buildWith(true, null).getResolvedSettings('user-1', 'acc-1');
    expect(resolved.allowCrossStoreAsins).toBe(true);
  });

  it("a store's explicit false overrides a global true, and an explicit true a global NULL", async () => {
    const off = await buildWith(true, row({ id: 'store', store_id: 'acc-1', allow_cross_store_asins: false }))
      .getResolvedSettings('user-1', 'acc-1');
    expect(off.allowCrossStoreAsins).toBe(false);
    const on = await buildWith(null, row({ id: 'store', store_id: 'acc-1', allow_cross_store_asins: true }))
      .getResolvedSettings('user-1', 'acc-1');
    expect(on.allowCrossStoreAsins).toBe(true);
  });

  it('a global NULL (and no store value) means off', async () => {
    const resolved = await buildWith(null, row({ id: 'store', store_id: 'acc-1', allow_cross_store_asins: null }))
      .getResolvedSettings('user-1', 'acc-1');
    expect(resolved.allowCrossStoreAsins).toBe(false);
    const global = await buildWith(null, null).getResolvedSettings('user-1', null);
    expect(global.allowCrossStoreAsins).toBe(false);
  });

  it('the raw row keeps NULL so the drawer can show "inherited"', async () => {
    const raw = await buildWith(true, row({ id: 'store', store_id: 'acc-1', allow_cross_store_asins: null }))
      .getSettings('user-1', 'acc-1');
    expect(raw.allowCrossStoreAsins).toBeNull();
  });
});

describe('StoreSettingsService.saveSettings — allowCrossStoreAsins', () => {
  const SOURCE = readFileSync(join(__dirname, 'store-settings.service.ts'), 'utf8');

  it('omitted leaves the stored value alone; explicit null is written (inherit)', () => {
    expect(SOURCE).toMatch(
      /allow_cross_store_asins = CASE\s+WHEN \$24::boolean THEN EXCLUDED\.allow_cross_store_asins\s+ELSE store_settings\.allow_cross_store_asins/,
    );
    expect(SOURCE).toMatch(
      /allow_cross_store_asins = CASE\s+WHEN \$25::boolean THEN EXCLUDED\.allow_cross_store_asins\s+ELSE store_settings\.allow_cross_store_asins/,
    );
  });

  it('a new store row is NOT seeded from the global value (its NULL already means inherit)', () => {
    expect(SOURCE).not.toMatch(/g\.allow_cross_store_asins/);
  });
});

describe('StoreSettingsService mapping — tracking provider', () => {
  async function providerFor(stored: unknown) {
    const db = {
      query: jest.fn(() => Promise.resolve([row({ id: 'global', is_global: true, tracking_conversion_provider: stored })])),
    };
    return (await new StoreSettingsService(db as never).getSettings('user-1')).trackingConversionProvider;
  }

  it("only an explicit 'local' switches conversion off", async () => {
    expect(await providerFor('local')).toBe(TrackingConversionProvider.LOCAL);
    expect(await providerFor(' LOCAL ')).toBe(TrackingConversionProvider.LOCAL);
  });

  it('aquiline, api and any unreadable value keep conversion on', async () => {
    for (const stored of ['aquiline', 'api', 'AQUILINE', 'garbage', '', null]) {
      expect(await providerFor(stored)).toBe(TrackingConversionProvider.API);
    }
  });
});

describe('StoreSettingsService — blocked ASINs are Store > Global', () => {
  function buildWith(globalList: unknown, storeRow: Record<string, unknown> | null) {
    const globalRow = row({ id: 'global', is_global: true, blocked_asins: globalList });
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

  it('a store NULL inherits the global list', async () => {
    const resolved = await buildWith(['B0GGGGGGGG'], row({ id: 'store', store_id: 'acc-1', blocked_asins: null }))
      .getResolvedSettings('user-1', 'acc-1');
    expect(resolved.blockedAsins).toEqual(['B0GGGGGGGG']);
  });

  it('a store with no row of its own follows the global list', async () => {
    const resolved = await buildWith(['B0GGGGGGGG'], null).getResolvedSettings('user-1', 'acc-1');
    expect(resolved.blockedAsins).toEqual(['B0GGGGGGGG']);
  });

  it("a store's explicit [] blocks nothing", async () => {
    const resolved = await buildWith(['B0GGGGGGGG'], row({ id: 'store', store_id: 'acc-1', blocked_asins: [] }))
      .getResolvedSettings('user-1', 'acc-1');
    expect(resolved.blockedAsins).toEqual([]);
  });

  it('a global NULL is no list at all', async () => {
    const resolved = await buildWith(null, null).getResolvedSettings('user-1', 'acc-1');
    expect(resolved.blockedAsins).toEqual([]);
  });

  it('the raw store row keeps NULL', async () => {
    const raw = await buildWith(['B0GGGGGGGG'], row({ id: 'store', store_id: 'acc-1', blocked_asins: null }))
      .getSettings('user-1', 'acc-1');
    expect(raw.blockedAsins).toBeNull();
  });

  it('save writes blocked_asins with an omitted-means-unchanged flag and no longer writes listing_rules', () => {
    const SOURCE = readFileSync(join(__dirname, 'store-settings.service.ts'), 'utf8');
    expect(SOURCE).toMatch(/blocked_asins = CASE\s+WHEN \$22::boolean THEN EXCLUDED\.blocked_asins\s+ELSE store_settings\.blocked_asins/);
    expect(SOURCE).toMatch(/blocked_asins = CASE\s+WHEN \$23::boolean THEN EXCLUDED\.blocked_asins\s+ELSE store_settings\.blocked_asins/);
    expect(SOURCE).not.toMatch(/listing_rules/);
    expect(SOURCE).not.toMatch(/g\.blocked_asins/);
  });
});
