# Figma Site Redesign Refactor — Design Spec

**Date:** 2026-07-03
**Source of truth:** https://sweet-yang-69529706.figma.site/ (Figma Make published site)
**Scope:** Authenticated app shell + screens. **Out of scope:** Landing page (`/`), auth pages (`/login`, `/register`, `/verify-email`, `/auth/check-email`), onboarding flow.

## Context

User redesigned the authenticated app in Figma Make and published at the URL above. No design file exists — only the published site. This spec defines how to translate that published design into the existing `apps/web` + `packages/ui` (Emotion + `tkn()` + atomic design) system.

Per project memory (`project-figma-redesign.md`), **never copy Figma Make source raw** — it uses Tailwind v4 + shadcn/ui + oklch + Plus Jakarta Sans, all of which violate `CLAUDE.md`. Translation only.

## Audit Artifacts

- Screenshots (light + dark) for all 7 main pages in `figma-audit/`
- Token readings (computed CSS variables) for both themes captured below

## Strategic Decisions (User-Approved 2026-07-03)

1. **Approach A — Token-first**: refresh theme tokens first, then refactor AppLayout, then screens.
2. **Settings consolidation**: merge 5 current routes into 1 unified `/settings` hub + Drawer-based editing.
3. **Landing untouched**: dark-premium landing design stays separate (per memory).

---

## Phase 1 — Token Refresh

**Files:** `packages/ui/src/theme/{themes.ts, theme.types.ts, tkn.ts, designTokens.ts}`, `apps/web/src/index.css`, `packages/ui/package.json`.

### 1.1 Color updates (per-theme blocks in `themes.ts`)

#### `lightColors`

| Path | Current | New |
|---|---|---|
| `background.primary` | `#F8FAFC` | `#f4f7ff` |
| `background.secondary` | `#FFFFFF` | `#FFFFFF` (kept) |
| `background.tertiary` | `#F1F5F9` | `#eef3ff` |
| `surface.primary` | `#FFFFFF` | `#FFFFFF` (kept) |
| `surface.secondary` | `#F9FAFB` | `#f8fafc` |
| `text.primary` | `#111827` | `#0d1526` |
| `text.secondary` | `#6B7280` | `#475569` |
| `text.tertiary` | `#9CA3AF` | `#94a3b8` |
| `border.primary` | `#E5E7EB` | `#00000014` (8% alpha black) |
| `border.secondary` | `#F3F4F6` | `#0000000a` (4% alpha black) |
| `brand.primary` | `#4263EB` | `#2563eb` |
| `brand.primaryHover` | `#3B5BD9` | `#1d4ed8` |
| `brand.secondary` | `#EFF6FF` | `#eef3ff` |
| `semantic.info` | `#2563EB` | `#2563eb` (kept) |
| `sidebar.background` | `#0c1427` | `#0c1f52` (deep blue) |
| `sidebar.foreground` | (n/a) | `#93c5fd` (NEW) |
| `sidebar.textMuted` | `rgba(255,255,255,0.6)` | `rgba(147, 197, 253, 0.7)` |
| `sidebar.hover` | `rgba(255,255,255,0.1)` | `#162b6e` |
| `sidebar.active` | `rgba(255,255,255,0.15)` | `#162b6e` |
| `sidebar.accent` | `#4263EB` | `#2563eb` |
| `sidebar.divider` | `rgba(255,255,255,0.1)` | `#ffffff14` |

#### `darkColors`

| Path | Current | New |
|---|---|---|
| `background.primary` | `#0F172A` | `#09090f` |
| `background.secondary` | `#0F172A` | `#0c1018` |
| `background.tertiary` | `#1E293B` | `#1c1f2e` |
| `surface.primary` | `#1E293B` | `#111318` |
| `surface.secondary` | `#0F172A` | `#1c1f2e` |
| `text.primary` | `#F9FAFB` | `#f1f5f9` |
| `text.secondary` | `#9CA3AF` | `#94a3b8` |
| `text.tertiary` | `#6B7280` | `#64748b` |
| `border.primary` | `#374151` | `#ffffff12` (7% alpha white) |
| `border.secondary` | `#1F2937` | `#ffffff0a` |
| `brand.primary` | `#3B82F6` | `#6366f1` (indigo shift) |
| `brand.primaryHover` | `#60A5FA` | `#818cf8` |
| `brand.secondary` | `rgba(59,130,246,0.1)` | `rgba(99,102,241,0.12)` |
| `sidebar.background` | `#0c1427` | `#0d0f18` |
| `sidebar.foreground` | (n/a) | `#94a3b8` (NEW) |
| `sidebar.textMuted` | `rgba(255,255,255,0.6)` | `rgba(148,163,184,0.7)` |
| `sidebar.hover` | `rgba(255,255,255,0.1)` | `#1c1f2e` |
| `sidebar.active` | `rgba(255,255,255,0.15)` | `#1c1f2e` |
| `sidebar.accent` | `#4263EB` | `#6366f1` |
| `sidebar.divider` | `rgba(255,255,255,0.1)` | `#ffffff12` |

### 1.2 New token category: `accent`

Adds emerald accent used for "Active" status badges, success emphasis (separate from `semantic.success` which stays for system success states).

```typescript
// In ThemeColors (theme.types.ts)
accent: {
  primary: string;         // #10b981 light, #10b981 dark
  primaryHover: string;    // #059669 light, #34d399 dark
  secondary: string;       // #ecfdf5 light, rgba(16,185,129,0.12) dark
  foreground: string;      // #047857 light, #6ee7b7 dark
};
```

Update `tkn.ts` `ThemePath` union to include `colors.accent.*`.

### 1.3 Type additions to `ThemeColors`

Add to `theme.types.ts`:
- `sidebar.foreground: string` (new field — sidebar text color, currently reuses `sidebar.text`)

Existing `sidebar.text` field stays as alias of `sidebar.foreground` for backward compatibility (or migration replaces all `sidebar.text` usages — TBD in plan).

### 1.4 Font swap

Current: `Inter`/`Lexend`. Target: **Plus Jakarta Sans**.

- Add `@fontsource/plus-jakarta-sans` (or self-host) to `packages/ui/package.json`
- Import weights 400, 500, 600, 700 in `packages/ui/src/index.ts`
- Update `typographyTokens.fontFamily`:
  ```typescript
  fontFamily: {
    heading: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    body: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    sans: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', monospace",  // kept
  }
  ```
- Landing tokens unchanged (landing uses its own typography in components, which is acceptable since landing is out of scope)

### 1.5 Landing tokens

**Untouched.** `landing.*` block in both themes stays as-is.

---

## Phase 2 — AppLayout Refactor

**Files:** `apps/web/src/layouts/AppLayout/{AppLayout.container.tsx, AppLayout.component.tsx, AppLayout.style.ts}`, `packages/ui/src/atoms/Logo/Logo.component.tsx`.

Current AppLayout is already feature-complete: collapsible sidebar, breadcrumb, theme toggle, language dropdown, profile dropdown, mobile overlay. **Refactor is structural, not functional.**

### 2.1 Sidebar nav restructure

Current nav order: Dashboard → [Inventory: eBay Listings, Listing Jobs, Products] → Orders → Stores → [Settings: Store, Amazon Accounts, Listing Groups]

New nav order (matches figma):

```
[Logo: ZonDS / Dropship Automation subtitle]

INVENTORY
  Dashboard
  eBay Listings       (count chip)
  Listing Jobs
  Products
  Orders              (count chip)
  Stores

CONFIGURATION
  Settings

[Profile footer: Log out]
```

Changes:
1. Move `Dashboard` INTO Inventory section (currently sits above it)
2. Rename second Settings section label from "Settings" to "Configuration"
3. Collapse 3 Settings sub-items → single "Settings" nav item pointing to `/settings`
4. Add count chip (Badge) to eBay Listings nav item (currently only Orders has one)
5. Remove `MeshBackground` from sidebar OR replace with subtle pattern matching figma's flat deep-blue

### 2.2 Logo treatment

Figma shows: small square logo + stacked text "ZonDS" / "Dropship Automation".

Update `<Logo>` atom (or create a `SidebarLogo` variant) to support this stacked text layout. The current `<Logo size={220} />` is horizontal; figma wants vertical lockup.

### 2.3 Sidebar colors

All sidebar styles in `AppLayout.style.ts` must use `tkn('colors.sidebar.*')` paths (not hardcoded). After Phase 1 token refresh, the sidebar will automatically pick up new deep-blue (light) / near-black (dark) colors.

Audit `AppLayout.style.ts` for any hardcoded colors (e.g. `rgba(255,255,255,...)`) and replace with `tkn()` paths.

### 2.4 Topbar

Current topbar matches figma structure: mobile menu, collapse toggle, breadcrumb, theme toggle, notification bell, language dropdown. **No major changes** — only token refresh (Phase 1) applies.

Optional: figma shows a subtle avatar/profile chip in topbar; current uses sidebar footer dropdown. Keep sidebar-footer approach (no migration needed).

---

## Phase 3 — Dashboard Refactor

**Files:** `apps/web/src/features/dashboard/{DashboardPage.container.tsx, DashboardPage.component.tsx, DashboardPage.style.ts, DashboardPage.types.ts}`, new molecules in `packages/ui/src/molecules/`.

### 3.1 Layout (top to bottom)

```
[Header: H1 "Dashboard" + "Hello, {user}!"]

[Toolbar: Search listings input | This Month date picker | Store selector]

[Stat cards row — 5 cards responsive grid]
  Today         | Yesterday    | This Month   | This Month (Forecast) | Last Month
  Jul 2, 2026   | Jul 1, 2026  | Jul 01–02    | Jul 01–31             | Jun 01–30
  Sales $X      | …            | …            | …                     | …
  Orders N      | …            | …            | …                     | …
  Net Profit $X | …            | …            | …                     | …
  Margin %      | …            | …            | …                     | …

[Revenue & Profit chart — 2 lines]
  Toggle: Revenue | Profit
  X axis: dates, Y axis: $ amounts

[Listings table]
  Product | Price | Cost | Est. Profit | Margin | ROI | Sold | Status
```

### 3.2 New molecule: `StatCard`

```typescript
// packages/ui/src/molecules/StatCard/
interface StatCardProps {
  label: string;          // "Today"
  dateRange: string;      // "Jul 2, 2026"
  sales: string;          // "$2.800"
  orders: string | number;
  netProfit: string;
  margin: string;         // "24.6%"
  isForecast?: boolean;   // visually distinguishes forecast card
}
```

Container composes `StatCard` from RTK Query data; component renders pure presentation.

### 3.3 Chart

Use **Recharts** (`recharts` package — check if installed; if not, add). Two-line chart (Revenue + Profit) with:
- Custom tooltip styled with `tkn()` tokens
- Axis ticks use `tkn('colors.text.tertiary')`
- Grid lines use `tkn('colors.border.secondary')`
- Series colors: Revenue = `tkn('colors.brand.primary')`, Profit = `tkn('colors.accent.primary')`

If Recharts adds too much bundle weight, fallback: lightweight custom SVG chart in `packages/ui/src/molecules/LineChart/`.

### 3.4 Toolbar

- Search input: use `ModernTextInput` molecule with search icon prefix (extend if needed)
- Date picker: use existing date molecule or create `PeriodPicker` (Button + Dropdown). The figma "This Month" pill opens a small menu
- Store selector: `Button` + `Dropdown` with store list

---

## Phase 4 — eBay Listings, Listing Jobs, Products

**Files:** respective `apps/web/src/features/{listings, listings/jobs, listings/products}/` folders.

All three are **table-driven screens**. Translation strategy:

### 4.1 Table primitive audit

Check existing table implementation (likely ad-hoc per feature). If no shared table primitive exists, build `DataTable` molecule in `packages/ui/src/molecules/DataTable/` covering:
- Header row with sortable columns
- Body rows with hover state
- Status pill cell (maps enum → color)
- Pagination footer
- Empty state slot

### 4.2 Status pill

Map domain enums to color tokens via a `<StatusPill status={...}>` atom:
- `Active` → `accent.primary` (emerald)
- `Draft` / `Pending` → `text.tertiary`
- `Error` / `Failed` → `semantic.error`
- `Shipped` / `Completed` → `semantic.info`
- `Cancelled` → `semantic.warning`

Domain enum stays in `packages/shared/src/domain/`.

### 4.3 Per-screen scope

- **eBay Listings**: product image + title + ASIN + price metrics + status. Filters: status, store. Bulk actions toolbar.
- **Listing Jobs**: job type + status + progress + timestamps. Likely uses `ProgressBar` atom.
- **Products**: ASIN/image/title/price/source. Simpler table.

---

## Phase 5 — Orders (List + Detail)

**Files:** `apps/web/src/features/orders/{OrdersPage.container.tsx, OrdersPage.component.tsx, details/}`.

### 5.1 Orders list

Columns per figma (capture was less detailed for orders — read screenshot at implementation time). Likely: Order # | Buyer | Date | Total | Status | Amazon linked?

### 5.2 Order detail

Already has Amazon linking modal. Refactor to use Drawer (already exists) + new `SectionHeader` molecule. Net profit display uses `accent.primary` for positive values.

---

## Phase 6 — Stores

**Files:** `apps/web/src/features/ebay/stores/`.

Per figma, Stores page shows: store cards with avatar/image, name, status, marketplace, stats (active listings, total orders), token status, last sync, sync/disconnect buttons.

Sidebar nav `Stores` item **stays** — it's both in sidebar AND embedded in Settings as "Connected Stores" tab. No route change.

---

## Phase 7 — Settings Hub Consolidation (Largest)

**Files:** new `apps/web/src/features/settings/` directory. Deprecate: `apps/web/src/features/{store-settings, amazon, profile, listing-settings-groups}/` (delete or move logic into new hub modules).

### 7.1 Route change

```
OLD:
  /settings/store                  → StoreSettingsPage
  /settings/amazon-accounts        → AmazonAccountsPageContainer
  /settings/listing-groups         → ListingSettingsGroupPage
  /settings/listing-groups/new     → ListingSettingsGroupForm
  /settings/listing-groups/:id/edit → ListingSettingsGroupForm
  /profile                         → ProfilePage

NEW:
  /settings                        → SettingsHubPage (everything)
```

Add `<Navigate>` redirects from old routes → `/settings`.

### 7.2 Hub page structure

Single scrolling page with section cards:

```
[Header: H1 "Settings" + "Manage your account, integrations, and automation"]

[Profile hero card]
  Avatar | demoo user (Pro Plan) | zondsxseller01@gmail.com
  Tabs: [Personal Information] [Connected Stores (1 Active)]

[Row: eBay Account card | Amazon Accounts card]
  Each: SectionHeader (icon + title + action button)
  Body: details grid + status pills

[Row: Store Configuration card | Blacklist Management card]

[Listing Settings Groups card]
  List of group cards (name, listings count, margin) + edit/delete icons

[Row: Account & Security card | Notifications card]
  Account: list buttons (Change Password, 2FA, Language, API Access)
  Notifications: list of toggle rows

[Plan card]
  Pro Plan | $49/mo | Renewal date | Manage Plan button

[Danger Zone]
  Deactivate Account button (destructive variant)
```

### 7.3 Drawer modals

Each "Manage" / "Edit" / "Add" button opens a right-side `Drawer` (already exists in `packages/ui/src/molecules/Drawer/`):

| Trigger | Drawer content |
|---|---|
| eBay Account → Manage | Full eBay account detail (token, sync, disconnect) |
| Amazon Accounts → Add | Form: email, password, 2FA secret |
| Store Config → Edit | Country, city, zip, validation toggles, blacklist |
| Listing Group → New / edit | Existing `ListingSettingsGroupForm` migrated into Drawer |
| Account → Change Password | Form: current, new, confirm |
| Account → 2FA | QR + secret + verification code |
| Account → Language & Region | Locale + timezone selectors |
| Account → API Access | API key list + generate |
| Notifications → Edit | All notification toggles |
| Profile → Personal Information | First/last name, email, phone, bio, address |

Drawer state managed by container; URLs can use query params (e.g. `/settings?drawer=ebay`) for deep-linkability.

### 7.4 Logic migration

Existing logic in `StoreSettingsService`, `AmazonAccountsService`, `ListingSettingsGroupService`, etc. stays in backend. Frontend containers call same RTK Query endpoints — just reshuffled into hub.

### 7.5 i18n keys

New namespace `settings` under `translation`:
- `translation:settings.title`, `translation:settings.subtitle`
- `translation:settings.profile.*`
- `translation:settings.sections.ebay.*`, `.amazon.*`, `.storeConfig.*`, `.blacklist.*`, `.listingGroups.*`, `.account.*`, `.notifications.*`, `.plan.*`, `.danger.*`

Old keys under `storeSettings.*`, `amazon.*`, `listingSettingsGroups.*`, `profile.*` migrate to `settings.*` (or aliases for backward compat — TBD).

---

## Phase 8 — Route Cleanup + i18n Audit

### 8.1 Route redirects

In `apps/web/src/App.tsx`, replace deprecated routes with:

```tsx
<Route path="settings/store" element={<Navigate to="/settings" replace />} />
<Route path="settings/amazon-accounts" element={<Navigate to="/settings" replace />} />
<Route path="settings/listing-groups/*" element={<Navigate to="/settings" replace />} />
<Route path="profile" element={<Navigate to="/settings" replace />} />
<Route path="settings" element={<SettingsHubPage />} />
```

### 8.2 Sidebar nav update

In `AppLayout.container.tsx`, remove the 3 Settings sub-nav items, replace with single:
```tsx
<S.NavItem $active={pathWithoutLocale === '/settings'} onClick={() => localeNavigate('/settings')}>
  <Icon name="settings" size={18} />
  {t('translation:menu.settings')}
</S.NavItem>
```

### 8.3 Breadcrumb update

`getBreadcrumbItems()` in `AppLayout.container.tsx` simplifies: `/settings/*` → single "Settings" breadcrumb item.

### 8.4 i18n audit

- Grep for hardcoded UI strings in refactored files (ESLint rule `no-implicit-i18n-namespaces` enforces namespace prefix)
- All new strings under `translation:settings.*` and `translation:dashboard.*` (or dedicated namespaces per CLAUDE.md convention)
- Both `en/translation.json` and `tr/translation.json` updated

---

## Design System Additions Summary

New atoms/molecules to create in `packages/ui/src/`:

| Component | Type | Purpose |
|---|---|---|
| `StatCard` | molecule | Dashboard stat card |
| `SectionHeader` | molecule | Card header: icon + title + description + action button |
| `StatusPill` | atom | Status enum → colored pill |
| `DataTable` | molecule | Shared table primitive (if not exists) |
| `CountChip` | atom or Badge variant | Sidebar nav count chip |
| `LineChart` | molecule | Revenue/profit chart (Recharts wrapper or custom SVG) |
| `SidebarLogo` | atom variant | Logo with stacked text lockup |

Extended:
- `ThemeColors` type: add `accent` category + `sidebar.foreground`
- `tkn.ts` `ThemePath`: register new paths
- `typographyTokens.fontFamily`: Plus Jakarta Sans

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Token refresh breaks existing screens visually | Phase 1 lands first; screens will look "off" but functional until Phase 3+ catches up. Commit Phase 1 alone, visually verify, then proceed. |
| Settings consolidation removes 5 routes — breaking bookmarks / deep links | Phase 8.1 adds `<Navigate>` redirects to `/settings` for all old paths. |
| Recharts bundle size | Evaluate; if >50kb gzipped, build custom SVG line chart instead. |
| Plus Jakarta Sans missing weights | Use `@fontsource/plus-jakarta-sans` (full variable font) instead of manual Google Fonts link. |
| Dark mode primary divergence (blue vs indigo) confuses devs | Document in `CLAUDE.md` after Phase 1: "primary is per-theme — light uses blue-600, dark uses indigo-500". |
| Drawer-based editing loses deep-linking | Phase 7.3 uses query params (`/settings?drawer=ebay`) so URLs are shareable. |

---

## Out of Scope (Explicit)

- Landing page redesign
- Auth pages (login, register, verify-email, check-email)
- Onboarding flow (`/onboarding/ebay`, `/ebay/connect`)
- Backend changes (all data shapes stay same — this is purely a frontend refactor)
- Mobile native layout (responsive is in scope; native app is separate)

---

## Open Questions Resolved

1. **Q:** Keep separate Stores route? **A:** Yes — Stores stays standalone AND appears as "Connected Stores" tab in Settings profile card.
2. **Q:** Drawer vs Modal for Settings edit? **A:** Drawer (right-side, already exists).
3. **Q:** Per-theme primary OK? **A:** Yes — natural fit since light/dark are separate theme objects.
4. **Q:** Use Recharts or custom? **A:** Try Recharts first, fallback to custom SVG if bundle heavy.

---

## Phasing for Implementation Plan

The `writing-plans` skill will translate this into a sequenced implementation plan. Recommended order:

1. **Phase 1** (token refresh) — small, atomic, lands visible diff everywhere
2. **Phase 2** (AppLayout) — high visual impact across all pages
3. **Phase 3** (Dashboard) — most complex screen, validates new molecules
4. **Phase 4** (Listings/Products/Jobs) — batch of similar table screens
5. **Phase 5** (Orders) — independent screen group
6. **Phase 6** (Stores) — small standalone
7. **Phase 7** (Settings hub) — largest, most disruptive, last
8. **Phase 8** (Route cleanup + i18n) — final hygiene

Each phase should be a separate commit (or PR) for reviewability.
