import { TrackingConversionProvider, TrackingConversionScope, type StoreSettingsResponse } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import {
  buildInheritedStoreFields,
  resolveSeedAllowCrossStore,
  resolveSeedMaxLoss,
  resolveStoreDraftSeed,
} from './storeDraftSeed';
import { GLOBAL_SCOPE } from './storeScope';

const row = (overrides: Partial<StoreSettingsResponse>): StoreSettingsResponse =>
  ({
    id: 'row',
    isGlobal: false,
    country: 'US',
    state: 'WY',
    zipCode: '82801',
    checkBlacklist: true,
    blacklist: [],
    amazonTaxRate: 0,
    autoFulfillEnabled: false,
    trackingConversionProvider: TrackingConversionProvider.AQUILINE,
    trackingConversionScope: TrackingConversionScope.AMAZON_LOGISTICS_ONLY,
    trackingConvertManualOrders: true,
    ...overrides,
  }) as StoreSettingsResponse;

const globalRow = row({
  id: 'global',
  isGlobal: true,
  amazonTaxRate: 7,
  autoFulfillEnabled: true,
  autoFulfillMaxLoss: 5,
  checkBlacklist: false,
  trackingConversionProvider: TrackingConversionProvider.LOCAL,
});
const storeRow = row({ id: 'store-a-row', storeId: 'store-a', amazonTaxRate: 3, autoFulfillMaxLoss: null });

describe('resolveStoreDraftSeed', () => {
  it('uses the scope row when it exists', () => {
    expect(resolveStoreDraftSeed([globalRow, storeRow], 'store-a')).toBe(storeRow);
    expect(resolveStoreDraftSeed([globalRow, storeRow], GLOBAL_SCOPE)).toBe(globalRow);
  });

  it('falls back to the global row for a store with no row of its own', () => {
    expect(resolveStoreDraftSeed([globalRow, storeRow], 'store-b')).toBe(globalRow);
  });

  it('returns null when neither exists', () => {
    expect(resolveStoreDraftSeed([storeRow], 'store-b')).toBeNull();
    expect(resolveStoreDraftSeed([storeRow], GLOBAL_SCOPE)).toBeNull();
  });
});

describe('resolveSeedMaxLoss', () => {
  it('inherits the global limit for a store row with none', () => {
    expect(resolveSeedMaxLoss([globalRow, storeRow], 'store-a')).toBe(5);
    expect(resolveSeedMaxLoss([globalRow, storeRow], 'store-b')).toBe(5);
  });

  it('keeps a store limit of its own, including 0', () => {
    expect(resolveSeedMaxLoss([globalRow, row({ storeId: 'store-a', autoFulfillMaxLoss: 0 })], 'store-a')).toBe(0);
  });

  it('is null for a global row with no limit', () => {
    expect(resolveSeedMaxLoss([row({ isGlobal: true, autoFulfillMaxLoss: null })], GLOBAL_SCOPE)).toBeNull();
  });
});

describe('buildInheritedStoreFields', () => {
  it('copies the global row', () => {
    expect(buildInheritedStoreFields(globalRow)).toEqual({
      amazonTaxRate: 7,
      checkBlacklist: false,
      autoFulfillEnabled: true,
      trackingConversionProvider: TrackingConversionProvider.LOCAL,
      trackingConversionScope: TrackingConversionScope.AMAZON_LOGISTICS_ONLY,
      trackingConvertManualOrders: true,
    });
  });

  it('uses the read-side defaults (conversion ON) without a global row', () => {
    expect(buildInheritedStoreFields(null)).toEqual({
      amazonTaxRate: 0,
      checkBlacklist: true,
      autoFulfillEnabled: false,
      trackingConversionProvider: TrackingConversionProvider.AQUILINE,
      trackingConversionScope: TrackingConversionScope.AMAZON_LOGISTICS_ONLY,
      trackingConvertManualOrders: true,
    });
  });
});

describe('resolveSeedAllowCrossStore', () => {
  const globalOn = row({ id: 'global', isGlobal: true, allowCrossStoreAsins: true });

  it('a store with no row of its own shows the global value and owns nothing', () => {
    expect(resolveSeedAllowCrossStore([globalOn], 'store-a')).toEqual({ value: true, own: null });
  });

  it('a store row holding null still shows the inherited value', () => {
    const store = row({ id: 's', storeId: 'store-a', allowCrossStoreAsins: null });
    expect(resolveSeedAllowCrossStore([globalOn, store], 'store-a')).toEqual({ value: true, own: null });
  });

  it("a store's own choice wins over the global one", () => {
    const store = row({ id: 's', storeId: 'store-a', allowCrossStoreAsins: false });
    expect(resolveSeedAllowCrossStore([globalOn, store], 'store-a')).toEqual({ value: false, own: false });
  });

  it('nothing set anywhere reads as off', () => {
    expect(resolveSeedAllowCrossStore([], 'store-a')).toEqual({ value: false, own: null });
    expect(resolveSeedAllowCrossStore([], GLOBAL_SCOPE)).toEqual({ value: false, own: null });
  });
});
