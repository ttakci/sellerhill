# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
pnpm dev              # Build packages, then run api + web concurrently
pnpm dev:web          # Build packages, run web only
pnpm dev:api          # Build packages, run api only

# Build
pnpm build            # Build all packages and apps

# Quality
pnpm lint             # ESLint check (max-warnings 0)
pnpm lint:fix         # ESLint auto-fix
pnpm format           # Prettier write all files
pnpm typecheck        # TypeScript check across all packages
pnpm validate         # lint + typecheck (runs on pre-commit)

# Docker (PostgreSQL 16, Redis 7, pgAdmin)
pnpm docker:up        # Start services
pnpm docker:down      # Stop services
pnpm docker:logs      # Follow logs
pnpm docker:clean     # Remove containers and volumes
```

Packages must be built before apps can run (`pnpm dev` handles this automatically). No tests exist yet — Jest and ts-jest are installed but unused.

## Architecture

**pnpm workspace monorepo** with two apps and three packages:

| Path | Description |
|---|---|
| `apps/api` | NestJS 10.3+ backend. Raw PostgreSQL via `pg` (no ORM). BullMQ job queues (Redis). JWT auth (Passport). |
| `apps/web` | React 18 + Vite 5. Redux Toolkit + RTK Query. Emotion CSS-in-JS. i18n (EN + TR). |
| `packages/shared` | Domain types, DTOs, Zod schemas, constants, i18n resources. Dual-format build (ESM + CJS). |
| `packages/ui` | Design system (Atomic Design). Theme tokens, styled components, contexts. |
| `packages/mcp` | Stub — no source code yet. |

### Key Patterns

**Container/Component split** — Every page:
- `[Feature]Page.container.tsx` — Logic, RTK Query hooks, state management
- `[Feature]Page.component.tsx` — Presentation only (only `useTranslation` hook allowed)
- `[Feature]Page.style.ts` — Emotion styled components
- `[Feature]Page.types.ts` — Feature-specific types

**API calls** — All frontend API interactions use RTK Query via `baseApi.injectEndpoints`. No direct fetch/axios.

**Shared types** — All domain types/DTOs/interfaces in `packages/shared/src/domain/`. All Zod schemas in `packages/shared/src/schemas/`. No duplicates, no `any`.

**Database** — Raw `pg` driver via `DatabaseService` (query, getClient, transaction methods). Schema in `docker/postgres/init.sql`. No ORM.

**i18n** — No hardcoded UI strings. Files in `packages/shared/src/i18n/resources/{en,tr}/`. Key resolution rule:
- Domain namespace JSONs (`ebay.json`, `dashboard.json`, `orders.json`, etc.) have a **top-level key matching the namespace name** (e.g. `{ "ebay": { "connect": { "title": "..." } } }`).
- When calling `t()` with the namespace as default (via `useTranslation(['ebay', 'translation'])`), use **dot notation with the full path including the wrapper key**: `t('ebay.connect.title')`. Do NOT use colon syntax — `t('ebay:connect.title')` will show the raw key.
- Cross-namespace access to `translation` (which has no wrapper key) uses **colon syntax**: `t('translation:common.loading')`.
- Summary: dot notation (`t('ebay.connect.title')`) for the primary namespace, colon syntax (`t('translation:key')`) only for cross-namespace access to `translation`.

**Reference module** — `store-settings` is the canonical pattern:
- Backend: `apps/api/src/modules/store-settings/`
- Frontend: `apps/web/src/features/store-settings/`
- Shared: `packages/shared/src/domain/store-settings/`

**Landing page** (`apps/web/src/features/landing/`) — public marketing page at `/` (no locale prefix). Professional dark-premium SaaS design, TR/EN + light/dark aware.
- Container (`LandingPage.container.tsx`) owns all state/logic: scroll detection, mobile menu, locale switching, navigation to `/{locale}/login|register`. Component (`LandingPage.component.tsx`) is presentation-only (`useTranslation` + the scroll-reveal `IntersectionObserver`, which is a visual concern).
- Styled with Emotion `styled` + `tkn()` tokens from `colors.landing.*` (extended palette: `heroBg`, `heroGlow`, `heroGlowAlt`, `heroGrid`, `heroText`, `heroTextMuted`, `heroBorder`, `accentCyan`, `cardBorder`, `cardBorderHover`, `chipBg`, `chipBorder`, `sectionDeep`, etc.). The hero is **always dark** in both themes — use `colors.landing.heroText`/`heroTextMuted` for text on it, never `text.inverse` (which flips per theme). When adding new landing tokens, register them in **all three** places: `theme.types.ts` (`ThemeColors.landing`), `themes.ts` (light + dark blocks), and `tkn.ts` (`ThemePath` union) — otherwise `tkn('colors.landing.x')` is a type error.
- Copy is in i18n under `landing.*` (both `en/translation.json` and `tr/translation.json`). Pricing plan features are arrays — consume via `t('translation:landing.pricing.<plan>.features', { returnObjects: true })`. Only the `pro` plan has a `badge`.
- Icons: the `<Icon>` component resolves `color="brand.primary"` / `"semantic.success"` / `"landing.<token>"` dot-paths. Brand icons are `amazon`/`ebay` in the icon map; `brand-amazon`/`brand-ebay` are aliases. Marketing icons available: `arrow-right`, `star`, `zap`/`sparkles`, `shield-check`, `clock`, `layers`, `repeat`, `gauge`.

### Custom ESLint Plugin (`eslint-plugin-design-system.js`)

- `no-hardcoded-colors` — Use theme tokens, not hex/rgb
- `no-hardcoded-spacing` — Use theme spacing tokens
- `no-inline-styles` — No style prop in JSX
- `no-styled-typography` — Use `<Text>` component, not styled.h1/h2/etc.
- `no-bare-text-in-button` — Wrap Button children in `<Text>`
- `no-implicit-i18n-namespaces` — Require namespace prefix in i18n keys

## Domain Concepts

- **Product**: Source of truth from Amazon (ASIN, images, price). Cached to save API costs.
- **Listing**: An active offer on eBay. Always linked to a Listing Setting Group.
- **Listing Setting Group**: Defines repricing strategy, stock logic, eBay fees, profit margins. Multiple listings share one group — adjusting a group instantly changes all its listings.
- **Order**: An eBay sale. Linked to a Listing (via `listing_id`). Product info (title, image, ASIN) resolved via listing→product JOIN, not stored in orders. Contains eBay-side financials (saleTotal, ebayEarnings) and Amazon-side costs (purchasePrice, amazonTax, amazonShipping).
- **Amazon Account**: A buyer Amazon account used for order scraping. Credentials encrypted with AES-256-GCM. One user can have multiple Amazon accounts.

## Order Management

### Data Flow
```
eBay Order → Order Sync (BullMQ, every 15 min) → orders table
  ↕ (matched via lineItem.legacyItemId → listings.ebay_item_id)
orders.listing_id → listings → products (title, image, ASIN via JOIN)
  ↓ (user links Amazon order)
Amazon Account + Amazon Order ID → Playwright scraping → order costs updated
  ↓ (automatic)
Amazon Order Tracking (BullMQ, per-order scheduler) → Amazon status polling → eBay status sync
```

### Order → Listing → Product Relationship
- **Matching**: eBay order's `lineItems[0].legacyItemId` matched against `listings.ebay_item_id` during sync
- **Product data** (title, ASIN, image, SKU): Resolved via `orders.listing_id → listings → products` JOIN in `findOne()`
- **Purchase price**: Stored in orders as snapshot (product prices change, order needs historical price)
- **Order table** only stores: eBay order data, buyer info, financials, shipping address
- **Columns**: `order_date` (eBay creationDate), `last_ebay_event_at` (eBay lastModifiedDate), `updated_at` (our updates), `last_synced_at` (sync tracking)

### Net Profit Formula
```
netProfit = ebayEarnings - purchasePrice - amazonTax - amazonShipping
```
- `ebayEarnings` = eBay's `totalDueSeller` (already deducts all eBay fees)
- `transactionFee` and `adFee` are calculated and stored for display only, NOT deducted again

### Order Sync (eBay → Local)
- **Queue**: `order-sync` (BullMQ), cron every 15 min
- **Per-user processing**: Each user gets a separate job, concurrency: 3
- **Manual refresh**: `POST /orders/sync` queues high-priority job, waits, returns fresh data
- **Cache tracking**: `ebay_accounts.last_ebay_sync_at` — sync fetches only orders since last sync
- **Listing matching**: Uses `lineItem.legacyItemId` → `listings.ebay_item_id` to establish `listing_id`

### Amazon Order Linking
- User provides Amazon Order ID + selects an Amazon Account
- `AmazonScrapingService` scrapes the Amazon order detail page via Playwright
- Scraped data (purchase price, tax, shipping, tracking) written to order
- `recalculateProfit()` triggered with actual Amazon costs
- Tracking job started immediately for the order

### Amazon Order Tracking (Amazon → eBay Status Sync)
- **Queue**: `amazon-tracking` (BullMQ, per-order schedulers)
- **Intervals**:
  - Pending/Processing orders: every **6 hours** (waiting for shipment)
  - Shipped orders: every **12 hours** (waiting for delivery)
- **No auto-stop**: Tracking continues until order reaches a terminal state (delivered, cancelled, completed). The processor removes the job when terminal status is detected.
- **eBay sync**:
  - Amazon `shipped` → `POST /sell/fulfillment/v1/order/{id}/shipping_fulfillment` on eBay with tracking number
  - Amazon `delivered` → Order status set to `completed`
- **On startup**: `reconcileSchedulers()` cleans up orphaned schedulers and creates missing ones for active orders

### Amazon Scraping — Anti-Ban Strategy
- **Session isolation**: Each Amazon account gets its own browser state file (`.browser-state/{accountId}.json`) with separate cookies, localStorage
- **Fingerprint isolation**: Deterministic per-account fingerprint (user-agent, viewport, timezone) — same account always looks the same
- **Rate limiting** (Bottleneck):
  - Global: max 5 concurrent browser actions
  - Per-account: 1 concurrent, 3 seconds between requests, 20 requests/minute
  - Exponential backoff on 429/captcha/block responses
- **Session reuse**: Existing cookies restored on repeat visits. Full login only when session expires.
- **Stealth**: `playwright-extra` + `puppeteer-extra-plugin-stealth` (patches navigator.webdriver, plugins, WebGL, etc.)
- **2FA support**: TOTP via `otplib` — user provides the secret key from Amazon's 2FA settings

### eBay Fulfillment API
- `createShippingFulfillment(accessToken, ebayOrderId, lineItemId, quantity, { trackingNumber, shippingCarrierCode })` — marks order as shipped on eBay
- Tracking number + carrier are mutually dependent — both must be provided together
- Currently forwards Amazon's real tracking number. Future: replace with generated fake tracking IDs for dropshipping.

### Key Files
- **Backend orders**: `src/modules/orders/` — OrdersService, OrderSyncService, EbayFulfillmentService, OrderSyncQueueService, OrderSyncProcessorService
- **Backend Amazon**: `src/modules/amazon/` — AmazonAccountsService, AmazonScrapingService, AmazonOrderParserService, AmazonTrackingQueueService, AmazonTrackingProcessorService, AmazonRateLimiter, BrowserStateManager
- **Backend products**: `src/modules/products/` — ProductsService (price/image lookup)
- **Frontend orders**: `apps/web/src/features/orders/` — list page, detail page, Amazon linking
- **Frontend Amazon**: `apps/web/src/features/amazon/` — accounts page, linking modal, RTK Query API
- **Shared**: `packages/shared/src/domain/orders/`, `packages/shared/src/domain/amazon/`, `packages/shared/src/schemas/orders/`, `packages/shared/src/schemas/amazon/`

## Architectural Rules

1. **Type Safety** — Types in `packages/shared/src/domain/`. No `any`. No duplicates.
2. **Validation** — Zod schemas in `packages/shared/src/schemas/`. Backend DTOs use `class-validator` but implement shared interfaces.
3. **UI & Styling** — Emotion with semantic tokens. No inline styles. No hardcoded colors (`#fff`, `rgba(...)`, etc.), spacing (`16px`, etc.), or magic numbers. Everything must be a theme token via `tkn()`. If a new color/spacing/value is needed, add it to `packages/ui/src/theme/` (designTokens, themes, tkn paths) first. Use `Icon` component, no inline SVGs.
4. **Forms** — Use `ModernTextInput` molecule. Inputs must use `React.forwardRef` and `value={value ?? ''}`.
5. **Loading & Errors** — `useLoading(isLoading)` for global UI overlay. `showMessage` from `UIContext` for errors. Loading state is business logic — it belongs in container files (`.container.tsx`), never in component files (`.component.tsx`). Component files must NOT render loading spinners or conditional loading UI; the container handles loading via the `useLoading` hook which shows a global overlay. The only exception is passing an `isLoading` prop to a Button atom for inline button spinner.
6. **Container/Component Split (strict)** — Component files (`.component.tsx`) must contain ONLY JSX/markup and `useTranslation`. ALL logic (formatting, computed values, event handlers, hooks beyond `useTranslation`/`useTheme`) belongs in container files (`.container.tsx`). Utilities like `formatCurrency`, `formatDate`, `isTR` checks are logic — they go in the container.
7. **Shared Utilities** — Reusable formatting and locale utilities (e.g., `formatCurrency`, `formatCompactNumber`, `formatDate`, `getLocaleConfig`) live in `packages/ui/src/utils/`. Import from `@repo/ui`. Never define them locally in component or container files.
8. **Design System Only (no custom UI primitives)** — All UI primitives (inputs, selects, checkboxes, buttons, modals, dropdowns, toggles, date pickers, etc.) MUST come from `packages/ui` (atoms or molecules). Never use native HTML elements (`<select>`, `<input>`, `<button>`, etc.) or build custom form controls directly in feature code. If a needed component doesn't exist in the design system, create it there first as an atom/molecule, then use it. This ensures consistency and reusability across all screens.
9. **MessageModal for success/error/info/warning messages** — All informational and error messages MUST use the `MessageModal` molecule via `showMessage` from `UIContext`. Never use native `alert()`/`confirm()`, create custom modal implementations, or bypass this pattern. `MessageModal` provides consistent styling with type-appropriate icons (success=check-circle, error=x-circle, warning=alert-triangle, info=info) and proper button handling.
10. **No hardcoded status/constant strings** — All status values, type discriminators, and constant strings MUST be defined as enums in `packages/shared/src/domain/`. Never use string literals like `'active'`, `'draft'`, `'custom'`, `'predefined'`, etc. directly in code. Use the corresponding enum (e.g., `ListingStatus.ACTIVE`, `TemplateType.CUSTOM`, `PolicyType.PAYMENT`, `OrderStatus.SHIPPED`, `EbayAccountStatus.ACTIVE`). If a new constant is needed, create or extend an enum in the shared package first.
11. **Keep CLAUDE.md up to date** — When changes are made that affect project conventions, architecture, commands, patterns, or rules, CLAUDE.md MUST be updated to reflect the current state. This includes new packages, changed file paths, updated tooling, new architectural patterns, or modified workflows. Do not let CLAUDE.md become stale.

## Environment Setup

1. `pnpm docker:up` (PostgreSQL on :5432, Redis on :6379)
2. Copy `apps/api/.env.example` to `apps/api/.env` and fill in values
3. Copy `apps/web/.env.example` to `apps/web/.env` (defaults work for local dev)
4. `pnpm dev`

API: `http://localhost:3000` (Swagger at `/api/docs`). Web: Vite dev server (default :5173).

## Figma Redesign — Per-Theme Tokens

The figma Make redesign (https://sweet-yang-69529706.figma.site/) introduced tonal shifts:
- **Primary is per-theme**: light uses `#2563eb` (blue-600), dark uses `#6366f1` (indigo-500). Do NOT expect them to match.
- **Sidebar background is per-theme**: light deep blue `#0c1f52`, dark near-black `#0d0f18`.
- **Borders are alpha-based**: `#00000014` (light) / `#ffffff12` (dark) — not solid hex.
- **`accent` token category** (emerald `#10b981`) is for "Active" status badges and success emphasis. Distinct from `semantic.success` (system success states).
- **Font**: Plus Jakarta Sans (was Inter/Lexend).
- **Sidebar nav**: Inventory section (Dashboard, eBay Listings, Listing Jobs, Products, Orders, Stores) + Configuration section (Settings). Single Settings nav item (hub consolidation TBD in Plan 5).

Redesign spec: `docs/superpowers/specs/2026-07-03-figma-site-refactor-design.md`.
