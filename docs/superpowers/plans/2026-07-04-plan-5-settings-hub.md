# Plan 5: Settings Hub Consolidation

**Date:** 2026-07-04
**Approach:** Full UI build; backend gaps noted explicitly. Edit affordances wired where backend exists; placeholder Drawers where missing.

## Goal

Consolidate 5 routes into single scrolling `/settings` hub page. Each section is a `SettingsCard`. Edit buttons open right-side `Drawer` modals (or navigate to existing pages where backend not ready).

## Architecture

- **Hub route**: `/{locale}/settings` → `SettingsHubPage`
- **Old routes** → `<Navigate to="/settings" replace />` (with `?section=<id>` for deep-linking)
- **Drawer state**: query-param driven (`?drawer=profile|ebay|amazon|store|listingGroup|password|2fa|api|language|notifications`)
- **Backend**: existing endpoints reused; missing endpoints noted in "Backend Gaps" section per Drawer

## File Structure

**Created:**
- `packages/ui/src/molecules/Drawer/{Drawer.component.tsx,Drawer.style.ts,Drawer.types.ts,index.ts}` — slide-in right panel
- `apps/web/src/features/settings/SettingsPage/{SettingsHubPage.container.tsx, SettingsHubPage.component.tsx, SettingsHubPage.style.ts, SettingsHubPage.types.ts, index.ts}`
- `apps/web/src/features/settings/components/` — one component per section:
  - `ProfileHero/{ProfileHero.component.tsx,...}`
  - `EbayAccountSection/`
  - `AmazonAccountsSection/`
  - `StoreConfigSection/`
  - `BlacklistSection/`
  - `ListingGroupsSection/`
  - `AccountSecuritySection/`
  - `NotificationsSection/`
  - `PlanSection/`
  - `DangerZoneSection/`
- `apps/web/src/features/settings/drawers/` — one Drawer per edit flow:
  - `ProfileDrawer/` (backend ready — profile update API exists)
  - `AmazonAccountDrawer/` (backend ready — createAmazonAccount)
  - `StoreConfigDrawer/` (backend ready — reuse StoreSettings logic)
  - `ListingGroupDrawer/` (backend ready — reuse ListingSettingsGroupForm)
  - `ChangePasswordDrawer/` (**backend gap** — placeholder)
  - `TwoFactorDrawer/` (**backend gap** — placeholder)
  - `ApiAccessDrawer/` (**backend gap** — placeholder)
  - `LanguageDrawer/` (frontend only — change i18n language)
  - `NotificationsDrawer/` (**backend gap** — placeholder)

**Modified:**
- `apps/web/src/App.tsx` — add new route + redirects
- `apps/web/src/layouts/AppLayout/AppLayout.container.tsx` — breadcrumb simplification (already points to `/settings/store` for nav; update to `/settings`)

## Tasks

### Task 1: Build Drawer molecule
Slide-in right panel based on Modal atom pattern. Props: `isOpen`, `onClose`, `title`, `subtitle`, `width`, `children`, `footerContent`. Uses `position: fixed`, `right: 0`, transforms `translateX(100%) → 0`, scrollable body, sticky footer.

### Task 2: Add `settings.*` i18n keys
Add `translation:settings.title`, `.subtitle`, `.sections.{profile,ebay,amazon,storeConfig,blacklist,listingGroups,account,notifications,plan,danger}.{title,subtitle,actionLabel}`, `.drawer.{profile,password,twofa,api,language,notifications}.{...}` for both `en/translation.json` and `tr/translation.json`.

### Task 3: Build SettingsHubPage
Single scrolling page. Container fetches `useGetMeQuery`, `useGetEbayAccountsQuery`, `useGetAmazonAccountsQuery` (if exists), reads query param for active drawer. Component renders `<ProfileHero>` + grid of `<SettingsCard>` sections.

### Task 4: Build section components
Each section is a `<SettingsCard>` with header (icon+title+subtitle) and body content. Edit/Manage buttons emit `onEdit(sectionId)` → container sets drawer query param.

### Task 5: Build Drawer modals
Where backend exists: full edit form (Profile, Amazon Add, Store Config, Listing Group, Language).
Where backend missing: render form UI + a `MessageModal` info note on save attempt saying "Backend not yet implemented — your input will not be saved".

### Task 6: Route + redirect wiring
`/settings/store`, `/settings/amazon-accounts`, `/settings/listing-groups/*`, `/profile` → `<Navigate to="/settings" replace />`.
Add new `/settings` → `<SettingsHubPage />`.
Sidebar nav item already navigates to `/settings/store` (from Plan 1 Task 6) — update to `/settings`.

### Task 7: Breadcrumb + verify
Breadcrumb `/settings/*` → single "Settings" item. Run `pnpm lint` + manual screenshot.

## Backend Gaps (User Notified After Implementation)

| Drawer / Section | Backend Status |
|---|---|
| Profile Drawer (Personal Info) | ✅ Exists (profile update API) |
| Amazon Account Drawer (Add) | ✅ Exists (AmazonAccounts create) |
| Store Config Drawer (Edit) | ✅ Exists (StoreSettings update) |
| Listing Group Drawer (New/Edit) | ✅ Exists (ListingSettingsGroup create/update) |
| Language Drawer | ✅ Frontend-only (i18n) |
| Change Password Drawer | ❌ Missing — needs `POST /auth/change-password` |
| 2FA Drawer | ❌ Missing — needs TOTP enrollment + verify endpoints |
| API Access Drawer | ❌ Missing — needs `GET/POST /api-keys` endpoints |
| Notifications Drawer | ❌ Missing — needs `GET/PUT /notification-preferences` |
| Plan Section | ❌ Missing — no billing system; render as static "Pro Plan" placeholder |
| Danger Zone (Deactivate) | ❌ Missing — needs `DELETE /users/me` |

## Definition of Done

- `pnpm lint` PASS
- `/settings` route renders all 10 sections
- All 5 old routes redirect to `/settings`
- All Drawers open + close
- Drawers with backend: save works (where reusable logic permits)
- Drawers without backend: show clear "not implemented" notice on save
- Sidebar nav "Settings" goes to `/settings`
- Breadcrumb simplified
