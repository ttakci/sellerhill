# Plans 2-5: Visual Audit + Settings Hub Implementation

**Date:** 2026-07-04
**Status:** Active — sequential execution Plan 2 → 3 → 4 → 5

## Context

Original spec `2026-07-03-figma-site-refactor-design.md` outlined Phases 3-8 (Dashboard, Tables, Orders/Stores, Settings hub). Inspection of the codebase on 2026-07-04 revealed that Phases 3-6 are largely **already implemented** from earlier work — only the visual polish gap remains. Phase 7 (Settings hub consolidation) is the only real new implementation work.

Reference screenshots: `figma-audit/01-07-*-light/dark.png`.

## Approach

**Audit methodology** (Plans 2-4):
1. Use `chrome-devtools-mcp` to navigate to each screen
2. Capture current state in both light and dark themes
3. Compare against the matching `figma-audit/` reference using image-diff analysis
4. List concrete discrepancies (color, spacing, typography, layout, missing elements)
5. Fix each discrepancy in the relevant `.style.ts` or `.component.tsx`
6. Re-screenshot and verify the fix landed
7. Commit per plan

**Settings hub** (Plan 5) — implementation, not audit:
1. Build new `/settings` route as single scrolling page with section cards
2. Migrate existing logic from `store-settings`, `amazon`, `profile`, `listing-settings-groups` into the hub
3. Build Drawer modals for edit flows (using existing Drawer molecule)
4. Add `<Navigate>` redirects from old routes
5. Update sidebar nav (single `Settings` item already exists from Plan 1 Task 6)
6. Verify no broken deep links

## Plans

### Plan 2 — Dashboard (audit + polish)
- Reference: `figma-audit/01-dashboard-{light,dark}.png`
- Route: `/{locale}/dashboard`
- Files: `apps/web/src/features/dashboard/DashboardPage/*`
- Known existing: 5 period cards, AreaChart, toolbar with search + segmented control, listings table

### Plan 3 — Tables (audit + polish)
- References: `figma-audit/02-ebay-listings-{light,dark}.png`, `03-listing-jobs-*`, `04-products-*`
- Routes: `/{locale}/listings`, `/{locale}/listings/jobs`, `/{locale}/listings/products`
- Files: respective `apps/web/src/features/listings/**` folders

### Plan 4 — Orders + Stores (audit + polish)
- References: `figma-audit/05-orders-*`, `06-stores-*`
- Routes: `/{locale}/orders`, `/{locale}/stores`
- Files: `apps/web/src/features/{orders,ebay/stores}/*`

### Plan 5 — Settings Hub (implementation)
- Reference: `figma-audit/07-settings-{light,dark}.png`
- Route: `/{locale}/settings` (new); old routes (`/settings/store`, `/settings/amazon-accounts`, `/settings/listing-groups`, `/profile`) redirect via `<Navigate>`
- Files: new `apps/web/src/features/settings/SettingsPage/` + components; deprecate old route components (logic migrated, files may stay as feature modules referenced from hub)
- Backend: NO changes (existing endpoints reused)

## Definition of Done

**Per plan (2-4):** screenshots of the polished screen in light + dark mode committed under `figma-audit/results/<plan>-after-{light,dark}.png`; visual diff vs reference is within tolerance (colors, spacing, layout structure).

**Plan 5:** `/settings` route renders all sections, every old route redirects correctly, Drawer modals open and save via existing RTK Query endpoints.

## Out of Scope

- Backend changes (any new fields/endpoints needed get deferred)
- Mobile native (responsive is in scope)
- Auth/landing pages (already explicitly excluded from original spec)
- i18n `no-implicit-i18n-namespaces` rule (separate effort)
- `no-native-select` rule (separate effort — ModernSelect migration)
