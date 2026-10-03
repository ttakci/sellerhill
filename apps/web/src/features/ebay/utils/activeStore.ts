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
 * Params that belong to the store just left: the page number, the open
 * record (return `r`, conversation `c`), an open drawer and a hand-off of
 * ASINs. Everything else is the VIEW the seller is in (dashboard tab and
 * period, the drafts view, the messages folder, list filters, a search) and
 * survives a switch — comparing two stores' charts or drafts is the point of
 * a switcher.
 */
const STORE_BOUND_PARAMS = ['page', 'r', 'c', 'drawer', 'asins'] as const;

/**
 * The query string after the seller picks another store: the view is kept,
 * the store-bound params are dropped. Following a record's own store (a
 * detail page opened from another store) keeps every param, or the record
 * would close.
 */
export const searchForStoreSwitch = (
  search: URLSearchParams,
  storeId: string,
  keepParams: boolean
): URLSearchParams => {
  const next = new URLSearchParams(search);
  if (!keepParams) {
    for (const param of STORE_BOUND_PARAMS) {
      next.delete(param);
    }
  }
  next.set('store', storeId);
  return next;
};

/**
 * On a record page (`/orders/123`, `/listings/abc`, `/listings/jobs/j1`) the
 * list it belongs to; `null` on a list page. A manual switch on a record page
 * goes to that list — the record belongs to the store just left, and staying
 * would make the page switch straight back to the record's store.
 * `metaPath` is the matched `AppRouteMeta.path` (a prefix entry may end in `/`).
 */
export const recordListPath = (path: string, metaPath: string | undefined): string | null => {
  if (!metaPath) {
    return null;
  }
  const listPath = metaPath.replace(/\/+$/, '') || '/';
  return path !== listPath && path.startsWith(`${listPath}/`) ? listPath : null;
};
