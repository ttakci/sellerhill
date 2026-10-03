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

/**
 * On a store-scoped page the URL mirrors the active store, so a copied link
 * opens the same store. Returns the corrected params, or `null` when the URL
 * is already right (or the page has no store, or none is known yet).
 */
export const nextSearchForActiveStore = (
  search: URLSearchParams,
  activeStoreId: string | null,
  storeScoped: boolean
): URLSearchParams | null => {
  if (!storeScoped || !activeStoreId || search.get('store') === activeStoreId) {
    return null;
  }
  const next = new URLSearchParams(search);
  next.set('store', activeStoreId);
  return next;
};

/**
 * The query string after the seller picks another store. A switch starts the
 * page over — page 1, no open record, no selection, no open drawer — so only
 * the store survives. Following a record's own store (a detail page opened
 * from another store) keeps the page's params, or the record would close.
 */
export const searchForStoreSwitch = (
  search: URLSearchParams,
  storeId: string,
  keepParams: boolean
): URLSearchParams => {
  const next = keepParams ? new URLSearchParams(search) : new URLSearchParams();
  next.set('store', storeId);
  return next;
};
