# Settings — "Mağaza Yapılandırması" Section (Store Management)

**Date:** 2026-07-09
**Status:** Design (pending implementation plan)
**Scope:** Frontend only (`apps/web`, `packages/shared` i18n). **No backend changes.**

## Goal

Add a new **"Mağaza Yapılandırması"** (Store Configuration / Management) section to the Settings hub. It mirrors the "Hesap ve Güvenlik" (Account & Security) section layout — a single `SettingsCard` with three `SettingsActionRow` rows — each row opening a drawer:

1. **Mağaza ayarları** (Store settings, blacklist excluded) → drawer
2. **Yeni blacklist gir** (Add a blacklist keyword) → drawer
3. **Blacklist'leri göster** (List blacklists as cards) → drawer

## Key decision: consolidate (Option A)

The existing `StoreConfigSection` + `StoreConfigDrawer` already edit exactly the "store settings minus blacklist" fields (scope, location: country/state/zip, validation toggles). Keeping them alongside a new Row 1 drawer would duplicate the editing surface.

**Decision:** Remove `StoreConfigSection` and the standalone create/edit store-config flow from the hub. Row 1's drawer **reuses** the store-config editing (location + validation), now driven by a store/global selector. The Listing Groups section is **untouched**.

## Context (current state, unchanged)

- `StoreSettings` domain type (`packages/shared/src/domain/store-settings/store-settings.types.ts`): `storeId?`, `isGlobal`, `country`, `state`, `zipCode`, `validateTitle`, `validateDescription`, `blacklist: BlacklistKeyword[]`.
- `BlacklistKeyword`: `{ id, keyword, scope: 'title' | 'description' | 'both' }` (the `id` is vestigial; only `{keyword, scope}` is persisted in the JSONB column).
- Backend endpoints (reused as-is):
  - `GET /v1/store-settings/all` → all configs for the user
  - `GET /v1/store-settings?storeId=` → single resolved config (store > global > default fallback)
  - `POST /v1/store-settings` → upsert full settings object (including `blacklist`)
- RTK Query hooks (reused): `useGetAllStoreSettingsQuery`, `useGetStoreSettingsQuery`, `useSaveStoreSettingsMutation` (tag: `StoreSettings`).
- Existing reusable presentational piece: `BlacklistCard` (`apps/web/src/features/store-settings/components/BlacklistCard/`).

## Architecture

### New section component

`StoreManagementSection` (inside `SettingsHubPage.component.tsx`, alongside the existing `AccountSecuritySection` pattern):

```
<SettingsCard variant="section" header={{ icon: 'store' (or 'settings'), title, subtitle }}>
  <SettingsActionRow icon="settings"  label="Mağaza ayarları"      onClick={() => onAction('storeSettings')} />
  <SettingsActionRow icon="plus"      label="Yeni blacklist gir"   onClick={() => onAction('blacklistAdd')} />
  <SettingsActionRow icon="list"      label="Blacklist'leri göster" onClick={() => onAction('blacklistList')} />
</SettingsCard>
```

Placed in the layout below the existing two-column grid (eBay/Amazon, Listing Groups), above (or directly replacing the slot of) the removed StoreConfigSection. Listing Groups section stays in its current two-column position.

### Drawer keys

`SettingsDrawerKey` (`SettingsHubPage.types.ts`) updated:
- **Remove:** `'storeConfig'`
- **Add:** `'storeSettings'`, `'blacklistAdd'`, `'blacklistList'`

(Existing keys `profile`, `ebay`, `amazonAdd`, `amazonList`, `listingGroupNew`, `listingGroupEdit`, `password`, `language` unchanged.)

### Drawer 1 — Mağaza ayarları (StoreSettingsDrawer)

Reuses the existing `drawers/StoreConfigDrawer/` component (location + validation fields). Its container is generalised from the current create/edit dual-mode to a **selector-driven manage mode**:

- A store/global **scope selector** (global option + each eBay store). The user explicitly requested: dropdown on desktop, bottom-sheet on mobile — use the responsive select molecule (verify `ModernSelect`/`Select` renders a bottom sheet on mobile; if not, that gap is filed as an implementation task, not a backend change).
- On scope selection, prefill fields from the matching config in `storeConfigs` (already fetched in the hub container via `useGetAllStoreSettingsQuery`), falling back to defaults for a scope with no config yet.
- Save → `useSaveStoreSettingsMutation` with the full settings object for that scope (preserving that config's existing `blacklist` array unchanged — same preserve-on-save behavior the current StoreConfigDrawer uses).
- This subsumes both "create new config" and "edit config" — upsert handles both.

### Drawer 2 — Yeni blacklist gir (BlacklistAddDrawer) — NEW

- Same store/global scope selector as Drawer 1.
- Fields: `keyword` (`ModernTextInput`) + `scope` (`ModernSelect`: both / title / description).
- "Add" appends `{ keyword, scope }` to the **selected scope's** `blacklist` array and saves via `useSaveStoreSettingsMutation` (full settings object, all other fields preserved).
- Validation: reuse `blacklistKeywordSchema(t)` (`packages/shared/src/schemas/store-settings/storeSettings.schema.ts`); prevent empty + duplicate `(keyword, scope)` pairs; surface errors via `MessageModal`/inline per existing form patterns.
- Success feedback via `showMessage` (`UIContext`).

### Drawer 3 — Blacklist'leri göster (BlacklistListDrawer) — NEW

- Same store/global scope selector.
- Renders the selected scope's `blacklist` as a **responsive card grid** reusing `BlacklistCard` (each card shows keyword + scope badge + remove button).
- Remove → deletes the matching `{keyword, scope}` from the array and saves via `useSaveStoreSettingsMutation`; optimistic UI follows the existing `providesTags`/`invalidatesTags: ['StoreSettings']` refetch pattern.
- Empty state: message (reuse `storeSettings.noKeywords`).

### Shared scope selector

Both new blacklist drawers (and Drawer 1) share an identical scope selector. Extract a small shared control — either a local molecule `StoreScopeSelector` (`packages/ui/src/molecules/`) or a typed wrapper inside the settings feature. Build it once, reuse across the three drawers. Options: `[{ value: 'global', label }, ...availableStores.map(s => ({ value: s.id, label: s.name }))]`.

> Note per architectural rules: if promoted to `packages/ui`, it must follow the container/component split (stateful) or component/style/types (stateless). A thin stateless selector wrapper stays in the feature to avoid over-engineering unless it's genuinely reusable elsewhere. Decision deferred to implementation plan.

## Data flow

```
hub container
  └─ useGetAllStoreSettingsQuery() → storeConfigs[]        (already present)
  └─ useGetEbayAccountsQuery()    → availableStores[]      (already present)
       │
       ├─ Drawer 1 (storeSettings): select scope → prefill from storeConfigs → save (preserve blacklist)
       ├─ Drawer 2 (blacklistAdd):  select scope → append {keyword,scope} → save (preserve non-blacklist fields)
       └─ Drawer 3 (blacklistList): select scope → render BlacklistCard[] → remove → save
```

All three drawers persist through the same single `POST /v1/store-settings` endpoint; each sends the **full** settings object for the chosen scope, preserving fields it does not own.

## i18n

Namespace: `translation` (under `settingsHub`), added to **both** `packages/shared/src/i18n/resources/en/translation.json` and `tr/translation.json`:

- `settingsHub.sections.storeManagement.title`
- `settingsHub.sections.storeManagement.subtitle`
- `settingsHub.sections.storeManagement.storeSettings` (Row 1 label)
- `settingsHub.sections.storeManagement.blacklistAdd` (Row 2 label)
- `settingsHub.sections.storeManagement.blacklistList` (Row 3 label)
- `settingsHub.drawer.blacklist.add.title` / `.subtitle`
- `settingsHub.drawer.blacklist.list.title` / `.subtitle`
- Scope-selector label + "Global" option label (reuse `storeSettings.globalSettings` where possible).

Reuse existing `storeSettings.*` keys (`scope_both/title/description`, `blacklistKeyword`, `addKeyword`, `noKeywords`, `selectStore`, etc.) inside the drawers — these already exist in `en/tr/storeSettings.json`.

All keys must use the dot-notation rule from CLAUDE.md (`t('translation:settingsHub.sections.storeManagement.title')`).

## Files

### Create
- `apps/web/src/features/settings/drawers/BlacklistAddDrawer/{.component,.container,.style,.types}.tsx` + `index.ts`
- `apps/web/src/features/settings/drawers/BlacklistListDrawer/{.component,.container,.style,.types}.tsx` + `index.ts`
- (Optional) shared scope selector component — location decided in implementation plan.

### Modify
- `apps/web/src/features/settings/SettingsPage/SettingsHubPage.component.tsx` — remove `StoreConfigSection`, add `StoreManagementSection`, wire 3 drawers.
- `apps/web/src/features/settings/SettingsPage/SettingsHubPage.container.tsx` — drop `handleNewStoreConfig` / `handleEditStoreConfig` / `editingStoreConfig` plumbing; pass `storeConfigs` + `availableStores` to the drawers.
- `apps/web/src/features/settings/SettingsPage/SettingsHubPage.types.ts` — update `SettingsDrawerKey` and `SettingsHubPageComponentProps`.
- `apps/web/src/features/settings/drawers/StoreConfigDrawer/StoreConfigDrawer.container.tsx` — generalise to selector-driven manage mode (load by scope, preserve blacklist on save).
- `apps/web/src/features/settings/drawers/index.ts` — export new drawers.
- `packages/shared/src/i18n/resources/en/translation.json` + `tr/translation.json` — new keys above.

### Out of scope
- The standalone `apps/web/src/features/store-settings/StoreSettingsPage` route (leave as-is; not removed).
- Backend, DB schema, domain types, Zod schemas (unchanged).
- Listing Groups section (untouched).

## Architectural rules honored

- 4-file split per drawer (component/container/style/types), no logic in `.component.tsx`, no `styled(...)` outside `.style.ts`.
- Loading via `useLoading` in containers; errors via `showMessage`/`MessageModal`.
- All UI from `@repo/ui` (Drawer, ModernTextInput, ModernSelect/Select, SettingsCard, SettingsActionRow, Button, Text, Icon).
- No hardcoded strings (i18n), no hardcoded colors/spacing (tokens), no native form controls.
- No new status strings — `BlacklistKeyword.scope` already uses string literal union `'title' | 'description' | 'both'`; this remains a shared type, not a UI-literal.

## Open questions for implementation plan

1. Confirm which select molecule renders a bottom sheet on mobile (`ModernSelect` vs `Select`) — verify, don't assume.
2. Decide shared-scope-selector home (feature-local wrapper vs `packages/ui` molecule).
3. Whether to keep `StoreConfigDrawer` file/folder name or rename to `StoreSettingsDrawer` for clarity (cosmetic; renaming touches imports).
