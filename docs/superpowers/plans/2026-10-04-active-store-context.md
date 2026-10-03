# One Active Store — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The seller picks ONE eBay store in the top bar, and every store-scoped screen and action follows that choice. The per-page store filters go away.

**Architecture:**
- One pure resolver decides the active store in this order: URL `?store=` > remembered choice (`localStorage`) > first connected store.
- An `ActiveStoreProvider` mounted inside `AppLayout` exposes the result through `useActiveStore()`. On store-scoped routes (`AppRouteMeta.storeScoped`) it keeps `?store=` in step with that result.
- Pages stop reading `searchParams.get('store')` and their own filter Selects, and read `activeStoreId` from the hook instead.
- The API is unchanged.

**Tech Stack:** React 18, React Router 6, RTK Query, Emotion, Vitest, `@repo/ui` design system, i18next (16 locales).

**Spec:** `docs/superpowers/specs/2026-10-04-active-store-context-design.md`

## Global Constraints

- **4-file split** for every feature component (`.component.tsx` markup only / `.container.tsx` logic / `.style.ts` / `.types.ts`). A provider follows the `components/DirectionProvider.tsx` + `.types.ts` pattern.
- **Design system only:** the switcher is the `Dropdown` atom (same pattern as the language menu at `layouts/AppLayout/AppLayout.component.tsx:406`). No native elements, no hand-rolled buttons.
- **No hardcoded strings:** every new key goes in all 16 locales' `translation.json`. Those files are CRLF, so scripts must keep line endings intact.
- **Store-independent pages show no store name:** Billing, Settings (except the store-settings drawers' scope select), Stores, Profile, Best Sellers, Onboarding. The switcher itself stays visible in the top bar on every page.
- **No "All stores" view anywhere.** The API's blank-store call survives only for the switcher's per-store counts.
- **`localStorage`** is read and written inside try/catch, under the key `sellerhill.activeStore.<userId>`, and the app must work without it.
- **Toast:** no toast provider is mounted in the app (`ToastProvider` exists in `@repo/ui` but nothing mounts it). The switcher's label is the signal that the store changed. **Deviation from the spec:** no toast. The operator is told.
- **Mobile:** works at 375 px. The `Dropdown` already renders as a bottom sheet below 640 px.

## Review Focus

1. **A deep link naming a store the seller does not own** (`?store=<foreign id>`): it must be ignored, the active store kept, and the URL corrected. It must never send the foreign id to the API.
2. **A detail page (order / listing / job / return) belonging to store B, opened while A is active:** the active store switches to B. It must not flip back to A because the URL sync and the record disagree.
3. **The active store disconnected in another tab:** the accounts refetch drops it, and the provider falls back to the first remaining store. There is no blank page and no request with a stale id.
4. **First paint before accounts load:** `activeStoreId` is `null`, and pages skip their store-scoped queries. They must not fire an unscoped (all-stores) request that then flashes the wrong data.
5. **Store switch while a drawer is open or a list sits on page 4:** the drawer closes and the page resets to 1. A page 4 that the new store does not have must not stay selected.

---

### Task 1: Pure active-store resolver

**Files:**
- Create: `apps/web/src/features/ebay/utils/activeStore.ts`
- Test: `apps/web/src/features/ebay/utils/activeStore.test.ts`

**Interfaces:**
- Produces:
  - `resolveActiveStoreId(input: { urlStoreId: string | null; rememberedStoreId: string | null; storeIds: readonly string[] }): string | null`
  - `activeStoreStorageKey(userId: string): string`
  - `readRememberedStore(userId: string | null | undefined): string | null`
  - `rememberStore(userId: string | null | undefined, storeId: string): void`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';

import { activeStoreStorageKey, resolveActiveStoreId } from './activeStore';

const IDS = ['a', 'b', 'c'];

describe('resolveActiveStoreId', () => {
  it('prefers a URL store the seller owns', () => {
    expect(resolveActiveStoreId({ urlStoreId: 'b', rememberedStoreId: 'c', storeIds: IDS })).toBe('b');
  });
  it('ignores a URL store the seller does not own and uses the remembered one', () => {
    expect(resolveActiveStoreId({ urlStoreId: 'zzz', rememberedStoreId: 'c', storeIds: IDS })).toBe('c');
  });
  it('ignores a remembered store that is gone and falls back to the first', () => {
    expect(resolveActiveStoreId({ urlStoreId: null, rememberedStoreId: 'gone', storeIds: IDS })).toBe('a');
  });
  it('is null when the seller has no store', () => {
    expect(resolveActiveStoreId({ urlStoreId: 'a', rememberedStoreId: 'a', storeIds: [] })).toBeNull();
  });
  it('treats an empty URL value as absent', () => {
    expect(resolveActiveStoreId({ urlStoreId: '', rememberedStoreId: null, storeIds: IDS })).toBe('a');
  });
  it('keys the remembered choice per user', () => {
    expect(activeStoreStorageKey('u1')).toBe('sellerhill.activeStore.u1');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**
Run: `pnpm --filter web exec vitest run src/features/ebay/utils/activeStore.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run it and confirm it passes**
Run: same command. Expected: 6 passed.

- [ ] **Step 5: Commit**
`git add apps/web/src/features/ebay/utils/activeStore.ts apps/web/src/features/ebay/utils/activeStore.test.ts && git commit -m "feat(web): one rule for the active eBay store"`

---

### Task 2: `ActiveStoreProvider`, `useActiveStore` and store-scoped routes

**Files:**
- Create: `apps/web/src/components/ActiveStoreProvider.tsx`, `apps/web/src/components/ActiveStoreProvider.types.ts`
- Modify:
  - `apps/web/src/app/routeMeta.types.ts`: add `storeScoped?: boolean`.
  - `apps/web/src/app/routeMeta.ts`: set `storeScoped: true` on `/dashboard`, `/actions`, `/listings`, `/listings/all`, `/listings/jobs`, `/listings/revisions`, `/listings/products`, `/listings/`, `/orders`, `/orders/`, `/messages`, `/returns`. Do not set it on `/best-sellers`, `/billing`, `/settings`, `/settings/`, `/stores`, `/profile` or `/onboarding`.
  - `apps/web/src/App.tsx:190`: the seller layout route becomes `<Route element={<ActiveStoreProvider><AppLayout /></ActiveStoreProvider>}>`, so `AppLayout.container` itself can call `useActiveStore()` (Task 3 needs it for the badges). It is inside the router, so `useSearchParams` / `useLocation` work.
- Test: `apps/web/src/components/ActiveStoreProvider.test.tsx` (Vitest + `@testing-library/react`; check `apps/web/package.json` first, and if the library is absent, test only the pure helper `nextSearchForActiveStore` below).

**Interfaces:**
- Consumes: `resolveActiveStoreId`, `readRememberedStore`, `rememberStore` (Task 1); `useGetEbayAccountsQuery` (`features/ebay/api/ebayApi`); `resolveRouteMeta` (`app/routeMeta`); `useGetMeQuery` (the user id, as `AppLayout.container.tsx:49` reads it); `selectIsAuthenticated` (`AppLayout.container.tsx:43`); `stripLocaleFromPath` (`@/utils/locale`).
- Produces:
  - `useActiveStore(): ActiveStoreContextValue`, where `ActiveStoreContextValue = { activeStoreId: string | null; stores: EbayAccountPublicDto[]; setActiveStore: (storeId: string) => void }`. Outside a provider it returns `{ activeStoreId: null, stores: [], setActiveStore: () => undefined }`, so a page rendered in a test never throws.
  - `nextSearchForActiveStore(search: URLSearchParams, activeStoreId: string | null, storeScoped: boolean): URLSearchParams | null`. It returns the corrected params when `?store=` must change, else `null`.

- [ ] **Step 1: Write the failing test** for `nextSearchForActiveStore`:
  - on a store-scoped route, a missing `store` is set;
  - a wrong `store` is replaced;
  - an equal `store` returns `null`;
  - on a non-scoped route, `null` is returned whatever `store` holds;
  - with `activeStoreId === null`, `null` is returned.

- [ ] **Step 2: Run it** (`pnpm --filter web exec vitest run src/components/ActiveStoreProvider.test.tsx`) and confirm it fails.

- [ ] **Step 3: Implement the provider**

```tsx
export const ActiveStoreProvider = ({ children }: ActiveStoreProviderProps): React.ReactElement => {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const { data: me } = useGetMeQuery(undefined, { skip: !isAuthenticated });
  const userId = me?.id ?? null;
  const { data } = useGetEbayAccountsQuery(undefined, { skip: !isAuthenticated });
  const stores = useMemo(() => data?.items ?? [], [data?.items]);
  const storeIds = useMemo(() => stores.map((s) => s.id), [stores]);
  const [searchParams, setSearchParams] = useSearchParams();
  const pathWithoutLocale = stripLocaleFromPath(useLocation().pathname);
  const storeScoped = resolveRouteMeta(pathWithoutLocale)?.storeScoped ?? false;
  const [chosen, setChosen] = useState<string | null>(null);

  const activeStoreId = useMemo(
    () => resolveActiveStoreId({
      urlStoreId: storeScoped ? searchParams.get('store') : chosen,
      rememberedStoreId: chosen ?? readRememberedStore(userId),
      storeIds,
    }),
    [storeScoped, searchParams, chosen, userId, storeIds],
  );

  // The URL is a mirror of the choice on store-scoped pages, so a copied link opens the same store.
  useEffect(() => {
    const next = nextSearchForActiveStore(searchParams, activeStoreId, storeScoped);
    if (next) setSearchParams(next, { replace: true });
  }, [searchParams, activeStoreId, storeScoped, setSearchParams]);

  // Whatever became active (a deep link, a detail page's own store) is remembered.
  useEffect(() => {
    if (activeStoreId) { rememberStore(userId, activeStoreId); setChosen(activeStoreId); }
  }, [activeStoreId, userId]);

  const setActiveStore = useCallback((storeId: string) => {
    if (!storeIds.includes(storeId)) return;
    setChosen(storeId);
    rememberStore(userId, storeId);
    if (storeScoped) {
      // A store switch starts the page over: page 1, no open record, no selection.
      const next = new URLSearchParams();
      next.set('store', storeId);
      setSearchParams(next, { replace: false });
    }
  }, [storeIds, userId, storeScoped, setSearchParams]);

  const value = useMemo(() => ({ activeStoreId, stores, setActiveStore }), [activeStoreId, stores, setActiveStore]);
  return <ActiveStoreContext.Provider value={value}>{children}</ActiveStoreContext.Provider>;
};
```

  - Put the context object, the `ActiveStoreContextValue` type and `ActiveStoreProviderProps` in `.types.ts`, or the context in the `.tsx` if lint allows. Follow `DirectionProvider`.
  - `setActiveStore` drops every other query parameter on purpose. That is what resets pagination, the open conversation, the open return drawer (`r=`), the stage tab and so on (Review Focus 5). Drawers opened by `?drawer=` close for the same reason.

- [ ] **Step 4: Run the tests and `pnpm --filter web exec tsc --noEmit -p tsconfig.json`** (only the 3 known `dominantBaseline` errors may remain).

- [ ] **Step 5: Commit** — `feat(web): active store provider and store-scoped routes`.

---

### Task 3: The top-bar switcher and the sidebar badges

**Files:**
- Create: `apps/web/src/layouts/AppLayout/StoreSwitcher/StoreSwitcher.{component.tsx,container.tsx,style.ts,types.ts}` and `index.ts`.
- Modify:
  - `layouts/AppLayout/AppLayout.component.tsx`: render `<StoreSwitcher />` inside `S.HeaderRight`, BEFORE the language `Dropdown`.
  - `layouts/AppLayout/AppLayout.container.tsx`: the sidebar badges read the active store.
  - `packages/shared/src/i18n/resources/*/translation.json` (16 files): add `header.selectStore` ("Select store" / "Mağaza seç") and `header.storeWithCount` ("{{store}} · {{count}}").

**Interfaces:**
- Consumes:
  - `useActiveStore()` (Task 2);
  - `useGetActionCenterByStoreQuery(storeIds, { pollingInterval: ACTION_CENTER_POLL_INTERVAL_MS })` (`features/action-center/api/actionCenterApi.ts`);
  - `getStoreLabel` (`features/ebay/utils/storeLabel.ts`);
  - `EbayUnreadCountDto.byAccount` (`{ ebayAccountId, unread }[]`).
- Produces: `storeOwnItemCount(summary?: ActionCenterSummaryDto): number`. It counts items where `accountWide !== true`, summing `count`. Move the identical helper from `ActionCenterPage.container.tsx` into `features/action-center/utils/storeItemCount.ts` and import it in both places.

- [ ] **Step 1: Write a Vitest for `storeOwnItemCount`:** account-wide items are excluded, and `undefined` gives 0. Run it and confirm it fails.

- [ ] **Step 2: Implement `storeOwnItemCount`** and point `ActionCenterPage.container.tsx` at it. Run the test and confirm it passes.

- [ ] **Step 3: Build the switcher container**
  - With 0 stores it renders nothing.
  - With 1 store it renders a static label: `Text` on the header ink, no `Dropdown`.
  - With 2 or more stores it renders a `Dropdown` with the same trigger styling as `S.LanguageSelectTrigger` (reuse it through `styled(...)` in `StoreSwitcher.style.ts`). The trigger shows the active store's label. Each option's label is `t('translation:header.storeWithCount', { store, count })`, or the bare label when `count === 0`, and `onClick` calls `setActiveStore(id)`. Mark the active option the way the language menu marks its own; check the `Dropdown` item type for a `selected`/`active` field.
  - The trigger's `aria-label` is `t('translation:header.selectStore')`.
  - The trigger is no wider than 12 rem, with an ellipsis on the label.

- [ ] **Step 4: Point the sidebar badges at the active store** in `AppLayout.container.tsx`:
  - Replace `useGetActionCenterQuery(undefined, …)` with `useGetActionCenterByStoreQuery(storeIds, { skip: … , pollingInterval })`. The badge reads `byStore?.[activeStoreId]` as total `totalCount` / `criticalCount > 0`; these include the account-wide items, which belong on every store's badge. Note that RTK dedupes this with the switcher's call because the args are equal.
  - `unreadMessageCount` = `unreadMessages?.byAccount.find((r) => r.ebayAccountId === activeStoreId)?.unread ?? 0`.
  - `AppLayout.container` can call `useActiveStore()` because Task 2 mounted the provider around `AppLayout` in `App.tsx`. The operator console never renders `AppLayout`, so staff never mount it.

- [ ] **Step 5: Add the i18n keys to all 16 locales.** Use a CRLF-safe script that inserts after `"selectLanguage"` in the `header` block, and confirm `JSON.parse` succeeds on every file.

- [ ] **Step 6: Check:** `pnpm --filter @repo/shared build`, web `tsc`, `pnpm --filter web test`, then eslint on the changed files.

- [ ] **Step 7: Commit** — `feat(web): store switcher in the top bar; sidebar badges follow it`.

---

### Task 4: Overview pages read the active store (Dashboard, Action Center, Orders list, Returns, Messages)

**Files (modify):**
- `features/dashboard/hooks/useDashboardUrlState.ts` and `DashboardPage/DashboardPage.{container,component,types}.tsx`;
- `features/action-center/ActionCenterPage/ActionCenterPage.{container,component,types}.tsx`;
- `features/orders/all/hooks/useOrdersFilters.ts` and `OrdersAllPage.{container,component,types}.tsx`;
- `features/returns/ReturnsPage/hooks/useReturnsUrlState.ts` and `ReturnsPage.{container,component,types}.tsx`;
- `features/messages/hooks/useMessagesUrlState.ts` and `MessagesPage/MessagesPage.{container,component,types}.tsx`.

**The same conversion, per page:**
1. Delete the `store` URL read (`searchParams.get('store')` / `params.get('store')`), its setter and the `'store'` branch of any clear-filters handler.
2. Read `const { activeStoreId } = useActiveStore();` in the container or hook, and use it wherever the old store value went into a query arg (`ebayAccountId: activeStoreId ?? undefined`).
3. Add `skip: !activeStoreId` to every store-scoped query on the page (Review Focus 4).
4. Delete the store `Select` from the component, its props from `.types.ts`, and its `useStoreFilterOptions` / options memo from the container.
5. `hasActiveFilters`-style flags no longer count the store.

**Page-specific notes:**
- **Dashboard:** remove `PARAM_STORE`, `ALL_STORES`, `storeId` and `setStoreId` from `useDashboardUrlState`. The `S.ToolbarRight` store select goes, and the toolbar keeps the tabs only. Every "view all" link drops `store=` (the provider adds it).
- **Action Center:** delete `requestedStore`, `selectedStore`, the URL write-back effect, `handleStoreChange` and the picker options. The selected summary is `byStore?.[activeStoreId]`. Keep `getActionCenterByStore` (shared with the switcher). Keep the per-item `stores` badges for connection items, and keep the account-wide caption. Item links already carry `store=<id>`, so leave them.
- **Messages:** delete `storeSelector`, its `PageHeader` `actions` slot and `setStore`. `activeAccount` = `accounts.find((a) => a.id === activeStoreId)`. The compact type/folder toolbar's `showToolbar` no longer counts the store selector.
- **Orders:** `useOrdersFilters` loses `storeFromUrl`, its `useState` and its sync effect. `ebayAccountId` comes from the hook. Per-row currency: `resolveStoreCurrency(accounts, activeStoreId)` for the whole page.
- **Returns:** `useReturnsUrlState`'s `openedWithSelection` must no longer count `store`.

- [ ] **Step 1: Convert the five pages.**
- [ ] **Step 2: Source-guard test.** Add `apps/web/src/features/ebay/active-store.guard.test.ts` (Vitest, using `fs.readFileSync`) asserting that none of the files listed in this task and Task 5 contain `get('store')` or `useStoreFilterOptions`, and that each container (or its URL hook) contains `useActiveStore(`.
- [ ] **Step 3: Check:** web `tsc`, `pnpm --filter web test`, eslint on the changed files.
- [ ] **Step 4: Commit** — `refactor(web): overview pages follow the active store`.

---

### Task 5: Inventory pages read the active store (Listings overview, all and drafts, jobs, products, revision history)

**Files (modify):**
- `features/listings/overview/ListingsOverviewPage.{container,component,types}.tsx`;
- `features/listings/all/hooks/useListingsFilters.ts` and `ListingsAllPage.{container,component,types}.tsx`;
- `features/listings/listing-jobs/ListingJobsPage.{container,component,types,style}.tsx`;
- `features/listings/products/ProductsPage.{container,component,types,style}.tsx`;
- `features/listings/revision-history/RevisionHistoryPage.{container,component,types}.tsx`;
- `features/listings/shared/listings-filter.types.ts`.

**Conversion:** the same five-point conversion as Task 4.

**Page-specific notes:**
- **Listings overview:** delete `storeQuery` and `withStore`; the links are plain paths again, since the provider adds `store=`. The Add Listings drawer gets no `initialEbayAccountId` (Task 7 removes the prop).
- **`useListingsFilters`:** remove the `ebayAccountId` filter field and its URL branch. `toQuery` sets `ebayAccountId: activeStoreId ?? undefined`. Either the hook takes `activeStoreId` as an argument or it calls `useActiveStore()` itself; pick the one that keeps the hook's tests green.
- **Listing jobs:** remove `storeFilter`, `handleStoreFilterChange`, `showStoreFilter` and `jobStoreLabel` (Task 6 removes the labels everywhere).

- [ ] **Step 1: Convert the five pages,** and extend the Task 4 guard file list with these files.
- [ ] **Step 2: Check:** web `tsc`, `pnpm --filter web test`, eslint.
- [ ] **Step 3: Commit** — `refactor(web): inventory pages follow the active store`.

---

### Task 6: Detail pages follow their record's store, and store labels go

**Files (modify):**
- `features/orders/details/OrderDetailsPage.{container,component,types}.tsx`;
- `features/listings/detail/ListingDetailPage.{container,component,types}.tsx`;
- `features/listings/listing-jobs/details/ListingJobDetailsPage.{container,component,types}.tsx`;
- `features/returns/ReturnDetailDrawer/ReturnDetailDrawer.container.tsx`;
- `features/orders/shared/order-card.mapper.ts` and `features/listings/shared/listing-card.mapper.ts`;
- `features/returns/shared/return-row.mapper.ts` and `features/returns/shared/ReturnCard/*`;
- `features/listings/all/hooks/useListingsColumns.tsx` and `features/orders/all/hooks/useOrdersColumns.tsx`.

**Interfaces:**
- Consumes: `useActiveStore()`.
- Produces: `useFollowRecordStore(recordStoreId: string | null | undefined): void`, in `features/ebay/hooks/useFollowRecordStore.ts`.

**The hook:**

```ts
/**
 * A record of another store (a deep link, an Action Center row) makes that
 * store active, so the page never shows a record under the wrong store.
 * Runs only when the record's store is known and differs.
 */
export const useFollowRecordStore = (recordStoreId: string | null | undefined): void => {
  const { activeStoreId, setActiveStore } = useActiveStore();
  useEffect(() => {
    if (recordStoreId && activeStoreId && recordStoreId !== activeStoreId) {
      setActiveStore(recordStoreId);
    }
  }, [recordStoreId, activeStoreId, setActiveStore]);
};
```

**Caution (Review Focus 2):**
- `setActiveStore` rewrites the query string to `?store=<id>` only. On a detail page that would drop the detail's own params, such as the return drawer's `r=`.
- Change `setActiveStore` to take `(storeId, { keepParams?: boolean })`. With `keepParams: true` it sets `store` and keeps the other params, and `useFollowRecordStore` passes it.
- Add that case to the Task 2 helper test.

**Steps:**
- [ ] **Step 1: Write the test** for the `keepParams` variant (params kept, store replaced). Run it and confirm it fails. Implement it, then run it and confirm it passes.
- [ ] **Step 2: Call `useFollowRecordStore`** with:
  - `order?.ebayAccountId` in the order detail;
  - `listing?.ebayAccountId` in the listing detail;
  - `job?.ebayAccountId` in the job detail;
  - `detail?.ebayAccountId ?? row?.ebayAccountId` in the return drawer.
- [ ] **Step 3: Remove every store label:**
  - the `storeLabel` prop and its rendering on the three detail pages;
  - `storeLabel` / `storeLabelFor` in the three mappers, the cards and the two column hooks;
  - the `translation:common.store` / `common.storeNamed` keys only if nothing else reads them. Grep first; if unused, remove them from all 16 locales.
  - Then delete `useStoreLabel` and `resolveRecordStoreLabel` together with their tests, if nothing imports them. Keep `getStoreLabel` and `useStoreFilterOptions` only while they are used; the switcher uses `getStoreLabel`.
- [ ] **Step 4: Check:** web `tsc`, tests, eslint.
- [ ] **Step 5: Commit** — `refactor(web): detail pages follow their record's store; store labels removed`.

---

### Task 7: Drawers use the active store; the settings scope defaults to it

**Files (modify):**
- `features/listings/add-listings/drawer/AddListingsDrawer.{container,component,types}.tsx`;
- `features/listings/import-existing/ExistingListingsImportDrawer.{container,component,types}.tsx`;
- `features/settings/SettingsPage/SettingsHubPage.container.tsx`;
- `packages/shared/src/i18n/resources/*/listings.json` (16 files): add `listings.addDrawer.addingTo` ("Adding to {{store}}" / "{{store}} mağazasına ekleniyor") and `listings.existingImport.importingTo` ("Importing into {{store}}" / "{{store}} mağazasına aktarılıyor"). Find the exact parent keys with grep and keep the namespace wrapper (`listings.*`).

**Add Listings:**
- The `ebayAccountId` form field stays (the submit needs it), but it is set from `activeStoreId` on open and whenever `activeStoreId` changes (dropping the policies, as the existing store-change branch does). The store `Select` is removed from the component.
- The drawer subtitle shows `addingTo` with the active store's `getStoreLabel`.
- Remove the `initialEbayAccountId` prop and the stored-preference `ebayAccountId` (keep the group/policy preferences). A remembered store may only be used when it equals the active store; otherwise its policies are dropped.

**Import existing listings:** `values.ebayAccountId` is initialised from `activeStoreId`; the store `Select` and its step-1 validation go; the subtitle shows `importingTo`.

**Settings hub:** when `?scope=` is absent, the scope is the ACTIVE store, not global (`GLOBAL_SCOPE` is used only when `scope=global`). The scope `Select` in the store-settings drawers stays, with "All stores" as an option. The drawer header already states the scope; verify it reads the resolved scope, not the raw URL value.

- [ ] **Step 1: Implement the three changes,** and add the i18n keys to all 16 locales (CRLF-safe; check with `JSON.parse`).
- [ ] **Step 2: Vitest for the settings scope:**
  - absent → the active id;
  - `global` → global;
  - a foreign id → global, the existing rule.
  - Extract the scope resolution into a pure `resolveSettingsScope(scopeParam, activeStoreId, storeIds)` in `features/settings/utils/settingsScope.ts` if it is inline.
- [ ] **Step 3: Check:** web `tsc`, tests, eslint; `pnpm --filter @repo/shared build` first.
- [ ] **Step 4: Commit** — `feat(web): drawers add to the active store; settings open on it`.

---

### Task 8: Demo, verification, docs

**Files:**
- Modify: `apps/web/src/features/demo/demoBaseQuery.ts` (only if a demo handler ignores `ebayAccountId` on a now-scoped call: orders, listings, jobs, products, revisions, returns, messages, dashboard — check each, and filter by the fixture's store id);
- Modify: `CLAUDE.md` (a new "### One active store (top bar)" section under "Frontend Architecture Notes"; amend the dashboard toolbar, Action Center, Messages and multi-store bullets that describe per-page store filters).
- Modify: the spec's §2, to record the no-toast deviation.

- [ ] **Step 1: Demo filtering.** For each scoped demo handler, confirm it filters by `params.ebayAccountId`; add the filter where it is missing.
- [ ] **Step 2: Full checks.** Run `pnpm --filter @repo/shared build && pnpm --filter @repo/ui build`, web `tsc`, `pnpm --filter web test`, `pnpm lint`, and `pnpm --filter api test` (the API is unchanged; this is a smoke run).
- [ ] **Step 3: Browser check in demo mode** (two demo stores). Run `pnpm --filter web exec vite --port 5199` and a Playwright script at 1440 px and 375 px:
  - the switcher shows both stores with counts;
  - switching store changes the orders list and resets to page 1;
  - `/orders/<id of store B>` opened with A active switches the switcher to B;
  - `/orders?store=<foreign uuid>` is corrected to the active store;
  - Billing shows no store name, but the switcher is still present;
  - the Add Listings drawer subtitle names the active store.
- [ ] **Step 4: Update CLAUDE.md and the spec,** then commit: `docs: one active store`.
- [ ] **Step 5: Push `development`.** The UAT/main merge is the operator's call.
