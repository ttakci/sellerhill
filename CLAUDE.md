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
pnpm typecheck        # Real `tsc --noEmit` across apps/web, apps/api, packages/ui (strict — reports all errors)
pnpm validate         # lint + typecheck (full check — run manually or in CI)

# Pre-commit hook runs `pnpm lint` only. `pnpm typecheck` is strict and the web
# app still carries pre-existing TS errors, so it is NOT in the pre-commit hook
# (it would block every commit). Run `pnpm typecheck` to find them and clean up;
# once the web app is clean, restore `pnpm run validate` in `.husky/pre-commit`.

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

## Product Refresh Pipeline

Amazon product data (metadata + buy-box price + stock) is sourced **exclusively from the Keepa API** — one provider, one token per ASIN (`history=0`, `stock=1`, `stats=90`). ScraperAPI was removed: its per-request credit model is 10–100× more expensive than Keepa's token pool under bulk-add/churn. Keepa returns title/images/brand/description/features/price/stock in a single token, so there is no second fetch.

> **Strengths:** zero-waste token utilization, linear scalability to millions of products, per-user cost attribution, self-healing failure handling. Frequency is a config knob, not an architecture.

### Shared product cache
`products` is a global ASIN-keyed cache — one ASIN exists once regardless of how many users list it. One customer's data fetch serves every customer listing that ASIN. There is **no per-user Keepa cost isolation**; costs are attributed via fair-split (see Token tracking below).

### Stale-driven scheduler + batch worker
There is **no "refresh everything every N hours" cron**. Instead a `keepa-refresh` BullMQ queue with two roles:
- **Scheduler** (`RefreshSchedulerService`, repeatable tick every minute by default): runs a single query — `SELECT id FROM products WHERE next_refresh_at <= NOW() ORDER BY next_refresh_at ASC LIMIT $batchSize` — and enqueues **one** `refresh-batch` job. The scheduler knows nothing about Keepa.
- **Worker** (`RefreshProcessorService`): one bulk Keepa call per batch (Keepa's 100-ASIN bulk limit is chunked internally) → captures `tokensConsumed`/`tokensLeft` → per-product compare + update → fan-out for changed products. Per-product failures are isolated inside the batch (try/catch); a transport failure (Keepa 429/5xx/network) propagates so BullMQ retries the whole batch idempotently.

### Field change-detection
The worker updates the `products` row only when buy-box price, stock, or title changed. The fan-out (`ProductSyncService.updateAllListingsForProduct`) recomputes each active listing's strategy and pushes to eBay **only when that listing's price or quantity actually changed** (buffer/rounding may absorb an Amazon change). eBay API volume stays proportional to real changes, not to refresh frequency.

### Failure handling & poison-product quarantine
- **Transport failure**: BullMQ exponential backoff retries the batch; `next_refresh_at` is **not** advanced, so products stay due.
- **Data failure** (ASIN missing/broken in Keepa response): `consecutive_failures++`; below `KEEPA_REFRESH_MAX_FAILURES` the product is retried on a near-future tick (next_refresh_at untouched); at/above the threshold it is **quarantined** (`next_refresh_at = NOW() + KEEPA_REFRESH_QUARANTINE_MINUTES`) so a permanently-dead ASIN cannot starve the refresh queue.

### Config-driven frequency (no rewrite to change cadence)
All env (defaults shown), all optional:
- `KEEPA_REFRESH_INTERVAL_MINUTES=720` (12h). Dial to 360 (6h) / 180 (3h) by env only.
- `KEEPA_REFRESH_BATCH_SIZE=50` — products per tick (one bulk Keepa call).
- `KEEPA_REFRESH_SCHEDULER_CRON=* * * * *` — tick cadence.
- `KEEPA_REFRESH_WORKER_CONCURRENCY=1` — parallel refresh jobs.
- `KEEPA_REFRESH_QUARANTINE_MINUTES=1440`, `KEEPA_REFRESH_MAX_FAILURES=5`.

Throughput = batch_size × ticks/min; bounded by Keepa's token-generation rate (plan tier). Refresh interval ≈ `total_unique_asins / (token_rate × utilization)`.

### Token tracking (cost attribution)
- `keepa_usage_log` — one row per ASIN per refresh: `asin, tokens (fair share = batch tokensConsumed / products_in_batch), source ('refresh'|'create'), user_ids (JSONB array of users actively listing the ASIN), requested_at`. Append-only.
- `keepa_balance` — `tokensLeft`/`refillIn` snapshots from each Keepa response (time series).
- **Admin per-user monthly cost (fair-split):** `SELECT uid, SUM(tokens / jsonb_array_length(user_ids)) AS tokens FROM keepa_usage_log CROSS JOIN LATERAL jsonb_array_elements_text(user_ids) AS uid WHERE requested_at >= date_trunc('month', NOW()) GROUP BY uid ORDER BY tokens DESC;`
- No UI yet (admin reads tables directly). Token-balance-driven worker throttling is intentionally deferred until real utilization data is collected.

### Listing creation path
`ListingProcessorService` (the `listings` queue worker) uses a **single** `KeepaService.getProductDetailsWithMeta(asin)` per new product (full metadata + price + stock + token meta in one call). Re-listing a cached ASIN makes **no** Keepa call (0 tokens) — the product is already on the refresh schedule. New product rows get `next_refresh_at = NOW() + 12h` on insert (`findOrCreateProduct`); subsequent rescheduling uses the config interval.

### Key product-refresh files
- `src/modules/listings/keepa.service.ts` — Keepa API, `history=0`, token-meta capture, bulk `getProducts()` + `getProductDetailsWithMeta()`.
- `src/modules/listings/refresh-scheduler.service.ts` — repeatable tick, selects overdue products.
- `src/modules/listings/refresh-processor.service.ts` — batch worker (compare/update/fan-out/quarantine/token-log).
- `src/modules/listings/keepa-usage.service.ts` — `keepa_usage_log` + `keepa_balance` persistence.
- `src/modules/listings/product-sync.service.ts` — `updateAllListingsForProduct()` (change-detected fan-out) + `syncListingsForProduct()` (sale-driven entry point).
- DB: `products` (next_refresh_at, last_refresh_attempt_at, last_successful_refresh_at, consecutive_failures), `keepa_usage_log`, `keepa_balance`. Migrations `025`/`026`/`027`.

## Order Management

### Data Flow
```
eBay Order → Order Sync (BullMQ, every 15 min) → orders table
  ↕ (matched via lineItem.legacyItemId → listings.ebay_item_id)
orders.listing_id → listings → products (title, image, ASIN via JOIN)
  ↓ (NEW order only, xmax-detected insert)
Sale-Driven Stock Sync → products.stock decremented → stock-sync queue → recompute + push eBay
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
- **Idempotency**: `upsertOrder()` uses Postgres `RETURNING id, (xmax = 0) AS inserted` to detect brand-new orders vs re-synced updates — one-time side effects (stock decrement) only fire on genuine inserts

### Sale-Driven Stock Sync (between Keepa refresh cycles)
- **Why**: A confirmed eBay sale is real signal that Amazon stock dropped, so we don't wait for the next Keepa refresh cycle to correct eBay quantities.
- **Queue**: `stock-sync` (BullMQ). Producer = `StockSyncQueueService` (orders module, `@InjectQueue`), consumer = `StockSyncProcessorService` (listings module, `@Processor`, concurrency 3). Same queue name registered in both modules → same Redis queue.
- **Flow on new matched order**: `products.stock` decremented by order quantity (`ProductsService.decrementStock`, floors at 0) → enqueue `{ productId }` → worker calls `ProductSyncService.syncListingsForProduct(productId)` → reuses the same fan-out as the refresh pipeline: recomputes `quantity` per listing's own settings group and pushes to eBay (`updatePriceAndStock`) + DB.
- **Quantity formula** (single source of truth, `ListingStrategyService.calculateQuantity`): `quantity = min(max(amazonStock − buffer, 0), defaultQuantity)`. Used by listing creation, the Keepa refresh pipeline, and the sale-driven queue identically.
- **Shared product stock**: `products.stock` is an ASIN-level cache shared across all customers. One customer's sale depletes it, so ALL listings sharing that ASIN are recomputed — each with its own group's `buffer`/`defaultQuantity` → different eBay quantities per seller.
- **Best-effort & idempotent**: stock sync is wrapped so it never fails order sync; the worker re-reads `products.stock` at execution time, so delayed/coalesced jobs re-push the correct current value. The Keepa refresh pipeline resets `products.stock` to Amazon ground truth.
- **Rate-limit hygiene**: BullMQ `jobId` bucketed per 5s window per product collapses a burst of sales into one job; `attempts: 3` + exponential backoff; `EbayService.withRateLimitRetry` honours `Retry-After` on 429/5xx.

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
- **Backend products**: `src/modules/products/` — ProductsService (price/image lookup, `decrementStock` for sale-driven stock sync)
- **Product refresh pipeline** (Keepa sole provider): `keepa.service.ts`, `refresh-scheduler.service.ts`, `refresh-processor.service.ts`, `keepa-usage.service.ts`, `product-sync.service.ts` — see "Product Refresh Pipeline" section above.
- **Sale-driven stock sync**: `src/modules/orders/stock-sync-queue.service.ts` (producer) + `src/modules/listings/stock-sync-processor.service.ts` (consumer) + `ProductSyncService.syncListingsForProduct()` + `ListingStrategyService.calculateQuantity()` (canonical quantity formula)
- **Frontend orders**: `apps/web/src/features/orders/` — list page, detail page, Amazon linking
- **Frontend Amazon**: `apps/web/src/features/amazon/` — accounts page, linking modal, RTK Query API
- **Shared**: `packages/shared/src/domain/orders/`, `packages/shared/src/domain/amazon/`, `packages/shared/src/schemas/orders/`, `packages/shared/src/schemas/amazon/`

## Architectural Rules

1. **Type Safety** — Types in `packages/shared/src/domain/`. No `any`. No duplicates.
2. **Validation** — Zod schemas in `packages/shared/src/schemas/`. Backend DTOs use `class-validator` but implement shared interfaces.
3. **UI & Styling** — Emotion with semantic tokens. No inline styles. No hardcoded colors (`#fff`, `rgba(...)`, etc.), spacing (`16px`, etc.), or magic numbers. Everything must be a theme token via `tkn()`. If a new color/spacing/value is needed, add it to `packages/ui/src/theme/` (designTokens, themes, tkn paths) first. Use `Icon` component, no inline SVGs.
4. **Forms** — Use `ModernTextInput` molecule. Inputs must use `React.forwardRef` and `value={value ?? ''}`.
5. **Loading & Errors** — `useLoading(isLoading)` for global UI overlay. `showMessage` from `UIContext` for errors. Loading state is business logic — it belongs in container files (`.container.tsx`), never in component files (`.component.tsx`). Component files must NOT render loading spinners or conditional loading UI; the container handles loading via the `useLoading` hook which shows a global overlay. The only exception is passing an `isLoading` prop to a Button atom for inline button spinner.
6. **Container/Component Split (strict, enforced by ESLint + PreToolUse hook)** — Every feature component is split into 4 files:
   - `[Name].component.tsx` — JSX markup only. Allowed hooks: `useTranslation`, `useTheme`. Forbidden: `useState`, `useEffect`, `useMemo`, `useCallback`, `useReducer`, `useRef`, RTK Query hooks (`useQuery`/`useMutation`/`useLazyQuery`), `useSelector`, `useDispatch`, `useNavigate`, formatters (`formatCurrency`, etc.), event handlers. Forbidden: `styled(...)`.
   - `[Name].container.tsx` — All logic. Forbidden: `styled(...)`. JSX is allowed only as `<Component .../>` return.
   - `[Name].style.ts` — All `styled(...)` calls.
   - `[Name].types.ts` — `interface`/`type`/`enum` declarations only.

   **Atoms/Molecules** (`packages/ui/src/{atoms,molecules}/`) follow the same rules. **Stateful** atoms/molecules (Select, Dropdown, Tooltip, etc.) MUST split into `.container.tsx` + `.component.tsx` like features. **Stateless** atoms/molecules (Button, Badge) stay as `.component.tsx` + `.style.ts` + `.types.ts`.

   **Exempt:** `apps/web/src/features/landing/**`, `apps/web/src/**/api/*.ts(x)`, `apps/web/src/app/store.ts`, `apps/api/**`, `*.config.{ts,js,mjs,cjs}`.

   Enforced by `design-system/styled-only-in-style-files`, `design-system/types-only-in-types-files`, `design-system/logic-only-in-container`, `design-system/no-styled-in-container` ESLint rules, and by `.claude/hooks/pretooluse-frontend-rules.js` (Write/Edit/MultiEdit).
7. **Shared Utilities** — Reusable formatting and locale utilities (e.g., `formatCurrency`, `formatCompactNumber`, `formatDate`, `getLocaleConfig`) live in `packages/ui/src/utils/`. Import from `@repo/ui`. Never define them locally in component or container files.
8. **Design System Only (no custom UI primitives)** — All UI primitives (inputs, selects, checkboxes, buttons, modals, dropdowns, toggles, date pickers, etc.) MUST come from `packages/ui` (atoms or molecules). Never use native HTML elements (`<select>`, `<input>`, `<button>`, etc.) or build custom form controls directly in feature code. If a needed component doesn't exist in the design system, create it there first as an atom/molecule, then use it. This ensures consistency and reusability across all screens.
9. **MessageModal for success/error/info/warning messages** — All informational and error messages MUST use the `MessageModal` molecule via `showMessage` from `UIContext`. Never use native `alert()`/`confirm()`, create custom modal implementations, or bypass this pattern. `MessageModal` provides consistent styling with type-appropriate icons (success=check-circle, error=x-circle, warning=alert-triangle, info=info) and proper button handling.
10. **No hardcoded status/constant strings** — All status values, type discriminators, and constant strings MUST be defined as enums in `packages/shared/src/domain/`. Never use string literals like `'active'`, `'draft'`, `'custom'`, `'predefined'`, etc. directly in code. Use the corresponding enum (e.g., `ListingStatus.ACTIVE`, `TemplateType.CUSTOM`, `PolicyType.PAYMENT`, `OrderStatus.SHIPPED`, `EbayAccountStatus.ACTIVE`). If a new constant is needed, create or extend an enum in the shared package first.
12. **No hardcoded UI strings — all text via i18n** — Every user-visible string (labels, buttons, messages, placeholders, tooltips, table headers, empty states, counts, etc.) MUST use i18n `t()` with keys defined in `packages/shared/src/i18n/resources/{en,tr}/`. Never write raw text like `<Text>Clear</Text>` or `{listings.length} results` directly in JSX. The only exceptions are: (a) universal symbols like `—` (em dash) used as empty-value placeholders, (b) numeric/format values produced by formatters (`formatCurrency`, `formatDate`, etc.), and (c) string literals passed to `t()` as keys. If a new string is needed, add the key to **both** `en/` and `tr/` JSON files first, then use `t('namespace.key')` in the component.
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
- **Font**: Inter (headings) + Lexend (body/UI). Loaded via Google Fonts in `apps/web/index.html`; tokens in `packages/ui/src/theme/designTokens.ts` (`fontFamily.heading` = Inter, `fontFamily.body`/`sans` = Lexend, `mono` = JetBrains Mono).
- **Sidebar nav**: Inventory section (Dashboard, eBay Listings, Listing Jobs, Products, Orders, Stores) + Configuration section (Settings). Single Settings nav item (hub consolidation TBD in Plan 5).

Redesign spec: `docs/superpowers/specs/2026-07-03-figma-site-refactor-design.md`.

## Frontend Rules (Quick Reference)

See `.claude/skills/frontend-rules/SKILL.md` for the canonical version.

### File organization
4 files per feature component: `.component.tsx` (markup only) / `.container.tsx` (logic) / `.style.ts` (styled) / `.types.ts` (types). Stateful atoms/molecules (Select, Dropdown, etc.) also need `.container.tsx` + `.component.tsx` split. Stateless atoms (Button, Badge) stay as `.component.tsx` + `.style.ts` + `.types.ts`. Exempt: landing, RTK api files, store.ts, configs.

### Anti-patterns (will be blocked by hook + lint)
- `styled(...)` outside `.style.ts`
- `useState`/`useEffect`/RTK Query/etc. in `.component.tsx`
- `interface`/`type`/`enum` outside `.types.ts`
- Hardcoded hex/rgb colors (use `tkn('colors.*')`)
- Hardcoded px/rem spacing (use `tkn('spacing.*')`)
- `style={{ }}` inline styles
- `styled.h1`/`styled.p` (use `<Text variant="...">`)
- Raw `<select>`, `<input>`, `<button>`, native HTML form controls
- `alert()`/`confirm()` (use `MessageModal` via `showMessage`)
- Hardcoded status strings like `'active'` (use enums from `packages/shared`)
- Hardcoded UI strings (use i18n `t()`)

### Atom extension pattern in `.style.ts`
Empty template literal + variant/weight/size props in JSX. Layout CSS only in template (margin/gap/flex/grid/position/dimensions). No font-size/font-weight/color/background/border/shadow in template — those go in props.
