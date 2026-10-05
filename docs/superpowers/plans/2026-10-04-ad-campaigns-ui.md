# Ad Campaigns UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the SellerHill campaign list and detail screens, add campaign context to listing detail and the unsaved pricing calculator, and expose campaign navigation using the top bar's active eBay store.

**Architecture:** Add a campaigns feature following the existing container/component/style/types pattern and RTK Query conventions. Keep campaign reads and writes scoped by `useActiveStore().activeStoreId`, reusing the existing backend routes and DTOs; extend only the read DTO projections needed to distinguish margin overrides and show a listing's campaign. Use existing `@repo/ui` primitives, theme tokens, and localization resources.

**Tech Stack:** React 18, TypeScript, React Router, Redux Toolkit Query, Emotion, `@repo/shared`, `@repo/ui`, react-i18next, Vitest, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md` (Part B7 and the listing detail / price calculator UI in Part B5); read alongside `.superpowers/sdd/2026-10-04-ad-campaigns-backend/ui-plan-research.md` and `docs/superpowers/plans/2026-10-04-ad-campaigns-backend.md`.

## Global Constraints

- Campaign screens use only the active top-bar store from `useActiveStore()`; do not add a page-level store selector.
- Store-scoped queries are skipped while `activeStoreId` is `null`; include the active store ID in every query and mutation argument.
- On active-store change, clear page selection and close store-bound drawers; ignore completions from mutations started for the previous store. RTK Query cache keys must remain store-specific.
- A listing with either `marginPercentOverride` or `marginFixedOverride` set excludes the ad rate from SellerHill's repricing calculation. The eBay campaign rate can remain present in synced campaign state; show that it is not applied to the SellerHill price. Do not infer margin override from `priceLocked` or rewrite the synced rate.
- Campaign metrics remain `null` pending the future B6 report parser. Render an unavailable/pending value for null or absent metric fields; never turn missing data into zero. B6 parsing/capture changes and C3/C4 billing/profit work are out of scope.
- Add a `campaigns` namespace JSON resource under each supported locale: `en`, `tr`, `ru`, `hi`, `ur`, `ar`, `az`, `bn`, `de`, `fr`, `es`, `it`, `ro`, `uk`, `zh`, `pt`. Keep resource shape identical. Primary namespace keys use dot notation (`t('campaigns.list.title')`); cross-namespace keys use `t('translation:common.loading')`.
- Keep seller-facing strings in i18n; use sentence case and direct action labels. Add the campaign section and item to `translation:menu.*` in all locales.
- Preserve the repository's container/component/style/types split and the existing `@repo/ui` design system. Do not add visual frameworks, fonts, or dependencies.
- Use the existing Vitest harness in `apps/web/vitest.config.ts` and `apps/web/src/test/setup.ts`; do not add a test framework or upgrade dependencies.
- The backend campaign routes already exist in the development tree, but B6 metrics parsing does not. This plan owns the small read-only projection changes for margin override and listing campaign detail only; do not expand backend scope beyond those read DTOs.
- Do not deploy or merge to UAT/main, use production, or call live eBay endpoints. Use mocked API responses and local verification only.
- Each implementation commit stages only the exact files listed in that task with `git add -- <paths>`; never use `git add -A`/`git add .` or `--no-verify`. Commit messages include the exact spec reference footer `Refs: docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md`.

## Review Focus

- A store switch while a mutation or query is pending must not leave old-store rows, selections, drawer state, or success/error UI in the newly selected store. Pin in Tasks 2 and 4.
- A null or partially populated metric object must remain visibly unavailable for each missing metric and must not be rendered as `$0`, `0`, or `0.0x`. Pin in Task 3.
- A margin override and a fixed price lock are separate states: a margin override suppresses the rate in SellerHill repricing even when synced campaign rate remains 5%; a price lock is a separate condition. Pin in Tasks 1, 4, and 5.
- An ineligible store and a read-only rule-based, CPC, dynamic, or ended campaign must remain readable while write actions are disabled with the server's reason. Pin in Tasks 3 and 4.
- Empty store context and store changes must not issue campaign requests with an absent or stale `ebayAccountId`; pin in Tasks 2 and 3.

---

### Task 1: Define UI read contracts and campaign RTK Query endpoints

**Files:**
- Create: `apps/web/src/features/campaigns/api/campaigns.api.ts`
- Create: `apps/web/src/features/campaigns/api/campaigns.api.test.ts`
- Modify: `apps/web/src/api/baseApi.ts`
- Modify: `packages/shared/src/domain/campaigns/campaigns.types.ts`
- Modify: `packages/shared/src/domain/listings/listings.types.ts`
- Modify: `apps/api/src/modules/ebay-campaigns/ebay-campaigns.service.ts`
- Modify: `apps/api/src/modules/ebay-campaigns/ebay-campaigns.service.spec.ts`
- Modify: `apps/api/src/modules/listings/listings.service.ts`
- Create: `apps/api/src/modules/listings/listing-campaign-read.spec.ts`
- Modify: `apps/web/src/features/listings/api/listings.api.ts`

**Interfaces:**
- Consumes: Existing backend routes `GET /campaigns?ebayAccountId=...`, `GET /campaigns/:campaignId?ebayAccountId=...`, `GET /campaigns/candidates?ebayAccountId=...`, `POST /campaigns`, `POST /campaigns/:campaignId/listings/{add,remove}`, `POST /campaigns/:campaignId/rate`, and `POST /campaigns/:campaignId/actions/:action`.
- Produces: Shared `EbayCampaignListDto` and `CampaignCandidatesDto` response interfaces matching backend response shapes; generated hooks `useGetCampaignsQuery({ ebayAccountId })`, `useGetCampaignQuery({ ebayAccountId, campaignId })`, `useGetCampaignCandidatesQuery({ ebayAccountId, listingSettingsGroupId?, search?, page, limit })`, and matching create/add/remove/rate/action mutation hooks. Every mutation body carries `ebayAccountId` as required by the controller. Register the `Campaigns` tag in `baseApi.tagTypes`.
- Produces: `CampaignListingDto.hasMarginOverride: boolean`; `ListingDto.adCampaign: { campaignId: string; name: string; status: string; fundingModel: string | null; adRateStrategy: string | null; adRate: number | null; appliedAdRate: number } | null`.

- [ ] **Step 1: Add API contract tests with a local MSW server**

The current Vitest setup provides jsdom and Testing Library, but no shared RTK Query/MSW server helper. Use the already-installed `msw` package to create `setupServer` in this test file, and configure a minimal Redux store with `baseApi.reducer` and `baseApi.middleware`. Intercept the configured local API origin; never call the real server.

```ts
it('keys list reads by the active eBay account and preserves null metrics', async () => {
  server.use(http.get('*/campaigns', ({ request }) => {
    expect(new URL(request.url).searchParams.get('ebayAccountId')).toBe('store-a');
    return HttpResponse.json({ campaigns: [{ campaignId: '123', metrics: null }], eligibility: {} });
  }));
  const result = await store.dispatch(campaignsApi.endpoints.getCampaigns.initiate({ ebayAccountId: 'store-a' }));
  expect(result.data?.campaigns[0]?.metrics).toBeNull();
});

it('sends the account id with campaign writes', async () => {
  server.use(http.post('*/campaigns', async ({ request }) => {
    expect(await request.json()).toEqual({ ebayAccountId: 'store-a', name: 'Spring', bidPercentage: 5 });
    return HttpResponse.json({ campaignId: '123' });
  }));
  await store.dispatch(campaignsApi.endpoints.createCampaign.initiate({
    ebayAccountId: 'store-a', name: 'Spring', bidPercentage: 5,
  }));
});
```

- [ ] **Step 2: Run the focused test and confirm it fails before endpoint creation**

Run: `pnpm --filter web test -- src/features/campaigns/api/campaigns.api.test.ts`
Expected: FAIL because the campaigns API module/endpoints do not exist.

- [ ] **Step 3: Add the minimal read DTO projections**

In `campaigns.types.ts`, add `EbayCampaignListDto` (`campaigns` plus eligibility) and `CampaignCandidatesDto` (`items`, `total`, `page`, `limit`, `skippedInCampaign`) to match current controller responses. In `CampaignListingDto`, add `hasMarginOverride`. In the campaign service's `ListingRow`, both listing SELECT projections, and `listing()` mapper, include/set it from the two override columns without deriving it from `lock_price`:

```ts
hasMarginOverride: row.margin_percent_override !== null || row.margin_fixed_override !== null,
```

For listing detail, add nullable `ListingDto.adCampaign` and extend the existing detail query/projection in `listings.service.ts` with a LEFT JOIN on `ebay_campaigns` by `(ebay_account_id, promoted_campaign_id)`. Map the campaign fields and stored campaign rate; return `null` when there is no joined campaign. Keep ad rate and effective pricing rate distinct: a margin override can leave the synced campaign rate nonzero while SellerHill's repricing calculation excludes it. Add regression coverage in `ebay-campaigns.service.spec.ts` for owned-store reads, `hasMarginOverride`, and pg NUMERIC string conversion; add `listing-campaign-read.spec.ts` to verify listing detail remains owner/store-scoped and a missing association maps to `null`. These are read projections only; do not change pricing or write behavior.

- [ ] **Step 4: Implement `campaigns.api.ts` with typed args, bodies, and cache invalidation**

Inject endpoints into `baseApi`; use response types from `@repo/shared`. List/detail/candidates use GET; write routes mirror the controller exactly. Provide campaign/listing tags on reads and invalidate them after successful writes so the detail and list refresh. Export only generated hooks needed by Tasks 3–4.

```ts
getCampaigns: builder.query<EbayCampaignListDto, { ebayAccountId: string }>({
  query: ({ ebayAccountId }) => ({ url: '/campaigns', params: { ebayAccountId } }),
  providesTags: (result, _error, { ebayAccountId }) => [
    { type: 'Campaigns', id: ebayAccountId },
    ...(result?.campaigns ?? []).map(({ campaignId }) => ({ type: 'Campaigns' as const, id: `${ebayAccountId}:${campaignId}` })),
  ],
}),
```

- [ ] **Step 5: Build shared types, then verify focused API tests and typecheck**

Run first: `pnpm --filter @repo/shared build` so web and API consume the new shared response types. Then run: `pnpm --filter web test -- src/features/campaigns/api/campaigns.api.test.ts` and `pnpm --filter api test -- ebay-campaigns.service.spec.ts listing-campaign-read.spec.ts`.
Expected: PASS for account-scoped URL/body, nullable metrics, store ownership, and NUMERIC conversion. Run: `pnpm typecheck`; address only errors introduced by these changes and report existing unrelated failures.

- [ ] **Step 6: Commit only Task 1 paths**

```bash
git add -- apps/web/src/features/campaigns/api/campaigns.api.ts apps/web/src/features/campaigns/api/campaigns.api.test.ts apps/web/src/api/baseApi.ts packages/shared/src/domain/campaigns/campaigns.types.ts packages/shared/src/domain/listings/listings.types.ts apps/api/src/modules/ebay-campaigns/ebay-campaigns.service.ts apps/api/src/modules/ebay-campaigns/ebay-campaigns.service.spec.ts apps/api/src/modules/listings/listings.service.ts apps/api/src/modules/listings/listing-campaign-read.spec.ts apps/web/src/features/listings/api/listings.api.ts
cat > /tmp/sellerhill-campaigns-task-1.msg <<'EOF'
feat(campaigns): add typed UI API and read projections

Refs: docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git commit -F /tmp/sellerhill-campaigns-task-1.msg -- apps/web/src/features/campaigns/api/campaigns.api.ts apps/web/src/features/campaigns/api/campaigns.api.test.ts apps/web/src/api/baseApi.ts packages/shared/src/domain/campaigns/campaigns.types.ts packages/shared/src/domain/listings/listings.types.ts apps/api/src/modules/ebay-campaigns/ebay-campaigns.service.ts apps/api/src/modules/ebay-campaigns/ebay-campaigns.service.spec.ts apps/api/src/modules/listings/listings.service.ts apps/api/src/modules/listings/listing-campaign-read.spec.ts apps/web/src/features/listings/api/listings.api.ts
rm /tmp/sellerhill-campaigns-task-1.msg
```

### Task 2: Register routes, store scope, navigation, and localization

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/app/routeMeta.types.ts`
- Modify: `apps/web/src/app/routeMeta.ts`
- Modify: `apps/web/src/app/routeMeta.storeScoped.test.ts`
- Modify: `apps/web/src/layouts/AppLayout/AppLayout.component.tsx`
- Modify: `packages/shared/src/i18n/index.ts`
- Modify: `packages/shared/src/i18n/types.ts`
- Create: `packages/shared/src/i18n/resources/{en,tr,ru,hi,ur,ar,az,bn,de,fr,es,it,ro,uk,zh,pt}/campaigns.json`
- Modify: `packages/shared/src/i18n/resources/{en,tr,ru,hi,ur,ar,az,bn,de,fr,es,it,ro,uk,zh,pt}/translation.json`
- Create: `apps/web/src/features/campaigns/index.ts`
- Create: `apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.container.tsx`
- Create: `apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.component.tsx`
- Create: `apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.style.ts`
- Create: `apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.types.ts`
- Create: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.container.tsx`
- Create: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.component.tsx`
- Create: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.style.ts`
- Create: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.types.ts`
- Create: `apps/web/src/features/campaigns/campaigns.routes.test.tsx`

**Interfaces:**
- Consumes: `useActiveStore(): { activeStoreId, stores, setActiveStore }`, `EbayAccountGuard`, existing `LocaleRedirect`, and `resolveRouteMeta`.
- Produces: Locale routes `/:locale/campaigns` and `/:locale/campaigns/:campaignId`, both under seller `AppLayout` and guarded by `EbayAccountGuard`; locale-less `/campaigns` redirects while preserving query parameters. Route metadata is `storeScoped: true`, `section: 'marketing'`, with list/detail breadcrumbs.

- [ ] **Step 1: Extend route metadata and test store scope**

Add the marketing nav section type, list exact route metadata before the `'/campaigns/'` prefix detail metadata, and cover both paths:

```ts
expect(resolveRouteMeta('/campaigns')?.storeScoped).toBe(true);
expect(resolveRouteMeta('/campaigns/123')?.storeScoped).toBe(true);
expect(resolveRouteMeta('/campaigns/123')?.breadcrumbs.at(-1)?.labelKey).toBe('campaigns:campaigns.detail.breadcrumb');
```

- [ ] **Step 2: Add campaign namespace resources and menu labels in all 16 locales**

Register `campaigns.json` in the explicit shared resource imports and EN typing. Start each file with the same wrapper and keys, including `campaigns.list.title`, `campaigns.detail.title`, `campaigns.list.metrics.*`, `campaigns.campaign.*`, `campaigns.errors.*`, `campaigns.actions.*`, and `campaigns.empty.*`. Keep `translation:menu.marketing` and `translation:menu.campaigns` present in each locale. Use native Turkish text and existing locale conventions; do not leave English placeholder strings in non-English files.

- [ ] **Step 3: Add lazy routes, locale-less redirect, and a flat Marketing sidebar group**

Import the feature barrel lazily in `App.tsx`. Add the two locale routes inside the seller layout and `<EbayAccountGuard>` within page containers. Add a locale-less `<LocaleRedirect to="campaigns" preserveQuery />`. In `AppLayout.component.tsx`, add one flat Marketing label and one Campaigns item using the existing `NavItem`, `NavTooltip`, and `onLocaleNavigate` patterns; do not create nested navigation.

- [ ] **Step 4: Add minimal page shells using house primitives**

Create both container/component/style/types files and the feature barrel so the routes build. Containers own `useActiveStore`, RTK Query, drawers, and selection. Components use `useTranslation` and `@repo/ui` only for presentation. Styled components use existing theme tokens, responsive layout, and visible focus states; no new fonts or generic gradient/card decoration.

- [ ] **Step 5: Test route scope, locale redirect, and store-switch isolation**

In `campaigns.routes.test.tsx`, render with a mocked `ActiveStoreContext`, switch `store-a` to `store-b` while a deferred read/write is pending, and assert that the new page queries use only `store-b`, selected listing IDs clear, and all store-bound drawers close. Also assert no query is issued when `activeStoreId` is null. Reuse `apps/web/src/test/setup.ts` and existing Testing Library/jsdom.

Run: `pnpm --filter web test -- src/app/routeMeta.storeScoped.test.ts src/features/campaigns/campaigns.routes.test.tsx`
Expected: PASS, with both campaign routes store-scoped and the page isolated on store switch.

- [ ] **Step 6: Commit only Task 2 paths**

```bash
git add -- apps/web/src/App.tsx apps/web/src/app/routeMeta.types.ts apps/web/src/app/routeMeta.ts apps/web/src/app/routeMeta.storeScoped.test.ts apps/web/src/layouts/AppLayout/AppLayout.component.tsx packages/shared/src/i18n/index.ts packages/shared/src/i18n/types.ts packages/shared/src/i18n/resources/en/campaigns.json packages/shared/src/i18n/resources/tr/campaigns.json packages/shared/src/i18n/resources/ru/campaigns.json packages/shared/src/i18n/resources/hi/campaigns.json packages/shared/src/i18n/resources/ur/campaigns.json packages/shared/src/i18n/resources/ar/campaigns.json packages/shared/src/i18n/resources/az/campaigns.json packages/shared/src/i18n/resources/bn/campaigns.json packages/shared/src/i18n/resources/de/campaigns.json packages/shared/src/i18n/resources/fr/campaigns.json packages/shared/src/i18n/resources/es/campaigns.json packages/shared/src/i18n/resources/it/campaigns.json packages/shared/src/i18n/resources/ro/campaigns.json packages/shared/src/i18n/resources/uk/campaigns.json packages/shared/src/i18n/resources/zh/campaigns.json packages/shared/src/i18n/resources/pt/campaigns.json packages/shared/src/i18n/resources/en/translation.json packages/shared/src/i18n/resources/tr/translation.json packages/shared/src/i18n/resources/ru/translation.json packages/shared/src/i18n/resources/hi/translation.json packages/shared/src/i18n/resources/ur/translation.json packages/shared/src/i18n/resources/ar/translation.json packages/shared/src/i18n/resources/az/translation.json packages/shared/src/i18n/resources/bn/translation.json packages/shared/src/i18n/resources/de/translation.json packages/shared/src/i18n/resources/fr/translation.json packages/shared/src/i18n/resources/es/translation.json packages/shared/src/i18n/resources/it/translation.json packages/shared/src/i18n/resources/ro/translation.json packages/shared/src/i18n/resources/uk/translation.json packages/shared/src/i18n/resources/zh/translation.json packages/shared/src/i18n/resources/pt/translation.json apps/web/src/features/campaigns/index.ts apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.container.tsx apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.component.tsx apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.style.ts apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.types.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.container.tsx apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.component.tsx apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.style.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.types.ts apps/web/src/features/campaigns/campaigns.routes.test.tsx
cat > /tmp/sellerhill-campaigns-task-2.msg <<'EOF'
feat(campaigns): register store-scoped routes and translations

Refs: docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git commit -F /tmp/sellerhill-campaigns-task-2.msg -- apps/web/src/App.tsx apps/web/src/app/routeMeta.types.ts apps/web/src/app/routeMeta.ts apps/web/src/app/routeMeta.storeScoped.test.ts apps/web/src/layouts/AppLayout/AppLayout.component.tsx packages/shared/src/i18n/index.ts packages/shared/src/i18n/types.ts packages/shared/src/i18n/resources/en/campaigns.json packages/shared/src/i18n/resources/tr/campaigns.json packages/shared/src/i18n/resources/ru/campaigns.json packages/shared/src/i18n/resources/hi/campaigns.json packages/shared/src/i18n/resources/ur/campaigns.json packages/shared/src/i18n/resources/ar/campaigns.json packages/shared/src/i18n/resources/az/campaigns.json packages/shared/src/i18n/resources/bn/campaigns.json packages/shared/src/i18n/resources/de/campaigns.json packages/shared/src/i18n/resources/fr/campaigns.json packages/shared/src/i18n/resources/es/campaigns.json packages/shared/src/i18n/resources/it/campaigns.json packages/shared/src/i18n/resources/ro/campaigns.json packages/shared/src/i18n/resources/uk/campaigns.json packages/shared/src/i18n/resources/zh/campaigns.json packages/shared/src/i18n/resources/pt/campaigns.json packages/shared/src/i18n/resources/en/translation.json packages/shared/src/i18n/resources/tr/translation.json packages/shared/src/i18n/resources/ru/translation.json packages/shared/src/i18n/resources/hi/translation.json packages/shared/src/i18n/resources/ur/translation.json packages/shared/src/i18n/resources/ar/translation.json packages/shared/src/i18n/resources/az/translation.json packages/shared/src/i18n/resources/bn/translation.json packages/shared/src/i18n/resources/de/translation.json packages/shared/src/i18n/resources/fr/translation.json packages/shared/src/i18n/resources/es/translation.json packages/shared/src/i18n/resources/it/translation.json packages/shared/src/i18n/resources/ro/translation.json packages/shared/src/i18n/resources/uk/translation.json packages/shared/src/i18n/resources/zh/translation.json packages/shared/src/i18n/resources/pt/translation.json apps/web/src/features/campaigns/index.ts apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.container.tsx apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.component.tsx apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.style.ts apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.types.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.container.tsx apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.component.tsx apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.style.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.types.ts apps/web/src/features/campaigns/campaigns.routes.test.tsx
rm /tmp/sellerhill-campaigns-task-2.msg
```

### Task 3: Build the campaign list and create drawer

**Files:**
- Modify: `apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.container.tsx`
- Modify: `apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.component.tsx`
- Modify: `apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.style.ts`
- Modify: `apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.types.ts`
- Create: `apps/web/src/features/campaigns/CampaignsPage/CampaignCard.component.tsx`
- Create: `apps/web/src/features/campaigns/CampaignsPage/CampaignList.helpers.ts`
- Create: `apps/web/src/features/campaigns/CampaignsPage/CampaignList.helpers.test.ts`
- Create: `apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.container.tsx`
- Create: `apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.component.tsx`
- Create: `apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.style.ts`
- Create: `apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.types.ts`

**Interfaces:**
- Consumes: `useGetCampaignsQuery({ ebayAccountId }, { skip: !activeStoreId })` (response already contains `eligibility`), `useCreateCampaignMutation()`.
- Produces: Campaign list cards and list/table mode with status, strategy, rate type/default rate, SellerHill count/eBay total, nullable sales/ad fees/ROAS, outside-SellerHill badge, eligibility banner, and create flow.

- [ ] **Step 1: Pin missing metric and eligibility presentation rules**

Test pure metric formatting/aggregation. Null metrics and missing keys become the localized unavailable label; zero is shown only when the API explicitly provides numeric zero. Do not sum a partial campaign set into a misleading store total:

```ts
expect(formatCampaignMetric(null, 'currency')).toBe('—');
expect(formatCampaignMetric({ sales: 0 }, 'currency', 'sales')).toBe('$0.00');
expect(sumCampaignMetric([{ metrics: { sales: 3 } }, { metrics: null }], 'sales')).toBeNull();
```

- [ ] **Step 2: Run helper tests to verify the failing state**

Run: `pnpm --filter web test -- src/features/campaigns/CampaignsPage/CampaignList.helpers.test.ts`
Expected: FAIL because `CampaignList.helpers.ts` is not implemented.

- [ ] **Step 3: Implement active-store list query and honest metrics helpers**

Use `activeStoreId` as the `ebayAccountId` and RTK Query's `skip` while absent. Read eligibility from the campaign list response (the backend list route already returns it); do not make a duplicate eligibility request. A null eligibility result is unavailable, not eligible. For each metric, format only actual numbers; aggregate only when every included campaign has that numeric field. A store switch clears view selection and closes CreateCampaignDrawer; use a captured store ID/request token in mutation callbacks so prior-store completions do not update current page state.

- [ ] **Step 4: Render list page, cards/table, and eBay eligibility message**

Use `PageHeader`, `Card`, `Badge`, `InfoMessage`, `Button`, and `Text` from `@repo/ui`. Follow `OrderCard` anatomy for campaign cards. Include list/table toggle, six 31-day KPI values, and all specified card/table facts. INELIGIBLE keeps campaign reads available and shows eBay's reason; create controls are disabled and explain the reason. Read-only campaigns link to detail.

- [ ] **Step 5: Implement create drawer and visible validation/error states**

Use the existing `Drawer` and `ModernTextInput` primitives. Validate non-empty name up to 80 characters and fixed rate 2.0–100.0 with one decimal before mutation. Label submit “Create campaign”; map the server's `campaigns.errors.*` key (including duplicate name and eligibility refusal) to localized copy. On success, close and reset only if the active store still matches the drawer's captured store, then let invalidated tags refresh the list.

- [ ] **Step 6: Verify focused helper and page tests**

Add Testing Library coverage for loading, empty list, null eligibility, INELIGIBLE reason, read-only cards, and null metrics. Run: `pnpm --filter web test -- src/features/campaigns/CampaignsPage`
Expected: PASS; no null metric appears as a fabricated zero.

- [ ] **Step 7: Commit only Task 3 paths**

```bash
git add -- apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.container.tsx apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.component.tsx apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.style.ts apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.types.ts apps/web/src/features/campaigns/CampaignsPage/CampaignCard.component.tsx apps/web/src/features/campaigns/CampaignsPage/CampaignList.helpers.ts apps/web/src/features/campaigns/CampaignsPage/CampaignList.helpers.test.ts apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.container.tsx apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.component.tsx apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.style.ts apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.types.ts
cat > /tmp/sellerhill-campaigns-task-3.msg <<'EOF'
feat(campaigns): build campaign list and create flow

Refs: docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git commit -F /tmp/sellerhill-campaigns-task-3.msg -- apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.container.tsx apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.component.tsx apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.style.ts apps/web/src/features/campaigns/CampaignsPage/CampaignsPage.types.ts apps/web/src/features/campaigns/CampaignsPage/CampaignCard.component.tsx apps/web/src/features/campaigns/CampaignsPage/CampaignList.helpers.ts apps/web/src/features/campaigns/CampaignsPage/CampaignList.helpers.test.ts apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.container.tsx apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.component.tsx apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.style.ts apps/web/src/features/campaigns/drawers/CreateCampaignDrawer/CreateCampaignDrawer.types.ts
rm /tmp/sellerhill-campaigns-task-3.msg
```

### Task 4: Build campaign detail, member management, and write actions

**Files:**
- Modify: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.container.tsx`
- Modify: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.component.tsx`
- Modify: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.style.ts`
- Modify: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.types.ts`
- Create: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignMembers.helpers.ts`
- Create: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignMembers.helpers.test.ts`
- Create: `apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.container.tsx`
- Create: `apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.component.tsx`
- Create: `apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.style.ts`
- Create: `apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.types.ts`
- Create: `apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.container.tsx`
- Create: `apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.component.tsx`
- Create: `apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.style.ts`
- Create: `apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.types.ts`
- Create: `apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.container.test.tsx`

**Interfaces:**
- Consumes: `useGetCampaignQuery({ ebayAccountId, campaignId }, { skip })`; candidate query; add/remove/rate/action mutations; `CampaignListingDto.hasMarginOverride`.
- Produces: campaign facts, metric panel, selected `DataTable` member list, add drawer with group/search/pagination/skipped count, per-listing rate drawer, default-rate change, remove, pause/resume/end controls, and reasoned read-only states.

- [ ] **Step 1: Add tests for effective ad-rate disclosure and campaign action gates**

Cover separate margin override and price lock states, plus `readOnlyReason` values. Keep a margin override member visible and editable/removable where allowed, but show “ad rate not applied”; don't call `priceLocked` the margin override signal.

```ts
expect(memberRateLabel({ adRate: 5, appliedAdRate: 5, hasMarginOverride: true, priceLocked: false })).toBe('not-applied');
expect(memberRateLabel({ adRate: 5, appliedAdRate: 5, hasMarginOverride: false, priceLocked: true })).toBe('price-locked');
expect(canWriteCampaign({ readOnlyReason: CampaignReadOnlyReason.DYNAMIC_RATE })).toBe(false);
```

- [ ] **Step 2: Implement the campaign detail read view and member table**

Show status, strategy, fixed/dynamic rate type, default rate, start date, ad count, and nullable metrics. Use `DataTable` with product, current price, campaign rate, selected rows, and remove action. For `hasMarginOverride`, disclose that the synced eBay campaign rate remains present but SellerHill excludes it from repricing; do not use `appliedAdRate === 0` to detect this case. Dynamic, CPC, rule-based, and ended campaigns stay readable but display the server `readOnlyReason` and suppress mutation controls.

- [ ] **Step 3: Implement add-listings drawer with one-time group fill**

Use `ModernSelect` to load listing settings groups. Selecting a group fills only the current selection from that group's eligible no-campaign candidates; it does not create a persistent rule. Add search and paginated candidates, removable selection chips/rows, and the `skippedInCampaign` count. Submit selected `listingIds` with the captured active account ID.

- [ ] **Step 4: Implement rate edit, default rate, remove, and lifecycle actions**

The per-listing rate drawer submits `listingIds: [listingId]` with `bidPercentage`; default-rate change submits no `listingIds`, matching the controller contract. Pause/resume/end use `ConfirmModal` for destructive end and explicit action labels. Disable all writes for ineligible or read-only campaigns, retain server errors on eBay refusal, and never optimistically claim a mutation succeeded before `.unwrap()` resolves.

- [ ] **Step 5: Reset store-bound detail state and ignore stale completions**

When `activeStoreId` changes, close add/rate/confirm drawers and clear selected IDs. Capture `{ ebayAccountId, campaignId }` at mutation start and update local state/toasts only if both still match current route/store when the promise settles. The RTK Query cache remains keyed by account ID. Test deferred old-store success and failure paths.

- [ ] **Step 6: Verify member and detail behavior**

Run: `pnpm --filter web test -- src/features/campaigns/CampaignDetailPage`
Expected: PASS for margin override messaging, locked-price distinction, read-only gates, zero-versus-null metrics, skipped candidate count, confirmation, and store-switch cleanup.

- [ ] **Step 7: Commit only Task 4 paths**

```bash
git add -- apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.container.tsx apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.component.tsx apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.style.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.types.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignMembers.helpers.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignMembers.helpers.test.ts apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.container.tsx apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.component.tsx apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.style.ts apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.types.ts apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.container.tsx apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.component.tsx apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.style.ts apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.types.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.container.test.tsx
cat > /tmp/sellerhill-campaigns-task-4.msg <<'EOF'
feat(campaigns): manage campaign listings and actions

Refs: docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git commit -F /tmp/sellerhill-campaigns-task-4.msg -- apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.container.tsx apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.component.tsx apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.style.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.types.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignMembers.helpers.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignMembers.helpers.test.ts apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.container.tsx apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.component.tsx apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.style.ts apps/web/src/features/campaigns/drawers/AddCampaignListingsDrawer/AddCampaignListingsDrawer.types.ts apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.container.tsx apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.component.tsx apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.style.ts apps/web/src/features/campaigns/drawers/EditCampaignRateDrawer/EditCampaignRateDrawer.types.ts apps/web/src/features/campaigns/CampaignDetailPage/CampaignDetailPage.container.test.tsx
rm /tmp/sellerhill-campaigns-task-4.msg
```

### Task 5: Add listing detail campaign context

**Files:**
- Modify: `apps/web/src/features/listings/detail/ListingDetailPage.container.tsx`
- Modify: `apps/web/src/features/listings/detail/ListingDetailPage.component.tsx`
- Modify: `apps/web/src/features/listings/detail/ListingDetailPage.style.ts`
- Modify: `apps/web/src/features/listings/detail/ListingDetailPage.types.ts`
- Create: `apps/web/src/features/listings/detail/campaign-presentation.test.ts`
- Modify: `packages/shared/src/i18n/resources/{en,tr,ru,hi,ur,ar,az,bn,de,fr,es,it,ro,uk,zh,pt}/campaigns.json`

**Interfaces:**
- Consumes: `ListingDto.adCampaign` from Task 1 and `ListingDto.marginPercentOverride` / `marginFixedOverride`.
- Produces: detail row “Ad campaign: <name> · <rate>%” linked to `/:locale/campaigns/:campaignId`; dynamic/non-applied explanation follows backend state; no row when `adCampaign` is null.

- [ ] **Step 1: Test campaign row states**

Test no association, active fixed rate, dynamic strategy, and margin override. The row must use the listing's owning campaign ID and use the margin override fields to explain that the synced campaign rate is excluded from SellerHill repricing—even when `appliedAdRate` is nonzero. Do not infer no association or no applied repricing rate from that stored value.

- [ ] **Step 2: Add localized row to listing detail**

Render beside existing listing facts using the established detail layout and `Link`/button treatment. Do not move store context based on this row; the listing-detail route already follows its own listing store, while campaign pages use the top bar's active store.

- [ ] **Step 3: Verify and commit exact paths**

Run: `pnpm --filter web test -- src/features/listings/detail/campaign-presentation.test.ts`

```bash
git add -- apps/web/src/features/listings/detail/ListingDetailPage.container.tsx apps/web/src/features/listings/detail/ListingDetailPage.component.tsx apps/web/src/features/listings/detail/ListingDetailPage.style.ts apps/web/src/features/listings/detail/ListingDetailPage.types.ts apps/web/src/features/listings/detail/campaign-presentation.test.ts packages/shared/src/i18n/resources/en/campaigns.json packages/shared/src/i18n/resources/tr/campaigns.json packages/shared/src/i18n/resources/ru/campaigns.json packages/shared/src/i18n/resources/hi/campaigns.json packages/shared/src/i18n/resources/ur/campaigns.json packages/shared/src/i18n/resources/ar/campaigns.json packages/shared/src/i18n/resources/az/campaigns.json packages/shared/src/i18n/resources/bn/campaigns.json packages/shared/src/i18n/resources/de/campaigns.json packages/shared/src/i18n/resources/fr/campaigns.json packages/shared/src/i18n/resources/es/campaigns.json packages/shared/src/i18n/resources/it/campaigns.json packages/shared/src/i18n/resources/ro/campaigns.json packages/shared/src/i18n/resources/uk/campaigns.json packages/shared/src/i18n/resources/zh/campaigns.json packages/shared/src/i18n/resources/pt/campaigns.json
cat > /tmp/sellerhill-campaigns-task-5.msg <<'EOF'
feat(listings): show campaign rate context

Refs: docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git commit -F /tmp/sellerhill-campaigns-task-5.msg -- apps/web/src/features/listings/detail/ListingDetailPage.container.tsx apps/web/src/features/listings/detail/ListingDetailPage.component.tsx apps/web/src/features/listings/detail/ListingDetailPage.style.ts apps/web/src/features/listings/detail/ListingDetailPage.types.ts apps/web/src/features/listings/detail/campaign-presentation.test.ts packages/shared/src/i18n/resources/en/campaigns.json packages/shared/src/i18n/resources/tr/campaigns.json packages/shared/src/i18n/resources/ru/campaigns.json packages/shared/src/i18n/resources/hi/campaigns.json packages/shared/src/i18n/resources/ur/campaigns.json packages/shared/src/i18n/resources/ar/campaigns.json packages/shared/src/i18n/resources/az/campaigns.json packages/shared/src/i18n/resources/bn/campaigns.json packages/shared/src/i18n/resources/de/campaigns.json packages/shared/src/i18n/resources/fr/campaigns.json packages/shared/src/i18n/resources/es/campaigns.json packages/shared/src/i18n/resources/it/campaigns.json packages/shared/src/i18n/resources/ro/campaigns.json packages/shared/src/i18n/resources/uk/campaigns.json packages/shared/src/i18n/resources/zh/campaigns.json packages/shared/src/i18n/resources/pt/campaigns.json
rm /tmp/sellerhill-campaigns-task-5.msg
```

### Task 6: Add unsaved ad-rate what-if to the group price calculator

**Files:**
- Modify: `apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.container.tsx`
- Modify: `apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.component.tsx`
- Modify: `apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.style.ts`
- Modify: `apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.types.ts`
- Create: `apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.test.tsx`
- Modify: `packages/shared/src/i18n/resources/{en,tr,ru,hi,ur,ar,az,bn,de,fr,es,it,ro,uk,zh,pt}/listingSettingsGroup.json`

**Interfaces:**
- Consumes: Existing `calculateListingPrice(amazonPrice, strategy, fees, amazonTaxRatePct, adRatePct = 0)`; the backend and shared formula already accept an ad-rate argument.
- Produces: An unsaved `adRatePct` what-if field for the settings group's hypothetical calculation. It is not added to form state or saved settings; this calculator has no per-listing margin-override context.

- [ ] **Step 1: Write calculator interaction test for zero and nonzero what-if**

With the same Amazon price/strategy/fees, entering 0 must preserve the current result; entering 5 must call the shared calculator with the fifth argument `5` and show the ad-fee breakdown row. Invalid, negative, or greater-than-100 input cannot calculate.

- [ ] **Step 2: Add local what-if state and normalize the rate**

Keep the text input in container-local `useState` in `PriceCalculatorSection.container.tsx`, clear the breakdown when edited, validate a finite rate from 0 to 100 with at most one decimal, and pass it only to `calculateListingPrice`. Do not add it to `ListingSettingsGroupFormData`, a mutation body, or persistent storage. This group-level calculator has no per-listing margin-override context; test effective zero-rate behavior in campaign-member/listing-detail presentation, not by adding an unused calculator prop. The shared helper already guards the combined eBay fee plus ad rate at 100%.

- [ ] **Step 3: Render ad-rate input and breakdown in existing calculator anatomy**

Use `ModernTextInput` with percent suffix and current `S.Row`; render an `adFeeAmount` breakdown row when nonzero. Label the field as an unsaved what-if. The entered value applies to the settings group's hypothetical calculation only and must never be persisted or described as changing a margin-override listing's price.

- [ ] **Step 4: Verify and commit exact paths**

Run: `pnpm --filter web test -- src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.test.tsx`

```bash
git add -- apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.container.tsx apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.component.tsx apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.style.ts apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.types.ts apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.test.tsx packages/shared/src/i18n/resources/en/listingSettingsGroup.json packages/shared/src/i18n/resources/tr/listingSettingsGroup.json packages/shared/src/i18n/resources/ru/listingSettingsGroup.json packages/shared/src/i18n/resources/hi/listingSettingsGroup.json packages/shared/src/i18n/resources/ur/listingSettingsGroup.json packages/shared/src/i18n/resources/ar/listingSettingsGroup.json packages/shared/src/i18n/resources/az/listingSettingsGroup.json packages/shared/src/i18n/resources/bn/listingSettingsGroup.json packages/shared/src/i18n/resources/de/listingSettingsGroup.json packages/shared/src/i18n/resources/fr/listingSettingsGroup.json packages/shared/src/i18n/resources/es/listingSettingsGroup.json packages/shared/src/i18n/resources/it/listingSettingsGroup.json packages/shared/src/i18n/resources/ro/listingSettingsGroup.json packages/shared/src/i18n/resources/uk/listingSettingsGroup.json packages/shared/src/i18n/resources/zh/listingSettingsGroup.json packages/shared/src/i18n/resources/pt/listingSettingsGroup.json
cat > /tmp/sellerhill-campaigns-task-6.msg <<'EOF'
feat(pricing): preview promoted listing ad rate

Refs: docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
git commit -F /tmp/sellerhill-campaigns-task-6.msg -- apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.container.tsx apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.component.tsx apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.style.ts apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.types.ts apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.test.tsx packages/shared/src/i18n/resources/en/listingSettingsGroup.json packages/shared/src/i18n/resources/tr/listingSettingsGroup.json packages/shared/src/i18n/resources/ru/listingSettingsGroup.json packages/shared/src/i18n/resources/hi/listingSettingsGroup.json packages/shared/src/i18n/resources/ur/listingSettingsGroup.json packages/shared/src/i18n/resources/ar/listingSettingsGroup.json packages/shared/src/i18n/resources/az/listingSettingsGroup.json packages/shared/src/i18n/resources/bn/listingSettingsGroup.json packages/shared/src/i18n/resources/de/listingSettingsGroup.json packages/shared/src/i18n/resources/fr/listingSettingsGroup.json packages/shared/src/i18n/resources/es/listingSettingsGroup.json packages/shared/src/i18n/resources/it/listingSettingsGroup.json packages/shared/src/i18n/resources/ro/listingSettingsGroup.json packages/shared/src/i18n/resources/uk/listingSettingsGroup.json packages/shared/src/i18n/resources/zh/listingSettingsGroup.json packages/shared/src/i18n/resources/pt/listingSettingsGroup.json
rm /tmp/sellerhill-campaigns-task-6.msg
```

### Task 7: Final UI verification and handoff

**Files:**
- Test: `apps/web/src/features/campaigns/**/*.test.ts`
- Test: `apps/web/src/features/campaigns/**/*.test.tsx`
- Test: `apps/web/src/features/listings/detail/campaign-presentation.test.ts`
- Test: `apps/web/src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.test.tsx`
- Verify: all campaign resources under `packages/shared/src/i18n/resources/*/campaigns.json`

- [ ] **Step 1: Run all focused web tests**

Run: `pnpm --filter web test -- src/features/campaigns src/features/listings/detail/campaign-presentation.test.ts src/features/settings/drawers/ListingGroupDrawer/PriceCalculatorSection/PriceCalculatorSection.test.tsx`
Expected: PASS; campaign list/detail remain scoped to active store, metrics preserve nullability, and margin override is distinct from fixed price lock.

- [ ] **Step 2: Check locale parity and build types**

Verify all 16 campaign resource files have the same nested keys and that shared i18n registration includes the namespace. Run: `pnpm typecheck` and `pnpm --filter web build`; repair only errors caused by this implementation and report unrelated existing errors.

- [ ] **Step 3: Inspect the diff and repository state**

Review the exact diff for unintended files, generated files, hardcoded seller-facing strings, non-token colors, missing locale keys, stale store state, and null-to-zero metric fallbacks. Confirm there are no backend parser/capture changes, production/UAT changes, or live eBay calls. Do not stage or commit unrelated workspace changes.

**Handoff note:** Backend work has local migrations 143/144 and campaign endpoints in the shared development tree; production deployment and UAT/main merge are explicitly outside this UI plan. Campaign performance values will remain unavailable until B6 has a real captured `.tsv.gz` and a parser; do not fill them with synthetic values. The deferred billing fee reader's `FeePromotedListingFeature` needs the incremental `orderId` approach already recorded by the backend owner; that C3/C4 work is outside this UI plan.

## Self-Review

- Spec coverage: navigation/routes/guard, list and detail screens, eligibility, all requested campaign actions, add-listing group fill/search/selection, nullable metrics, listing-detail association, calculator what-if, and all 16 locales are assigned to Tasks 1–6.
- Existing implementation check: campaign list/candidates response DTOs are inline at the controller, so Task 1 defines shared named interfaces; `baseApi` lacks the `Campaigns` tag. `CampaignListingDto` lacks margin-override information and `ListingDto` lacks campaign association; Task 1 adds only those read projections. Listing DTOs already include both margin override values, and `calculateListingPrice` already accepts `adRatePct`.
- Test harness check: web uses Vitest 2.1.9, Testing Library, jsdom, and `apps/web/src/test/setup.ts`; plans reuse them.
- Placeholder check: no TBD/TODO steps. The list metric helper test contract distinguishes actual zero from null and partial totals. Store changes clear selection/drawers and guard asynchronous completion updates.
