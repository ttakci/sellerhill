import type { StoreSettingsResponse } from '@repo/shared';

/** Sentinel value representing the global (all-stores) scope. */
export const GLOBAL_SCOPE = 'global';

/**
 * Build the scope selector options: global first, then every available store.
 * Used by all three store-management drawers.
 */
export function buildScopeOptions(
  availableStores: Array<{ id: string; name: string }>,
  globalLabel: string,
): Array<{ value: string; label: string }> {
  return [
    { value: GLOBAL_SCOPE, label: globalLabel },
    ...availableStores.map((s) => ({ value: s.id, label: s.name })),
  ];
}

/**
 * Resolve the persisted config for a selected scope from the full config list.
 * Returns null when no config exists yet for that scope (create-on-first-edit).
 */
export function resolveScopeConfig(
  storeConfigs: StoreSettingsResponse[],
  scope: string,
): StoreSettingsResponse | null {
  if (scope === GLOBAL_SCOPE) {
    return storeConfigs.find((c) => c.isGlobal) ?? null;
  }
  return storeConfigs.find((c) => !c.isGlobal && c.storeId === scope) ?? null;
}

/**
 * The store-settings scope the hub and its drawers open on. `?scope=global`
 * is "all stores"; `?scope=<id>` is that store when it is one of the seller's
 * (trusted until the store list has loaded, so a deep link is not lost; a
 * foreign id reads as "all stores"). With no `?scope=` the drawers open on
 * the ACTIVE store chosen in the top bar — the store the seller is working on.
 */
export function resolveSettingsScope(
  scopeParam: string | null,
  activeStoreId: string | null,
  storeIds: readonly string[] | null,
): string {
  if (scopeParam === GLOBAL_SCOPE) {
    return GLOBAL_SCOPE;
  }
  if (scopeParam) {
    return storeIds === null || storeIds.includes(scopeParam) ? scopeParam : GLOBAL_SCOPE;
  }
  return activeStoreId ?? GLOBAL_SCOPE;
}
