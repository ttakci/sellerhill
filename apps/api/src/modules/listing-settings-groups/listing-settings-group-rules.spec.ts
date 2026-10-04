import { normalizeListingRules, type CreateListingSettingsGroupRequest, TemplateType } from '@repo/shared';

import type { DatabaseService } from '../../common/database/database.service';

import { ListingSettingsGroupService } from './listing-settings-group.service';

// The group owns its listing rules (migration 141, spec Part A): create always
// writes the normalized value, update touches the column only when the
// caller sends rules, and a row that never saved any reads the defaults.

const USER = '11111111-1111-1111-1111-111111111111';

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 'g1',
  user_id: USER,
  name: 'Group',
  description: null,
  repricing_strategy: '[]',
  stock: '{"defaultQuantity":1}',
  fees: '{"ebayFeePercent":13,"fixedFeeAmount":0.3}',
  templates: '{"type":"predefined"}',
  content: null,
  listing_rules: null,
  created_at: new Date(),
  updated_at: new Date(),
  created_by: USER,
  updated_by: USER,
  ...overrides,
});

const build = () => {
  const calls: { sql: string; params: unknown[] }[] = [];
  const db = {
    query: (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      return Promise.resolve([row()]);
    },
  } as unknown as DatabaseService;
  return { service: new ListingSettingsGroupService(db), calls };
};

const minimal: CreateListingSettingsGroupRequest = {
  name: 'Group',
  repricingStrategy: [],
  stock: { defaultQuantity: 1 },
  fees: { ebayFeePercent: 13, fixedFeeAmount: 0.3 },
  templates: { type: TemplateType.PREDEFINED },
};

describe('listing settings groups own their listing rules', () => {
  it('create stores the normalized rules', async () => {
    const { service, calls } = build();
    await service.createListingSettingsGroup(USER, {
      ...minimal,
      listingRules: { minRating: '4,5', hideBrand: false } as never,
    });
    const insert = calls.find((call) => call.sql.includes('INSERT INTO listing_settings_groups'));
    expect(insert?.sql).toContain('listing_rules');
    const expected = normalizeListingRules({ minRating: '4,5', hideBrand: false });
    expect(insert?.params).toContain(JSON.stringify(expected));
    expect(expected.minRating).toBe(4.5);
    expect(expected.hideBrand).toBe(false);
  });

  it('a create without rules writes the explicit defaults', async () => {
    const { service, calls } = build();
    await service.createListingSettingsGroup(USER, minimal);
    const insert = calls.find((call) => call.sql.includes('INSERT INTO listing_settings_groups'));
    expect(insert?.params).toContain(JSON.stringify(normalizeListingRules(undefined)));
  });

  it('a row that never saved rules reads VeRO on and the brand hidden', async () => {
    const { service } = build();
    const group = await service.getListingSettingsGroupById(USER, 'g1');
    expect(group.listingRules.veroProtectionEnabled).toBe(true);
    expect(group.listingRules.hideBrand).toBe(true);
  });

  it('an update without rules leaves the column alone', async () => {
    const { service, calls } = build();
    await service.updateListingSettingsGroup(USER, 'g1', { name: 'Renamed' });
    const update = calls.find((call) => call.sql.includes('UPDATE listing_settings_groups'));
    expect(update?.sql).not.toContain('listing_rules =');
  });

  it('an update with rules writes them normalized', async () => {
    const { service, calls } = build();
    await service.updateListingSettingsGroup(USER, 'g1', {
      listingRules: { minRating: 9 } as never,
    });
    const update = calls.find((call) => call.sql.includes('UPDATE listing_settings_groups'));
    expect(update?.sql).toContain('listing_rules =');
    expect(update?.params).toContain(JSON.stringify(normalizeListingRules({ minRating: 9 })));
  });
});
