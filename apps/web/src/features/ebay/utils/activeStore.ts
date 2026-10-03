/**
 * The ONE rule for which eBay store the seller is working on: a store named in
 * the URL (a deep link, a refresh) if it is one of theirs, else the store they
 * last chose on this browser, else their first store. A value that is not one
 * of the seller's stores is never returned — it would be sent to the API.
 */
export const resolveActiveStoreId = (input: {
  urlStoreId: string | null;
  rememberedStoreId: string | null;
  storeIds: readonly string[];
}): string | null => {
  const { urlStoreId, rememberedStoreId, storeIds } = input;
  if (urlStoreId && storeIds.includes(urlStoreId)) {
    return urlStoreId;
  }
  if (rememberedStoreId && storeIds.includes(rememberedStoreId)) {
    return rememberedStoreId;
  }
  return storeIds[0] ?? null;
};

export const activeStoreStorageKey = (userId: string): string => `sellerhill.activeStore.${userId}`;

/** A per-browser convenience; storage may be blocked, so it never throws. */
export const readRememberedStore = (userId: string | null | undefined): string | null => {
  if (!userId) {
    return null;
  }
  try {
    return window.localStorage.getItem(activeStoreStorageKey(userId));
  } catch {
    return null;
  }
};

export const rememberStore = (userId: string | null | undefined, storeId: string): void => {
  if (!userId) {
    return;
  }
  try {
    window.localStorage.setItem(activeStoreStorageKey(userId), storeId);
  } catch {
    // Private window / blocked storage — the first store is the fallback.
  }
};
