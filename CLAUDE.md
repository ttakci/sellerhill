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

Packages must be built before apps can run (`pnpm dev` handles this automatically). `apps/api` has a **minimal Jest harness** for pure-logic helpers only: `pnpm --filter api test` (config at `apps/api/jest.config.js`, CJS + ts-jest, with a `@repo/shared → dist/cjs` moduleNameMapper and a `uuid` CJS shim for uuid@13 ESM). Covered: `profit-calculation.ts`, `order-matcher.ts`, `pick-best-match.ts`, `amazon-order-parser.service.ts`, `google-link-decision.ts`. DB/queue/NestJS layer is still manual-verified — integration tests are deferred (deliberate, not a gap). `apps/web` has no tests yet.

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
- **`amazonTaxRate`** (`store_settings.amazon_tax_rate`, migration `035`): per-user global percent 0–100, default `0`. User-configurable in Settings → StoreSettingsDrawer. Used by `OrderSyncService.recomputeProfit` to estimate provisional order profit when the real Amazon tax is unknown (see "Net Profit Formula" below). The Save handler writes the column for ALL of the user's `store_settings` rows (global + per-store) so the resolved value is consistent everywhere — the upsert path must NOT skip the column on the `UPDATE` branch.

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

- **Product**: Source of truth from Amazon (ASIN, images, price, features). Cached to save API costs. Shared ASIN-keyed across all users.
- **Listing**: An active offer on eBay. Linked to a Listing Setting Group **and** an eBay account (`listings.ebay_account_id`, multi-store). Per-listing automation overrides live on the listing row (pause sales, fixed price/qty, margins).
- **Listing Setting Group**: Repricing strategy, stock buffer, fees, HTML templates, plus **content policy** (`content` JSONB: strip brand from title, optional AI title/description flags). Multiple listings share one group.
- **Order**: An eBay sale. Linked to a Listing (`listing_id`) and eBay account (`ebay_account_id`). Product info via listing→product JOIN. Financials on both eBay and Amazon sides.
- **Amazon Account**: Buyer Amazon account for order scraping. AES-256-GCM credentials. Multiple per user.
- **eBay Account**: Connected store(s). Multi-store filtering on listings + orders by `ebayAccountId`. OAuth tokens are **encrypted at rest** (AES-256-GCM via `AMAZON_ENCRYPTION_KEY`, `enc:` prefix in `ebay_accounts.access_token`/`refresh_token`; `EbayService.onModuleInit` lazily re-encrypts legacy plaintext rows). All API callers must obtain tokens via `EbayService.getActiveAccountAccessToken(userId)` / `getAccountAccessToken(accountId)` — never read the raw columns.

## Product Refresh Pipeline

Amazon product data (metadata + Buy Box price + Buy Box stock) is sourced **exclusively from the Keepa API** — one provider, one query shape for every call (create + refresh alike): `history=0&stats=90&offers=20&only-live-offers=1&stock=1`. ScraperAPI was removed: its per-request credit model is 10–100× more expensive than Keepa's token pool under bulk-add/churn. **Full technical reference (verified cost model, response ground truth, invariants, probe procedure): [docs/keepa-integration.md](docs/keepa-integration.md) — read it before touching any Keepa code.**

**Token cost model (verified against live responses, 2026-07-28):** Keepa charges are conditional — `offers` costs **6 tokens per FOUND page of 10 live offers** when Keepa refreshes its offer cache, **0 tokens** when its cache is <1h fresh, and `stock=1` adds **+2 only when the stock observation is fresh**. Observed real costs for the same query ranged 0–6 tokens/ASIN. Therefore: (a) accounting always uses the response-reported `tokensConsumed`, **never** a locally-estimated per-ASIN count; (b) `history=0`/`stats`/`only-live-offers` are payload optimizations, **not** token savers. Real Buy Box stock requires `offers` — the old `stock=1`-without-`offers` call did not return usable per-seller stock.

### Shared product cache
`products` is a shared ASIN-keyed cache — one ASIN exists once regardless of how many users list it. One customer's data fetch serves every customer listing that ASIN. There is **no per-user Keepa cost isolation**; costs are attributed via fair-split (see Token tracking below).

### Stale-driven scheduler + batch worker
There is **no "refresh everything every N hours" cron**. Instead a `keepa-refresh` BullMQ queue with two roles:
- **Scheduler** (`RefreshSchedulerService` registers the tick; disabled entirely when `KEEPA_REFRESH_ENABLED=false`): every tick runs an **atomic claim** — `FOR UPDATE SKIP LOCKED` CTE that selects the most-overdue products **having ≥1 ACTIVE listing** and pushes their `next_refresh_at` forward by a short lease (`KEEPA_REFRESH_CLAIM_LEASE_MINUTES`, default 15) in the same statement — then enqueues **one** `refresh-batch` job. Overlapping ticks/parallel workers can never double-claim rows; a crashed batch's rows become due again when the lease expires. Products whose listings are all draft/ended are **not** refreshed (no eBay surface to update — this is a scope rule, NOT per-product sales-velocity tiering, which is explicitly not done).
- **Worker** (`RefreshProcessorService`): one bulk Keepa call per batch (`KeepaService.getProducts` dedupes ASINs and chunks internally at Keepa's 100-ASIN/request limit, summing `tokensConsumed` across chunks) → captures balance → per-product compare + update + fan-out. Per-product failures are isolated inside the batch; a transport failure (429/5xx/network) propagates so BullMQ retries the whole batch idempotently (rows stay claimed during retries).

### Stock semantics (three-state, unknown-preserve)
`KeepaStockStatus` (`known|out_of_stock|unknown` in `packages/shared`): the normalizer (`keepa-normalizer.ts`, pure + fixture-tested) matches the **Buy Box offer by sellerId** in `liveOffersOrder` and reads the last `stockCSV` observation; falls back to `stats.stockBuyBox` / `stats.stockAmazon` (Amazon caps at 1000). `OUT_OF_STOCK` (stock 0) only when live-offer retrieval **succeeded** and no live offer + no price exists. Anything ambiguous → `UNKNOWN`: the worker **preserves the previous price/stock** — Keepa failing to observe is never evidence of $0/qty-0. Keepa price sentinels (`-1` no data, `-2` no Buy Box) are treated as null, never real prices. `totalOfferCount` is **never** used as a stock quantity. `images` array (modern) is preferred over legacy `imagesCSV` (live responses can null the CSV).

### Field change-detection
`commerceChanged` (price/stock) triggers the eBay fan-out (`ProductSyncService.updateAllListingsForProduct` — pushes only where a listing's own price/qty actually changed); `metadataChanged` (title/brand/description) persists to the products row **without** fan-out. eBay API volume stays proportional to real changes.

### Failure handling & poison-product quarantine
- **Transport failure**: BullMQ exponential backoff retries the batch; rows stay claimed (lease), then become due again if all attempts fail.
- **Data failure** (ASIN missing from an otherwise-successful response): `consecutive_failures++` with **escalating backoff 5m → 15m → 60m → 240m** (`refresh-backoff.ts`, tested) so a dead ASIN can't burn tokens every tick; at/above `KEEPA_REFRESH_MAX_FAILURES` it is quarantined (`KEEPA_REFRESH_QUARANTINE_MINUTES`).

### Config-driven frequency (no rewrite to change cadence)
All env (defaults shown), all optional:
- `KEEPA_REFRESH_ENABLED=true` — master switch; `false` removes the repeatable tick (create-path calls unaffected).
- `KEEPA_REFRESH_INTERVAL_MINUTES=720` (12h). Dial to 360/180 by env only.
- `KEEPA_REFRESH_BATCH_SIZE=50` — products claimed per tick (chunked at 100/request internally, so >100 is safe).
- `KEEPA_REFRESH_CLAIM_LEASE_MINUTES=15` — claim lease; must exceed worst-case batch runtime incl. BullMQ retries.
- `KEEPA_REFRESH_SCHEDULER_CRON=* * * * *`, `KEEPA_REFRESH_WORKER_CONCURRENCY=1`, `KEEPA_REFRESH_QUARANTINE_MINUTES=1440`, `KEEPA_REFRESH_MAX_FAILURES=5`.
- `KEEPA_UPDATE_HOURS` (unset by default) — Keepa-side cache tolerance: serve Keepa's own cached offer data younger than N hours for ~0 tokens instead of forcing a live scrape (6 tokens/found page). Popular ASINs are refreshed by other Keepa customers, so raising this materially cuts spend; keep well below the refresh interval. `update=-1` (never refresh) is deliberately unsupported — niche ASINs would go permanently stale.

Budgeting: the offers+stock query costs ~6–14 tokens/ASIN on offer-cache refresh (0 when cached). Sustainable throughput ≈ `refill_rate_per_min / avg_tokens_per_asin`; e.g. 20 tpm ÷ 8 ≈ 2.5 ASIN/min ≈ 3.6k ASIN/day. `keepa_balance.refill_rate` (migration `055`) records the plan tier from each response.

### Token tracking (cost attribution)
- `keepa_usage_log` — one row per **requested** ASIN per refresh (fair share = batch `tokensConsumed` / requested-ASIN count — missing ASINs still get their row, so their users are not subsidized by users of returned ASINs), `source ('refresh'|'create')`, `user_ids` (JSONB array of users actively listing the ASIN). Append-only.
- `keepa_balance` — `tokens_left`/`refill_in_ms`/`refill_rate` snapshots captured from **every** Keepa response (refresh + create paths).
- **Admin per-user monthly cost (fair-split):** `SELECT uid, SUM(tokens / jsonb_array_length(user_ids)) AS tokens FROM keepa_usage_log CROSS JOIN LATERAL jsonb_array_elements_text(user_ids) AS uid WHERE requested_at >= date_trunc('month', NOW()) GROUP BY uid ORDER BY tokens DESC;`
- No UI yet (admin reads tables directly). Token-balance-driven admission control is deferred until real utilization data accumulates.

### Listing creation path
`ListingProcessorService` (the `listings` queue worker) resolves product data via `resolveProductData`: cache hit (valid title + ≥1 image) → **0 Keepa tokens**; cache miss → a **pg advisory lock keyed on the ASIN** serializes concurrent creates (recheck-after-lock), so N parallel jobs for one uncached ASIN make exactly **one** `getProductDetailsWithMeta` call. Usage + balance are logged from response meta **before** product validation — tokens charged for empty/invalid responses stay in accounting. New product rows get `next_refresh_at = NOW() + 12h` on insert (`findOrCreateProduct`). On the create path only, `UNKNOWN` stock normalizes to 0 (no previous value exists to preserve; live publish blocks at qty 0, drafts allowed).

### Listing quality: description template, item specifics, identifiers

The published eBay listing is built from three independent pieces. All three had defects that were visible on live listings (raw `{{{product_description}}}` text, a collapsed description box, three item specifics with a literal "Unknown"), so the rules below are load-bearing.

**1. Description — ONE renderer, shared by preview and publish.** `renderListingTemplate` + `buildListingTemplateContext` live in `packages/shared/src/utils/listing-template.ts` and are used by BOTH `ListingStrategyService.processDescriptionTemplate` (what eBay receives) and the settings-drawer live preview. They previously were two implementations with two vocabularies: the preview understood the Mustache syntax every seeded template is written in, the backend understood only `{{title}} {{description}} {{brand}} {{features}}` **and ignored PREDEFINED templates entirely** (`TODO: Handle predefined templates`), so a user's chosen design either never shipped or shipped with unrendered placeholder text.
- Supported syntax: `{{key}}` (escaped; an array renders as `<ul>`), `{{{key}}}` (raw), `{{#key}}…{{.}}…{{/key}}` (section/repeat), `{{^key}}…{{/key}}` (inverted). Canonical keys: `title`, `product_description`, `feature_bullets`, `product_details`, `main_image`, `images`, `brand`, `manufacturer`, `asin`, `category`, `condition`, `price`, `currency`, `quantity`. Legacy aliases (`description`, `features`, `specs`, `image`) still resolve.
- **Three presence flags — `has_features`, `has_details`, `has_images`** (`LISTING_TEMPLATE_PRESENCE_FLAGS`) exist because a section cannot nest inside a section of the **same** key (the closer is matched by backreference), so `{{#product_details}}` cannot both wrap a heading and repeat its own rows. Without them a spec-less product renders a styled heading over a void. They are scalars (`'1'` / `''`, never `'0'` — `isEmptyValue('0')` is false), used only as `{{#has_details}}…{{/has_details}}`, and are deliberately **not** in `LISTING_TEMPLATE_PLACEHOLDERS` (inserting `{{has_features}}` would print a bare `1`).
- `stripUnresolvedPlaceholders` runs last, so **template syntax can never reach a buyer**. Any new placeholder is added in the shared module once — never in one surface only.
- **Three placeholders are silently wrong or empty on a live listing and must never appear in a template**: `condition`/`quantity` are never passed by `processDescriptionTemplate`, and **`price`/`currency` carry the AMAZON SOURCE price** — `processDescriptionTemplate` runs at `listing-strategy.service.ts:61`, *before* `calculatePrice` (line 96), and builds its context from `product.price.current`, so publishing them puts the seller's cost in front of the buyer. `asin` is an Amazon identifier in buyer-visible text. No catalog template uses any of them and `predefined-templates.guard.spec.ts` enforces it; **fixing the price context itself (render the description after pricing) is still open.**
- PREDEFINED templates resolve through `ListingSettingsGroupService.getPredefinedTemplateHtml(id)` (5-min in-process cache); a missing id degrades to `DEFAULT_LISTING_TEMPLATE_HTML`, never to an empty description.

**1a. The template catalog is DATABASE DATA, not code (2026-08-09).** `predefined_templates` used to be a materialized copy of a hardcoded TS array that `ListingSettingsGroupService.onModuleInit` upserted by name on every API boot. That seed, its duplicate self-heal and its group-repointing logic are **deleted**; the catalog now lives in migrations `070` (structure) + `071` (the 8 templates).
- **`slug` is the stable natural key** (migration `070`: derived from `name`, `NOT NULL`, `UNIQUE`). It has to be: `id` is a random UUID referenced from `listing_settings_groups.templates->>'predefinedTemplateId'` **inside JSONB, with no foreign key**, and every deployed database already held rows minted by the old boot seed. A migration that merely INSERTed the catalog would not adopt them — it would create a second copy and detach every user's template choice, which then degrades silently to the default template while the UI keeps showing the chosen name.
- **`id` and `created_at` are never in a catalog upsert's `DO UPDATE SET` list.** This is the single most important line in `071`. `070` also ports the old self-heal into SQL **once** (repoint groups → then delete duplicates, partitioning on the *derived slug* rather than `name`, with a `jsonb_typeof(...) = 'object'` guard because `jsonb_set` on a scalar raises and would roll back the whole boot-time migration run). The UNIQUE index then makes duplicates structurally impossible, which is what replaces the self-heal.
- **To change or add a template: copy `071` to a new migration number.** An applied migration never re-runs, so editing `071` is a silent no-op. Do NOT restore a boot-time seed — the guard spec greps for it.
- `is_active` soft-retires a template: hidden from the picker (`getPredefinedTemplates`), still resolvable by `getPredefinedTemplateHtml` so listings already on it keep rendering it. **Never DELETE a catalog row** — there is no FK to protect it. `sort_order` drives picker order, because adopted rows keep old `created_at` while new rows share one `NOW()`.
- **Catalog (8):** `modern-professional`, `elite-trust`, `spec-sheet` (technical table), `gallery-grid` (the only one using `{{#images}}`), `minimal-mono` (**zero `<img>` — the option for a seller who wants no Amazon-hosted image URL in the page source**), `boutique-card` (serif, home/beauty/fashion), `compact-mobile`, `brand-story`. Names/descriptions are localized off the slug via `apps/web/src/features/settings/utils/predefinedTemplateLabel.ts` (used by BOTH the picker and the group-card badge), falling back to the DB name when a translation is missing.
- **Authoring rules, all enforced by `apps/api/src/modules/listings/predefined-templates.guard.spec.ts`** (parses `071`, renders each template with and without data): survives `sanitizeListingHtml` **untouched**; no `<link>`/`<script>`/`<iframe>`/`<form>`/`<meta>`/`<base>`/`<object>`/`<embed>`, no `on*=`, no `<a href>` (eBay forbids off-site links and the sanitizer does *not* strip them), no web fonts/`@import`/`data:`; no banned placeholder; no `{{` left in either render; balanced sections; **every CSS selector starts with a class** (the drawer preview injects this HTML into the app document, so a bare `h1 {}` would restyle the app) and no attribute selectors; every `{{#key}}` present in `sample_data`; images `max-width:100%` + `height:auto`. **The source marketplace name may occur ONLY inside a real product-image `src` URL** (Keepa image URLs are source-hosted); it is forbidden in visible text, class/style names, alt text and every other attribute. The guard renders representative source-hosted URLs, removes only `src` values, then scans the entire remaining markup. `minimal-mono` remains the strict zero-source-URL option. The sanitizer-untouched assertion is the regression test for the bug that started this: Elite Trust shipped a Google Fonts `<link>` that `sanitizeListingHtml` strips, so it never got the font it styled for.
- **Two eBay description fields, two limits**: `offer.listingDescription` (500,000 chars) is what buyers read; `inventoryItem.product.description` (4,000) is catalog metadata. Both were truncated at 4,000 with `substring`, which cut styled HTML mid-tag. Use `truncateHtml` (tag-boundary safe) with `EBAY_DESCRIPTION_MAX_LENGTH` / `EBAY_INVENTORY_DESCRIPTION_MAX_LENGTH`.
- `sanitizeListingHtml` strips XSS **and** eBay active-content (`iframe`/`form`/`object`/`embed`/`meta`/`link`). `<style>` is deliberately kept — every template needs it. AI-rewritten descriptions go through the same sanitize + truncate path.
- **Store-settings blacklist checks buyer-VISIBLE text** (`extractVisibleText`), never raw markup. Keepa image URLs are Amazon-hosted (`images-na.ssl-images-amazon.com`), so once templates started rendering `{{main_image}}` the near-universal "amazon" keyword matched the template's own `<img src>` and rejected every listing — over a string no buyer sees. Class names and inline styles are excluded for the same reason. Note the URL genuinely does carry the word: a seller who wants zero Amazon fingerprint in the description must drop `{{main_image}}`/`{{images}}` from their template (the eBay gallery images are uploaded separately and are unaffected).

**2. Item specifics — category-aware, always resolvable, never fabricated.** `apps/api/src/modules/ebay/aspect-builder.ts` (pure, Jest-covered) maps product attributes onto the aspects the **resolved category actually declares**, fetched via `get_item_aspects_for_category` as full metadata (required flag, `SELECTION_ONLY` allowed values, max length, cardinality) and cached per category for 1h. Rules:
- The category is resolved **before** the inventory item is built (it used to be PUT first with a Brand-only aspect map).
- Values are matched to allowed lists (exact → case-insensitive → containment); an unmatchable value is dropped, not forced.
- Amazon↔eBay naming differences go through the synonym table (`Part Number`→`MPN`, `Colour`→`Color`, …), not ad-hoc string compares.
- **"Unknown" is never published, and a required aspect is never left empty.** `pickTerminalValue` (`aspect-priors.ts`, pure + matrix-tested) guarantees a value for every category shape: eBay's own non-value (`Does Not Apply`/`Unspecified`) → a catch-all (`Unisex Adult`, `Other`, `One Size`) → a deterministic allowed value that asserts no measurement. Free-text aspects get `Does not apply`, Brand gets `Unbranded`.
  **This is the fix for the whack-a-mole class of failure** (`eBay requires the item specific "Department" for category 260988 …`): a required `SELECTION_ONLY` aspect used to be dropped when nothing matched, so eBay refused the publish, the retry loop forced it once, it was dropped again, and the listing died with advice the UI gave no way to act on. Turn the guarantee off per call with `allowTerminalFallback: false` (the probe script and tests use it).
- **Custom specifics.** eBay accepts up to `EBAY_MAX_ITEM_SPECIFICS` (45) name/value pairs and does NOT restrict names to the declared list — the strongest listings on the platform carry the source catalogue's whole attribute table. Everything harvested that the category did not declare is emitted as free-text specifics, required aspects first so they can never be crowded out. Marketing headlines are filtered out of feature-bullet scraping (a key must be ≤3 words, digit-free, with a non-sentence value; `LARGE 48OZ. CLEAN WATER TANK:` was reaching live listings as an item-specific name).
- **The model is a gap-filler, never a resolver.** The ladder runs the cheap deterministic layers first; only required aspects that product data, curated defaults, learned values and priors ALL failed to fill reach the LLM, capped per listing. Its pick is validated against eBay's allowed list (an invented value is discarded, not published) and learned for the category. With it off, the terminal fallback still guarantees a publishable listing.
- Provenance is recorded per aspect (`AspectResolutionLayer`: `product_data | curated | learned | prior | llm | terminal_fallback`) and logged as a one-line `product_data=13 prior=2` summary on every create — the diagnostic that replaces guessing.

**3. Catalog identifiers.** eBay validates Brand and MPN as a **pair** (`<BrandMPN>`): sending a brand with no MPN fails with "Input data for tag <BrandMPN> is invalid or missing". When no usable part number survives the GTIN/brand checks, `product.mpn` falls back to eBay's documented non-value rather than being omitted. `product.brand` / `mpn` / `upc` / `ean` are sent on the inventory item — this is what triggers eBay catalog matching and auto-enriched specifics. GTINs pass a GS1 check-digit test (`common/utils/gtin.ts`) first: a malformed UPC fails the entire publish.
- **A barcode is never an MPN.** Amazon fills `partNumber` with the product's UPC for most grocery/consumable ASINs, and eBay then rejects the publish outright (`Input data for tag <BrandMPN> is invalid`, `MPN has an invalid value of "021500000529"`). `asPartNumber` (keepa-normalizer) drops GTIN-shaped part numbers at extraction, `matchAspectValue` rejects them for MPN/Model-class aspects (a "Part Number: <upc>" feature bullet takes that route), and the eBay client omits `product.mpn` as a last check. Leaving MPN blank is explicitly allowed by eBay; the required-aspect fallback then supplies `Does not apply`.

**Keepa attribute extraction** (`extractProductAttributes` in `keepa-normalizer.ts`, pure + tested) is the source for 2 and 3, and its field names MUST match the official Keepa schema (keepacom/api_backend `Product.java`). It harvests ~30 attributes: `color`, `size`, `pattern`, `style`, `scent`, `itemForm`, `itemTypeKeyword`, `targetAudienceKeyword`, `audienceRating`, `materials[]` (the singular `material` is deprecated), `includedComponents`, `recommendedUsesForProduct`, `specificUsesForProduct[]`, `specialFeatures[]`, ingredients, `safetyWarning`, `productBenefit`, `itemHighlights`, battery flags, `unitCount{unitValue,unitType}`, counts, weights/dimensions (metric → US display units), `variations[].attributes[]` for THIS asin, `hazardousMaterials[]`, `upcList`/`eanList`/`gtinList`, `partNumber`, media fields. Sentinels (`-1`) and placeholder text (`Unknown`, `N/A`) are dropped.
**Do not invent field names here.** An earlier version read `flavor`, `department`, `genre`, `platform` and `variationAttributes` — none of which Keepa sends — while ignoring the ~15 attributes above that it does. That, not eBay, is why listings published with three item specifics next to a competitor's thirty.

**Persistence (migration `060`)**: `products.specs`, `products.identifiers` (JSONB) and `products.manufacturer`. Both attribute maps use grow-only writes (an empty new map never erases a richer stored one). `getProductByAsin` re-derives specs from stored `raw_keepa_data` when the row predates extraction, so an existing catalog produces full specifics with **zero** extra Keepa tokens; the refresh worker also treats "row has no specs" as a metadata change so backfill happens on the normal cycle. That read path also previously selected neither `features` nor `currency` while mapping them — every **cache hit** silently published a listing with no feature bullets.

**Titles**: `listing-title.ts` (pure + tested) normalizes whitespace/control chars and truncates at a **word boundary** with dangling separators removed. The old `slice(0, 80)` cut mid-word.

**AI title rewrite — the model proposes, code enforces (2026-07-31).** eBay ranks on the title, so all 80 characters are search surface. Three defects made the AI path actively worse than the deterministic one, all fixed and locked by tests:
- **The model saw the wrong input.** `rewriteTitle` was handed `baseTitle` — already brand-stripped and cut to 80 — so a 197-character Amazon title arrived pre-truncated and `1.19oz(34g) x 4ea` / `Korean Skin Care` were gone before the model could weigh them. It now receives `product.title`, the full source, and is judged against it.
- **Small local models cannot count characters.** Asked for 65-80 they answer 40-50 and drop identifiers. Rather than fight that with prompting, `expandTitleWithSourceKeywords` packs the unused budget with source keywords the model left behind — **identifiers first** (`48mm`, `50g`, `G5`), then remaining words in source order. Deduplication compares the whole title as an alphanumeric blob, because `1.19oz (34g)` and `1.19oz(34g)` are the same information written differently; tokens are split on commas too (Amazon writes `Levels,50g`). Bare numbers are never appended — `… Single Dose 36` is noise.
- **The model could undo the seller's brand setting.** With `stripBrandFromTitle` on, the prompt forbids the brand AND `stripBrandFromTitle` (now shared, pure) is re-applied to the model's output.
Packing appends **identifiers first** (`48mm`, `50g`, `G5`), then whole comma/pipe-delimited **phrases** (`Pastel Barrels` reads like a seller title; word-by-word packing produced `... 40-Count Lead Resists Bulk`), then single words for whatever budget is left. A phrase is skipped when half its words are already present, so it cannot restate the model's own answer. `ensureBrandPrefix` puts a dropped brand back at the FRONT — the packer would otherwise append it at the end (`... Pastel Barrels BIC`).

Two guards remain: a reply shorter than 8 characters is rejected **before** packing (padding must not rescue noise), and `isTitleRewriteAcceptable` rejects a final title under 60% of the budget or one that dropped every source identifier — in which case the deterministic title wins. **The AI path can never publish a worse title than the deterministic one.**

**Conditions**: `listing-condition.ts` maps Renewed/Refurbished → `USED_EXCELLENT` and Open Box → `NEW_OTHER`. The previous `LIKE_NEW` is only valid in a few media categories and failed the publish elsewhere.

**Create-path integrity (each of these was a live bug):**
- Running out of publish attempts is a **`ListingPublishExhaustedError`**, never an empty success. The original loop `return`ed `{ listingId: '' }` and both write sites recorded an ACTIVE listing with an empty `ebay_item_id` — a listing that does not exist on eBay, can never be matched to an order (order sync keys on that column), and blocks re-listing the ASIN. The batched path carries the same rule: a per-entry failure is JSON rather than a throw, so `BulkListingOutcome.errorName` ferries the type across and the caller reattaches it to the `Error` (the classifier keys on `Error.name`). Both write sites guard on `!outcome.ok || !outcome.listingId`.
- Category resolution **throws `CategoryResolutionError`** instead of falling back to `categoryId: '1'` (eBay's root, not a listable leaf — a guaranteed later failure whose message never mentioned the category).
- Aspect metadata **serves a stale cached copy, then throws `CategoryAspectsUnavailableError`** instead of returning `[]` (which published a Brand-only listing that then failed on every required specific in turn).
- Every create-path eBay call is wrapped in `withRateLimitRetry` (429/5xx). Aspect retry budget is **3, not 5** — with the terminal fallback a third attempt cannot succeed.
- Typed failures live in `ebay.errors.ts`; `listing-invariants.guard.spec.ts` source-greps all of the above so they cannot silently regress.

**4. The learning layer (migration `062`).** Three tables turn "resolve it again from scratch every time" into "ask once per category":
- `ebay_category_aspects` — taxonomy metadata cache. On a taxonomy outage a **stale snapshot is served with a warning**; an empty aspect list is never a valid answer.
- `ebay_category_map` — category resolution per `asin | amazon_category | query` scope, plus operator pins (`is_locked`, never overwritten by a cached taxonomy answer). A DB CHECK constraint refuses category `1`.
- `ebay_aspect_defaults` — `curated` (operator, at most one per aspect, may outrank product data) and `learned` (many candidates ranked by publish success). `AspectResolverService` reads one row set per category, **revalidates every stored value against the category's current allowed list** (eBay retires values), writes back successes fire-and-forget, and demotes a value eBay rejects (`confidence − 20`, stale at 0). A DB outage there degrades to the pure layers — it never blocks a listing.
- `EbayTaxonomyService` owns both caches (memory → DB → eBay → stale → throw). `ebay.service.ts` no longer holds taxonomy state.
- Per-listing audit on `listings`: `ebay_category_id`, `aspect_resolution` (JSONB: layer counts + per-aspect decisions), `aspect_autofilled_count`.

**5. Failure taxonomy (migrations `063`/`064`).** `classifyListingFailure` (pure, tested) maps our typed errors → eBay `errorId`/message shapes → HTTP status into `ListingFailureCode`, stored on `listing_job_items.failure_code` + `failure_details`. The seller UI shows ONLY the localized reason (`listings.jobs.failure.*`, EN+TR); the raw provider text and the per-item Retry action were both removed in 2026-08 — see "eBay API call budget & bulk writes". Migration `064` stores the settings group + policy ids on `listing_jobs` because the BullMQ payload that held them is gone once the job completes. A failed create is deliberately **not** parked as a DRAFT — `DRAFT` means "publish later", and `isAsinListed` would then block the user's own retry.

**6. Admin → Listing quality.** The third sanctioned admin write surface (after proxies and settings), because category defaults are shared across all customers. `GET /v1/admin/listing-quality/summary|defaults|categories`, `PUT`/`DELETE .../defaults`. A curated value for a `SELECTION_ONLY` aspect is validated against eBay's allowed list **before** storage (`listing-quality.helpers.ts`, Jest-covered) — otherwise the panel becomes a new source of publish failures. Deleting a curated row removes it; a learned row is marked stale instead, since its publish history is evidence.

**Diagnosis without publishing:** `pnpm --filter api ebay:aspect-probe -- --asin B0XXXXXXX [--category 260988]` prints the harvested attributes, the resolution table (aspect → value → layer → required) and the would-publish count, reading only the local product cache. Use it instead of publish-read-error-guess.

Known gap: listings already published with the broken description/specifics are **not** retroactively fixed — that needs a dedicated eBay revise batch (see "Deferred"). Phases still open from the approved plan: persisted curated/learned aspect defaults + taxonomy cache table, error taxonomy on `listing_job_items` + per-item retry, LLM aspect layer, admin Listing Quality tab.

### eBay API call budget & bulk writes (2026-08-09)

**eBay meters API calls PER APPLICATION, not per seller.** Every customer draws from one daily pool, so call volume — not customer count — is what runs out, and exhausting it stops that operation for *everyone*. Published defaults ([API Call Limits](https://developer.ebay.com/develop/apis/api-call-limits)): Inventory **2,000,000/day**, Feed 100,000, Account 25,000, Fulfillment 100,000, **Taxonomy 5,000**, Trading 5,000.

**The Feed API / LMS route is deliberately NOT taken.** Its per-seller limits scale better, but eBay forbids revising an Inventory-API-created listing through Trading (`bulkCreateOrReplaceInventoryItem` docs), and all LMS inventory feeds are Trading XML — adopting it is a one-way door that would strand the existing catalog, the aspect ladder, `bulk_migrate_listing` and migration `065`'s import. With bulk endpoints the Inventory quota sits at ~1% utilization at 1M listings, so there is no capacity argument for the switch.

**Everything that writes to eBay in volume goes through `EbayBulkService`** (`src/modules/ebay/ebay-bulk.service.ts`), 25 items per call:
- `updatePriceQuantity` — replaces a 4-call-per-listing path (`GET /offer?sku=` → `PUT /offer` → `GET /inventory_item` → `PUT /inventory_item`). At 400k updates/day that is 1.6M calls → **16k**.
- `createListings` — staged `bulk_create_or_replace_inventory_item` → `bulk_create_offer` → `bulk_publish_offer`, the failure set shrinking at each stage so one bad ASIN cannot cost the other 24 their listings. The **aspect self-heal loop is preserved**: only items eBay named a missing specific for are re-resolved (no eBay call — aspect metadata is cached) and replayed, bounded by `MAX_CREATE_ATTEMPTS = 3` per item. A replay always collides with the offer its first pass created, so `extractExistingOfferId` recovers the id rather than failing.
- **Chunking is size-only, never time-based.** A 3-ASIN job ships one call with 3 entries immediately; it never waits to fill a 25th slot.
- **Every eBay body comes from `ebay-listing-payload.ts`.** The rules encoded there (GS1 check digits, the BrandMPN pair, tag-safe truncation, the image floor) have each broken live listings once, so they are never hand-rolled at a call site. `listing-invariants.guard.spec.ts` greps this.
- **`locale` is required on every bulk inventory item.** The single-item `PUT /inventory_item/{sku}` needed only the `Content-Language` header, but `bulk_create_or_replace_inventory_item` validates a per-entry `locale` and rejects the **whole batch** without it (`User input error. Valid SKU and locale information are required for all the InventoryItems in the request`). It was missing, so every bulk-created listing failed while the UI showed only the generic "could not be created" — the raw text lives in `error-*.log`, not in the DTO (see "Failure text is split by audience"). eBay's `LocaleEnum` uses underscores (`en_US`), unlike the hyphenated header.
- **A missing response entry is a failure, never a success.** eBay answers 200/207 with per-entry `statusCode`; treating an absent entry as OK is how an ACTIVE row gets written for a listing that does not exist.
- **There is exactly ONE create implementation, and it is this one.** No kill switch, no per-item path, nothing to fall back to — a per-item fallback would cost 25× the quota for byte-identical output. `createListingWithRest` (the single-item loop in `ebay.service.ts`) is **deleted**: it rebuilt the same bodies, ran its own aspect self-heal loop, and charged the call budget *nothing*, so draft publishing was invisible to the governor. `ebay.service.ts` keeps only the read half, `prepareListingDraft` (location check + cached category/aspect resolution, no writes), which both callers use. The store is now **required** at enqueue (`400` when absent) rather than silently degrading to a per-ASIN path.
- **Draft publish is batched too.** `publishListing` / `publishListings` (`POST /listings/:id/publish`, `POST /listings/bulk-publish`) go through `EbayBulkService.createListings`: 100 drafts cost 12 calls instead of 300. Preparation stays per listing — a draft carries seller edits (title, price/quantity locks) a shared write path must not flatten — and so does the quota gate: each draft reserves its own slot before the write and every failure branch hands that one back, so a partial batch never holds a slot for a listing that does not exist. Drafts are grouped by eBay account first, because a bulk call carries exactly one seller token. Because a seller is waiting, publish acquires at `EbayCallPriority.INTERACTIVE` (full daily ceiling) while queue-driven creates stay `BACKGROUND` (against the reserve) — which is what makes the reserve mean what it says.
- **Drafts run through the same batch and stop before the writes.** A draft costs **zero** eBay calls — category and item specifics are resolved by `publishListing` later, itself batched — so draft→publish is 3 calls total, exactly what a direct create costs. A draft defers the quota, it never doubles it, and an abandoned draft costs nothing. The AI title generated at draft time is preserved at publish (`applyContentAi: false` there, and the stored title wins), so the LLM also runs once.

**Retry policy: three layers, only two of which can work.** `withEbayRateLimitRetry` (429/5xx, 4 attempts, `Retry-After`-aware) and the aspect self-heal (which *changes the input*) are where retries pay off. A blind job-level retry is not: by the time a failure is classified, transient causes are exhausted and what remains is a rejection of the input — wrong category, invalid identifier, missing policy — where the same request gets the same answer.
- `failPreparedItems` honours `failure.details.retryable`: an unretryable failure is terminal on its **first** attempt (`isTerminal = !canRetry || lastAttempt`). Without it a permanently broken ASIN re-paid Keepa, the LLM rewrite and the whole publish sequence three times (~27 eBay calls) to be refused again. The rule originally lived only in the deleted per-ASIN worker and had to be ported into the batch path — `failure-visibility.guard.spec.ts` is what caught the omission, which is the reason that guard exists.
- Batch items are always terminal — the other 24 succeeded, so re-running the job would re-attempt work that landed.
- **The seller-facing per-item Retry was removed (2026-08-09)**, endpoint and all. eBay quota is metered per application and shared by every seller, so a retry button spends a common resource on the attempt least likely to succeed. `failure-visibility.guard.spec.ts` locks the removal and the retryable-only rule.

**A job item must always reach a terminal state — this was broken and is now guarded.** `listing_job_items.status` defaults to `'DRAFT'`, so an item that is never processed *looks* like a draft listing. Two failures combined into a stuck job (observed live 2026-08-09: 4 ASINs → 2 `error`, 2 frozen at `draft`, job pinned at "processing" 2/4 forever):
- `processListingBatch` called `createListings` with no failure handling. Any throw in the write phase left the prepared items at the default status and the job could never complete, because `updateJobCounts` only finishes a job when `success + failed >= total`. `failPreparedItems` now closes them out (RETRYING while attempts remain **and** the failure is retryable, terminal ERROR otherwise, reservation released only when terminal).
- An outcome whose key was not in the batch context was silently `continue`d, and items eBay never answered for got no result at all. Both are now recorded as failures — same rule `correlateBulkResponses` applies to a missing response entry.
- The UI labels a job item's `draft` as **Queued**, not "Draft" (`listings.jobs.items.itemStatus.*`). It is a queue state, not a draft listing, and calling it "Draft" sent sellers looking for drafts that do not exist.

**Every failure carries a support reference.** `ListingFailureDetails.correlationId` is stamped by `ListingProcessorService.withTrace` from the ALS correlation context — the same id already threaded through HTTP → queue → Winston → `queue_observations`. The seller sees it under the failure reason, so a support case quoting it can be traced to the exact attempt instead of reconstructed from a timestamp and an ASIN. It is an opaque `req_<uuid>`: it identifies a request, not a user or a resource.

**A blacklist rejection is the seller's own setting, so say so.** `ListingStrategyService.validateListing` throws `"Description contains blacklisted keyword: X"`, which the classifier used to bucket as `UNKNOWN` → "The listing could not be created." — hiding a cause the seller could fix in one click. It is now `ListingFailureCode.BLACKLISTED_KEYWORD` with the matched keyword in `failureDetails.blacklistedKeyword`, rendered as "your blacklist blocked this (keyword: …)". Remember the blacklist matches buyer-VISIBLE text only, and that Keepa image URLs are Amazon-hosted — see the description-template notes above.

**Job cancellation (`POST /v1/listings/jobs/:jobId/cancel`).** The job details page offers Cancel, not Refresh — the page already polls every 3s, so a manual refresh only duplicated what was happening anyway. Semantics: **what went out, went out.** ASINs that already published keep their listings and their ACTIVE job items; everything not yet terminal is closed out as `ListingFailureCode.CANCELLED` and its billing reservation released, so a plan slot is never held for a listing that will never exist.
- Stopping the queue is done by a **flag the worker re-reads before each batch**, not by queue surgery: BullMQ jobs are enqueued without stable ids, so locating them would mean scanning the whole shared queue on every cancel. Already-queued jobs drain as one-DB-read no-ops, which is bounded and cannot miss a job.
- An **in-flight batch is allowed to finish** — its eBay calls are already spent, and abandoning it would leave listings on eBay with no row on our side. So `updateJobCounts` still runs after a cancel and must not recompute the status back to PROCESSING/COMPLETED; `ListingJobStatus.CANCELLED` is terminal and sticky (`CASE WHEN status = 'cancelled' THEN status ELSE …`).

**`listings.sku` + `listings.ebay_offer_id` (migration `067`)** are the precondition. The offer id was previously thrown away at create and re-fetched on every update (one of the four calls); the SKU was re-derived as `${asin}-NEW`, which is silently wrong in sandbox where create mints a timestamped SKU. Production SKUs are backfilled; pre-067 sandbox rows stay NULL.
- **Both columns are written at create** — the batch worker passes `sku` + `outcome.offerId` to `createListing`, and draft publish sets them on the row it flips to ACTIVE. They were missing from the INSERT for the migration's whole life, so *every* new listing came back NULL and kept paying the lookup the migration exists to remove. A draft legitimately has neither until it publishes.
- **A guessed SKU is never written back.** The fan-out still falls back to `${asin}-NEW` for pre-067 rows — it is the only way to address them — but `persistApplied` adopts it only when eBay resolved an offer from it (`sku = CASE WHEN v.offer_id IS NOT NULL THEN …`). Writing it unconditionally poisoned sandbox rows, whose real SKU can never match the guess, and a wrong SKU in this column is permanent. `listing-invariants.guard.spec.ts` locks both rules.

**Taxonomy was the real bottleneck, not Inventory.** `persistCategoryMappings` read an `AMAZON_CATEGORY` cache scope it never wrote, and the `QUERY` key is a brand+title hash — unique per product — so **every new ASIN burned one of 5,000 daily calls** (200k ASINs ≈ 40 days). It now writes that scope keyed on the **full Keepa category path** (`products.category_path`, migration `068`, backfilled in SQL from `raw_keepa_data` at zero provider cost). The leaf name alone is too weak: "Accessories" recurs under unrelated departments and one wrong answer would mis-file a whole niche. Precedence is unchanged — ASIN → Amazon category → query, with an operator's locked pin above all — so a bad generalization is always correctable.

**`EbayCallBudgetService`** (`src/common/ebay-budget/`) is a Redis Lua token bucket, per resource, keyed on the UTC day. It is **`@Global` and lives in `common/`, not in `EbayModule`** — AdminModule must read it, and importing EbayModule there would close the `Ebay → Llm → Admin` cycle that `module-cycle.guard.spec.ts` prevents.
- Background work acquires against `limit − EBAY_BUDGET_RESERVE_PERCENT`; interactive calls get the full ceiling, so a night of refreshing can never leave a seller unable to publish.
- Budget is charged **before every attempt** inside `withEbayRateLimitRetry` — a retry is a real call eBay counts.
- **Exhaustion defers, it does not fail.** `EbayBudgetExhaustedError` → `ListingFailureCode.PROVIDER_BUDGET_EXHAUSTED` → the worker calls `job.moveToDelayed(resetAt)` so BullMQ does not burn a retry on a quota that only refills at midnight.
- **Fails open.** An unreachable Redis allows the call; eBay's own 429 (already handled) is the hard stop. Losing the ability to *count* calls is not a reason to stop making them.
- Ceilings are platform settings (`ebay.budget.*`), so an approved Application Growth Check is a panel edit, not a deploy.

**Failure text is split by audience.** Sellers see ONLY the localized `failureCode` message; the provider's raw wording ("Input data for tag `<BrandMPN>` is invalid") names internal fields and reads as a defect in their product. It is stripped from `ListingJobItemDto` and surfaced to operators at `GET /v1/admin/listing-failures` with ASIN + account context. `failure-visibility.guard.spec.ts` locks both halves — hidden from the DTO and the web views, still persisted and still readable by admin.

**Fixed along the way (each a live defect):** `getActiveAccount`'s unordered `LIMIT 1` let a listing be repriced through a different store than it was published on (bulk grouping made this load-bearing); `String(price) !== String(finalPrice)` read `"12.30"` vs `12.3` as a change and pushed a no-op every refresh cycle; `findOrCreateProduct` hardcoded a 12-hour first refresh while the panel-tunable `KEEPA_REFRESH_INTERVAL_MINUTES` governed everything else.

**Capacity after this work:** eBay stops being the constraint. Updates ≈ 47M/day against the Inventory quota; the real ceiling becomes `KEEPA_REFRESH_BATCH_SIZE × ticks/day` (50 × 1440 = 72,000 product refreshes/day by default) and the Keepa token pool. Raising the refresh interval does *not* raise throughput — the scheduler is stale-driven and already spread across the day, and eBay's quota is a daily bucket, not a rate.

### Listing content policy + shared LLM infra (B)
Configured per **listing settings group** (`content` JSONB on `listing_settings_groups`, migration `031`):
- `stripBrandFromTitle` — deterministic removal of Amazon brand tokens from the eBay title at **create**.
- `aiTitleEnabled` / `aiDescriptionEnabled` — optional one-time rewrite through the shared LLM client at **create only**.

**Create-only hard rule (100k+ listings):** AI must **never** run on Keepa refresh, product-sync, or sale-driven stock-sync. Only `ListingProcessorService` calls `ListingStrategyService.prepareListingData(..., { applyContentAi: true })`; refresh paths omit the option and recompute price/quantity only. `create-only-ai.guard.spec.ts` locks this invariant. AI failures always fall back to deterministic title/description, so listing creation continues.

**Shared transport:** `LlmModule` exports `LlmService`, an OpenAI-compatible Chat Completions client with `chat()` and accumulated-delta `chatStream()`. It supports typed errors, bounded `Retry-After` handling for HTTP 429, per-call timeouts/abort signals, and fail-soft append-only usage logging in `llm_usage_log` (migration `040`). There is no billing/aggregation UI yet.

**One provider group.** `LlmService.resolveProvider` reads a single provider config — `LLM_PROVIDER` / `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_CONTENT_MODEL` — used by both LLM purposes (`CONTENT`, `ASPECT`). Runs across thousands of products per bulk add, so it wants the **cheapest tier that does the job** — the task is "compress a title to 80 chars" and "pick one value from an allowed list", not deep reasoning. (There used to be a second, optionally-paid "assistant" provider group — `LLM_ASSISTANT_*` — backing the customer-facing chatbot. That chatbot was replaced by tawk.to in 2026-08 and the second group was removed with it; see "Customer support widget — tawk.to" below.)

**`LlmUsagePurpose.ASPECT`** is the other use: choosing a required eBay item specific from the category's own allowed-value list (see "Listing quality" above). It is gated by `ebay.aspects.llmEnabled` (default off, admin-togglable) and capped by `ebay.aspects.llmMaxPerListing` (default 3). Its answer is validated against the allowed list and **written back as a learned default**, so each `(category, aspect)` question is asked once and every later listing in that category costs zero tokens. `llm_usage_log.purpose` separates the spend by purpose.

**Provider/config (env-only, no code branch).** The client posts plain OpenAI Chat Completions to `{LLM_BASE_URL}/chat/completions` with a Bearer token, so **switching providers is three env values, in every environment including local dev** — there is no longer a "local for dev, hosted for prod" split, because testing against a different model than production ships is how the drift below went unnoticed.
- **Current default: Google Gemini** (`LLM_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai`, `LLM_CONTENT_MODEL=gemini-3.1-flash-lite`, key from `aistudio.google.com/api-keys`). OpenAI (`https://api.openai.com/v1`) and Groq (`https://api.groq.com/openai/v1`) are drop-in alternatives. **Anthropic is the one exception** — its API is `/v1/messages` with `x-api-key`, not this shape, so Claude would need an adapter in `LlmService`, not an env change.
- **Never a thinking model.** It spends the token budget reasoning and returns `finish_reason: length` (truncated) or empty `content` at our caps — and the failure is silent, because the create path just falls back to the deterministic title. Verified live twice: `qwen3:1.7b` on Ollama returned EMPTY content even with `/no_think`, and `gemini-3.6-flash` returned a 47-character title at the 256-token title cap (the same prompt on `gemini-3.1-flash-lite` gave 77 characters in 0.7s). Use `-lite` / `-instruct` tiers. `ContentGenerationService.stripReasoning` additionally removes inline `<think>` blocks for models that keep them in `content`.
- **`pnpm --filter api llm:check` is how you verify a provider switch** (`src/scripts/llm-check.ts`, read-only). It sends one title-rewrite and one item-specific probe with production's exact request shape and token caps, and fails on the three modes that are otherwise silent: empty content, `finish_reason=length`, and an aspect answer that is not verbatim in the allowed list. Run it after ANY change to `LLM_BASE_URL` / `LLM_CONTENT_MODEL`.
- **Cost attribution needs a pricing row.** `buildLlmUsageEvents` computes NULL (rendered as an em dash, never `0`) when `llm_model_pricing` has no effective row for `(provider, model)` — and `provider` is the literal `LLM_PROVIDER` value, so it must match. Record it with `pnpm --filter api llm:pricing -- --provider google --model <id> --input-per-1m <usd> --output-per-1m <usd>` (effective-dated: the open row is closed and a new one opened in one transaction, so historical usage keeps the price that applied then). A genuinely free tier is recorded as a real `0` — that is different from unknown, and recording it explicitly is how the panel can tell them apart.
- `LLM_CONTENT_ENABLED=false` is the safe default (admin-togglable). **`LISTINGS_WORKER_CONCURRENCY=1` on a free provider tier** — free tiers cap requests per minute, and a bulk add at higher concurrency burns the 429 retry budget (create still succeeds; the AI rewrite just falls back). Raise to 2–4 once billing is enabled.

**No local LLM service.** `docker-compose.yml` no longer ships Ollama — dev, test and prod all talk to the same hosted provider. The original reason for local was "bulk listing traffic must be free"; at our prompt sizes (~300 input / ~30 output tokens per title) 100k listings is ~30M input tokens, which on a flash/mini/haiku tier is single- to low-double-digit dollars. That is not worth running a second model, a second quality bar, and a GPU-less inference box for.

**Spec C — Zon Assistant — REMOVED (2026-08), replaced by tawk.to.** A custom LLM-backed chatbot (conversation/history APIs, generation + inbox SSE, signed replay cursors, RAG/help-corpus ingestion, persistent support handoff/presence, proactive multi-tenant limiting, admin observability, `AssistantWidget` + `/support` console) was built and reviewed on `development`, then decommissioned in favor of the third-party tawk.to widget — see "Customer support widget — tawk.to" below for the current implementation, and CLAUDE.md git history / `docs/superpowers/specs/2026-07-26-zon-assistant-backend-design.md` + `docs/superpowers/plans/2026-07-26-zon-assistant-backend.md` for the historical design (no longer canonical; the code they describe is deleted). `docs/assistant/` (the old operations/SSE-protocol/testing handbook) was removed since it documented APIs that no longer exist.

### Customer support widget — tawk.to

Customer-facing "contact us" support is a third-party embed (**tawk.to**, free), not custom code. It replaced Spec C (see above) — same visible behavior to a seller (a chat bubble they can message), but the agent side (answering, routing, canned replies, chat history) is entirely inside tawk.to's own hosted dashboard/app, not Zonds.

**What ships in this repo:**
- `apps/web/src/features/support-widget/TawkToWidget/` — a small container/component pair that injects the tawk.to embed `<script>` (`https://embed.tawk.to/{propertyId}/{widgetId}`) into `document.body` on mount. It no-ops (renders nothing, injects nothing) when either ID is unset — safe default for local dev / environments without a tawk.to account. Script injection is idempotent (guarded by a DOM id), so mounting it more than once is harmless.
- Mounted in two places with intentionally different launch UX: `LandingPage` leaves tawk.to's native floating bubble visible; `AppLayout` hides the native bubble via `Tawk_API.hideWidget()` and renders a Zonds-designed "Contact us / Bize ulaşın" launcher in the sidebar footer (the old `AssistantWidget` position). Clicking calls `showWidget()` + `maximize()`; collapsed sidebar renders only the headset icon; unread counts appear on the custom launcher; mobile launch closes the sidebar first. **Deliberately NOT mounted in `OperatorLayout`** — staff at `/admin` should not see the customer support bubble.
- Env uses exactly two names everywhere: `VITE_TAWKTO_PROPERTY_ID` + `VITE_TAWKTO_WIDGET_ID` (`apps/web/.env.example`). They are wired through `Dockerfile.web` (`ARG`/`ENV`) and both Coolify compose files' `web` build `args`; there is no second non-`VITE_` pair. Current public embed IDs are the compose defaults, so deployments work without extra Coolify variables; defining the same two names overrides them. These are public browser-side identifiers, not secrets. Build-time, like the other `VITE_*` values — a value change requires a web rebuild, not just a container restart.

**What you (the account owner) need to do to make this live:**
1. Create a free account at tawk.to and a **property** for the site (Administration → Channels → Chat Widget, or your dashboard's onboarding). A property is the container for one site's widget + agents + settings.
2. From the widget's **Direct Chat Link** (`tawk.to/chat/<propertyId>/<widgetId>`) or the Chat Widget embed code, copy the two IDs into `VITE_TAWKTO_PROPERTY_ID` / `VITE_TAWKTO_WIDGET_ID`. Current values are `6a77cbcad1e0df1d455e2131` / `1jvhv843q`; they are already in local `apps/web/.env` and are defaults in both compose files. Only define those same two names in Coolify if overriding them later — never create `TAWKTO_PROPERTY_ID` / `TAWKTO_WIDGET_ID`.
3. Invite your support agents from the tawk.to dashboard (Administration → Agents) — agent seats are free and unlimited on tawk.to's free tier. They answer chats from tawk.to's own web dashboard or mobile app, **not** from anything in Zonds.
4. Rebuild/redeploy the `web` image so the build-time env vars are baked in.
5. Optional, from the tawk.to dashboard (no Zonds code involved): pre-chat form, canned responses, office hours / auto-away, chatbot/FAQ auto-replies, triggers, and visitor identification (the widget already receives no Zonds user data today — if you later want the chat to show the logged-in seller's name/email, that means adding a `window.Tawk_API.setAttributes(...)` call once the widget's `onLoad` fires, inside `TawkToWidget.container.tsx` — not implemented, since it wasn't asked for).

**What was removed to make room for this (2026-08), and why:**
- Backend: `assistant/`, `knowledge/` (RAG ingestion), `support/` modules (~80 files) — gone from `AppModule`. The `LlmModule`'s second "assistant" provider group (`LLM_ASSISTANT_*` env) is gone too; listings AI (`CONTENT`/`ASPECT`) is unaffected, see above.
- Frontend: `AssistantWidget`, the `/support` console (`SupportPage`), and the `/support` entry in `operatorRouting.ts`.
- Shared: `packages/shared/src/domain/{assistant,support,knowledge}/` and matching `schemas/`; `LlmUsagePurpose` trimmed to `CONTENT`/`ASPECT` (`ASSISTANT*`/`KNOWLEDGE_INGESTION` removed).
- **DB migrations `041`–`049` (assistant/knowledge tables) were deliberately left in place, untouched.** An applied migration is never deleted (see migration `061`'s note on this), and dropping tables is a separate, explicit, higher-risk action nobody asked for — those tables are now simply orphaned/dormant. If you want them gone, that is a future dedicated `DROP TABLE` migration, not part of this change.
- **`UserRole.SUPPORT` still exists but is now vestigial** — kept out of the seller app like before (`isOperatorRole`), but with no console to land on (`resolveHomePath` falls back to `/login` for it). Any existing SUPPORT-role account should be demoted via `pnpm user:set-role -- --email <email> --role customer` (or `admin`) so it isn't left with zero accessible product surface.
- Admin panel: no dedicated tab needed removal — there never was an "Assistant" tab (LLM cost data flowed through the generic Costs tab; `ADMIN_QUEUE_NAMES` never listed `knowledge-ingestion` either). Only `AdminModule`'s `BullModule.registerQueue(...)` entry for `knowledge-ingestion` needed removing, since that queue no longer exists.

For mass historical rewrites of existing published listings, do not re-queue create jobs; use deterministic strip-brand/templates or a future dedicated eBay revise batch.

Key files: `src/modules/llm/` (`llm.service.ts`, `llm-usage.service.ts`, `sse-parser.ts`), `content-generation.service.ts`, `listing-strategy.service.ts`, and the listing-group `content` config in shared types/UI.

### Key product / listing files
- `src/modules/listings/keepa.service.ts` — Keepa `/product` client (offers+stock query, chunked bulk `getProducts()` + `getProductDetailsWithMeta()`, response-reported token meta only).
- `src/modules/listings/keepa-normalizer.ts` (+ `.spec.ts`, `keepa-attributes.spec.ts`) — pure normalization: Buy Box offer matching, `stockCSV`, price sentinels, three-state stock, images array/CSV, `dedupeAsins`/`chunkAsins`, `extractProductAttributes` (item-specific attributes + GTIN/MPN identifiers).
- `src/modules/ebay/aspect-builder.ts` (+ `.spec.ts`) — category-aware eBay item specifics (allowed-value matching, Amazon↔eBay synonyms, custom specifics, decision provenance).
- `src/modules/ebay/aspect-priors.ts` (+ `.spec.ts`) — built-in aspect knowledge and `pickTerminalValue`, the "a required aspect is never empty" guarantee.
- `src/modules/ebay/aspect-resolver.service.ts` (+ `.spec.ts`) — async half of the ladder: curated/learned values, revalidation, write-back, rejection demotion, and the bounded LLM pass.
- `src/modules/ebay/aspect-llm.service.ts` (+ `aspect-llm.spec.ts`) — pure prompt/parse for item-specific selection (strips `<think>` blocks small local models emit, rejects any value off the allowed list) plus the fail-soft service.
- `src/modules/ebay/ebay-taxonomy.service.ts` + `category-resolution.ts` (+ `.spec.ts`) — DB-backed category + aspect metadata, operator pins, stale-serve.
- `src/modules/listings/listing-failure.ts` (+ `.spec.ts`) — the single failure classifier; `aspect-audit.ts` — per-listing resolution summary.
- `src/modules/admin/admin-listing-quality.service.ts` + `listing-quality.helpers.ts` (+ `.spec.ts`) — admin read/curate surface.
- `src/modules/ebay/ebay.errors.ts` + `listing-invariants.guard.spec.ts` — typed create-path failures and the source-greps that keep the silent fallbacks from returning.
- `src/scripts/ebay-aspect-probe.ts` — read-only aspect diagnosis (`pnpm --filter api ebay:aspect-probe`).
- `src/modules/ebay/listing-condition.ts` and `src/modules/listings/listing-title.ts` (+ `.spec.ts`) — condition mapping and word-boundary title truncation.
- `src/common/utils/gtin.ts` — GS1 check-digit validation for UPC/EAN before they reach eBay.
- `packages/shared/src/utils/listing-template.ts` — the single description template renderer (drawer preview + publish).
- `src/modules/listings/refresh-backoff.ts` (+ `.spec.ts`) — escalating data-failure delay schedule.
- `src/modules/listings/refresh-scheduler.service.ts` — repeatable tick registration + `KEEPA_REFRESH_ENABLED` gate.
- `src/modules/listings/refresh-processor.service.ts` — atomic claim (`FOR UPDATE SKIP LOCKED` + lease), batch worker (compare/update/fan-out/quarantine/token-log).
- `src/modules/listings/keepa-usage.service.ts` — `keepa_usage_log` + `keepa_balance` persistence.
- `src/modules/listings/product-sync.service.ts` — `updateAllListingsForProduct()` (overrides + change-detected fan-out) + `syncListingsForProduct()`.
- `src/modules/listings/content-generation.service.ts` — optional AI title/description rewrite (create only).
- `src/scripts/llm-check.ts` / `llm-pricing-set.ts` — provider verification (`pnpm --filter api llm:check`) and effective-dated price recording (`llm:pricing`).
- `src/modules/listings/listing-strategy.service.ts` — price/qty formula, strip brand, templates, AI gate.
- FE listings: `apps/web/src/features/listings/` — `overview/`, `all/` (+ hooks), `detail/`, `api/listings.api.ts`, domain `ListingCard` under `apps/web/src/domain-ui/`.
- DB: `products` refresh columns; `listings` overrides + `ebay_account_id`; `listing_settings_groups.content`. Migrations `025`–`031`.

## Account scope — seller app vs operator console (hard separation)

**An account is either a seller account or a staff account, never both.** Zonds ships two products behind one login: the seller app (dashboard / listings / orders / settings) and the operator console (`/admin`). They used to share one shell, so an ADMIN was a seller account with extra menu items. That is gone.

| Role | May reach |
|---|---|
| `CUSTOMER` | Seller app only. No admin panel. |
| `SUPPORT` | **Vestigial as of 2026-08** — no console anywhere (the `/support` queue console was removed when customer support moved to tawk.to, see "Customer support widget — tawk.to"). Still kept out of the seller app by `isOperatorRole`, but has nothing to land on; demote any existing SUPPORT account via `pnpm user:set-role`. |
| `ADMIN` | Admin panel only. |

- **Shared predicate**: `isOperatorRole` / `isCustomerRole` / `OPERATOR_ROLES` in `packages/shared/src/domain/auth/account-scope.ts`. Both sides of the wire use the same function — never re-derive the role set inline.
- **API enforcement** is in `JwtAuthGuard` (`apps/api/src/modules/auth/jwt-auth.guard.ts`): after authentication, a staff role is refused (`403 auth.errors.customerAreaForbidden`) on any route not marked **`@OperatorSurface()`**. **Every authenticated route is a customer surface by default** — a new seller controller is separated correctly by doing nothing, and a forgotten decorator fails closed. The decorator only widens access for staff; customers are still kept out of operator routes by `RolesGuard` + `@Roles(...)`.
- **The operator surfaces are exactly three**: `admin.controller`, `auth.controller` and `profile.controller` (the last two are session/self-service, needed by every account). `account-scope.guard.spec.ts` unit-tests the guard **and** source-greps that list, so adding a fourth is a deliberate edit — marking a seller controller would hand staff a customer's data back. (`knowledge-admin.controller` and `support.controller` were removed with Spec C — see "Customer support widget — tawk.to".)
- **Web enforcement**: `apps/web/src/layouts/OperatorLayout/` is the staff shell for `/:locale/admin` — its own sidebar (Admin only), no seller nav, no store switcher, no customer-facing widgets. `AppLayout` bounces staff to the console; `OperatorLayout` bounces sellers to `/dashboard`. Both shells share one set of styled components (`layouts/shell/AppShell.style.ts`) and re-export it, so the chrome can never fork.
- **`apps/web/src/app/operatorRouting.ts` is the single routing authority** for staff: the console route table, `resolveHomePath(role, hasConnectedAccounts)` (used by login, register, Google auth and both layout guards, so they cannot disagree) and `resolveOperatorBreadcrumbs`. `routeMeta.ts` describes the seller app only and deliberately no longer lists `/admin`.
- **Role changes stay CLI-only** (`pnpm user:set-role`, see "Role CLI" below). Promoting an account to ADMIN removes its access to the seller app on the next request — the CLI already revokes sessions, so the change takes effect immediately. Keep at least one ADMIN account that is not someone's selling account.
- **Not implemented (asked for, deferred):** operator impersonation ("log into a customer's account with personal/account details redacted"). It needs an impersonation token, a redaction layer and its own audit trail — none of it exists today.

## Admin Panel — Observability, FinOps & Operations

The admin module lives in `apps/api/src/modules/admin/` and uses the existing auth RBAC (`UserRole.CUSTOMER|SUPPORT|ADMIN`, `Roles`, `RolesGuard`, `PrivilegedSessionGuard`, migration `041`). It does not introduce a second role system. Every admin route is gated by `JwtAuthGuard` + `RolesGuard` + `PrivilegedSessionGuard` (per-request session revalidation) + `@Roles(UserRole.ADMIN)`.

**Read-only, with two deliberate write surfaces.** Observability data is never mutated from here. The two exceptions are platform infrastructure that has no owning customer module, so an operator action is the only way they can ever change: the **proxy pool** (`POST`/`PATCH /v1/admin/proxies*`) and **runtime platform settings** (`PUT`/`DELETE /v1/admin/settings/:key`). All other admin-initiated mutations still go through the owning module's endpoint with its own guard chain.

**One panel, no duplicates.** `/:locale/admin` is the single admin surface — rendered inside the **operator shell**, not the seller shell (see "Account scope" above) — with tabs Overview / Queues / Costs / Proxies / Listing Quality / Settings / Billing / Users / **eBay Limits** / **Listing Failures**. The last two are read-only: eBay Limits shows the shared per-application daily quota per resource (used/remaining/background ceiling/reset), and Listing Failures is the ONLY surface carrying a provider's raw error text — sellers see the localized `failureCode` message instead. The former `/:locale/admin/assistant` page duplicated the overview + queue + usage reads and was removed; the path now redirects to `/admin`. Do not add a second admin page — add a tab.

- `GET /v1/admin/overview` — platform counts, current-period usage summaries, and BullMQ queue counts.
- `GET /v1/admin/usage/summaries` — `(source, metric)` usage aggregation with optional period/source/metric filters.
- `GET /v1/admin/queues/health` — waiting/active/completed/failed/delayed/prioritized counts for registered queues. Read-only; the admin module never enqueues.
- Migration `049` adds append-only `usage_events` and effective-dated `shared_cost_entries`. Existing Keepa/LLM writers still target their source tables; projecting those rows into `usage_events` is a follow-up.
- Costs use nullable micro-USD `BIGINT`; NULL means unknown and must never be represented as zero. Currency and estimated cost are pair-coupled.
- Pure helpers in `apps/api/src/modules/admin/finops-helpers.ts` resolve effective pricing, calculate token cost, and allocate shared costs. Tests enforce exact allocation residue.
- The admin frontend renders only redacted data — no prompts, messages, credentials, or raw provider errors are exposed. (The `/:locale/support` console mentioned in older revisions was removed — see "Customer support widget — tawk.to".) Provider invoice reconciliation and external alert delivery remain follow-ups.
- Migration `050` adds partial unique indexes for safe replay of source projections. `UsageEventsService` is the single fail-soft writer; Keepa source rows project with deterministic per-user fair-share, and LLM source rows project prompt/completion/embedding tokens with effective-date pricing from `llm_model_pricing`. Source logs remain authoritative and projection failures never break provider operations.
- `UsageBackfillService` can idempotently rebuild historical Keepa/LLM projections, but is deliberately not wired to startup or cron. Proxy/tracking enum seams exist without emitting synthetic bytes, requests, or costs.
- Migration `051` adds append-only `queue_observations` for BullMQ completed/failed events. `QueueEventsCollectorService` watches the operational queues and persists only allowlisted correlation plus a SHA-256 hash of allowlisted identifiers—never raw job payloads. Writes are fail-soft/idempotent; retention defaults to 7 days (clamped 1–90) and is applied by the shared `data-retention` job below.
- Admin read APIs: `GET /v1/admin/queues/observations` (queue/event/correlation/date/page filters), `GET /v1/admin/queues/observations/:id`, `GET /v1/admin/finops/users`, `GET /v1/admin/finops/providers`, and `GET /v1/admin/operations/summary`. `QUEUE_OBSERVABILITY_ENABLED=false` disables collection.

### Database retention (`data-retention` queue)

**Every append-only table is purged by ONE nightly job driven by one manifest.** `queue_observations` used to have a bespoke retention worker while five other append-only tables had none — including `keepa_usage_log`, the fastest-growing table in the schema (one row per **requested** ASIN per refresh, ~26M rows/year on a full schedule). `QueueObservabilityRetentionService` is **deleted**; `DataRetentionService` replaces it and covers all six. Adding a table is one entry in `data-retention.manifest.ts`, never a seventh worker.

| Table | Age column | Default | Floor | Why |
|---|---|---|---|---|
| `queue_observations` | `recorded_at` | 7d | 1d | Diagnostic only |
| `keepa_usage_log` | `requested_at` | 90d | 7d | Fastest-growing; cost survives in `usage_events` |
| `llm_usage_log` | `requested_at` | 90d | 7d | Same |
| `usage_events` | `recorded_at` | 400d | 30d | The FinOps projection the Costs tab reads |
| `buyer_message_log` | `created_at` | 400d | **180d** | **Correctness — see below** |
| `audit_logs` | `created_at` | 730d | **365d** | Compliance evidence |

- **`buyer_message_log` is not a log, it is an idempotency ledger.** Its partial unique index on `(ebay_order_id, event_type) WHERE status = 'sent'` is the only thing stopping a buyer being messaged twice for the same event; deleting a row **re-arms** that event for its order. Hence the 180-day code floor, enforced independently of the registry and locked by a spec.
- **Identifiers are interpolated, so they come from a frozen literal list and are re-validated** by `isSafeSqlIdentifier` before any query is built. A validation failure **refuses to build the SQL** rather than degrading. The age window is a bound parameter. `clampRetentionDays` maps NaN/0/negative to the rule's **floor**, never to 0 — a mistyped override must not be able to mean "delete everything".
- **Batched, resumable, fail-soft.** `ctid IN (SELECT … LIMIT 5000)` (works without a uniform PK) with a 400-batch-per-table cap, so the first run against a long-lived DB cannot hold locks or bloat WAL; leftovers are picked up the next night. One failing table never stops the other five, and nothing throws into the API process.
- Windows are panel-tunable at `/admin` → Settings → **Data retention & disk**. The **schedule** (`DATA_RETENTION_CRON`, default `17 3 * * *`) is read once at boot and stays env-only. `QUEUE_OBSERVABILITY_RETENTION_CRON` is still honoured as a fallback.
- **Leftover from the rename:** the old `queue-observability-retention` queue has no worker now. Its repeatable entry lingers in Redis harmlessly — clear it once with `redis-cli --scan --pattern 'bull:queue-observability-retention:*' | xargs redis-cli DEL`.

### Log file retention

`apps/api/logs/*.log` is a **shipping buffer for Promtail, not the archive** — Loki owns queryable history (7 days). Combined logs were kept 14 days uncompressed with no size ceiling behind the age bound, which is GBs/day at scale. Now: rotated files are **gzipped** (~10× on JSON), combined retention matches Loki's (`LOG_COMBINED_RETENTION_DAYS`, default 7), errors are kept longer because they are small and are what you need after the Loki window closes (`LOG_ERROR_RETENTION_DAYS`, default 30). Promtail globs `*.log`, so a rotated `*.log.gz` is correctly invisible to it — it has already shipped those lines.
- `GET /v1/admin/billing/metrics` — minimal read-only billing metrics: account status distribution (subscription-status proxy from `users.status`), access-tier distribution (plan proxy from `users.role`), listing/AO quota usage-pressure summaries (per-user counts banded by env thresholds), and the total estimated cost for the period (nullable micro-USD, null when no cost rows — never faked as 0). No plan/subscription/quota tables exist today; the metrics are derived from real tables only, and quota bands use env-configurable soft thresholds (`ADMIN_LISTING_QUOTA_WARN_THRESHOLD` default 25, `ADMIN_LISTING_QUOTA_CRITICAL_THRESHOLD` default 100, `ADMIN_AMAZON_ACCOUNT_QUOTA_WARN_THRESHOLD` default 3, `ADMIN_AMAZON_ACCOUNT_QUOTA_CRITICAL_THRESHOLD` default 10) — same `ConfigService.get ?? default` pattern as `ADMIN_QUEUE_WAITING_THRESHOLD`. Pure helpers in `billing-metrics.helpers.ts` (band classification, distribution aggregation, cost-total resolution) are Jest-covered.
- `/admin` is a lazy, role-gated frontend with Overview / Queues / Costs / Proxies / Settings / Billing / Users tabs. It lives in the operator shell, whose sidebar shows Admin only to `UserRole.ADMIN`; backend guards remain authoritative. Container logic is split into `features/admin/hooks/useAdminProxyForm.ts` and `useAdminSettings.ts`. Money is rendered with `formatMicroCurrency` from `@repo/ui` (micro-USD → localized currency); an unknown (null) cost renders as an em dash, never `0`. Destructive queue actions remain intentionally absent.
- Shared queue correlation helpers (`stampJobData`, `extractCorrelationId`, `generateCorrelationId`) and an API AsyncLocalStorage context carry trace identity across HTTP and queue boundaries. `RequestIdMiddleware` enters ALS, Winston adds correlation/queue/job structured fields, and all operational producers/workers—including `order-sync`, `stock-sync`, `auto-fulfill`, Amazon sync/tracking/verify, listings, and Keepa refresh—propagate the same ID through fan-out. Job IDs, retry/backoff, repeat schedules, dedup, and priority remain unchanged.

### Proxy pool management (`/admin` → Proxies)

The fixed ISP proxy pool (`proxies` table, migrations `057` + `058`) is managed from the panel — operators no longer hand-write SQL INSERTs.

- `GET /v1/admin/proxies` — every pool row plus an aggregate summary (active/disabled, assigned/free, expiring/expired, total known monthly cost). `POST /v1/admin/proxies` registers a purchased proxy; `PATCH /v1/admin/proxies/:id` patches status/label/expiry/cost.
- **Passwords are write-only.** They are encrypted (AES-256-GCM, `enc:` prefix, `AMAZON_ENCRYPTION_KEY`) at insert and are never returned by any endpoint — not even masked. `ProxyService.onModuleInit`'s plaintext backfill remains only for legacy operator SQL.
- **Assignment is NOT writable.** `ProxyService` owns the atomic per-user claim (`FOR UPDATE SKIP LOCKED`, `UNIQUE assigned_user_id`); a manual reassign from the panel would race it and break the one-user-one-static-IP invariant. The panel registers capacity and disables burned proxies — nothing else.
- Migration `058` adds `expires_at`, `monthly_cost_micros` and `currency`. A lapsed fixed ISP proxy has its static IP released by the provider, breaking the assigned user's IP continuity, so expiry is surfaced as a server-derived `ProxyExpiryState` (`no_expiry|ok|expiring_soon|expired`) and drives `AdminWarningKind.PROXY_EXPIRING` / `PROXY_EXPIRED` warnings. `PROXY_POOL_EXHAUSTED` fires when the pool has ACTIVE rows but no free one — the next new user's auto-fulfill would fail closed with `proxy_required`.
- Cost follows the platform micro-USD convention: unknown is `null`, never `0`. The pool total sums only ACTIVE rows with a known cost, so it is a lower bound whenever some costs are unrecorded.
- Pure helpers in `proxy-pool.helpers.ts` (`classifyProxyExpiry`, `buildProxyPoolSummary`) are Jest-covered.

### User monitoring (`/admin` → Users)

`GET /v1/admin/users` returns one row per user joining operational footprint (active listings, Amazon buyer accounts, active eBay stores, orders in the last 30 days, assigned proxy `host:port`) with period usage/cost attribution from the `usage_events` projection (Keepa fair-split tokens, LLM tokens, total estimated micro-USD). Read-only; role changes remain CLI-only (see below).

### Runtime platform settings (`/admin` → Settings)

Operational configuration is stored in the DB and edited from the panel instead of requiring an env change + redeploy. Migration `059` adds `platform_settings` (`key` PK, `value` TEXT, `updated_by`).

- **Resolution order is DB override → env var → code default.** A deployment with no override rows behaves exactly as it did when the values lived only in env, so adopting this is never a behavior change on its own. Deleting an override returns the key to its env/default value — that is the escape hatch when a panel change makes things worse.
- **The registry is the single source of truth**: `apps/api/src/common/settings/platform-settings.registry.ts` declares each key's type, bounds, code default, env var, and whether it requires a restart. Adding a knob = one registry entry + the key in `PlatformSettingKey` (`packages/shared`). The admin API, validation, and UI all derive from it.
- **`PlatformSettingsService` is global** (`common/settings/settings.module.ts`, `@Global` like `DatabaseModule`) so workers, schedulers and controllers can all consume it without import cycles. Overrides are loaded in one query and cached for 30s; writes invalidate locally and other replicas converge within the TTL. A missing table or DB error fails soft to env/defaults — a settings outage never breaks a consumer.
- **What stays env-only (never in the registry):** connection bootstrap (`DATABASE_*`, `REDIS_*`), crypto/auth secrets (`JWT_*`, `AMAZON_ENCRYPTION_KEY`), provider API credentials (`KEEPA_API_KEY`, `EBAY_*`, `GOOGLE_*`, `PADDLE_*`, `LLM_API_KEY`), and process identity (`NODE_ENV`, `PORT`, `CORS_ORIGINS`). They are read before the DB connection exists, are rotated as an ops action, and must not be reachable over HTTP.
- **Secrets in the registry** (currently only `SMTP_PASSWORD`) are write-only: stored `enc:`-prefixed AES-256-GCM and never returned — the DTO carries `value: null` plus `hasValue`.
- **`requiresRestart` is not cosmetic.** It marks values consumed once at boot (`KEEPA_REFRESH_SCHEDULER_CRON`, the Amazon tracking intervals baked into per-order job schedulers). The UI shows the badge because a silently-ignored change is worse than no change. Worker concurrency (`*_WORKER_CONCURRENCY`, `*_QUEUE_CONCURRENCY`) is applied at decoration time and stays env-only for the same reason.
- **The Keepa kill switch is enforced at job execution**, not registration: `RefreshProcessorService.selectRefreshBatch` checks `KEEPA_REFRESH_ENABLED` on every tick, so turning it off in the panel stops background token spend immediately without a restart. (`RefreshSchedulerService` still honours the env var at boot for the repeatable-tick registration.)
- Writes are validated + normalized by pure helpers in `platform-settings.helpers.ts` (`validateSettingValue`, `coerceBoolean`, `coerceNumber` — Jest-covered) and audit-logged in the same transaction (`action='PLATFORM_SETTING_CHANGE'` / `'PLATFORM_SETTING_RESET'`, secret values redacted).
- `POST /v1/admin/settings/email/test` opens an SMTP connection with the effective mail settings so a credential change can be confirmed before it is relied on. It sends no mail. `EmailService` rebuilds its Nodemailer transporter whenever the resolved config fingerprint changes, so a settings edit applies on the next send.
- Consumers migrated off `ConfigService` for these keys: `RefreshProcessorService`, `AdminService`, `AdminProxiesService`, `AmazonOrderSyncService`, `AmazonCheckoutService`, `AmazonTrackingProcessorService`, `ContentGenerationService`, `QuotaEnforcementService`, `EmailService`.

### Role CLI (operator-only, no HTTP path)

Role escalation/demotion is a **server-console operation only** — there is no HTTP endpoint to change a user's role. The `user-set-role` CLI (`apps/api/src/scripts/user-set-role.ts`, run via `pnpm user:set-role -- --email <email> --role <customer|support|admin>`) is the sole path. Pure parsing/audit logic is extracted into `user-set-role-helpers.ts` (unit-tested by `user-set-role-helpers.spec.ts`).

Security contract (enforced in helpers + script):
- **Strict `--email`/`--role` parsing** against the shared `UserRole` enum — no positional args, no env fallback, no HTTP. Unknown flags → `RoleCliArgError` → exit 2. `--role` must equal a `UserRole` enum value (e.g. `Admin` is rejected; only `admin` is accepted).
- **Transactional user lock** — `SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1) FOR UPDATE` so a concurrent role change cannot race.
- **Change only if needed** — `shouldChangeRole(current, next)` guards no-op writes; a re-run with the same role exits 0 without writing anything.
- **Session invalidation** — on a real change, all active `auth_refresh_sessions` for the user are revoked explicitly. Migration `041`'s `users_security_change_revoke_sessions` trigger also bumps `users.session_version` + revokes sessions on the role UPDATE; the explicit revoke is defense-in-depth (survives a dropped trigger). The bumped `session_version` additionally invalidates all outstanding access tokens (validated via `AuthSessionService.validateAccess`).
- **Durable redacted audit** — a row is inserted into `audit_logs` **in the same transaction** (commits atomically with the role change, or rolls back with it). `action='ROLE_CHANGE'`, `resource_type='user'`, `details` JSONB carries only `{ action, previousRole, newRole, targetUserId, actor|null, changedAt }` — never email/password/session secrets. The email is recoverable by joining `audit_logs.user_id` → `users`; it is not duplicated in `details`.
- **Exit codes**: `0` changed (or already target role: no-op success), `2` bad args, `3` user not found, `1` DB/transaction failure.

**The role now decides which product the account can open at all** (see "Account scope"), so this CLI is also the switch between the seller app and the operator console. Promoting a seller to `admin`/`support` cuts that account off from its own listings and orders; demoting an operator cuts it off from `/admin`. Run it through pnpm without the `--` separator (`npx tsx src/scripts/user-set-role.ts --email … --role …` from `apps/api`, or `pnpm --filter api exec tsx …`) — pnpm forwards a literal `--` to the script, which the strict parser rejects with exit 2.

The CLI loads `apps/api/.env` (for `DATABASE_URL`) like `migrate.ts`; it does NOT bootstrap the NestJS app context. Operator identity (the server-shell `$USER`) is recorded as the audit `actor` when available, else `null`. The script files (`apps/api/src/scripts/**/*.ts`) follow `migrate.ts`/`knowledge.ts` precedent for console output + dotenv typing; no `eslint-disable` is used in the new files.

## Billing & Packages

The package and billing system is database-driven and Paddle-ready. Canonical details live in [docs/billing-and-packages.md](docs/billing-and-packages.md); keep this section aligned when billing behavior changes.

### Customer packages

Customers see only two capacity metrics — active listings and monthly automatic orders (AO). Internal Keepa, LLM, API, queue, and proxy usage must not be exposed as customer-facing tokens or credits. Initial seeded catalog values are deliberately configurable before launch:

| Plan | Active listings | Monthly AO | Initial monthly price |
|---|---:|---:|---:|
| Starter | 1,500 | 150 | $39 |
| Growth | 2,500 | 250 | $55 |
| Scale | 4,500 | 450 | $75 |

Plan prices, yearly prices, limits, active state, ordering, and Paddle price IDs are stored in billing catalog tables, not TypeScript constants or UI copy. Landing pricing reads the public catalog. Do not create a second plan model.

### Billing implementation

- Migrations `052_create_billing_foundation.sql` and `053_billing_quota_enforcement.sql` create the catalog, subscriptions, usage periods, listing/AO reservations, and webhook inbox.
- Backend module: `apps/api/src/modules/billing/`; frontend feature: `apps/web/src/features/billing/`.
- Paddle is abstracted behind a provider port as the planned Merchant of Record. Checkout/portal fail safely until Paddle credentials and price IDs exist.
- `BILLING_ENFORCEMENT_ENABLED=false` is the transition default. It gives users full access without fabricating a subscription. Enable only after Paddle sandbox/live flows are verified.
- Paddle webhooks use raw-body signature verification, idempotent inbox processing, stale-event protection, and subscription state updates. JWT must never be treated as the billing source of truth.

### Quota semantics

- Listing quota = active listings + open reservations. Draft and ended listings are excluded. Bulk create and publish use advisory-lock reservations. Queue success consumes; terminal failure releases. Downgrades never disable existing listings; they block new create/publish operations only.
- AO quota = per-user UTC calendar month. Reservation is idempotent by eBay order ID, consumption occurs only after Amazon placement, and blocked/final-failed checkout releases the reservation. Existing placed orders and tracking are not stopped by quota exhaustion.
- Quota exhaustion uses shared enums/reasons and must not be represented by hardcoded status strings.

### Admin billing metrics

`GET /v1/admin/billing/metrics` is a read-only, role-gated endpoint displayed in the admin Billing tab. It reports cost totals, account/access distributions, and listing/AO quota pressure. Unknown costs remain `null`; real zero costs remain `0`. It uses the existing `UserRole.ADMIN`, `RolesGuard`, and privileged-session guards — do not introduce a second RBAC system.

## Order Management

### Data Flow
```
eBay Order → Order Sync (BullMQ, every 15 min) → orders table
  ↕ (matched via lineItem.legacyItemId → listings.ebay_item_id)
orders.listing_id → listings → products (title, image, ASIN via JOIN)
  ↓ (NEW order only, xmax-detected insert)
Sale-Driven Stock Sync → products.stock decremented → stock-sync queue → recompute + push eBay
  ↓ (automatic, every 30 min per Amazon account)
Amazon Order Auto Cost-Capture (amazon-order-sync queue) → scrape account order list
  → strict-match ASIN+qty+amount+date to pending/provisional eBay orders → write real costs → LINKED
  ↓ (or user manually links an Amazon Order ID)
Amazon Account + Amazon Order ID → Playwright scraping → order costs updated → recomputeProfit
  ↓ (automatic, when store_settings.auto_fulfill_enabled + per-account enable+cap; A2)
Automated Amazon Fulfillment (`auto-fulfill` queue) → Playwright checkout on round-robin buyer account
  → review-step hard cap → place order → atomic write real costs + LINKED + schedule tracking
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
netProfit = ebayEarnings - purchasePrice - amazonTax - amazonShipping         (confirmed/linked)
netProfit = ebayEarnings - purchasePrice - (purchasePrice × amazonTaxRate/100) (provisional estimate)
```
- `ebayEarnings` = eBay's `totalDueSeller` (already deducts all eBay fees)
- `transactionFee` and `adFee` are calculated and stored for display only, NOT deducted again
- **`net_profit` is NULLABLE** (migration `033`): `NULL` = unknown cost (never faked); `0` = a computed real zero (trusted Amazon link with costs that legitimately sum to zero, e.g. free shipping + no tax). Aggregations `FILTER` out NULL rows rather than treating them as 0.
- **`cost_capture_status` enum** (`packages/shared` `OrderCostCaptureStatus`, DB type `order_cost_capture_status`) drives profit confidence. Values:
  - `pending` — eBay order ingested, nothing captured yet, product cost unknown.
  - `linked` — Amazon costs fully scraped from a real Amazon order. **TRUSTED**: only status that produces a headline `net_profit`.
  - `provisional` — listing matched so product/purchase cost is known, but Amazon tax+shipping not yet captured (awaiting auto cost-capture or manual link).
  - `failed` — Amazon scrape ran but returned no usable financials; prior values retained, `net_profit` stays NULL.
  - `untracked` — no listing match (`listing_id IS NULL`); source cost can never be resolved. Stays NULL forever.
- **Provisional estimate (A1.1)**: when `cost_capture_status = provisional`, `recomputeProfit` computes an **estimate** via the pure `estimateProvisionalNetProfit({ ebayEarnings, purchasePrice, amazonTaxRatePct })` helper in `profit-calculation.ts`. Uses the product's last-known Amazon price (resolved via `orders.listing_id → listings → products`); Amazon shipping is **not** estimated (variable; often $0 on Prime — disclosed in UI). The tax percent comes from the per-user global `amazonTaxRate` store setting (migration `035`, default `0`). On any store-settings failure, `recomputeProfit` falls back to `0%` (gross) — settings resolution never breaks profit compute.
- **`profitBasis`** (`'confirmed' | 'estimated' | null`) on `OrderDto` + dashboard rows: derived from `cost_capture_status` by `deriveProfitBasis` (`linked→'confirmed'`, `provisional→'estimated'`, else `null`). The FE uses it to label estimates; the **confirmed (linked) dashboard headline stays pure/trusted** — provisional rows are surfaced separately, never blended into the headline total.
- **Single writer**: `OrderSyncService.recomputeProfit(ebayOrderId, { scrapeFailed? })` is the only method that sets `cost_capture_status`. Called on order insert, on `ebay_earnings` change during re-sync, and after every Amazon link / cost-capture path. Renamed from `recalculateProfit` (old name still appears in git history only). Resolves the user's global store settings best-effort via `StoreSettingsService.getResolvedSettings(userId, null)` when computing the provisional estimate.
- **Dashboard profit tiers** (`GET /dashboard`, `dashboard.service.ts buildPeriod`):
  - `confirmed` = `SUM(net_profit) FILTER (status <> cancelled AND cost_capture_status = 'linked')` — the **headline** `netProfit` shown on period cards. Trusted only; `profitBasis = 'confirmed'`.
  - `provisional` = same filter with `cost_capture_status = 'provisional'` — shown separately as a lower-confidence addendum, labeled "Estimated" in the FE (`profitBasis = 'estimated'`). Never blended into the headline total.
  - `uncosted` = `SUM(sale_total) FILTER (cost_capture_status IN ('pending','failed','untracked'))` — **revenue only**, no profit implied (`profitBasis = null`).
- **ASIN availability for untracked fallback (open question — resolved)**: eBay's inbound order payload does **not** expose the item ASIN; the listing-match path uses `lineItems[].legacyItemId` → `listings.ebay_item_id`. The `recomputeProfit` ASIN fallback resolves via `orders.listing_id → listings → products.asin` JOIN, which is only available when a listing matched. For truly untracked orders (no listing) the ASIN is **not resolvable** from the eBay payload — those rows correctly stay `untracked` + `NULL net_profit`. The auto cost-capture matcher's ASIN signal comes from the same JOIN on the eBay candidate side (Amazon side ASIN comes from the scrape).

### Order Sync (eBay → Local)
- **Queue**: `order-sync` (BullMQ), cron every 15 min
- **Per-user processing**: Each user gets a separate job, concurrency: 3
- **Manual refresh**: `POST /orders/sync` queues high-priority job, waits, returns fresh data
- **Cache tracking**: `ebay_accounts.last_ebay_sync_at` — sync fetches only orders since last sync
- **Listing matching**: Uses `lineItem.legacyItemId` → `listings.ebay_item_id` to establish `listing_id`
- **Idempotency**: `upsertOrder()` uses Postgres `RETURNING id, (xmax = 0) AS inserted` to detect brand-new orders vs re-synced updates — one-time side effects (stock decrement) only fire on genuine inserts
- **Tracking-at-ingest invariant**: every eBay-account order is ingested and visible, but `listing_id` is assigned only when the Item ID matches a Zonds listing that is ACTIVE at first ingest. Sale-driven stock sync and auto-fulfill require that initial match. `ON CONFLICT` deliberately never backfills `listing_id`, so importing the listing later cannot retroactively auto-purchase an older untracked order. `order-tracking-invariant.guard.spec.ts` locks all three gates.
- **Re-sync cost recompute**: when an existing order's `ebay_earnings` changes on re-sync (delta > $0.001), `OrderSyncService.recomputeProfit(ebayOrderId)` is re-invoked so `net_profit` + fees reflect the corrected earnings. `cost_capture_status` is preserved/advanced, never reset to `pending`.

### Sale-Driven Stock Sync (between Keepa refresh cycles)
- **Why**: A confirmed eBay sale is real signal that Amazon stock dropped, so we don't wait for the next Keepa refresh cycle to correct eBay quantities.
- **Queue**: `stock-sync` (BullMQ). Producer = `StockSyncQueueService` (orders module, `@InjectQueue`), consumer = `StockSyncProcessorService` (listings module, `@Processor`, concurrency 3). Same queue name registered in both modules → same Redis queue.
- **Flow on new matched order**: `products.stock` decremented by order quantity (`ProductsService.decrementStock`, floors at 0) → enqueue `{ productId }` → worker calls `ProductSyncService.syncListingsForProduct(productId)` → reuses the same fan-out as the refresh pipeline: recomputes `quantity` per listing's own settings group and pushes to eBay (`updatePriceAndStock`) + DB.
- **Quantity formula** (single source of truth, `ListingStrategyService.calculateQuantity`): `quantity = min(max(amazonStock − buffer, 0), defaultQuantity)`. Used by listing creation, the Keepa refresh pipeline, and the sale-driven queue identically.
- **Shared product stock**: `products.stock` is an ASIN-level cache shared across all customers. One customer's sale depletes it, so ALL listings sharing that ASIN are recomputed — each with its own group's `buffer`/`defaultQuantity` → different eBay quantities per seller.
- **Best-effort & idempotent**: stock sync is wrapped so it never fails order sync; the worker re-reads `products.stock` at execution time, so delayed/coalesced jobs re-push the correct current value. The Keepa refresh pipeline resets `products.stock` to Amazon ground truth.
- **Rate-limit hygiene**: BullMQ `jobId` bucketed per 5s window per product collapses a burst of sales into one job; `attempts: 3` + exponential backoff; `EbayService.withRateLimitRetry` honours `Retry-After` on 429/5xx.

### Amazon Order Linking (manual)
- User provides Amazon Order ID + selects an Amazon Account
- `AmazonScrapingService` scrapes the Amazon order detail page via Playwright
- Scraped data (purchase price, tax, shipping, tracking) written to order, `amazon_linked_at` set
- If the scrape reached the page but the financial DOM was empty, the caller preserves prior costs and invokes `OrderSyncService.recomputeProfit(ebayOrderId, { scrapeFailed: true })` to mark `cost_capture_status = failed` (never silently zero-fills)
- On a successful link, `recomputeProfit(ebayOrderId)` runs with the real costs already on the row → sets `cost_capture_status = linked` and computes a trusted `net_profit`
- Tracking job started immediately for the order

### Amazon Order Auto Cost-Capture (`amazon-order-sync` queue)
Automatically links Amazon costs to pending/provisional eBay orders without manual order-ID entry. One BullMQ job per Amazon buyer account scrapes that account's "Your Orders" list, then strict-matches each scraped Amazon order to an eBay candidate and writes real costs.

- **Queue**: `amazon-order-sync` (BullMQ, `AMAZON_ORDER_SYNC_QUEUE`). Cron `AMAZON_ORDER_SYNC_CRON` (default `0 */3 * * *` — every 3 hours), one job per Amazon account. Concurrency: `AMAZON_ORDER_SYNC_CONCURRENCY` (default 2).
- **This tick is the platform's biggest scaling lever, and its cadence is a capacity decision, not a latency one (2026-08-10).** It costs one Playwright scrape per **account** per fire whether or not that account sold anything, so its cost is `accounts × ticks/day` and is **independent of order volume**. `AmazonRateLimiter` caps the whole platform at 5 concurrent browser actions ⇒ ~432k browser-seconds/day; at 500 accounts × ~35s the former every-30-minutes default demanded ~840k/day — roughly **2× the available supply**, i.e. a permanent backlog that never drains. Every 3 hours costs ~140k/day and fits. Raising the frequency only shortens how soon **already-placed** orders get their Amazon costs written: purchasing is triggered directly from order ingest (`maybeEnqueueAutoFulfill`) and tracking has its own per-order schedulers, so nothing a seller waits on runs here. Tune it at `/admin` → Settings (`amazon.orderSync.cron`, `requiresRestart`) before sizing up hardware.
- **Per-account flow** (`AmazonOrderSyncService.runForAccount`):
  1. Select candidate eBay orders for the user with `cost_capture_status IN ('pending','provisional')` and `order_date >= NOW() - 60 days` (ASIN resolved via `orders → listings → products` JOIN).
  2. `AmazonScrapingService.scrapeAccountOrders(userId, accountId, since)` — Playwright scrape of the account's order list since `amazon_accounts.last_orders_sync_at` (first sync defaults to 30-day look-back). Returns `{ rows, suspect }`.
  3. For each Amazon order, `pickBestMatch` (pure helper) picks the highest-scoring eBay candidate via `scoreAmazonOrderMatch` (**strict**: requires ALL of same ASIN + same quantity + amount within tolerance + date within window; any miss → no match, never force-link).
  4. On a confident match: write Amazon `purchase_price`/`amazon_tax`/`amazon_shipping`, set `amazon_linked_at`, set `cost_capture_status = linked`, call `recomputeProfit(ebayOrderId)` → trusted `net_profit`.
  5. Misses stay `pending`/`provisional` for the next tick or manual linking.
- **Watermark discipline** (Keepa-aligned, no silent drops):
  - **Transport failure** (Playwright crash, Amazon 5xx, network): `scrapeAccountOrders` throws → BullMQ retries the whole job with exponential backoff; `last_orders_sync_at` is NOT advanced so the same window is re-pulled.
  - **Suspect 0-row scrape** (page redirected off "Your Orders", or zero order-cards on page 1 — likely a layout/selector break): treated as a data failure, NOT a legit empty. Watermark is held (no advance) and the run returns without throwing — the 30-min scheduler naturally retries on the next tick, avoiding a BullMQ retry storm on a persistent Amazon layout change.
  - **Legit empty / no candidates**: watermark advances normally.
  - **Per-Amazon-order failure** in the match/write loop: logged and skipped, never fails the run (watermark still advances for the rest).
- **Matching strictness** (`order-matcher.ts`): `scoreAmazonOrderMatch` requires identical ASIN (`+40`), identical quantity (`+20`), amount within `AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT` percent (`+up to 40`, scaled by closeness), date within `AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS` (`+up to 20`, scaled by closeness). Score is informational; `match: true` requires ALL four gates to pass. Wrong cost attribution is treated as worse than no attribution — there is no "best effort" force-link path.
- **Config (all optional, defaults shown):**
  - `AMAZON_ORDER_SYNC_CRON='0 */3 * * *'` — scheduler tick (every 3 hours; see the capacity note above before lowering it).
  - `AMAZON_ORDER_SYNC_CONCURRENCY=2` — parallel jobs (one per Amazon account).
  - `AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT=5` — max percent diff between Amazon `grandTotal` and eBay `sale_total`.
  - `AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS=7` — max day-delta between Amazon and eBay order dates (candidate pool itself is 60-day to cover slow ship paths).

### Amazon Order Tracking (Amazon → eBay Status Sync)
- **Queue**: `amazon-tracking` (BullMQ, per-order schedulers)
- **Intervals** (env-tunable, hours): pre-ship `AMAZON_TRACKING_PRESHIP_INTERVAL_HOURS` (default **6** — the only urgency is pushing the tracking number to eBay soon after Amazon ships); shipped `AMAZON_TRACKING_SHIPPED_INTERVAL_HOURS` (default **24** — delivered-detection has no time-critical side effect, and 12h polling of the longest order phase doubled scrape traffic for nothing)
- **No auto-stop**: Tracking continues until order reaches a terminal state (delivered, cancelled, completed). The processor removes the job when terminal status is detected.
- **eBay sync**:
  - Amazon `shipped` → `POST /sell/fulfillment/v1/order/{id}/shipping_fulfillment` on eBay with tracking number
  - Amazon `delivered` → Order status set to `completed`; if the order was never observed `shipped` (fast delivery between ticks), the eBay fulfillment push runs first so eBay always gets the tracking
- **Hardened semantics (2026-07-28, `amazon-tracking-processor.service.ts`)**:
  - **Fresh eBay token**: the shipped push uses `EbayService.getAccountAccessToken(ebayAccountId)` (refresh-on-demand) — never the raw `ebay_accounts.access_token` column, which is expired by the time the 6–12h tick fires.
  - **No silent drop**: a failed eBay fulfillment POST propagates out of `handleShipped` → the local status write is skipped → the next tick retries the push. Only permanently-unpushable conditions (account gone/inactive, no linked listing item) log-and-advance.
  - **Fresh tracking on transition**: the freshly scraped tracking number/carrier are mirrored into the in-memory row before the shipped push (the row was read pre-scrape and is empty on the first shipped detection).
  - **Status regression guard** (`shouldApplyStatus`): no-op writes, transitions out of terminal states, and SHIPPED → pre-ship downgrades are blocked (the Amazon parser's `'pending'` fallback on a layout miss must not rewind an order and cause a duplicate eBay fulfillment later).
  - **Interval downshift**: on the shipped transition the per-order scheduler is re-upserted at the 12h interval (previously only a restart's `reconcileSchedulers()` applied it).
  - **Amazon-cancel ≠ eBay-cancel**: an Amazon-side cancellation (migration `056`) stamps `orders.amazon_cancelled_at` and stops tracking but NEVER overwrites the local eBay order status — the eBay sale is still live and must be fulfilled another way. Such orders surface in the "needs attention" filter (`auto_fulfill_status IN (blocked,failed) OR amazon_cancelled_at IS NOT NULL`) and as an "Amazon cancelled" badge in the orders list.
  - **Tracking kickoff on auto-link**: `AmazonOrderSyncService` schedules per-order tracking immediately after a confident cost-capture match (previously tracking only started at the next API restart via `reconcileSchedulers`).
- **On startup**: `reconcileSchedulers()` cleans up orphaned schedulers and creates missing ones for active orders

### Automated Amazon Fulfillment (A2)

When `store_settings.auto_fulfill_enabled` is on, a brand-new matched eBay order automatically triggers an Amazon purchase on a round-robin buyer account. Fires from the **same `upsertOrder` `xmax = 0` genuine-insert seam** as sale-driven stock-sync — A2 only runs on the first ingest of an order, never on re-syncs. Intended for the dropshipping flow: eBay sale → buy on Amazon → ship-to buyer → Amazon tracking forwarded to eBay.

- **Queue**: `auto-fulfill` (BullMQ, literal `AUTO_FULFILL_QUEUE = 'auto-fulfill'`, registered in `OrdersModule` via `BullModule.registerQueue`). Producer = `AutoFulfillQueueService` (orders module) invoked from `OrderSyncService.maybeEnqueueAutoFulfill` on the genuine-insert path. Processor = `AutoFulfillProcessor extends WorkerHost` (amazon module). `jobId = fulfill-${ebayOrderId}` dedup, `attempts: 3`, exponential backoff 60s. Concurrency: `AUTO_FULFILL_QUEUE_CONCURRENCY` (default 1) — sequential per the rate-limiter contract.
- **Producer resolution** (`OrderSyncService.maybeEnqueueAutoFulfill`, pure helpers in `auto-fulfill-helpers.ts`):
  1. `StoreSettingsService.getResolvedSettings(userId, entity.ebayAccountId)` (store-specific override falls back to the user's global row — same Store > Global > Default resolution as the rest of `store_settings`; fixed 2026-07-28, previously always passed `null` and silently ignored any per-store `autoFulfillEnabled` override) → if `!autoFulfillEnabled` → status `skipped`, no enqueue.
  2. `SELECT id, last_used_at, auto_fulfill_cap_total FROM amazon_accounts WHERE user_id=$1 AND auto_fulfill_enabled=TRUE AND auto_fulfill_cap_total IS NOT NULL` → empty → `skipped`.
  3. `pickRoundRobinAccount` picks oldest-`last_used_at`-first (NULL treated as oldest); ties broken by id ASC.
  4. `meetsCoarseCapGate(saleTotal, cap)` pre-filter — `saleTotal > 0 && saleTotal <= cap`. Obvious over-cap orders never enqueue.
  5. `UPDATE amazon_accounts SET last_used_at = NOW` on the picked account → `enqueue(ebayOrderId, amazonAccountId)`.
- **Checkout service** (`AmazonCheckoutService`, step-structured Playwright). Every browser action goes through `AmazonRateLimiter.schedule(accountId, …)`. Step sequence inside `runForOrder → checkout`:
  1. **Idempotency re-check** — re-reads `orders.auto_fulfill_status`; `shouldSkipFulfillStart` (PLACED/BLOCKED/DRY_RUN/SKIPPED) → log + return. Prevents double-order on BullMQ retries.
  2. `loadInputs` (joins amazon_accounts + listings + products) — throws `no_asin` if no row, `cap` on non-finite cap.
  3. `ensureLoggedIn` via `AmazonScrapingService.ensureAuthenticatedPage` → maps captcha/OTP/login signals to `captcha`/`otp`/`login`.
  3b. **Cart hygiene** — `clearCart` best-effort empties the active cart BEFORE adding our item (a blocked prior attempt or the buyer's personal items would otherwise be co-purchased — Amazon checks out the WHOLE cart).
  4. Add-to-cart with quantity — `out_of_stock` if ASIN unavailable or no visible add-to-cart button.
  4b. **Cart verification (HARD, fail-closed)** — `verifyCartContents` navigates to the cart page and requires EXACTLY one active line item matching our ASIN (and, when readable, the order quantity) → otherwise throws `cart` + `cart-mismatch` evidence snap. An unreadable row count also blocks; selector drift surfaces during dry-run tuning, before money moves.
  5. `selectShipToAddress` (throws `address`), `selectDefaultPayment` (throws `payment` on decline signals).
  **Ship-to must be the eBay BUYER, never the buyer account's default.** `loadInputs` refuses the order (`address`) when `orders.shipping_address` lacks street/city/zip — it previously defaulted to `{}`, and the flow then "used whatever Amazon pre-selected", i.e. the account holder's own address: a paid order delivered to the wrong person with the eBay sale still unfulfilled. Saved-address selection uses the pure, unit-tested `addressBlockMatchesBuyer` (`address-match.ts`), which requires street **and** zip (plus the unit line when the buyer has one) — a zip-only rule silently picked the wrong entry when one household held two addresses under the same zip (observed live: `30 N GOULD ST 24233` vs `STE567`). Name is corroborating only, since eBay and Amazon render recipients differently. No match → `addBuyerAddress` enters the buyer's address; if that is unavailable the order fails closed.
  6. **Review-step HARD CAP** — reads grand total on the review page (the last step before "Place Order"). The **Place Order control must be visible** before the total is accepted (`review_unreadable` otherwise): Amazon's address step also renders an "Order total" sidebar, so without this gate the cap was checked against an earlier step's figure and dry-run reported success without ever proving the final pre-purchase page. The total is read from labelled selectors first, then a structure-independent `/order total|grand total\s*:?\s*\$N/` text fallback anchored to the LABEL (never "first price on the page", which could be a subtotal). Non-finite/≤0 → `review_unreadable` (distinct from `cap`, so a selector break is never misreported as the spend guard working); `> capTotal` when `AUTO_FULFILL_REVIEW_CAP_HARD_STOP !== 'false'` (default ON) → `cap`. Aborts BEFORE the click, never over-spends.
  7. **Dry-run** (`amazon_accounts.auto_fulfill_dry_run`) → snap `dry_run_review`, then `simulatePlacement` + return. NO click.
  **Dry-run simulates the post-purchase bookkeeping** so an operator can verify what a real placement does to an order — which costs land, that it becomes cost-captured, what net profit is computed — without money leaving. It writes a `SIM-`-prefixed `amazon_order_id` (`SIMULATED_AMAZON_ORDER_PREFIX`), splits the REAL review-page total into `purchase_price`/`amazon_tax`/`amazon_shipping`, sets `cost_capture_status='linked'`, and calls the real `recomputeProfit` so `net_profit` is produced exactly as production would. Three safety properties are load-bearing: `auto_fulfill_status` stays **DRY_RUN** (never `placed`, so `shouldSkipFulfillStart` and the PURCHASED state are untouched); the `SIM-` prefix makes `deriveFulfillmentState` report SIMULATED; and **tracking is NOT scheduled** — the id is fake, so a tracker would scrape a non-existent Amazon order and mark the row failed. Fail-soft throughout: a diagnostic aid must never break the run it inspects.
  8. Else click "Place Order" (click errors swallowed at warn-log to prevent double-order races), `parseConfirmation` (throws `no_confirmation` on missing confirmation DOM), `onPlaced`, set status `placed`.
- **Money safety — `onPlaced` (fail-soft layered)**: after a confirmed placement, NO path rethrows into the processor's failure branch.
  - **Layer 1** (single atomic UPDATE): `auto_fulfill_status='placed'` + `cost_capture_status='linked'` + real `purchase_price`/`amazon_tax`/`amazon_shipping` + `amazon_order_id` + `amazon_linked_at=NOW` in one statement.
  - **Layer 2** (fallback if layer 1 throws): minimal UPDATE setting `amazon_order_id` + `placed` only.
  - **Layer 3** (best-effort try/catch): `OrderSyncService.recomputeProfit(ebayOrderId)` → trusted `net_profit` (A1 reuse — single writer invariant preserved).
  - **Layer 4** (best-effort try/catch): `AmazonTrackingQueueService.scheduleOrderTracking(orderId, amazonAccountId)` → existing tracker drives shipped→eBay shipped, delivered→completed.
- **Fail-closed typed errors**: `AutoFulfillBlockedError` carries one of the shared blocked reasons (`no_asin`, `captcha`, `otp`, `login`, `out_of_stock`, `address`, `payment`, `cap`, `no_confirmation`, `cart`). `AmazonCheckoutService.runForOrder` catches its OWN blocked errors → sets `auto_fulfill_status='blocked'` + `auto_fulfill_blocked_reason` + returns (NO BullMQ retry — blocked is a permanent data/state condition, not transport). Any error that ESCAPES to `AutoFulfillProcessor.process` is transport/infra: on the final attempt it sets `auto_fulfill_status='failed'` then rethrows so BullMQ applies backoff. The idempotency re-check inside `runForOrder` is what keeps retries safe across the producer→processor boundary.
- **Evidence screenshots**: full-page PNGs at `fulfillment-evidence/{ebayOrderId}/{stage}-{timestamp}.png` via `snap(page, ebayOrderId, stage)` (path overridable via `FULFILLMENT_EVIDENCE_DIR`, default `$CWD/fulfillment-evidence`). Stages include each blocked-reason, `dry_run_review`, and the order confirmation. **No admin-role gating is enforced in code** — the directory is treated as admin-only via filesystem perms on the server.
- **Guardrails (defense-in-depth)**: master toggle (store settings) + per-account enable/cap/dry-run (amazon_accounts) + **proxy-required-to-enable** (server-side `AmazonAccountsService.assertCanEnable` throws `amazon.errors.autoFulfillProxyRequired` if `!proxyService.isConfigured()` and `amazon.errors.autoFulfillCapRequired` if `capTotal == null` when the flag is on) + review-step hard cap + coarse pre-filter + dry-run + fail-closed typed errors + idempotency re-check.
- **Config (all optional, defaults shown):**
  - `AUTO_FULFILL_QUEUE_CONCURRENCY=1` — parallel checkout jobs (keep at 1 to honour per-account rate limiting).
  - `AUTO_FULFILL_CHECKOUT_MIN_TIME_MS=4500` — minimum spacing between checkout steps (human-like pacing).
  - `AUTO_FULFILL_REVIEW_CAP_HARD_STOP=true` — any value ≠ literal `'false'` keeps the review-step cap on (default ON).
  - `FULFILLMENT_EVIDENCE_DIR=$CWD/fulfillment-evidence` — screenshot output dir.
  - `FULFILLMENT_EVIDENCE_TTL_DAYS=7` — evidence PNG retention; `AmazonCheckoutService` sweeps per-order dirs older than this hourly (default 7d, clamped 1–365).
  - `PROXY_PROVIDER` — **`.env.example` placeholder only; no runtime branch** — the provider format is encoded entirely in `PROXY_USER`/`PROXY_PASS_TEMPLATE`.
  - `PROXY_ENDPOINT`, `PROXY_USER` (supports `{session}` placeholder), `PROXY_PASS_TEMPLATE` (supports `{session}`), `PROXY_STRATEGY` (`perUser` default | `perAccount` reserved) — see "Amazon Scraping — Anti-Ban Strategy" below.
- **Settings UI — two gates, both customer-facing.** Auto-fulfillment only runs when BOTH are on, matching `maybeEnqueueAutoFulfill`'s resolution order:
  1. **Store gate** — `autoFulfillEnabled` toggle in the live `StoreSettingsDrawer`, set globally or per eBay store (Store > Global > Default, same as `amazonTaxRate`). The drawer also carries the tracking-conversion provider Select (only `local` visible; `api` labeled "coming soon").
  2. **Buyer-account gate** — `autoFulfillEnabled` toggle + `autoFulfillCapTotal` in the live `AmazonAccountDrawer`, per Amazon buyer account. A user with two buyer accounts must opt each one in separately. Enabling is refused by `assertCanEnable` without a proxy or a cap; the drawer surfaces the backend's own error key (`autoFulfillProxyRequired` / `autoFulfillCapRequired`) rather than a generic failure so the user knows which guard rejected them.

  **`auto_fulfill_dry_run` is deliberately NOT in any customer UI.** It exists to validate the Playwright `CHECKOUT_SELECTORS` against live Amazon DOM — a platform engineering concern with no customer meaning. Operators set it directly on `amazon_accounts` for the one-time selector-tuning pass. (The former `features/amazon/accounts/AmazonAccountsPage` carried all three fields but was orphaned — no route, no importer — when settings moved to the hub+drawer model; it was deleted and its customer-facing fields moved into `AmazonAccountDrawer`. **Credential verify is now reachable** as a per-card "Verify login" action in `AmazonAccountsDrawer` — re-saving the password purely to trigger a retry was not a usable recovery path, since verification can fail for reasons unrelated to the stored credentials (stale session, proxy hiccup, Amazon challenge). Account delete is still unreachable in the UI — a known gap.)

**Amazon authentication must be positively PROVEN, never inferred (`amazon-auth-state.ts`).** `probeAmazonAuth` + the pure, unit-tested `decideAmazonAuth` are the single source of truth, used by `performLogin` (post-login gate), `BrowserStateManager.isSessionValid` (session reuse) and `AmazonCheckoutService.ensureLoggedIn` (pre-checkout gate). Precedence: an auth route (`/ap/signin`, `/ax/claim/*`) or a visible credential/OTP control is a HARD negative; auth-gated account content or a populated non-signed-out nav greeting is a positive; `signedOutNav` alone is a WEAK negative that must NOT veto a positive, because Amazon serves its header from a CDN cache that can render "Hello, sign in" on a fully authenticated page. Two bugs made this necessary: (a) `!url.includes('/signin')` treated Unified Auth's `/ax/claim/*` pages as valid sessions, and a submit that merely produced no error was marked ACTIVE — so `AmazonAccountStatus.ACTIVE` was a false positive; (b) `ensureLoggedIn` only probed for captcha/OTP, so a signed-out page silently no-opped every checkout step (each helper treats a missing control as "layout variant, skip") and the run failed only at the review-total read — misreported as `cap`. Hence `review_unreadable` is now a distinct blocked reason from `cap`, and "Proceed to checkout" is a mandatory step (`clickFirstAvailable` returns a boolean; a miss there throws `cart`).
- **`OrderFulfillmentState` is the seller-facing vocabulary** (`packages/shared/src/domain/orders/fulfillment-state.ts`, derived at read time by the pure `deriveFulfillmentState`, unit-tested): `purchased | amazon_cancelled | action_required | in_progress | not_automated | manual | simulated`. It exists because the raw columns could not answer "did Amazon buy this, and must I act?" without knowing the schema — `orders.status` is eBay-only, `auto_fulfill_status` has seven values (several internal), `amazon_cancelled_at` is a separate flag that overrides `placed`, and `cost_capture_status` is a third axis. Precedence is load-bearing: an Amazon cancellation outranks `placed` (money moved, item not coming, eBay sale still owed), and a `SIM-` order id reports SIMULATED so a dry run can never look purchased. The list column, detail page and filter all read this one value; `GET /orders?fulfillmentState=` filters it **in SQL** so paging/totals stay correct. FE mapping (badge variant, icon, per-state guidance key) lives in `features/orders/shared/fulfillment-state.ts`.
- Orders list shows ONE unified fulfillment column (badge + blocked reason + Amazon order id). The old pairing of a raw `auto_fulfill_status` badge with a separate cancellation badge required schema knowledge to read, and an untouched order rendered a bare em dash. The status filter offers only the statuses the sync actually writes (`pending | waiting_shipment | processing | shipped | completed`) — `mapOrderStatus` never writes `cancelled`, so offering it guaranteed an empty result that read as a broken filter. The former two-value "needs attention" dropdown is replaced by the fulfillment-state filter (`autoFulfillNeedsAttention` is still accepted for API compatibility). Labels i18n'd under `orders.fulfillmentState.*` (EN + TR).
- **A missing Amazon product page is `no_asin`, not `out_of_stock`.** `isProductPageMissing` checks HTTP 404/410 and Amazon's own "couldn't find that page" screen before the availability check. Reporting a delisted ASIN as out-of-stock told the seller to wait for stock that will never return; the two need different actions (fix/end the listing vs. wait).
- **Shared enums**: `AutoFulfillStatus` (`pending|running|placed|blocked|failed|dry_run|skipped`) + `AutoFulfillBlockedReason` (13 values incl. `proxy_required`, `quota_exhausted`, `cart`, `review_unreadable`) in `packages/shared/src/domain/orders/orders.types.ts`; `TrackingConversionProvider` (`local|api`) in `packages/shared/src/domain/amazon/amazon.types.ts`. The `auto-fulfill-helpers.ts` re-exports a template-literal type derived from the enum (single source of truth).

### Tracking Converter (real-only, pluggable)

Introduced by A2 so post-purchase shipped events map Amazon carrier strings to eBay's enum without fabricating tracking data. **Used by every shipped order** (auto-fulfill, manual link, auto cost-capture alike). Wired in `AmazonTrackingProcessorService.handleShipped` — resolves the per-user `store_settings.tracking_conversion_provider` and fails closed to `LOCAL` on any miss/error.

- `TrackingConverter` interface + `resolveConverter(provider)` (`tracking-converter.ts`).
- **`LocalTrackingConverter`** (active): `TB[A-Z]*` number prefix OR `amazon` carrier string → eBay `Amazon_Logistics` pass-through. Otherwise map known carriers via `EBAY_CARRIER_MAP` (`ups→UPS`, `usps`/`u.s. postal service`/`united states postal service`→USPS, `fedex`/`federal express`→FedEx, `dhl`/`dhl express`→DHL_Express); unknown → passthrough with `shippingCarrierCode = car || 'Other'`.
- **`ApiTrackingConverter`** (reserved stub): `convert()` throws — no sanctioned 3rd-party provider configured.
- **No fabrication policy**: eBay deprecated Bluecare/Aquiline network support across 2024–2026, so TBA/TBM/TBC tracking numbers are passed through as `Amazon_Logistics` rather than remapped to an invented carrier. The `TrackingConverter` path is the sole carrier-mapping seam (`mapCarrierForEbay` removed).
- **Provider restriction**: UI exposes only `local` (the `api` option is hidden behind a "coming soon" label); backend `@IsIn([TrackingConversionProvider.LOCAL])` enforces it on write.

### Amazon Scraping — Anti-Ban Strategy
- **Session isolation**: Each Amazon account gets its own browser state. **Legacy** (pre-A2): `.browser-state/{accountId}.json` storage-state files. **Current** (A2+): per-account persistent user-data-dir at `${BROWSER_STATE_DIR || $CWD/.browser-state}/profiles/{accountId}/` via `chromium.launchPersistentContext` — one full browser profile per account, cached in-process by `BrowserStateManager.getContext`. Legacy `.browser-state/{accountId}.json` sessions are migrated on first launch of the new profile via post-launch `context.addCookies(...)` (cookies only — localStorage intentionally NOT migrated; errors swallowed).
- **Idle eviction (I2 memory bound)**: each persistent context owns a Chromium process (~150–300 MB RSS). `BrowserStateManager` runs a periodic sweep (`BROWSER_CONTEXT_SWEEP_INTERVAL_MS`, default 2 min) and closes contexts that are **provably idle**: `context.pages().length === 0` **and** untouched longer than `BROWSER_CONTEXT_IDLE_TTL_MS` (default 10 min). The zero-page guard is non-negotiable — in-flight scrape/checkout always holds ≥1 page, so eviction cannot crash active work. Callers must still go through `AmazonRateLimiter.schedule(accountId, …)`.
- **Profile disk GC (2026-08-10) — the eviction above bounds MEMORY; this bounds DISK.** Nothing ever touched the `user_data_dir` itself, so a profile grew without limit (HTTP cache, code cache, service-worker CacheStorage, GPU/shader caches) and a deleted account leaked its profile forever: **50–250 GB at 500 accounts, with no cleanup at all**. `BrowserProfileGcService` (daily, first run 10 min after boot) closes that gap. Policy lives in the pure, Jest-covered `browser-profile-gc.ts`; the service is the fs shell.
  - **A cache prune never costs a login, and that distinction is the whole design.** Amazon's session is cookies (`at-main`/`sess-at-main`/`session-id`/`ubid-main`) in `Default/Network/Cookies`, decrypted with the key in the profile-root `Local State`. `CHROMIUM_DISPOSABLE_CACHE_PATHS` is an **allowlist** of browser-managed caches Chromium already evicts under disk pressure; `CHROMIUM_SESSION_CRITICAL_PATHS` names the session files, and the spec asserts no disposable entry **is or is an ancestor of** a critical one. That ancestor check is the real guard — listing `Default/Network` would take `Cookies` with it. Cost of a prune: one cache miss on the next page load. **Never add a path to the disposable list without re-reading that test.**
  - **Full removal is the rare branch, because a re-login can hit a captcha/OTP and take a buyer account out of service.** Only two cases reach it: an **orphan** (account gone from `amazon_accounts` — nothing to log back into, zero risk) and a profile **dormant** past `BROWSER_PROFILE_GC_DORMANT_DAYS` (default **90**; by then Amazon has usually expired the session server-side anyway, so the eviction is effectively free). `0` disables dormant eviction while keeping prune + orphan purge. `resolveBrowserProfileGcConfig` falls back to the **default** on an unparseable value and clamps to a 7-day floor — a typo must never become a mass re-login event.
  - **Three safety properties, each of which was a way to break an account**: (1) every mutation runs inside `AmazonRateLimiter.schedule(accountId, …)`, with a **liveness re-check inside the lock**, so a prune and a `launchPersistentContext` can never interleave on one `user_data_dir`; (2) a failed `amazon_accounts` read **aborts the sweep** — treating a DB outage as "no accounts exist" would purge all 500 profiles as orphans; (3) `hasLiveContext` outranks everything else. Reclaimed bytes are measured only for full removals: stat-ing every cache file across 500 profiles daily would cost minutes of IO for a log line.
  - Panel-tunable at `/admin` → Settings → **Data retention & disk** (`amazon.browserProfileGc.*`).
- **Fingerprint isolation**: Deterministic per-account fingerprint (user-agent, viewport, timezoneId from `hashCode(accountId)`) — same account always looks the same across restarts.
- **Proxy stack (A2, refactored 2026-07-28 — fixed ISP pool)**: PRIMARY model is a pool of **fixed ISP proxies** (static IP, unlimited bandwidth, ~$3-4/proxy/30d) in the `proxies` table (migration `057`): operator INSERTs rows (`host`/`port`/`username`/`password` — password may be plaintext, `ProxyService.onModuleInit` re-encrypts it AES-256-GCM `enc:`-prefixed on next boot), and each **user** is lazily assigned exactly ONE proxy (`assigned_user_id UNIQUE`, atomic `FOR UPDATE SKIP LOCKED` claim, oldest row first). All of a user's Amazon buyer accounts exit from the same static IP — the "one household, several accounts" pattern; per-user granularity also contains the blast radius between unrelated customers. `ProxyStatus` enum (`active|disabled`) in `packages/shared`; a `disabled` (burned) proxy is never used even if still assigned — the user re-claims a free one on next resolve. `ProxyService.isConfigured()`/`resolve()` are **async** now (DB-backed). GB-billed rotating residential was rejected on cost (~25-30 GB/user/month ≈ $125-180/user vs $3-4 fixed).
  - **Legacy env fallback** (used only while the `proxies` table has no ACTIVE rows): single rotating-residential template `PROXY_ENDPOINT`/`PROXY_USER`/`PROXY_PASS_TEMPLATE` with a sticky `{session}` token via `proxySessionToken(strategy, userId, amazonAccountId)`; `PROXY_STRATEGY=perUser` (default) | `perAccount`. A pool that EXISTS but is exhausted deliberately does NOT fall back to env (mixing static-IP and rotating models per user would make IP behavior unpredictable) — resolve returns null and checkout fails closed.
  - **Proxy fallback discipline**: `BrowserStateManager.resolveProxy()` returns null when `!(await proxyService.isConfigured())` → existing scraping runs **direct** (no regression when no proxy exists). **Auto-fulfill is hard-blocked without a proxy** — `AmazonAccountsService.assertCanEnable` calls `proxyService.ensureAvailableFor(userId, …)` (eagerly claims a pool proxy so the user gets enable-time feedback instead of a runtime block) and throws `amazon.errors.autoFulfillProxyRequired` / `autoFulfillCapRequired`; AND `AmazonCheckoutService.runForOrder` re-checks `isConfigured()` + `isProxyActive` at runtime (defense-in-depth: pool disabled/exhausted after enable → checkout blocks with `auto_fulfill_blocked_reason='proxy_required'` instead of running bare-IP).
- **Rate limiting** (Bottleneck via `AmazonRateLimiter.schedule(accountId, …)`):
  - Global: max `AMAZON_GLOBAL_CONCURRENCY` concurrent browser actions (default **5**, unchanged from when it was hardcoded). **This is a resource guard, not the anti-ban control** — bans are governed by the per-account limits below, which stay hardcoded; raising the global does not make any single account look busier. It is also the **platform throughput ceiling**: capacity is `maxConcurrent × 86,400` browser-seconds/day (5 ⇒ ~432k), and past ~400 buyer accounts it becomes the binding constraint. Lower `AMAZON_ORDER_SYNC_CRON` before raising it — that is far cheaper than the RAM (~150–300 MB RSS per unit).
  - Per-account: 1 concurrent, 3 seconds between requests, 20 requests/minute
  - Exponential backoff on 429/captcha/block responses
  - **Invariant**: callers MUST go through `AmazonRateLimiter.schedule(accountId, …)` so two `launchPersistentContext` calls never race the SingletonLock on the same user_data_dir.
- **Session reuse**: Existing cookies restored on repeat visits. Full login only when session expires.
- **Stealth**: `playwright-extra` + `puppeteer-extra-plugin-stealth` (patches navigator.webdriver, plugins, WebGL, etc.)
- **2FA support**: TOTP via `otplib` — user provides the secret key from Amazon's 2FA settings

### eBay Fulfillment API
- `createShippingFulfillment(accessToken, ebayOrderId, lineItemId, quantity, { trackingNumber, shippingCarrierCode })` — marks order as shipped on eBay
- Tracking number + carrier are mutually dependent — both must be provided together
- Currently forwards Amazon's real tracking number. Future: replace with generated fake tracking IDs for dropshipping.

### Buyer Auto-Messaging (settings-driven, optional)

Automated, template-driven buyer messages on four order lifecycle events. Configured per-store in Store Settings (global + per-eBay-store, same `store_settings` resolution as `amazonTaxRate`/`autoFulfillEnabled`). Per event: independent enable/disable + choose a predefined system template or a user-authored custom template. **No manual inbox/reply** — descoped; this is outbound-only automation.

- **Events**: `order_received` (thank-you on genuine order insert), `shipped` (on the tracking shipped transition — note eBay already auto-notifies on ship, so this is opt-in and the default template uses a distinct tone), `delivered` (on the delivered/completed transition), `feedback_request` (delayed BullMQ job, N days after delivered).
- **Config**: `store_settings.buyer_messaging` JSONB (`{ enabled, events: { [event]: { enabled, template: { kind: 'system'|'custom', id }, delayDays? } } }`). Row-level resolve (store row overrides global). Migration `054` adds the column + `buyer_message_templates` + `buyer_message_log`.
- **Templates are one unified, DB-backed, per-user space — no code-constant "system" templates (2026-08-08).** `buyer_message_templates` (migration `066` adds `is_default BOOLEAN`) holds every template a user can pick from, including their four starter defaults. `buyer_message_system_defaults` (migration `066`, PK `event_type`) is the DB-stored source copy for those defaults, replacing the old `SYSTEM_BUYER_MESSAGE_TEMPLATES` code constant — changing default wording is now a data change, not a deploy.
  - **Lazy per-user seeding, once.** `BuyerMessageTemplateRepository.ensureSeeded(userId)` (advisory-lock guarded, same "create on demand" idiom as `resolveProductData` in `listing-processor.service.ts`) inserts the four `is_default=true` rows from `buyer_message_system_defaults` the first time `GET /v1/buyer-messaging/templates` is called for a user with zero templates — never again after that, even if the user later deletes one, so a removed starter doesn't keep reappearing. Migration `066` also backfills existing users (skipping any event a user already has a row for) so it never ships with an empty list.
  - **A default is an ordinary template, not a protected one.** `isDefault: true` only drives a "Default" badge and the "Reset to default" action in the edit drawer — the row is fully editable/deletable/renamable like any other. `POST /v1/buyer-messaging/templates/:id/reset` restores just the `body` (not the name) from `buyer_message_system_defaults`, and only for a template where `is_default = true`.
  - **`BuyerMessageTemplateKind.SYSTEM` is legacy-only**, kept so a `store_settings.buyer_messaging` config saved before this change keeps resolving: `BuyerMessageService.resolveTemplate` reads its body from `buyer_message_system_defaults` by event type (DB), not the removed constant. New saves from the settings UI always write `CUSTOM` pointing at a real template row — the picker no longer distinguishes "system" vs "custom" sources.
- **Pipeline**: lifecycle seam → `buyer-message` BullMQ queue → `BuyerMessageProcessor` (idempotency guard via `buyer_message_log` partial-unique on `(ebay_order_id, event_type) WHERE status='sent'`; re-checks config at fire time → `skipped` if disabled; `redactForLog` strips tokens before any logged/thrown error; fail-soft `enqueue` never breaks order/tracking flows) → `BuyerMessagingProvider` port (`EbayMessageApiProvider`, eBay REST Message API `sendMessage`; token resolved per-account via `EbayService.getAccountAccessToken`).
- **Triggers**: `OrderSyncService` genuine-insert seam (`order_received`); `AmazonTrackingProcessorService` status transitions (`shipped`, `delivered` + delayed `feedback_request`). All env-gated (`BUYER_MESSAGING_ENABLED=true`, default off) + per-user config.
- **Env**: opt-in is per-user via Store Settings (master toggle + per-event) — there is NO env master switch. Only `BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS=3` (default feedback-request delay).
- **FE — three surfaces, not one drawer.** `BuyerMessagingSection` (master toggle + 4 padded event cards, per-event template picker listing that user's own templates for the event, delayDays, shared hover/click/focus Tooltips explaining each event), mounted in `StoreSettingsDrawer` step 2. It is controlled by `StoreSettingsDrawer.container`; there is no nested Save — the drawer's final Save persists both ordinary store settings and the messaging config together through the existing two endpoints. Template management lives on the settings hub's "Store Configuration" card as two sibling drawers (mirrors the Listing Settings Groups Manage/Create split): `BuyerMessageTemplatesDrawer` (list — one merged grid of every template incl. defaults, event-type filter, full (untruncated) body preview per card, delete w/ `ConfirmModal`) and `BuyerMessageTemplateDrawer` (create/edit — name/event/body/placeholder-chips/preview, event type locked once created, "Reset to default" + confirm when `isDefault`). RTK Query: `storeSettingsApi` (config GET/PUT) + `buyerMessagingApi` (template CRUD + `resetBuyerMessageTemplate`). i18n under `storeSettings:storeSettings.messaging.*`.
- **Key files**: `apps/api/src/modules/buyer-messaging/` (`buyer-messaging.module.ts`, `buyer-message.service.ts`, `buyer-message.processor.ts`, `buyer-message-queue.service.ts`, `buyer-message.provider.ts`, `buyer-message-template.repository.ts` (+ `ensureSeeded`/`resetToDefault`/`getSystemDefaultBody`), `buyer-message.controller.ts`, `buyer-message-helpers.ts` + `.spec.ts`, `buyer-messaging.constants.ts`). Shared: `packages/shared/src/domain/buyer-messaging/`, `packages/shared/src/schemas/buyer-messaging/`. The `buyer-message` queue is registered in the admin queue registry (`ADMIN_QUEUE_NAMES`, `OBSERVED_QUEUE_NAMES`).
- **Known follow-ups (deferred minors from implementation)**: the eBay Message API `sendMessage` exact field shape is `// TODO(confirm)` in the provider (port-isolated, verified against live docs at runtime).

### Key Files
- **Backend orders**: `src/modules/orders/` — OrdersService, OrderSyncService (owns `recomputeProfit` + `maybeEnqueueAutoFulfill`), EbayFulfillmentService, OrderSyncQueueService, OrderSyncProcessorService, **AutoFulfillQueueService** (A2 producer). Pure helpers: `profit-calculation.ts` (`computeNetProfit`, `deriveCostCaptureStatus`, `estimateProvisionalNetProfit`, `deriveProfitBasis`), `*.spec.ts` unit tests.
- **Backend Amazon**: `src/modules/amazon/` — AmazonAccountsService (owns `assertCanEnable` A2 guard), AmazonScrapingService, AmazonOrderParserService, AmazonTrackingQueueService, AmazonTrackingProcessorService (wires the tracking converter), AmazonRateLimiter, BrowserStateManager (persistent context + proxy), **AmazonOrderSyncService + AmazonOrderSyncQueueService + AmazonOrderSyncSchedulerService + AmazonOrderSyncProcessor** (auto cost-capture), **order-matcher.ts / pick-best-match.ts** (pure match heuristic + tests), **AmazonCheckoutService + AutoFulfillProcessor + auto-fulfill-helpers.ts (.spec.ts)** (A2 checkout/processor/pure helpers), **proxy.service.ts** (fixed ISP proxy pool w/ per-user assignment; legacy env-template fallback), **tracking-converter.ts (.spec.ts)** (`LocalTrackingConverter` + `ApiTrackingConverter` stub + `resolveConverter`).
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

## System Requirements & Deployment (local / test / prod)

Zonds runs the same code in every environment — only config (env vars) and capacity differ. Three runtimes: **local** (developer machine), **test** (Coolify on a VPS), **prod**. There is no environment-specific code path.

### Shared stack (all environments)

| Component | Purpose | Notes |
|---|---|---|
| **PostgreSQL 16** | primary DB (`pg` driver, no ORM) | schema in `docker/postgres/init.sql` + `apps/api/migrations/`; auto-run on API boot |
| **Redis 7** | BullMQ job queues | `order-sync`, `stock-sync`, `amazon-*`, `auto-fulfill`, `keepa-refresh`, etc. |
| **Node 20+ / pnpm 9+** | api + web + packages | monorepo workspace |
| **Playwright Chromium** | Amazon scraping + A2 checkout | headless; needs OS libs (see below) |
| **(A2) Fixed ISP proxies** | Amazon anti-ban | REQUIRED for A2 auto-fulfill; optional-but-recommended for scraping. Rows in the `proxies` table (one per user, auto-assigned); legacy `PROXY_*` env fallback |

**Playwright/Chromium OS deps** (Linux servers, not needed on local Docker which bundles them): `libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2`. Install once: `npx playwright install --with-deps chromium`.

### Local dev

- **Machine:** your PC. **8 GB RAM minimum** (Chromium for scraping is the heaviest single process).
- **Services:** `pnpm docker:up` runs PostgreSQL + Redis + pgAdmin in Docker — nothing else to install.
- **A2 here:** runs, but **auto-fulfill is hard-blocked without a proxy** (`ProxyService.isConfigured()` false — empty `proxies` table and no env fallback). That's fine for testing flow logic. To exercise a live checkout you need a real Amazon buyer account + at least one row in the `proxies` table — then use **dry-run mode** on the account.
- No GPU needed (A2 uses Playwright CPU; local LLM is a separate B-spec concern).

### Test (Coolify / VPS)

- **Current Hostinger VPS:** 4 vCPU, 16 GB RAM, 200 GB disk, **no GPU** — runs api + web + postgres + redis + Playwright. This is adequate for test.
- Run Postgres + Redis as containers (Coolify stack or `docker-compose`). api + web as Coolify services behind the Coolify reverse proxy.
- **Add fixed ISP proxies at `/admin` → Proxies** if you want scraping ban-resistance and to test A2 dry-run/live checkout. Record each proxy's expiry + monthly cost there so renewals are alerted on and the pool cost is visible.
- Add real Amazon buyer accounts (encrypted at rest via `AMAZON_ENCRYPTION_KEY`).
- 16 GB is comfortable for a handful of accounts; the I2 idle-eviction (`BROWSER_CONTEXT_IDLE_TTL_MS`) bounds resident Chromium so even ~10–20 accounts won't pile up.

### Prod

- **PostgreSQL 16** (managed recommended) + **Redis 7**, both with persistence + backups.
- **API + Web** behind a reverse proxy (Coolify / Nginx / Caddy) with TLS.
- **CPU:** 4+ vCPU (Playwright is CPU-bound; the per-account rate limiter caps concurrency, but headroom matters).
- **RAM — the key dimension, driven by concurrent Amazon accounts:** ~150–300 MB per resident Chromium context + ~1–1.5 GB base (api + web + Postgres + Redis). I2 idle-eviction means resident contexts are bounded by **active** concurrency, not total account count. **Minimum 16 GB; 32 GB for multi-tenant scale.** Set OOM/alerting on memory.
- **Disk:** every large consumer is now TTL-bounded, but size for the steady state, not the average. At ~500 accounts: Postgres 60–100 GB in year 1 (mostly `products.raw_keepa_data`, with the append-only logs held by the `data-retention` job), `.browser-state/profiles/` bounded by `BrowserProfileGcService` (unbounded before 2026-08-10 — it was the single largest consumer at 50–250 GB), `fulfillment-evidence/` ~15 GB at the 7-day TTL, Loki ~10–20 GB at 7 days, `apps/api/logs/` a few GB gzipped. **Budget 1 TB NVMe at 500 accounts**; 50 GB only covers a handful.
- **Fixed ISP proxies:** **required** for A2 — one per user (auto-assigned from the `proxies` pool), static IP, unlimited bandwidth (~$3-4/proxy/30d). Add them at `/admin` → Proxies with their expiry date so lapses are alerted before the static IP is released. Size the pool to the active-user count; GB-billed residential was rejected on cost (~25-30 GB/user/month through Playwright).
- **GPU:** not required and not planned — Playwright is CPU-bound and the LLM is a hosted API call.

### Secrets / env checklist (per environment)

- `AMAZON_ENCRYPTION_KEY` — 32-byte hex (AES-256-GCM for buyer-account credentials). **Required wherever amazon_accounts are used.**
- JWT/auth secrets (access + refresh-cookie signing).
- `KEEPA_API_KEY` (product refresh pipeline).
- eBay app credentials (per connected store).
- A2 proxies: rows in the `proxies` table (fixed ISP pool, primary) — `PROXY_ENDPOINT` / `PROXY_USER` / `PROXY_PASS_TEMPLATE` / `PROXY_STRATEGY` env is the legacy fallback only.
- `CORS_ORIGINS` / `COOKIE_DOMAIN` / `COOKIE_SAMESITE` (prod web origin).
- A2 tunables (all optional, defaults safe): `AUTO_FULFILL_*`, `BROWSER_CONTEXT_*`, `FULFILLMENT_EVIDENCE_*`, Keepa refresh tunables.

**Env vs admin panel.** The list above is the complete set of things that MUST be env: connection bootstrap, crypto keys, provider credentials, process identity. Operational tuning (Keepa refresh cadence + kill switch, AI content toggle, quota enforcement, SMTP host/user/password, order-matching tolerances, evidence retention, admin warning thresholds) is edited at `/admin` → Settings and stored in `platform_settings`; env values there are only the fallback when no override row exists. Prefer the panel — it needs no redeploy and is audit-logged.

**Compose files.** `docker-compose.yml` = local dev services (Postgres/Redis/pgAdmin/Loki/Promtail/Grafana — no LLM service; see "Provider/config"). `docker-compose.test.yml` = Coolify test/sandbox (eBay sandbox endpoints, debug logging, concurrency 1). `docker-compose.production.yml` = Coolify production (eBay production endpoints). The two Coolify files build the same images from the same code and differ only in configuration; both mount `browser_state` + `fulfillment_evidence` + `api_logs` volumes, define a `/api/health/live` healthcheck, and carry a memory limit sized for resident Chromium contexts.

### A2 operational checklist (before enabling real-money auto-fulfill in any environment)

1. Proxy capacity present (`ProxyService.isConfigured()` true — ≥1 ACTIVE row in `proxies`, or legacy env fallback) and reachable. Add it at `/admin` → Proxies; the tab shows free-vs-assigned capacity and warns when the pool is exhausted.
2. ≥1 Amazon buyer account with `auto_fulfill_enabled=true` + `auto_fulfill_cap_total` set.
3. **Run `auto_fulfill_dry_run=true` first** — confirms the full checkout flow reaches the Amazon review step and the cap behaves, **without charging**. Inspect `fulfillment-evidence/{ebayOrderId}/dry_run_review-*.png`.
4. **Tune the Playwright selectors** in `AmazonCheckoutService` against live Amazon DOM during dry-run (selectors are best-effort and DOM-drift is the main fragility). Keep selectors in the `CHECKOUT_SELECTORS` constant.
5. Only then flip `auto_fulfill_dry_run=false` on a low-value test order and watch the placed/blocked status + evidence.
6. Monitor: BullMQ queue depth (`auto-fulfill`, `amazon-tracking`), `orders.auto_fulfill_status` (watch `blocked`/`failed`), memory (Chromium), proxy bandwidth.

### A2 enablement status & gating (read this before touching auto-fulfill)

> **State as of 2026-07-20:** A2 code is COMPLETE and reviewed on `development`, but **auto-fulfill is NOT yet usable end-to-end** because two prerequisites are external to the codebase. Do not tell the user "A2 works / is done" without checking these — the code compiles and unit-tests pass, but no live checkout has ever been run.

**The single remaining gate before any real Amazon purchase is `dry-run selector tuning`. It is NOT a code task — it is a live, operator-driven verification that must happen once, against real Amazon, before real money is allowed to leave. The reason it cannot be done in code is:** the Playwright selectors in `AmazonCheckoutService.CHECKOUT_SELECTORS` (add-to-cart, address selection, review grand-total, confirmation parse) are written against Amazon's DOM, which Amazon rotates frequently and which differs by account/region. There is no way to validate them without an actual logged-in Amazon buyer session. Selectors that look correct in code routinely miss on the live page → the flow blocks (`out_of_stock` / `address` / `no_confirmation`) or worse, proceeds to the wrong step. Dry-run mode (`auto_fulfill_dry_run=true`) runs the ENTIRE checkout up to (but not including) the "Place Order" click and screenshots every step, so you can confirm each selector resolves and the review-step total is read correctly — **without spending money**.

**Prerequisites the user must provide (cannot be coded):**
1. **Fixed ISP proxies** — buy N ISP Dedicated proxies (e.g. IPRoyal ISP, US location, ~$3-4/proxy/30d, unlimited bandwidth) and add them at `/admin` → Proxies (migrations `057`/`058`; the password is encrypted at insert and never shown again). One proxy per user, auto-assigned. **Status: NOT purchased yet (2026-07-28; model switched from GB-billed residential to fixed ISP on cost — see "Proxy stack").** Without any pool row (or legacy `PROXY_*` env fallback), `AmazonCheckoutService.runForOrder` hard-blocks every order with `auto_fulfill_blocked_reason='proxy_required'` (the runtime guard). This is by design — auto-fulfill over the bare server IP bans Amazon buyer accounts.
2. **A real Amazon buyer account** connected in Zonds (email + password + 2FA secret), with `auto_fulfill_enabled=true` + `auto_fulfill_cap_total` set + `auto_fulfill_dry_run=true`.

**How to guide the user when they want to "turn on auto-fulfill" / "test it" / "go live":**
- **No proxy purchased yet → A2 cannot run.** Tell them the proxy is the first purchase (fixed ISP Dedicated, US location, ~$3-4/proxy/30d, one per user — add it at `/admin` → Proxies). Do NOT suggest enabling `auto_fulfill_enabled` on any account — it will be rejected by `assertCanEnable` (proxy + cap required) and/or block every order at runtime. There is no code workaround; the proxy is a hard safety floor.
- **Proxy purchased + Amazon account added → run dry-run first.** Set `auto_fulfill_dry_run=true` on the account, ingest one new matched eBay order (or wait for the order-sync cron), then read `orders.auto_fulfill_status` (expect `dry_run`) and the screenshots under `fulfillment-evidence/{ebayOrderId}/`. If any step shows a wrong page / missing total / blocked reason other than `cap`, the `CHECKOUT_SELECTORS` for that step need a live-DOM patch — that is the "selector tuning" task. Repeat until `dry_run_review-*.png` shows the correct review page with a readable grand total and the cap behaves.
- **Dry-run clean → one low-value live order.** Flip `auto_fulfill_dry_run=false`, set a tight `auto_fulfill_cap_total` (e.g. $10), and watch `auto_fulfill_status` flip to `placed` + a real `amazon_order_id` + `net_profit` (trusted, LINKED). Only then widen to normal caps / more accounts.
- **Never skip dry-run.** The review-step hard cap is only as good as `readReviewGrandTotal`; if that selector misses on the live DOM, the cap check fails closed (`cap` block) — safe, but it means auto-fulfill is silently not working. Dry-run is how you prove the selectors resolve before money is at stake.

**What is safe to do right now without a proxy:** everything in the code, the settings UI, the FE chip/filter, and `auto_fulfill_status='skipped'`/`'proxy_required'` behavior. You can connect Amazon buyer accounts, configure caps/dry-run flags, and watch the producer enqueue → processor block with `proxy_required`. That exercises the entire pipeline except the Playwright checkout, which is the part that needs the proxy + live tuning.

### Observability — log tracing (Loki/Promtail/Grafana)

A free, self-hosted log-tracing stack, present in **every** environment (local `docker-compose.yml` and both Coolify compose files) so a request/job can be traced end-to-end by `correlationId` — the id already stamped onto every `apps/api` log line by `RequestIdMiddleware` → AsyncLocalStorage → Winston's `correlationFormat` (see `apps/api/src/common/observability/`).

- **Why file-tailing, not container-log scraping**: locally `apps/api` runs on the host via `pnpm dev:api`, not in a container, so there is no API container stdout for Promtail to scrape. Instead Winston writes JSON logs to `apps/api/logs/*.log` (`logger.config.ts` — the two `winston-daily-rotate-file` transports now run in **every** environment, not just `NODE_ENV=production` as before; `LOG_LEVEL` is also now actually honored, previously a silent no-op) and Promtail tails that directory. Local dev bind-mounts the host folder (`./apps/api/logs`); the Coolify files share a named `api_logs` volume between the `api` and `promtail` services (`api`'s WORKDIR is `/app/apps/api`, so the same relative `logs/` path lands in the shared volume). One `docker/promtail/promtail-config.yml` is reused everywhere via `-config.expand-env=true` + an `ENVIRONMENT` env var set per compose file (`development`/`test`/`production`).
- **Label design**: only `level` (bounded: debug/info/warn/error) plus the static `job`/`environment` labels are indexed in Loki. `correlationId`/`queueName`/`jobId`/`context` are parsed by Promtail's `json` pipeline stage into queryable-but-unindexed fields — putting a high-cardinality id straight into a Loki label is a known anti-pattern that wrecks the index.
- **Local dev**: `pnpm docker:up` starts `zonds_loki` (`:3100`), `zonds_promtail`, `zonds_grafana` (`http://localhost:3001`, `admin`/`admin123` — hardcoded like pgAdmin's local-dev credentials) alongside the existing services; no `pnpm docker:*` script changes were needed since they run plain `docker-compose` with no `-f` filter. Grafana auto-provisions the Loki datasource and a starter "Zonds API Logs" dashboard (`docker/grafana/provisioning/`) — nothing to click through.
- **Trace a request**: grab the `X-Request-ID` response header (or read it straight from a log line), then in Grafana → Explore → Loki: `{job="zonds-api"} | json | correlationId="<id>"`.
- **Coolify (test/production)**: same three services added, on the `coolify` network. **Grafana publishes no host port** (neither does `api`/`web` in these files — Coolify's own domain/proxy config is how a service becomes reachable), and `GRAFANA_ADMIN_PASSWORD` is a **required** Coolify env var (no hardcoded prod password). Reach it via an SSH tunnel to the VPS; adding a public Coolify domain + auth for it is a deliberate follow-up, not wired up here.
- **Retention**: Loki filesystem storage with compactor-based retention, 7 days by default (`docker/loki/loki-config.yml`, `limits_config.retention_period`) — raise it there if you need longer history.
- Key files: `docker/loki/loki-config.yml`, `docker/promtail/promtail-config.yml`, `docker/grafana/provisioning/{datasources,dashboards}/`, `apps/api/src/common/config/logger.config.ts`.

### Backups & monitoring (prod)

- **Postgres:** daily logical backup (pg_dump) + point-in-time if managed.
- **`fulfillment-evidence/`:** ephemeral, TTL-cleaned — not backed up.
- **`.browser-state/profiles/`:** ephemeral session profiles — not backed up (re-login on loss). Disk-bounded by `BrowserProfileGcService`; watch its nightly summary line for orphan/dormant removals, since each one means an account will re-authenticate.
- **Alert on:** API OOM / restart, BullMQ dead-letter growth, proxy bandwidth quota, spike in `auto_fulfill_status='blocked'`.

## Figma Redesign — Per-Theme Tokens

The figma Make redesign (https://sweet-yang-69529706.figma.site/) introduced tonal shifts:
- **Primary is per-theme**: light uses `#2563eb` (blue-600), dark uses `#6366f1` (indigo-500). Do NOT expect them to match.
- **Sidebar background is per-theme**: light deep blue `#0c1f52`, dark near-black `#0d0f18`.
- **Borders are alpha-based**: `#00000014` (light) / `#ffffff12` (dark) — not solid hex.
- **`accent` token category** (emerald `#10b981`) is for "Active" status badges and success emphasis. Distinct from `semantic.success` (system success states).
- **Font**: **Inter** for headings + **Lexend** for body/UI. Lexend is drawn for reading fluency (wide apertures, tall x-height) which suits dense tables/forms; Inter keeps titles neutral so they don't compete with the data. Both SIL OFL 1.1, latin-ext (TR-safe). Loaded via Google Fonts in `apps/web/index.html`; tokens in `packages/ui/src/theme/designTokens.ts`; base `body` rule in `apps/web/src/index.css`. Mono = JetBrains Mono.
  - **History — do not flip this back without a reason stronger than taste.** The app shipped on Inter + Lexend until `fb00bc9` (2026-07-17) swapped in a single family, Source Sans 3, for "a calmer institutional feel". That was reverted on 2026-07-30 and the pairing restored deliberately, together with the tighter size/leading scale below. Two round trips is enough; a third needs a concrete defect (a rendering, legibility or TR-glyph problem), not a preference.
- **Body is 14px, not 16.** `typographyTokens.fontSize.base` (0.875rem) is the primary reading size and the value-text size for every form control (TextInput/Select/SearchField/MessageComposer). `fontSize.md` (15px) is now the **heading** step (`h4`), not body. Heading leading is tight (`lineHeight.display` 1.1 / `tight` 1.2 / `snug` 1.3) because Lexend's x-height already carries the row; body is `normal` 1.47 (14/~21).
- **Text ink**: soft neutral charcoal primary (`#27272a`), secondary (`#475569`). Brand blue `#2563eb`. **Softened 2026-08** from `#0f172a` (slate-900, blue-tinted near-black) after live user feedback that body/heading text read too harsh/cold — dark theme's `text.primary` (`#e2e8f0`, light ink on dark) was already soft and is untouched.
- **Weights**: headings / card titles **semibold**; row labels **semibold** for clarity. **Softened 2026-08** after live user feedback that the app read too bold: `typographyTokens.fontWeight.semibold` dropped from `600`→`500` and `bold` from `700`→`600` (`normal`/`medium` untouched — body text was never the complaint). One token-file change cascades to every consumer (headings, buttons, badges, active nav/tab state, table row labels) since none of them hardcode a weight. The whole app's font-size scale also dropped one step at the same time (see the Typography scale table below) — both changes are pure `packages/ui/src/theme/designTokens.ts` edits, no per-component overrides.
- **Radii**: progressive scale — sm 6px (badges/checkboxes/table cells), md 8px (buttons/inputs/selects), lg 12px (cards/dialogs), xl 16px (modals), 2xl 20px (hero). Tokens in `packages/ui/src/theme/designTokens.ts` (`radiusTokens`); `controlTokens.radius` matches `radiusTokens.md`. **`radiusPxTokens`** (`theme.radiusPx`, adds `xs: 4`) is the pixel mirror for SVG/canvas consumers such as recharts, which cannot take rem — use it instead of hardcoding a chart radius, and keep both scales in sync.
- **Sidebar nav**: Inventory + Configuration. Route breadcrumbs from `apps/web/src/app/routeMeta.ts`.
- **Settings hub**: full-width 2-col grid; **header icons restored** on section cards; account rows keep row icons.

Redesign spec: `docs/superpowers/specs/2026-07-03-figma-site-refactor-design.md`.

## Frontend Architecture Notes (2026-07)

### Typography scale (use `<Text variant>` — never raw font-size in feature CSS)
**Softened 2026-08** (live user feedback: too large/bold) — every size below `xxxl` dropped ~1px and `semibold`/`bold` each dropped one loaded weight step (600→500, 700→600). Both are token-file changes (`packages/ui/src/theme/designTokens.ts`), so they apply everywhere at once — no per-component overrides.

| Variant | Size | Use for |
|---|---|---|
| `h1` | 23px / semibold(500) | Page titles (`PageHeader`) |
| `h2` | 19px / semibold(500) | Rare large section titles |
| `h3` | 17px / semibold(500) | Drawer titles, major section |
| `h4` | 15px / semibold(500) | Card titles (`SettingsCard`, `QuickActionCard`) |
| `h5` | 13px / semibold(500) | Small section labels |
| `body` | 14px / regular | Primary UI text, control text, row labels |
| `body-sm` | 13px / regular | Table cells, secondary denser text, drawer subtitles |
| `body-xs` | 10px / regular | Micro meta |
| `caption` / `overline` | 11px / 10px | Meta, helper, chips |
| `mono` | 11px | Codes / IDs only |
| `metric` | 19px / semibold(500) / tabular-nums | KPI figures (period cards, detail-page headline). Headings are for titles — do **not** repurpose `h1`/`h2` for numbers |
| `metric-sm` | 17px / semibold(500) / tabular-nums | Secondary KPI figures (net profit under a headline metric) |

**`numeric` prop** — any figure rendered in a column (money, counts, percentages) must set `<Text numeric>` so digits are tabular and stack down the column. `metric` / `metric-sm` already enable it. A money cell in `body`/`body-sm` without `numeric` visibly jitters row to row.

**KPI card pattern** — label is `caption` + `text.secondary`, figure is `metric`. Never give the label the same weight as its own number (`body` + semibold labels above an `h3` figure was the old Admin pattern and read as two competing headings).

**Title → subtitle gap**: `PageHeader` uses `spacing.xs` between title and subtitle. Title is always `Text variant="h1" weight="semibold"`; subtitle is `body-sm` secondary. **Do not** invent ad-hoc page titles.

**Page shell (mandatory alignment)**:
- Outer gutter is **only** `AppLayout` `ContentInner` (responsive padding). Feature pages must **not** add their own outer `padding`.
- Root of every authenticated page: `PageContainer` from `@repo/ui` (or `PageContainerWithMobileBar` for detail pages with sticky mobile action bars). Gap between title and sections = `spacing.lg`.
- Pattern: `<PageContainer><PageHeader title={…} subtitle={…} />…</PageContainer>`. Export as `Container = PageContainer` in feature `*.style.ts` if preferred.
- Never double-pad (ContentInner + page Container) — that misaligns titles across screens.

### Form controls (must stay aligned)
**`controlTokens.height` in `designTokens.ts` is the single source of truth.**
`packages/ui/src/styles/formControl.ts` derives from it — it must never re-declare
a height literal. (It used to, and had drifted 4px away from the tokens *and* from
this table, so a labeled TextInput never matched the Button beside it.)

| Size | Compact (no floating label) | Labeled (floating label) |
|---|---|---|
| small | 2.5rem | 3.25rem |
| medium | 2.75rem | 3.5rem |
| large | 3rem | 4rem |

- **TextInput**, **Select**, **SearchField**, **Textarea** share the same heights, surface treatment and `border.control` idle border. Hover does not alter the border. Focus/open uses a clean **brand.primary** border with no halo or box-shadow; field validation uses the shared `ValidationMessage` (outlined triangle-info glyph + semantic error text).
- **`colors.border.focus` must always equal `colors.brand.primary`.** They are separate tokens for historical reasons; when they diverged, focused controls used different colours in dark mode.
- **Floating labels are mandatory** for form fields (drawers, settings, auth). Do **not** place an external `<Text>` label above a TextInput/Select — use the `label` prop.
- Toolbar/filter rows may use compact controls with `placeholder` only (no label) so Search + Select share one height.
- Button `medium` = 2.75rem (matches compact medium); Button `large` = 3.5rem (matches **medium labeled**, i.e. the auth-form pairing of labeled input above primary submit). Form primary actions in drawers use `medium` not `large`.
- Every interactive atom carries a `:focus-visible` ring in `brand.primary`. Checkbox / Radio / Toggle hide their real `<input>`, so they mirror focus onto the visible box with `input:focus-visible + &` — a plain sibling selector, **never** an Emotion component selector (those need the babel plugin and crash at runtime).

### Card grids (list surfaces)
`DataTable`'s grid derives its column count from **`gridMinItemWidth`** (the
narrowest track a card can survive in) via `auto-fill`, optionally capped by
**`gridMaxColumns`**. It used to be `repeat(3, 1fr)` above 75rem, which handed a
wide horizontal card ~380px — not enough for its own contents, so the card
visibly crushed. Current settings: Orders `26rem`/max 2 · Listings `24rem`/max 2 ·
Jobs `20rem` · Products `19rem`. A card that lays out horizontally (thumbnail
beside content) must declare a wide minimum; a compact tile can go narrow.

Inside a card, a fixed `repeat(N, 1fr)` stat strip is the usual failure mode —
use `repeat(auto-fit, minmax(…, 1fr))` so cells reflow instead of truncating.

### Density, radius and elevation (one scale, no per-page drift)
- **Card tier radius is `lg` (12px)** — `Card`, `SettingsCard`, `QuickActionCard`, `Table` container, `FilterBar`. Controls are `md` (8px), badges/checkboxes are `sm` (6px), modals `xl`.
- **Card content inset is 18px (`spacing.md+`)** whether you use `<Card padding="lg">` or `<CardBody>` — the two APIs resolve to the same value on purpose.
- **Table rhythm**: `Th` 11px vertical, `Td` 7px vertical, `Tr` min-height 2.5rem → ~38px rows. Header stays taller than data so chrome reads lighter. (Spacing scale softened 2026-08 alongside the typography pass — see `spacingTokens` in `designTokens.ts`; every step ≥8px dropped ~1-2px, the finest gaps (2-6px) untouched.)
- **`TableColumn.align` is honoured** by `Th`/`Td`/`ThContent`. Money and count columns are `align: 'right'` + `<Text numeric>`; text columns stay left. (The prop existed but was dead for a long time — every right/center column silently rendered left.)
- **Never hand-roll a Card.** Detail pages had five separate styled-components duplicating the atom's surface/radius/shadow/padding. Extend it — `styled(Card)` with layout-only CSS — so a change to the card language reaches every page.

### Overlay and breakpoint tokens
- **`theme.zIndex`** (`zIndexTokens`): `sticky 100 · scrim 990 · sidebar 1000 · dropdown 1100 · assistant 1200 · overlay 9000 · drawer 9100 · modal 9200 · toast 9400 · loading 9600 · tooltip 9800`. Never hardcode a z-index — the global loading overlay once resolved to the string `"4rem"` (from `tkn('spacing.xxxl')`), which is invalid for the unitless property, so the browser dropped it and the overlay rendered *behind* drawers and modals.
- **`theme.breakpoints`** (`breakpointTokens`): `sm 30rem · md 48rem · lg 64rem · xl 80rem`, plus `*Below` max-width complements. The app previously carried ~11 hand-typed breakpoint literals.
- **One drawer shell (2026-08-08):** every `Drawer` is 32rem (full-width below `md`) with the same header/footer surfaces, soft body canvas, typography and spacing from `packages/ui/src/molecules/Drawer`. The legacy `size="sm|md|lg"` prop remains source-compatible but does not change panel geometry. Dense flows must make their internal layout responsive/scrollable inside the canonical width — never widen or narrow the surrounding drawer for one feature.

### Accessibility floors held by the token layer
- `text.tertiary` must clear WCAG AA (4.5:1) on `surface.primary`, `surface.secondary` **and** `background.tertiary` in **both** themes. It is used 60+ times; the previous value failed in dark on both surfaces and in light on `background.tertiary`.
- Dashboard period-band gradients are **theme-identical** (the bands are always-dark by design, like the landing hero) and dark enough that `periodForeground` clears 5.3:1 and `periodForegroundMuted` clears 4.7:1 on every stop.

### Container logic extraction
God containers are forbidden. Extract feature hooks under `features/<feature>/hooks/`:
- Example: `listings/all/hooks/useListingsFilters.ts`, `useListingsColumns.tsx`.
- Container orchestrates data + hooks and returns only `<Component .../>`.
- `useForm` lives in container or `useXxxForm` hook — never in `.component.tsx`.

### Loading UX
- `useLoading(...)` is for **blocking mutations** only (save/delete/bulk), not initial page fetches.
- Initial list load → empty state / table message (or future skeleton), not full-app overlay.

### Routing
- Route-level `React.lazy` + `Suspense` in `App.tsx` for app pages. Landing stays eager.

### Domain vs design system
- Keep domain composites (`ListingCard`, `ConnectEbayPrompt`) generic where possible; prefer app-level wrappers if they grow domain-specific. Do not add more product/domain molecules to `@repo/ui` without review.
- **`@repo/ui` does NOT depend on `@repo/shared`.** Its tsconfig `rootDir` is `packages/ui/src` and the root path mapping resolves `@repo/shared` to *source*, so a single import breaks the build with `TS6059`. When a design-system component needs domain knowledge, inject it (context/prop) instead of importing shared.

### Marketplace links are environment-scoped (never hardcode a host)
Sandbox and production eBay are separate sites with separate item id spaces: `ebay.com/itm/<sandbox id>` is always a dead link. Item URLs are built by `buildEbayItemUrl(itemId, environment)` / `buildAmazonProductUrl(asin)` in `packages/shared/src/domain/ebay/ebay.urls.ts` (with the `EbayEnvironment` enum + `resolveEbayEnvironment`).
- The app resolves the environment **once** in `apps/web/src/main.tsx` from `VITE_EBAY_ENVIRONMENT` and passes the builders to `MarketplaceProvider` (`@repo/ui`). `IdBadge` — rendered from ~9 screens — and the listing-detail "open on eBay" action both consume them via `useMarketplaceContext()`, so header actions and row badges can never disagree.
- `VITE_EBAY_ENVIRONMENT` **must mirror the API's `EBAY_ENVIRONMENT`**; it is a Vite build-time arg, wired in `Dockerfile.web` and both Coolify compose files (`sandbox` in test, `production` in production). Missing/unknown value → production (safe default). The same commit added the missing `VITE_GOOGLE_CLIENT_ID` ARG/ENV to `Dockerfile.web` — compose was passing it into a build that never declared it, so the Google button was silently hidden in every container build.
- Amazon has no sandbox; `AmazonCheckoutService`'s Playwright navigation to `amazon.com/dp/<asin>` is a real purchase flow, not a UI link, and stays as-is.

### Every list endpoint is server-paginated (mandatory)
`GET /listings`, `GET /listings/jobs` and `GET /listings/products` all return
`{ items, total, page, limit }`. Jobs and products used to return unbounded
arrays that the browser filtered and sliced — and the jobs page polls every 5s,
so each poll re-downloaded the account's entire job history to render ten rows.

- `ListingJobsQueryDto` — `page`, `limit` (default 20, clamped 100), `search` (job-id prefix), `status`.
- `UserProductsQueryDto` — `page`, `limit`, `search` (title / ASIN / brand).
- Product counts use `COUNT(DISTINCT p.id)` to match the `SELECT DISTINCT` page query — a product with several listings must count once.
- Every filter control resets `page` to 1; otherwise a narrowed result set leaves the user on an empty page.
- **Never add a list endpoint that returns a bare array.** If a UI shows a table or grid over it, it needs `page`/`limit` on day one.

### Listings list (server-side — mandatory)
- `GET /listings` returns `PaginatedListingsDto` `{ items, total, page, limit, categories }` — **never** the full catalog for table UIs.
- Query: `ListingsQueryDto` — `page`, `limit`, `search`, `status`, `category`, `ebayAccountId` (store filter), `sortBy`/`sortOrder`, numeric range mins/maxes. Deprecated `stockPreset` still accepted for API compat; **FE does not send it** — use advanced `quantityMin`/`quantityMax` only (avoid dual stock filters).
- `lastSaleAt` on list rows: `MAX(orders.order_date)` correlated subquery via `orders.listing_id` (cheap with index). Sort keys `lastSale` / `lastSaleAt`.
- FE: `useGetListingsQuery(query)`; ListingsAll URL params via `useListingsFilters` (`q`, `page`, `limit`, `sort`, `dir`, `store` → `ebayAccountId`, `status` default **active**).
- Status filter options: **all / active / inactive** only on operational list chrome. **Drafts** are a dedicated view (`?status=draft`) from overview → Other actions → View drafts; not mixed into carousel or default “all” (API excludes `draft` when status is omitted). **No status column** on the all table by default.
- **Draft create**: `CreateListingsRequest.asDraft` → queue worker prepares product/pricing, inserts `listings` with `status=draft` and **no** eBay publish (`ebay_item_id` nullable). Publish later via `POST /listings/:id/publish` or bulk `POST /listings/bulk-publish`. Shared detail page for drafts + live listings.
- Default visible columns: product, price, quantity, sold, **lastSale**, profit, createdAt — **not** source/listingId/status (ASIN + eBay id live inside product cell).
- Product cell: transparent image (no gray plate), title 2-line clamp, ASIN/eBay label rows; selection column is narrow (`Table` `$selection` + `colgroup`, `@repo/ui` must be **rebuilt** after Table style changes — package loads from `dist/`).
- Overview/Dashboard: small pages (`limit: 12` / `50`). Client-side filter/sort/slice of the full catalog is **forbidden**.

### Dashboard panel (Sellerboard-style)

**Toolbar**: underline tabs (icon + label) on the left, store filter pinned right **on the same row** — `flex-wrap: nowrap` with a scrollable tab rail, never wrapping onto a second line. The store `Dropdown` must be wrapped in an auto-width flex parent (`S.ToolbarRight`): the atom's own container is `display: block; width: 100%`, so as a bare flex child it claims the whole row and pushes itself below the tabs. The tab rail is deliberately underline-styled, not a pill group, so page navigation reads differently from the in-card `SegmentedControl`.

**URL state** (all in the query string, shareable): `?tab=cards|chart|pnl`, `?period=today|thisWeek|thisMonth|thisYear`, `?store=<ebayAccountId>`, `?granularity=day|week|month`. Owned by `hooks/useDashboardUrlState.ts`; defaults are omitted from the URL. Every value is a **shared enum** (`DashboardTab`, `DashboardPeriodKey`, `DashboardChartGranularity`, `DashboardChartSeries`, `DashboardPnlGroup`, `DashboardValueFormat` in `packages/shared/src/domain/dashboard/`) — no string literals.

- **Cards tab**: 4 period cards (gradient band + headline sales, net profit w/ margin, trend chips, orders/units · refunds · gross profit · ROI grid, expandable "More details" with payout/COGS/tax/shipping/fees/AOV/refund-rate) over two carousel sections (`ListingCarousel` + `OrderCarousel` in `Card`s, "view all" moved into the card header). Selecting a card refilters both carousels (listings via `soldFrom`/`soldTo`, orders via `dateFrom`/`dateTo`). Skeleton cards render during the first load — **never** `useLoading` for the initial fetch.
- **Chart tab**: ComposedChart — net-profit **bars** (gradient fill) against sales/units/refunds **lines**, dual axis (currency left, count right), custom themed tooltip, **click-toggleable legend chips**, and a `SegmentedControl` for granularity (30 days / 12 weeks / 12 months). Right rail is a grouped P&L summary (Revenue · Costs · Profit · Ratios) with emphasized gross/net totals.
- **P&L tab**: metrics × 12-month matrix, grouped sections, sticky metric column + header, current-period column highlighted, **heat-map toggle** (per-row relative intensity via an opacity overlay — never a hardcoded rgba) and **client-side CSV export** (the matrix is already in memory; no API round-trip).
- **View all** → `/listings/all?soldFrom&soldTo&from=dashboard` or `/orders/all?dateFrom&dateTo&from=dashboard`; back returns to `/dashboard`.
- API: `GET /v1/dashboard?chartGranularity=&ebayAccountId=` → `{ metrics, chart: { granularity, points, summary }, history: { months } }`. The old `days`/`revenueTrend`/`recentOrders` payload was removed — nothing consumed it and the granularity switch replaces it.
- **Bucket keys are anchored on Postgres' `CURRENT_DATE`** (`getAnchorDate()`) and emitted as `to_char(...,'YYYY-MM-DD')` text, never a `date` column: node-pg parses `date` into a *local-midnight* Date, so an API process in UTC+3 talking to a UTC database used to generate keys that never matched and rendered an empty chart/P&L. Do not reintroduce `toISOString()` on a pg `date`.
- **Cost/ratio aggregates**: `periodSelect()` also sums `purchase_price`, `transaction_fee`, `ad_fee`, `amazon_shipping`, `amazon_tax`; `roi = profitConfirmed / costOfGoods` and `refundRate = refunds / (orders + refunds)`. Costs are display-only (already inside `ebay_earnings`) and render with a `−` prefix.
- **Tiered profit** (per period): headline `netProfit` is **confirmed-only** (`cost_capture_status = 'linked'`, trusted Amazon costs). `profitProvisional` (product-only costs) and `revenueUncosted` (pending/failed/untracked — revenue only, no profit) surface as separate chips with tooltips, so users never confuse an unknown cost with a real zero. See "Net Profit Formula" for the enum semantics.
- **Theme tokens**: `colors.dashboard.period*Gradient` (band backgrounds), `periodForeground`/`periodForegroundMuted` (fixed light ink on the always-dark bands — **never** `text.inverse`, which flips per theme), `series{Profit,Sales,Units,Refunds}`, `heat{Positive,Negative}`.
- **Files**: `apps/web/src/features/dashboard/` — `DashboardPage/` (shell), `components/{PeriodCard,CardsPanel,ChartPanel,PnlPanel}/`, `hooks/{useDashboardUrlState,useDashboardFormatters}.ts`, `utils/{metricRows,chartSeries,pnlExport,periodRanges,emptyMetrics}.ts`, `dashboard.types.ts`. `utils/metricRows.ts` is the single source of truth for row order/labels/formats shared by the chart summary and the P&L matrix.

### Listings UX chrome (mobile-first SaaS)
- Prefer **no** dense PageHeader action button clusters (Create / Export / End) on list/detail. Use overview QuickActions, SettingsCard rows, drawers, DataTable toolbar download, or a single mobile **Manage** sheet.
- Product images on cards/detail/table: **`background: transparent`** (match `ListingCard`).
- Avoid duplicate facts: ASIN/eBay once; economics once; do not triple KPI + facts + economics.

### Listing detail (`apps/web/src/features/listings/detail/`)
- Layout: hero (gallery + ids + chips) → economics card → stock/performance → **automation** → configuration (edit drawer) → system → product content (description / features / specs).
- Automation UI maps to DB overrides (migration `029`):
  - **Pause sales** → `disable_ordering` (force qty 0)
  - **Fixed price** → `lock_price` + `disable_repricing` (+ optional `price_override`)
  - **Fixed quantity** → `lock_quantity` (+ optional `quantity_override`)
  - **Custom margin** → `margin_*_override` only when fixed price is off
- Worker: `product-sync.service.ts` applies overrides on refresh fan-out.
- Detail payload joins product `features` + builds `specs` (Brand + parsed `Key: Value` features); description from product.

### Multi-store (`ebay_account_id`)
- **Create/import store selection is mandatory:** both Add Listings and Existing eBay Import drawers require an explicit eBay store on step 1. `ebayAccountId` travels through request → persisted listing job → BullMQ batch → processor → `EbayBulkService.createListings`; these flows must never publish through an arbitrary `LIMIT 1` active account. It is enforced at enqueue (`400` when absent), not defaulted.
- Migration `030`: `listings.ebay_account_id` (backfill from user's eBay account). Create path sets it via `EbayService.getActiveAccountId`.
- Filter: listings `?ebayAccountId=`; orders already had `orders.ebay_account_id` + same query param.
- FE store Select options from `useGetEbayAccountsQuery`.

### Listing settings group — content policy
- Migration `031`: `listing_settings_groups.content` JSONB default `{ stripBrandFromTitle, aiTitleEnabled, aiDescriptionEnabled }` all false.
- UI: Settings → Listing Group drawer general step (toggles + hints). Shared: `ListingContentConfig`, Zod `listingContentConfigSchema`.
- Apply strip-brand + optional AI in `ListingStrategyService` at **create** only — see "Listing content policy" above.

### Auth / session security (implemented)
- **Refresh token**: HttpOnly cookie `zonds_rt` (`path=/api`, `SameSite=Lax`, `Secure` in production). JS cannot read it.
- **Access token**: memory only (Redux) — never `localStorage` / `sessionStorage`.
- **Boot**: `AuthBootstrap` calls `POST /auth/refresh` with `credentials: 'include'`; on success hydrates access token.
- **401**: `baseApi` single-flight cookie refresh, then retry; failure → logout.
- **Logout**: `POST /auth/logout` clears cookie + Redux wipe. Legacy `localStorage` token keys are purged on load.
- Do **not** reintroduce `localStorage.setItem('accessToken'|'refreshToken')`.
- **CORS**: API reads `CORS_ORIGINS` (comma-separated) or legacy `CORS_ORIGIN`. Production must list the real web origin(s).
- **Cookie env**: optional `COOKIE_DOMAIN` (e.g. `.takci.cloud`), `COOKIE_SAMESITE=lax|none`.
- **Google OAuth (GIS popup auth-code)**: optional. Env: `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (api), `VITE_GOOGLE_CLIENT_ID` (web — same Client ID). FE `@react-oauth/google` popup yields a one-time `code` → `POST /auth/google` → backend `google-auth-library` exchanges it (`redirectUri: 'postmessage'`) + `verifyIdToken`, then issues a normal session. **Never auto-merges** a Google identity into an existing password account — same email with a password account → `409 emailExistsPassword`. Google skips only name entry + email verification; onboarding/eBay connect/routing are identical to password login (same `{accessToken,user}` + `zonds_rt` cookie via `attachSession`). Pure `google-link-decision.ts` (login/create/block) is unit-tested. Google-only users have `password_hash = NULL`; password login is blocked for them (`invalidCredentials`). Missing env → API boots, endpoint returns `503 googleNotConfigured`, FE hides the button. Schema: migration `039` (`users.password_hash` nullable + `user_oauth_accounts` multi-provider table, unique on `(provider, provider_user_id)`). Design spec: `docs/superpowers/specs/2026-07-21-google-oauth-design.md`.
- Listings URL: `{VITE_API_BASE_URL}/listings?page=1&limit=…` — bare `/listings` without page still works (server defaults) but FE always sends page/limit.

### Domain UI vs design system
- Product-specific composites live in `apps/web/src/domain-ui/` (`ListingCard`, `ConnectEbayPrompt`).
- `@repo/ui` is design-system only (atoms/molecules/organisms + tokens). Do not re-add domain widgets there.

### Route metadata
- Breadcrumbs + nav section: `apps/web/src/app/routeMeta.ts` (`resolveBreadcrumbs`, `resolveNavSection`).
- Do not hardcode path→label maps in `AppLayout`.

### Settings surface
- Canonical UI: `/settings` hub + drawers only.
- Legacy full pages (`/settings/store`, `/amazon-accounts`, `/listing-groups`) redirect to the hub.

### One canonical flow per task (no duplicate surfaces)
Same rule as "one admin panel, no duplicates" and the settings-hub redirects:
- **Add listings** is the `AddListingsDrawer` only. `/listings/add` redirects to `/listings?drawer=add`; the standalone `AddListingsPage` was deleted. It was a second implementation over the same Zod schema with its own Card radius and raw `<h2>`/`<span>` typography, and would have silently drifted from the drawer.
- Before adding a page that duplicates an existing flow, add a tab, a drawer, or a query param instead.

### Tabs — one rail, one meaning
- **`TabNav`** (`packages/ui/src/atoms/TabNav/`) is the only tab rail: controlled (`items` / `value` / `onChange`), navigation-only, scrolls instead of wrapping. `Tabs` composes it when you also want it to own the panel content.
- Page-level section navigation (Dashboard, Admin, Support) = `TabNav` `underline`. Compact in-card switches (chart granularity, billing interval) = `SegmentedControl`. Grid↔table = `ViewToggle`.
- **Never use `Button variant="primary|secondary"` as a tab or filter group.** Admin and Support did, which made "where you already are" the loudest element on the page and left no weight for real CTAs. For the same reason, per-row Save buttons in a settings list are `secondary` — a tab full of primaries means nothing is primary.

### No hand-rolled primitives (the recurring failure mode)
Every one of these existed as a private copy before being folded back into the
design system. Reach for the atom first; if it can't express what you need, add
a variant to the atom rather than forking it.
- **Cards** → `styled(Card)`. Five bespoke copies existed across two detail pages, the add-listings flow and the error screen.
- **Textareas** → `Textarea`, which now carries `fill` (absolute-inset, fills a positioned card) and `mono` (code/HTML). Two features had forked a native `<textarea>` purely for those two behaviours and both lost the shared focus ring.
- **Buttons** → `Button` / `IconButton`. Carousel arrows, pagination dots and "view all" links were raw `styled.button`s re-implementing hover/focus/disabled. A pagination dot needs a ≥1.5rem hit area with a small visual mark inside — never make the 0.5rem dot itself the button.
- **Empty / loading / error screens** → `EmptyState`. Loading and empty on the same surface must use the **same** component, otherwise the two states look like different screens. The `ErrorBoundary` fallback uses it too (it was an emoji glyph over margin-spaced text).
- **Nested flows** → a real nested `Drawer` with `onBack`, not inline content swapped into the parent's card.

### Page-level loading is not the global overlay
`useLoading(...)` takes **mutation flags only**. Nine containers had folded their initial `useQuery` `isLoading` into it, so the blocking full-screen overlay covered the app on first paint of Settings, Stores, Products, Profile, Store Settings, Listing Groups and the add/edit drawers. Initial fetch renders the page's own `EmptyState` (loading title + description), never the overlay. Loading and empty must use the *same* component so the two states don't look like different screens.

### Listings CSV export
- `GET /listings/export` — same filters as list (incl. store/status/ranges), server-built CSV, max 5000 rows.
- FE: `useExportListingsCsvMutation` (not client-side CSV from a page of items).

### Migrations (listings-related recent)
| # | Purpose |
|---|---|
| `029` | Per-listing overrides (`disable_ordering`, locks, price/qty/margin overrides) |
| `030` | `listings.ebay_account_id` + backfill |
| `031` | `listing_settings_groups.content` JSONB |
| `032` | `listings.ebay_item_id` nullable (drafts before eBay publish) |
| `033` | `orders.net_profit` nullable (NULL = unknown, 0 = real zero) + `cost_capture_status` enum + index + backfill from `amazon_linked_at`/`listing_id` |
| `034` | `amazon_accounts.last_orders_sync_at` (watermark for the auto cost-capture scraper — migration `034`) |
| `035` | `store_settings.amazon_tax_rate` `NUMERIC(5,2)` default `0` (per-user global percent for provisional-profit estimate) |
| `036` | `store_settings.auto_fulfill_enabled` (master toggle, default `false`) + `tracking_conversion_provider VARCHAR(20)` default `'local'` (A2) |
| `037` | `amazon_accounts.auto_fulfill_enabled` (default `false`) + `auto_fulfill_cap_total NUMERIC(10,2)` (nullable) + `auto_fulfill_dry_run` (default `false`) (A2 per-account) |
| `038` | `orders.auto_fulfill_status` enum (`pending|running|placed|blocked|failed|dry_run|skipped`) + `auto_fulfill_blocked_reason VARCHAR(200)` + `auto_fulfill_attempted_at TIMESTAMPTZ` + partial index `idx_orders_auto_fulfill_status WHERE status IN ('blocked','failed')` (A2) |
| `039` | `users.password_hash` nullable (Google-only users) + `user_oauth_accounts` table (`provider`, `provider_user_id`, `provider_email`, unique `(provider, provider_user_id)`, multi-provider-ready) — Google OAuth |
| `040` | Append-only `llm_usage_log` (`user_id`, purpose/model, prompt/completion tokens, latency, success/error) for future per-user LLM cost attribution; no billing UI yet — shared LLM infra (B) |
| `049` | Admin Observability & FinOps foundation: append-only `usage_events` with nullable micro-USD estimated cost + effective-dated `shared_cost_entries`; user roles remain owned by migration `041`, LLM pricing by `048` |
| `050` | Idempotent Keepa/LLM usage projections: partial unique indexes for user-attributed and platform-level `usage_events` source references |
| `051` | Queue observability: append-only, payload-redacted `queue_observations` for idempotent BullMQ completed/failed event capture |
| `054` | Buyer auto-messaging: `store_settings.buyer_messaging` JSONB (config), `buyer_message_templates` (user custom templates), `buyer_message_log` (idempotency + audit; partial-unique `(ebay_order_id, event_type) WHERE status='sent'`) — see "Buyer Auto-Messaging" |
| `056` | `orders.amazon_cancelled_at TIMESTAMPTZ` + partial index — Amazon-side purchase cancellation flag (local eBay order status is never overwritten; surfaces in the needs-attention filter) |
| `057` | `proxies` pool table — fixed ISP proxies with per-user assignment (`assigned_user_id UNIQUE`, atomic claim); password encrypted at rest via boot backfill; replaces the env-template residential model (env kept as fallback while the pool is empty) |
| `058` | `proxies.expires_at` + `monthly_cost_micros` + `currency` + partial expiry index — proxy renewal tracking and pool cost, surfaced in the admin Proxies tab |
| `059` | `platform_settings` — operator overrides for runtime-tunable config (DB override → env → code default); registry-validated, secrets encrypted at rest |
| `060` | `products.specs` + `products.identifiers` (JSONB, grow-only) — item specifics and catalog identifiers cached per ASIN so a cache hit publishes full eBay specifics without a Keepa call |
| `062` | `ebay_category_aspects` (taxonomy cache, stale-servable) + `ebay_category_map` (category resolution + operator pins, CHECK refuses root category `1`) + `ebay_aspect_defaults` (curated + learned item-specific values) + `listings.ebay_category_id`/`aspect_resolution`/`aspect_autofilled_count` |
| `063` | `listing_job_items.failure_code` + `failure_details` — structured failure reasons so the UI stops rendering raw eBay strings |
| `064` | `listing_jobs.listing_settings_group_id` + policy ids — required to re-queue ONE failed ASIN (the BullMQ payload holding them is gone once the job completes) |
| `065` | Existing eBay listing onboarding: read-only store discovery (`ebay_listing_discoveries`), tracked/untracked filter, exact ASIN↔Item ID XLSX import, and legacy Trading→Inventory API migration without recreating eligible listings |
| `066` | `buyer_message_system_defaults` (DB-stored default bodies, replaces code-constant `SYSTEM_BUYER_MESSAGE_TEMPLATES`) + `buyer_message_templates.is_default` + backfill of existing users' starter templates — see "Buyer Auto-Messaging" |
| `067` | `listings.sku` + `listings.ebay_offer_id` — the two identifiers `bulkUpdatePriceQuantity` addresses rows by; removes the per-update offer lookup. Production SKUs backfilled, pre-067 sandbox left NULL (timestamped, not derivable). Both are written at create/publish (see "eBay API call budget & bulk writes") — the INSERT omitted them until 2026-08-09 |
| `068` | `products.category_path` — full Amazon category path, backfilled in SQL from `raw_keepa_data`; the key that amortizes eBay category resolution across a niche instead of paying Taxonomy per ASIN |
| `061` | `products.manufacturer` — split out of `060` because `060` was already applied when the column was added. **An applied migration never re-runs: amending one is a silent no-op, so a new column always ships as a new file.** |

API runs pending migrations on boot (`DatabaseService.onModuleInit` → `MigrationRunner`). Production Docker also runs `migrate` in entrypoint. **Restart API** after pulling new SQL files.

### Package builds agents must remember
- `@repo/shared` and **`@repo/ui` load from `dist/`** — after editing icons, Table selection width, Checkbox, etc., run `pnpm --filter @repo/ui build` (and shared when types/i18n change) or `pnpm dev` package build step.
- Icon names must exist in `packages/ui/src/atoms/Icon/icons/index.tsx` (e.g. `sliders-horizontal` alias). Emotion **must not** use component selectors like `${Other}:hover &` without babel plugin (crashes at runtime).

### Deferred (optional / env-dependent)
- CSRF token layer if API is ever cross-site with `SameSite=None`.
- Bulk offline AI rewrite of existing 100k listings (not in online create path).
- Push title/policy edits from listing detail to eBay Inventory API (DB is source of truth for group/policies today; price/qty still driven by refresh + strategy).

## Frontend Rules (Quick Reference)

See `.claude/skills/frontend-rules/SKILL.md` for the canonical version.

### File organization
4 files per feature component: `.component.tsx` (markup only) / `.container.tsx` (logic) / `.style.ts` (styled) / `.types.ts` (types). Stateful atoms/molecules (Select, Dropdown, etc.) also need `.container.tsx` + `.component.tsx` split. Stateless atoms (Button, Badge) stay as `.component.tsx` + `.style.ts` + `.types.ts`. Exempt: landing, RTK api files, store.ts, configs.

Heavy page logic belongs in `features/<x>/hooks/` — not a 600-line container.

### Anti-patterns (will be blocked by hook + lint)
- `styled(...)` outside `.style.ts`
- `useState`/`useEffect`/RTK Query/etc. in `.component.tsx`
- `interface`/`type`/`enum` outside `.types.ts`
- Hardcoded hex/rgb colors (use `tkn('colors.*')`)
- Hardcoded px/rem spacing (use `tkn('spacing.*')`)
- `style={{ }}` inline styles
- `styled.h1`/`styled.p` (use `<Text variant="...">`)
- Raw `<select>`, `<input>`, `<button>`, native HTML form controls
- External labels above TextInput/Select (use floating `label` prop)
- Mismatched control heights or non-brand focus rings on form controls
- `alert()`/`confirm()` (use `MessageModal` via `showMessage`)
- Hardcoded status strings like `'active'` (use enums from `packages/shared`)
- Hardcoded UI strings (use i18n `t()`)
- Two families competing for the **same** role (e.g. body text Inter on one screen, Lexend on another). A heading/body pairing is not this — the sanctioned stack is Inter headings + Lexend body/UI + JetBrains Mono for codes. Never hardcode a family name; use the tokens.

### Atom extension pattern in `.style.ts`
Empty template literal + variant/weight/size props in JSX. Layout CSS only in template (margin/gap/flex/grid/position/dimensions). No font-size/font-weight/color/background/border/shadow in template — those go in props.
