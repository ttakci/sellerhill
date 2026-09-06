import {
  BlacklistType,
  TrackingConversionProvider,
  TrackingConversionScope,
  type StoreSettingsResponse,
} from '@repo/shared';

import { inheritMissingStoreLocation } from './store-settings.helpers';

function settings(
  overrides: Partial<StoreSettingsResponse> = {},
): StoreSettingsResponse {
  return {
    id: 'settings-id',
    isGlobal: false,
    storeId: 'store-id',
    country: 'US',
    state: 'CA',
    zipCode: '90210',
    shipFromCity: 'Los Angeles',
    checkBlacklist: true,
    blacklist: [],
    amazonTaxRate: 0,
    autoFulfillEnabled: false,
    trackingConversionProvider: TrackingConversionProvider.LOCAL,
    trackingConversionScope: TrackingConversionScope.AMAZON_LOGISTICS_ONLY,
    trackingConvertManualOrders: true,
    buyerMessaging: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('inheritMissingStoreLocation', () => {
  const globalSettings = settings({
    id: 'global-id',
    isGlobal: true,
    storeId: undefined,
    country: 'US',
    state: 'NY',
    zipCode: '10001',
    shipFromCity: 'New York',
    amazonTaxRate: 9,
    autoFulfillEnabled: true,
    blacklist: [{ id: 'global-keyword', keyword: 'global', types: [BlacklistType.TITLE, BlacklistType.DESCRIPTION] }],
  });

  it('inherits only missing location fields from global settings', () => {
    const storeSettings = settings({
      country: '',
      state: '  ',
      zipCode: '',
      shipFromCity: '',
      amazonTaxRate: 3,
      autoFulfillEnabled: false,
      blacklist: [{ id: 'store-keyword', keyword: 'store', types: [BlacklistType.TITLE] }],
    });

    expect(inheritMissingStoreLocation(storeSettings, globalSettings)).toMatchObject({
      country: 'US',
      state: 'NY',
      zipCode: '10001',
      shipFromCity: 'New York',
      amazonTaxRate: 3,
      autoFulfillEnabled: false,
      blacklist: [{ id: 'store-keyword', keyword: 'store', types: [BlacklistType.TITLE] }],
    });
  });

  it('preserves every non-empty store location field', () => {
    const storeSettings = settings({
      country: 'GB',
      state: 'London',
      zipCode: 'SW1A 1AA',
      shipFromCity: 'London',
    });

    expect(inheritMissingStoreLocation(storeSettings, globalSettings)).toMatchObject({
      country: 'GB',
      state: 'London',
      zipCode: 'SW1A 1AA',
      shipFromCity: 'London',
    });
  });

  // A store row created by a focused drawer (blacklist / buyer messaging) has
  // no city of its own. Without inheritance that row publishes an eBay item
  // location with an empty city while the user's global row has one — the same
  // failure the postcode inheritance above exists to prevent.
  it('inherits the city when a store row was created without one', () => {
    const storeSettings = settings({ shipFromCity: undefined });

    expect(inheritMissingStoreLocation(storeSettings, globalSettings).shipFromCity).toBe(
      'New York',
    );
  });

  it('inherits location field by field without replacing store-owned settings', () => {
    const storeSettings = settings({
      country: 'US',
      state: '',
      zipCode: '94105',
      checkBlacklist: false,
      buyerMessaging: { enabled: false, events: {} },
    });

    const resolved = inheritMissingStoreLocation(storeSettings, globalSettings);

    expect(resolved.country).toBe('US');
    expect(resolved.state).toBe('NY');
    expect(resolved.zipCode).toBe('94105');
    expect(resolved.checkBlacklist).toBe(false);
    expect(resolved.buyerMessaging).toEqual({ enabled: false, events: {} });
  });
});
