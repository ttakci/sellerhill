import type { StoreSettingsResponse } from '@repo/shared';

/**
 * Resolve the location fields independently from the rest of a store override.
 *
 * A focused drawer (blacklist or buyer messaging) may legitimately create a
 * store-specific row before that store has its own location. Returning that row
 * wholesale used to shadow the user's valid global postcode with an empty
 * string, which then reached eBay as `postalCode: ''`. Only location inherits;
 * every other field remains owned by the store row (A2, tax, blacklist, buyer
 * messaging, validation flags).
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
  };
}
