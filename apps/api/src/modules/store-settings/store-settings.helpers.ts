import { TrackingConversionProvider, type StoreSettingsResponse } from '@repo/shared';

/**
 * Resolve the location fields independently from the rest of a store override.
 *
 * A focused drawer (blacklist or buyer messaging) may legitimately create a
 * store-specific row before that store has its own location. Returning that row
 * wholesale used to shadow the user's valid global postcode with an empty
 * string, which then reached eBay as `postalCode: ''`. Only location inherits;
 * every other field remains owned by the store row (A2, tax, blacklist, buyer
 * messaging, validation flags).
 *
 * `shipFromCity` is part of the location and inherits with the rest: it is the
 * city half of the one seller address, persisted to the column migration 089
 * minted for a since-merged separate form. Omitting it here would let a store
 * row created by the blacklist drawer publish an eBay item location with no
 * city while the user's global row has one — the same class of bug the
 * postcode line above exists to prevent.
 */
export function inheritMissingStoreLocation(
  storeSettings: StoreSettingsResponse,
  globalSettings: StoreSettingsResponse,
): StoreSettingsResponse {
  return {
    ...storeSettings,
    country: storeSettings.country.trim() || globalSettings.country,
    state: storeSettings.state.trim() || globalSettings.state,
    zipCode: storeSettings.zipCode.trim() || globalSettings.zipCode,
    shipFromCity: storeSettings.shipFromCity?.trim() || globalSettings.shipFromCity,
  };
}

/**
 * Store > Global for "allow ASINs already on my other stores": the store's own
 * value when it set one, else the global row's, else OFF (migration 140). A
 * NULL on a store row means "follow the global row", never "off".
 */
export function resolveAllowCrossStoreAsins(
  storeValue: boolean | null | undefined,
  globalValue: boolean | null | undefined,
): boolean {
  return storeValue ?? globalValue ?? false;
}

/**
 * Read a stored `tracking_conversion_provider`. Only an explicit `'local'`
 * means "no conversion": conversion is the default (migration 112), and a
 * blank, misspelt or unknown value must not quietly switch it off — that would
 * push the raw Amazon tracking number to eBay. Case and whitespace are
 * tolerated on older rows.
 */
export function mapTrackingConversionProvider(stored: string | null | undefined): TrackingConversionProvider {
  return typeof stored === 'string' && stored.trim().toLowerCase() === 'local'
    ? TrackingConversionProvider.LOCAL
    : TrackingConversionProvider.API;
}
