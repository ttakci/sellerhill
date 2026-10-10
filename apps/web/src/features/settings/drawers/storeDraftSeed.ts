import { TrackingConversionProvider, TrackingConversionScope, type SaveStoreSettingsRequest, type StoreSettingsResponse } from '@repo/shared';

import { GLOBAL_SCOPE, resolveScopeConfig } from './storeScope';

/**
 * The row a drawer's form starts from for the selected scope.
 *
 * Every eBay store uses its own settings row; a store that has none yet uses
 * the global ("all stores") row. So the form for such a store must show the
 * GLOBAL values — prefilling hard defaults instead would show settings that
 * are not in force, and saving would write them as store overrides that
 * silently differ from global.
 *
 * Returns null only when neither the scope nor (for a store) the global row
 * exists; callers then fall back to their own defaults. The returned object
 * is one of `storeConfigs`' own entries, so its identity is stable across
 * renders and safe to compare for "config arrived" detection.
 */
export function resolveStoreDraftSeed(
  storeConfigs: StoreSettingsResponse[],
  scope: string,
): StoreSettingsResponse | null {
  const own = resolveScopeConfig(storeConfigs, scope);
  if (own || scope === GLOBAL_SCOPE) {
    return own;
  }
  return resolveScopeConfig(storeConfigs, GLOBAL_SCOPE);
}

/**
 * The loss limit in force for a scope. A store row with NO limit inherits the
 * global one (server rule: a store cannot opt out of a global limit), so the
 * form shows the global limit there too.
 */
export function resolveSeedMaxLoss(
  storeConfigs: StoreSettingsResponse[],
  scope: string,
): number | null {
  const own = resolveStoreDraftSeed(storeConfigs, scope)?.autoFulfillMaxLoss;
  if (own !== null && own !== undefined) {
    return own;
  }
  if (scope === GLOBAL_SCOPE) {
    return null;
  }
  return resolveScopeConfig(storeConfigs, GLOBAL_SCOPE)?.autoFulfillMaxLoss ?? null;
}

/**
 * Fields a FOCUSED drawer (one that owns only part of the row) must send when
 * it is about to CREATE a store row.
 *
 * On UPDATE an omitted field means "leave unchanged", but on INSERT the server
 * fills an omitted field with its column default — which can differ from the
 * global row (auto-fulfill off, the `local` tracking provider…). Sending the
 * global row's values makes the new store row start out identical to what the
 * store was already using. Without a global row the read-side defaults are
 * sent (the same values the API reports for a seller with no row).
 *
 * Location, buyer messaging, listing rules, the loss limit and
 * `allowCrossStoreAsins` are deliberately
 * NOT included: a store row that leaves them empty inherits the global ones at
 * read time, which keeps following later changes to the global row.
 */
export function buildInheritedStoreFields(
  globalConfig: StoreSettingsResponse | null,
): Pick<
  SaveStoreSettingsRequest,
  | 'amazonTaxRate'
  | 'checkBlacklist'
  | 'autoFulfillEnabled'
  | 'trackingConversionProvider'
  | 'trackingConversionScope'
  | 'trackingConvertManualOrders'
> {
  return {
    amazonTaxRate: globalConfig?.amazonTaxRate ?? 0,
    checkBlacklist: globalConfig?.checkBlacklist ?? true,
    autoFulfillEnabled: globalConfig?.autoFulfillEnabled ?? true,
    trackingConversionProvider: globalConfig?.trackingConversionProvider ?? TrackingConversionProvider.AQUILINE,
    trackingConversionScope: globalConfig?.trackingConversionScope ?? TrackingConversionScope.AMAZON_LOGISTICS_ONLY,
    trackingConvertManualOrders: globalConfig?.trackingConvertManualOrders ?? true,
  };
}

/**
 * "Allow ASINs already listed on my other stores" for a scope.
 *
 * `own` is the value saved on the scope's OWN row (null = not set); `value` is
 * what is in force: own ?? global ?? off — the server's resolution. A store
 * that never chose shows the inherited value and keeps inheriting until the
 * seller changes it (the drawer then sends `own` only, so an untouched store
 * row is not frozen at today's global value).
 */
export function resolveSeedAllowCrossStore(
  storeConfigs: StoreSettingsResponse[],
  scope: string,
): { value: boolean; own: boolean | null } {
  const own = resolveScopeConfig(storeConfigs, scope)?.allowCrossStoreAsins ?? null;
  const inherited =
    scope === GLOBAL_SCOPE ? null : resolveScopeConfig(storeConfigs, GLOBAL_SCOPE)?.allowCrossStoreAsins ?? null;
  return { value: own ?? inherited ?? false, own };
}
