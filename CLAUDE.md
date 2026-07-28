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

### Listing content policy + shared LLM infra (B)
Configured per **listing settings group** (`content` JSONB on `listing_settings_groups`, migration `031`):
- `stripBrandFromTitle` — deterministic removal of Amazon brand tokens from the eBay title at **create**.
- `aiTitleEnabled` / `aiDescriptionEnabled` — optional one-time rewrite through the shared LLM client at **create only**.

**Create-only hard rule (100k+ listings):** AI must **never** run on Keepa refresh, product-sync, or sale-driven stock-sync. Only `ListingProcessorService` calls `ListingStrategyService.prepareListingData(..., { applyContentAi: true })`; refresh paths omit the option and recompute price/quantity only. `create-only-ai.guard.spec.ts` locks this invariant. AI failures always fall back to deterministic title/description, so listing creation continues.

**Shared transport:** `LlmModule` exports `LlmService`, an OpenAI-compatible Chat Completions client with `chat()` and accumulated-delta `chatStream()`. It supports typed errors, bounded `Retry-After` handling for HTTP 429, per-call timeouts/abort signals, and fail-soft append-only usage logging in `llm_usage_log` (migration `040`). There is no billing/aggregation UI yet.

**Provider/config (env-only, no code branch):**
- Prod/bulk default: OpenAI (`LLM_BASE_URL=https://api.openai.com/v1`, `LLM_CONTENT_MODEL=gpt-4o-mini`) for reliable EN/TR quality. Groq (`https://api.groq.com/openai/v1`, `llama-3.1-8b-instant`) is the faster/cheaper alternative.
- Dev/trickle default: local Ollama (`LLM_BASE_URL=http://localhost:11434/v1`, `qwen3:1.7b`). `docker-compose.yml` includes the service + persistent `ollama_data` volume; pull once with `docker compose exec ollama ollama pull qwen3:1.7b` (and `qwen3:4b-instruct` for the future assistant).
- `LLM_API_KEY` is omitted for Ollama and required by hosted providers. `LLM_CONTENT_ENABLED=false` is the safe default. `LISTINGS_WORKER_CONCURRENCY=2` defaults bulk AI to modest provider pressure (tune 2–4).

**Capacity:** local Ollama is for development/trickle only. The no-GPU 16 GB test VPS already runs Postgres, Redis, Playwright, API, and web; a 4B model needs roughly 3–4 GB extra RAM. Prod/bulk should use hosted OpenAI/Groq instead of adding Ollama to the Coolify production compose.

**Implemented in C — Zon Assistant:** customer conversation/history APIs, generation + inbox SSE, signed replay cursors, RAG/help-corpus ingestion and atomic releases, persistent support handoff/presence, proactive multi-tenant limiting, read-only redacted admin observability, and the AssistantWidget/support/admin frontend surfaces now reuse `LlmService.chatStream()` and `LLM_ASSISTANT_MODEL`. Canonical design/plan: `docs/superpowers/specs/2026-07-26-zon-assistant-backend-design.md` and `docs/superpowers/plans/2026-07-26-zon-assistant-backend.md`; concise developer/operations handbook: `docs/assistant/`.

For mass historical rewrites of existing published listings, do not re-queue create jobs; use deterministic strip-brand/templates or a future dedicated eBay revise batch.

Key files: `src/modules/llm/` (`llm.service.ts`, `llm-usage.service.ts`, `sse-parser.ts`), `content-generation.service.ts`, `listing-strategy.service.ts`, and the listing-group `content` config in shared types/UI.

### Key product / listing files
- `src/modules/listings/keepa.service.ts` — Keepa `/product` client (offers+stock query, chunked bulk `getProducts()` + `getProductDetailsWithMeta()`, response-reported token meta only).
- `src/modules/listings/keepa-normalizer.ts` (+ `.spec.ts`) — pure normalization: Buy Box offer matching, `stockCSV`, price sentinels, three-state stock, images array/CSV, `dedupeAsins`/`chunkAsins`.
- `src/modules/listings/refresh-backoff.ts` (+ `.spec.ts`) — escalating data-failure delay schedule.
- `src/modules/listings/refresh-scheduler.service.ts` — repeatable tick registration + `KEEPA_REFRESH_ENABLED` gate.
- `src/modules/listings/refresh-processor.service.ts` — atomic claim (`FOR UPDATE SKIP LOCKED` + lease), batch worker (compare/update/fan-out/quarantine/token-log).
- `src/modules/listings/keepa-usage.service.ts` — `keepa_usage_log` + `keepa_balance` persistence.
- `src/modules/listings/product-sync.service.ts` — `updateAllListingsForProduct()` (overrides + change-detected fan-out) + `syncListingsForProduct()`.
- `src/modules/listings/content-generation.service.ts` — optional Ollama title/description rewrite (create only).
- `src/modules/listings/listing-strategy.service.ts` — price/qty formula, strip brand, templates, AI gate.
- FE listings: `apps/web/src/features/listings/` — `overview/`, `all/` (+ hooks), `detail/`, `api/listings.api.ts`, domain `ListingCard` under `apps/web/src/domain-ui/`.
- DB: `products` refresh columns; `listings` overrides + `ebay_account_id`; `listing_settings_groups.content`. Migrations `025`–`031`.

## Admin Observability & FinOps (read-only foundation)

The additive admin foundation lives in `apps/api/src/modules/admin/` and uses the existing assistant/auth RBAC (`UserRole.CUSTOMER|SUPPORT|ADMIN`, `Roles`, `RolesGuard`, `PrivilegedSessionGuard`, migration `041`). It does not introduce a second role system. Every admin route is gated by `JwtAuthGuard` + `RolesGuard` + `PrivilegedSessionGuard` (per-request session revalidation) + `@Roles(UserRole.ADMIN)`; the controller is strictly read-only (no write/delete endpoints).

- `GET /v1/admin/overview` — platform counts, current-period usage summaries, and BullMQ queue counts.
- `GET /v1/admin/usage/summaries` — `(source, metric)` usage aggregation with optional period/source/metric filters.
- `GET /v1/admin/queues/health` — waiting/active/completed/failed/delayed/prioritized counts for registered queues. Read-only; the admin module never enqueues.
- Migration `049` adds append-only `usage_events` and effective-dated `shared_cost_entries`. Existing Keepa/LLM writers still target their source tables; projecting those rows into `usage_events` is a follow-up.
- Costs use nullable micro-USD `BIGINT`; NULL means unknown and must never be represented as zero. Currency and estimated cost are pair-coupled.
- Pure helpers in `apps/api/src/modules/admin/finops-helpers.ts` resolve effective pricing, calculate token cost, and allocate shared costs. Tests enforce exact allocation residue.
- Admin operations frontend is available at `/:locale/admin/assistant` for ADMIN users and intentionally renders only redacted overview, queue, usage, and role-CLI guidance; no prompts, messages, credentials, or raw provider errors are exposed. Support console is available at `/:locale/support` for SUPPORT/ADMIN users. Proxy/tracking telemetry, provider invoice reconciliation, and alerting remain follow-ups.
- Migration `050` adds partial unique indexes for safe replay of source projections. `UsageEventsService` is the single fail-soft writer; Keepa source rows project with deterministic per-user fair-share, and LLM source rows project prompt/completion/embedding tokens with effective-date pricing from `llm_model_pricing`. Source logs remain authoritative and projection failures never break provider operations.
- `UsageBackfillService` can idempotently rebuild historical Keepa/LLM projections, but is deliberately not wired to startup or cron. Proxy/tracking enum seams exist without emitting synthetic bytes, requests, or costs.
- Migration `051` adds append-only `queue_observations` for BullMQ completed/failed events. `QueueEventsCollectorService` watches the operational queues and persists only allowlisted correlation plus a SHA-256 hash of allowlisted identifiers—never raw job payloads. Writes are fail-soft/idempotent; retention defaults to 7 days (clamped 1–90) and runs on the dedicated `queue-observability-retention` queue.
- Admin read APIs: `GET /v1/admin/queues/observations` (queue/event/correlation/date/page filters), `GET /v1/admin/queues/observations/:id`, `GET /v1/admin/finops/users`, `GET /v1/admin/finops/providers`, and `GET /v1/admin/operations/summary`. `QUEUE_OBSERVABILITY_ENABLED=false` disables collection; `QUEUE_OBSERVABILITY_RETENTION_DAYS` and `QUEUE_OBSERVABILITY_RETENTION_CRON` tune retention.
- `GET /v1/admin/billing/metrics` — minimal read-only billing metrics: account status distribution (subscription-status proxy from `users.status`), access-tier distribution (plan proxy from `users.role`), listing/AO quota usage-pressure summaries (per-user counts banded by env thresholds), and the total estimated cost for the period (nullable micro-USD, null when no cost rows — never faked as 0). No plan/subscription/quota tables exist today; the metrics are derived from real tables only, and quota bands use env-configurable soft thresholds (`ADMIN_LISTING_QUOTA_WARN_THRESHOLD` default 25, `ADMIN_LISTING_QUOTA_CRITICAL_THRESHOLD` default 100, `ADMIN_AMAZON_ACCOUNT_QUOTA_WARN_THRESHOLD` default 3, `ADMIN_AMAZON_ACCOUNT_QUOTA_CRITICAL_THRESHOLD` default 10) — same `ConfigService.get ?? default` pattern as `ADMIN_QUEUE_WAITING_THRESHOLD`. Pure helpers in `billing-metrics.helpers.ts` (band classification, distribution aggregation, cost-total resolution) are Jest-covered.
- `/admin` is a lazy, role-gated read-only frontend with Queues / Costs / Billing / Users tabs. Only `UserRole.ADMIN` sees the sidebar item; backend guards remain authoritative. In-page warnings use `ADMIN_QUEUE_WAITING_THRESHOLD` (default 100), `ADMIN_KEEPA_LOW_TOKENS_THRESHOLD` (default 100), and `ADMIN_LLM_FAILURE_RATE_THRESHOLD` percent (default 10). External alert delivery and destructive queue actions remain intentionally absent.
- Shared queue correlation helpers (`stampJobData`, `extractCorrelationId`, `generateCorrelationId`) and an API AsyncLocalStorage context carry trace identity across HTTP and queue boundaries. `RequestIdMiddleware` enters ALS, Winston adds correlation/queue/job structured fields, and all operational producers/workers—including `order-sync`, `stock-sync`, `auto-fulfill`, Amazon sync/tracking/verify, listings, Keepa refresh, and knowledge ingestion—propagate the same ID through fan-out. Job IDs, retry/backoff, repeat schedules, dedup, and priority remain unchanged.
- `KnowledgeModule` registers its ingestion queue/controller/processor/service and is imported by `AppModule`; the admin queue registry also includes `knowledge-ingestion`.

### Role CLI (operator-only, no HTTP path)

Role escalation/demotion is a **server-console operation only** — there is no HTTP endpoint to change a user's role. The `user-set-role` CLI (`apps/api/src/scripts/user-set-role.ts`, run via `pnpm user:set-role -- --email <email> --role <customer|support|admin>`) is the sole path. Pure parsing/audit logic is extracted into `user-set-role-helpers.ts` (unit-tested by `user-set-role-helpers.spec.ts`).

Security contract (enforced in helpers + script):
- **Strict `--email`/`--role` parsing** against the shared `UserRole` enum — no positional args, no env fallback, no HTTP. Unknown flags → `RoleCliArgError` → exit 2. `--role` must equal a `UserRole` enum value (e.g. `Admin` is rejected; only `admin` is accepted).
- **Transactional user lock** — `SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1) FOR UPDATE` so a concurrent role change cannot race.
- **Change only if needed** — `shouldChangeRole(current, next)` guards no-op writes; a re-run with the same role exits 0 without writing anything.
- **Session invalidation** — on a real change, all active `auth_refresh_sessions` for the user are revoked explicitly. Migration `041`'s `users_security_change_revoke_sessions` trigger also bumps `users.session_version` + revokes sessions on the role UPDATE; the explicit revoke is defense-in-depth (survives a dropped trigger). The bumped `session_version` additionally invalidates all outstanding access tokens (validated via `AuthSessionService.validateAccess`).
- **Durable redacted audit** — a row is inserted into `audit_logs` **in the same transaction** (commits atomically with the role change, or rolls back with it). `action='ROLE_CHANGE'`, `resource_type='user'`, `details` JSONB carries only `{ action, previousRole, newRole, targetUserId, actor|null, changedAt }` — never email/password/session secrets. The email is recoverable by joining `audit_logs.user_id` → `users`; it is not duplicated in `details`.
- **Exit codes**: `0` changed (or already target role: no-op success), `2` bad args, `3` user not found, `1` DB/transaction failure.

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

- **Queue**: `amazon-order-sync` (BullMQ, `AMAZON_ORDER_SYNC_QUEUE`). Cron `AMAZON_ORDER_SYNC_CRON` (default `*/30 * * * *` — every 30 min), one job per Amazon account. Concurrency: `AMAZON_ORDER_SYNC_CONCURRENCY` (default 2).
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
  - `AMAZON_ORDER_SYNC_CRON='*/30 * * * *'` — scheduler tick (every 30 min).
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
  6. **Review-step HARD CAP** — reads grand total on the review page (the last step before "Place Order"); non-finite/≤0 → `cap`; `> capTotal` when `AUTO_FULFILL_REVIEW_CAP_HARD_STOP !== 'false'` (default ON) → `cap`. Aborts BEFORE the click, never over-spends.
  7. **Dry-run** (`amazon_accounts.auto_fulfill_dry_run`) → snap `dry_run_review` + set status `dry_run` + return. NO click.
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
- **Settings UI**: master toggle + tracking-conversion provider Select in the live `StoreSettingsDrawer` (only `local` visible; `api` labeled "coming soon"). Per-account enable/cap-total/dry-run live **on the `AmazonAccountsPage` form** (NOT in `AmazonAccountDrawer`, which holds credentials only). Orders list surfaces `auto_fulfill_status` as a Badge column + reason tooltip (`autoFulfillStatusToBadgeVariant`) and a "needs attention" filter (blocked/failed → backend filter `o.auto_fulfill_status IN ('blocked','failed')`). Reason/column/filter labels all i18n'd under `orders.autoFulfill.*` and `amazon.autoFulfill.*` (EN + TR).
- **Shared enums**: `AutoFulfillStatus` (`pending|running|placed|blocked|failed|dry_run|skipped`) + `AutoFulfillBlockedReason` (12 values incl. `proxy_required`, `quota_exhausted`, `cart`) in `packages/shared/src/domain/orders/orders.types.ts`; `TrackingConversionProvider` (`local|api`) in `packages/shared/src/domain/amazon/amazon.types.ts`. The `auto-fulfill-helpers.ts` re-exports a template-literal type derived from the enum (single source of truth).

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
- **Fingerprint isolation**: Deterministic per-account fingerprint (user-agent, viewport, timezoneId from `hashCode(accountId)`) — same account always looks the same across restarts.
- **Proxy stack (A2, refactored 2026-07-28 — fixed ISP pool)**: PRIMARY model is a pool of **fixed ISP proxies** (static IP, unlimited bandwidth, ~$3-4/proxy/30d) in the `proxies` table (migration `057`): operator INSERTs rows (`host`/`port`/`username`/`password` — password may be plaintext, `ProxyService.onModuleInit` re-encrypts it AES-256-GCM `enc:`-prefixed on next boot), and each **user** is lazily assigned exactly ONE proxy (`assigned_user_id UNIQUE`, atomic `FOR UPDATE SKIP LOCKED` claim, oldest row first). All of a user's Amazon buyer accounts exit from the same static IP — the "one household, several accounts" pattern; per-user granularity also contains the blast radius between unrelated customers. `ProxyStatus` enum (`active|disabled`) in `packages/shared`; a `disabled` (burned) proxy is never used even if still assigned — the user re-claims a free one on next resolve. `ProxyService.isConfigured()`/`resolve()` are **async** now (DB-backed). GB-billed rotating residential was rejected on cost (~25-30 GB/user/month ≈ $125-180/user vs $3-4 fixed).
  - **Legacy env fallback** (used only while the `proxies` table has no ACTIVE rows): single rotating-residential template `PROXY_ENDPOINT`/`PROXY_USER`/`PROXY_PASS_TEMPLATE` with a sticky `{session}` token via `proxySessionToken(strategy, userId, amazonAccountId)`; `PROXY_STRATEGY=perUser` (default) | `perAccount`. A pool that EXISTS but is exhausted deliberately does NOT fall back to env (mixing static-IP and rotating models per user would make IP behavior unpredictable) — resolve returns null and checkout fails closed.
  - **Proxy fallback discipline**: `BrowserStateManager.resolveProxy()` returns null when `!(await proxyService.isConfigured())` → existing scraping runs **direct** (no regression when no proxy exists). **Auto-fulfill is hard-blocked without a proxy** — `AmazonAccountsService.assertCanEnable` calls `proxyService.ensureAvailableFor(userId, …)` (eagerly claims a pool proxy so the user gets enable-time feedback instead of a runtime block) and throws `amazon.errors.autoFulfillProxyRequired` / `autoFulfillCapRequired`; AND `AmazonCheckoutService.runForOrder` re-checks `isConfigured()` + `isProxyActive` at runtime (defense-in-depth: pool disabled/exhausted after enable → checkout blocks with `auto_fulfill_blocked_reason='proxy_required'` instead of running bare-IP).
- **Rate limiting** (Bottleneck via `AmazonRateLimiter.schedule(accountId, …)`):
  - Global: max 5 concurrent browser actions
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

- **Events**: `order_received` (thank-you on genuine order insert), `shipped` (on the tracking shipped transition — note eBay already auto-notifies on ship, so this is opt-in and the system template uses a distinct tone), `delivered` (on the delivered/completed transition), `feedback_request` (delayed BullMQ job, N days after delivered).
- **Config**: `store_settings.buyer_messaging` JSONB (`{ enabled, events: { [event]: { enabled, template: { kind: 'system'|'custom', id }, delayDays? } } }`). Row-level resolve (store row overrides global). Migration `054` adds the column + `buyer_message_templates` + `buyer_message_log`.
- **System templates**: code constants in `packages/shared` (`SYSTEM_BUYER_MESSAGE_TEMPLATES`, EN) — versioned, no migration to change copy.
- **Custom templates**: `buyer_message_templates` table (user-scoped, per-event). CRUD via `BuyerMessageTemplateRepository` + REST `/v1/buyer-messaging/templates`.
- **Pipeline**: lifecycle seam → `buyer-message` BullMQ queue → `BuyerMessageProcessor` (idempotency guard via `buyer_message_log` partial-unique on `(ebay_order_id, event_type) WHERE status='sent'`; re-checks config at fire time → `skipped` if disabled; `redactForLog` strips tokens before any logged/thrown error; fail-soft `enqueue` never breaks order/tracking flows) → `BuyerMessagingProvider` port (`EbayMessageApiProvider`, eBay REST Message API `sendMessage`; token resolved per-account via `EbayService.getAccountAccessToken`).
- **Triggers**: `OrderSyncService` genuine-insert seam (`order_received`); `AmazonTrackingProcessorService` status transitions (`shipped`, `delivered` + delayed `feedback_request`). All env-gated (`BUYER_MESSAGING_ENABLED=true`, default off) + per-user config.
- **Env**: `BUYER_MESSAGING_ENABLED=false` (master kill), `BUYER_MESSAGING_QUEUE_CONCURRENCY=1`, `BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS=3`.
- **FE**: `BuyerMessagingSection` (master toggle + 4 event rows + template source + delayDays, self-contained RTK Query save) + `BuyerMessageTemplateManager` (custom-template CRUD with Textarea editor + placeholder chips + live preview), mounted in `StoreSettingsDrawer`. RTK Query: `storeSettingsApi` (config GET/PUT) + `buyerMessagingApi` (template CRUD). i18n under `storeSettings:storeSettings.messaging.*`.
- **Key files**: `apps/api/src/modules/buyer-messaging/` (`buyer-messaging.module.ts`, `buyer-message.service.ts`, `buyer-message.processor.ts`, `buyer-message-queue.service.ts`, `buyer-message.provider.ts`, `buyer-message-template.repository.ts`, `buyer-message.controller.ts`, `buyer-message-helpers.ts` + `.spec.ts`, `buyer-messaging.constants.ts`). Shared: `packages/shared/src/domain/buyer-messaging/`, `packages/shared/src/schemas/buyer-messaging/`. The `buyer-message` queue is registered in the admin queue registry (`ADMIN_QUEUE_NAMES`, `OBSERVED_QUEUE_NAMES`).
- **Known follow-ups (deferred minors from implementation)**: `BuyerMessageService.resolveTemplate` falls back to empty body (not null) on a missing system template — unreachable today (system templates are total over the enum) but worth an `if (!sys) return null` guard; the eBay Message API `sendMessage` exact field shape is `// TODO(confirm)` in the provider (port-isolated, verified against live docs at runtime).

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
- **Seed the `proxies` table** (fixed ISP proxies) if you want scraping ban-resistance and to test A2 dry-run/live checkout.
- Add real Amazon buyer accounts (encrypted at rest via `AMAZON_ENCRYPTION_KEY`).
- 16 GB is comfortable for a handful of accounts; the I2 idle-eviction (`BROWSER_CONTEXT_IDLE_TTL_MS`) bounds resident Chromium so even ~10–20 accounts won't pile up.

### Prod

- **PostgreSQL 16** (managed recommended) + **Redis 7**, both with persistence + backups.
- **API + Web** behind a reverse proxy (Coolify / Nginx / Caddy) with TLS.
- **CPU:** 4+ vCPU (Playwright is CPU-bound; the per-account rate limiter caps concurrency, but headroom matters).
- **RAM — the key dimension, driven by concurrent Amazon accounts:** ~150–300 MB per resident Chromium context + ~1–1.5 GB base (api + web + Postgres + Redis). I2 idle-eviction means resident contexts are bounded by **active** concurrency, not total account count. **Minimum 16 GB; 32 GB for multi-tenant scale.** Set OOM/alerting on memory.
- **Disk:** 50 GB+ (Postgres, logs, `fulfillment-evidence/` screenshots — TTL-cleaned via `FULFILLMENT_EVIDENCE_TTL_DAYS`, traffic browser-state profiles under `.browser-state/profiles/`).
- **Fixed ISP proxies:** **required** for A2 — one per user (auto-assigned from the `proxies` pool), static IP, unlimited bandwidth (~$3-4/proxy/30d). Size the pool to the active-user count; GB-billed residential was rejected on cost (~25-30 GB/user/month through Playwright).
- **GPU:** not required (Playwright + local-LLM-via-Ollama are CPU; GPU only if a future hosted LLM/vLLM is chosen — B-spec decision).

### Secrets / env checklist (per environment)

- `AMAZON_ENCRYPTION_KEY` — 32-byte hex (AES-256-GCM for buyer-account credentials). **Required wherever amazon_accounts are used.**
- JWT/auth secrets (access + refresh-cookie signing).
- `KEEPA_API_KEY` (product refresh pipeline).
- eBay app credentials (per connected store).
- A2 proxies: rows in the `proxies` table (fixed ISP pool, primary) — `PROXY_ENDPOINT` / `PROXY_USER` / `PROXY_PASS_TEMPLATE` / `PROXY_STRATEGY` env is the legacy fallback only.
- `CORS_ORIGINS` / `COOKIE_DOMAIN` / `COOKIE_SAMESITE` (prod web origin).
- A2 tunables (all optional, defaults safe): `AUTO_FULFILL_*`, `BROWSER_CONTEXT_*`, `FULFILLMENT_EVIDENCE_*`, Keepa refresh tunables.

### A2 operational checklist (before enabling real-money auto-fulfill in any environment)

1. Proxy capacity present (`ProxyService.isConfigured()` true — ≥1 ACTIVE row in `proxies`, or legacy env fallback) and reachable.
2. ≥1 Amazon buyer account with `auto_fulfill_enabled=true` + `auto_fulfill_cap_total` set.
3. **Run `auto_fulfill_dry_run=true` first** — confirms the full checkout flow reaches the Amazon review step and the cap behaves, **without charging**. Inspect `fulfillment-evidence/{ebayOrderId}/dry_run_review-*.png`.
4. **Tune the Playwright selectors** in `AmazonCheckoutService` against live Amazon DOM during dry-run (selectors are best-effort and DOM-drift is the main fragility). Keep selectors in the `CHECKOUT_SELECTORS` constant.
5. Only then flip `auto_fulfill_dry_run=false` on a low-value test order and watch the placed/blocked status + evidence.
6. Monitor: BullMQ queue depth (`auto-fulfill`, `amazon-tracking`), `orders.auto_fulfill_status` (watch `blocked`/`failed`), memory (Chromium), proxy bandwidth.

### A2 enablement status & gating (read this before touching auto-fulfill)

> **State as of 2026-07-20:** A2 code is COMPLETE and reviewed on `development`, but **auto-fulfill is NOT yet usable end-to-end** because two prerequisites are external to the codebase. Do not tell the user "A2 works / is done" without checking these — the code compiles and unit-tests pass, but no live checkout has ever been run.

**The single remaining gate before any real Amazon purchase is `dry-run selector tuning`. It is NOT a code task — it is a live, operator-driven verification that must happen once, against real Amazon, before real money is allowed to leave. The reason it cannot be done in code is:** the Playwright selectors in `AmazonCheckoutService.CHECKOUT_SELECTORS` (add-to-cart, address selection, review grand-total, confirmation parse) are written against Amazon's DOM, which Amazon rotates frequently and which differs by account/region. There is no way to validate them without an actual logged-in Amazon buyer session. Selectors that look correct in code routinely miss on the live page → the flow blocks (`out_of_stock` / `address` / `no_confirmation`) or worse, proceeds to the wrong step. Dry-run mode (`auto_fulfill_dry_run=true`) runs the ENTIRE checkout up to (but not including) the "Place Order" click and screenshots every step, so you can confirm each selector resolves and the review-step total is read correctly — **without spending money**.

**Prerequisites the user must provide (cannot be coded):**
1. **Fixed ISP proxies** — buy N ISP Dedicated proxies (e.g. IPRoyal ISP, US location, ~$3-4/proxy/30d, unlimited bandwidth) and INSERT them into the `proxies` table (migration `057`; plaintext password OK — encrypted on next boot). One proxy per user, auto-assigned. **Status: NOT purchased yet (2026-07-28; model switched from GB-billed residential to fixed ISP on cost — see "Proxy stack").** Without any pool row (or legacy `PROXY_*` env fallback), `AmazonCheckoutService.runForOrder` hard-blocks every order with `auto_fulfill_blocked_reason='proxy_required'` (the runtime guard). This is by design — auto-fulfill over the bare server IP bans Amazon buyer accounts.
2. **A real Amazon buyer account** connected in Zonds (email + password + 2FA secret), with `auto_fulfill_enabled=true` + `auto_fulfill_cap_total` set + `auto_fulfill_dry_run=true`.

**How to guide the user when they want to "turn on auto-fulfill" / "test it" / "go live":**
- **No proxy purchased yet → A2 cannot run.** Tell them the proxy is the first purchase (fixed ISP Dedicated, US location, ~$3-4/proxy/30d, one per user — INSERT into the `proxies` table). Do NOT suggest enabling `auto_fulfill_enabled` on any account — it will be rejected by `assertCanEnable` (proxy + cap required) and/or block every order at runtime. There is no code workaround; the proxy is a hard safety floor.
- **Proxy purchased + Amazon account added → run dry-run first.** Set `auto_fulfill_dry_run=true` on the account, ingest one new matched eBay order (or wait for the order-sync cron), then read `orders.auto_fulfill_status` (expect `dry_run`) and the screenshots under `fulfillment-evidence/{ebayOrderId}/`. If any step shows a wrong page / missing total / blocked reason other than `cap`, the `CHECKOUT_SELECTORS` for that step need a live-DOM patch — that is the "selector tuning" task. Repeat until `dry_run_review-*.png` shows the correct review page with a readable grand total and the cap behaves.
- **Dry-run clean → one low-value live order.** Flip `auto_fulfill_dry_run=false`, set a tight `auto_fulfill_cap_total` (e.g. $10), and watch `auto_fulfill_status` flip to `placed` + a real `amazon_order_id` + `net_profit` (trusted, LINKED). Only then widen to normal caps / more accounts.
- **Never skip dry-run.** The review-step hard cap is only as good as `readReviewGrandTotal`; if that selector misses on the live DOM, the cap check fails closed (`cap` block) — safe, but it means auto-fulfill is silently not working. Dry-run is how you prove the selectors resolve before money is at stake.

**What is safe to do right now without a proxy:** everything in the code, the settings UI, the FE chip/filter, and `auto_fulfill_status='skipped'`/`'proxy_required'` behavior. You can connect Amazon buyer accounts, configure caps/dry-run flags, and watch the producer enqueue → processor block with `proxy_required`. That exercises the entire pipeline except the Playwright checkout, which is the part that needs the proxy + live tuning.

### Backups & monitoring (prod)

- **Postgres:** daily logical backup (pg_dump) + point-in-time if managed.
- **`fulfillment-evidence/`:** ephemeral, TTL-cleaned — not backed up.
- **`.browser-state/profiles/`:** ephemeral session profiles — not backed up (re-login on loss).
- **Alert on:** API OOM / restart, BullMQ dead-letter growth, proxy bandwidth quota, spike in `auto_fulfill_status='blocked'`.

## Figma Redesign — Per-Theme Tokens

The figma Make redesign (https://sweet-yang-69529706.figma.site/) introduced tonal shifts:
- **Primary is per-theme**: light uses `#2563eb` (blue-600), dark uses `#6366f1` (indigo-500). Do NOT expect them to match.
- **Sidebar background is per-theme**: light deep blue `#0c1f52`, dark near-black `#0d0f18`.
- **Borders are alpha-based**: `#00000014` (light) / `#ffffff12` (dark) — not solid hex.
- **`accent` token category** (emerald `#10b981`) is for "Active" status badges and success emphasis. Distinct from `semantic.success` (system success states).
- **Font**: **Source Sans 3** for headings + body/UI (institutional / insurance-grade readability; TR-friendly). Loaded via Google Fonts in `apps/web/index.html`; tokens in `packages/ui/src/theme/designTokens.ts`. Mono = JetBrains Mono.
- **Text ink**: strong slate primary (`#0f172a`), secondary (`#475569`). Brand blue `#2563eb`.
- **Weights**: headings / card titles **semibold**; row labels **semibold** for clarity.
- **Radii**: progressive scale — sm 6px (badges/checkboxes/table cells), md 8px (buttons/inputs/selects), lg 12px (cards/dialogs), xl 16px (modals), 2xl 20px (hero). Tokens in `packages/ui/src/theme/designTokens.ts` (`radiusTokens`); `controlTokens.radius` matches `radiusTokens.md`.
- **Sidebar nav**: Inventory + Configuration. Route breadcrumbs from `apps/web/src/app/routeMeta.ts`.
- **Settings hub**: full-width 2-col grid; **header icons restored** on section cards; account rows keep row icons.

Redesign spec: `docs/superpowers/specs/2026-07-03-figma-site-refactor-design.md`.

## Frontend Architecture Notes (2026-07)

### Typography scale (use `<Text variant>` — never raw font-size in feature CSS)
| Variant | Size | Use for |
|---|---|---|
| `h1` | 24px / semibold | Page titles (`PageHeader`) |
| `h2` | 20px / semibold | Rare large section titles |
| `h3` | 18px / semibold | Drawer titles, major section |
| `h4` | 16px / semibold | Card titles (`SettingsCard`, `QuickActionCard`) |
| `h5` | 14px / semibold | Small section labels |
| `body` | 14px / regular | Primary UI text, table cells, control text, row labels |
| `body-sm` | 12px / regular | Secondary denser text, drawer subtitles |
| `caption` / `overline` | 12px / 10px | Meta, helper, chips |
| `mono` | 12px | Codes / IDs only |

**Title → subtitle gap**: `PageHeader` uses `spacing.xs` between title and subtitle. Title is always `Text variant="h1" weight="semibold"`; subtitle is `body-sm` secondary. **Do not** invent ad-hoc page titles.

**Page shell (mandatory alignment)**:
- Outer gutter is **only** `AppLayout` `ContentInner` (responsive padding). Feature pages must **not** add their own outer `padding`.
- Root of every authenticated page: `PageContainer` from `@repo/ui` (or `PageContainerWithMobileBar` for detail pages with sticky mobile action bars). Gap between title and sections = `spacing.lg`.
- Pattern: `<PageContainer><PageHeader title={…} subtitle={…} />…</PageContainer>`. Export as `Container = PageContainer` in feature `*.style.ts` if preferred.
- Never double-pad (ContentInner + page Container) — that misaligns titles across screens.

### Form controls (must stay aligned)
Shared geometry: `packages/ui/src/styles/formControl.ts` + `controlTokens` on theme.

| Size | Compact (no floating label) | Labeled (floating label) |
|---|---|---|
| small | 2.5rem | 3rem |
| medium | 2.75rem | 3.25rem |
| large | 3rem | 3.75rem |

- **TextInput**, **Select**, **SearchField** share the same heights, `surface.primary` fill, `border.primary`, and **brand.primary** focus ring (`controlFocusShadow`). Never black/neutral focus borders.
- **Floating labels are mandatory** for form fields (drawers, settings, auth). Do **not** place an external `<Text>` label above a TextInput/Select — use the `label` prop.
- Toolbar/filter rows may use compact controls with `placeholder` only (no label) so Search + Select share one height.
- Button `medium` = 2.75rem (matches compact medium); form primary actions in drawers use `medium` not `large`.

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
- **Tabs** (`?tab=cards|chart|history`): Cards · Chart · History.
- **Period cards** (Tab 1): `today` | `thisWeek` | `thisMonth` | `thisYear` — solid header bands (`colors.dashboard.period*`). Click filters carousels below.
- **Carousels**: standard `ListingCarousel` + `OrderCarousel` side-by-side; listings via `soldFrom`/`soldTo`, orders via `dateFrom`/`dateTo`.
- **View all** → `/listings/all?soldFrom&soldTo&from=dashboard` or `/orders/all?dateFrom&dateTo&from=dashboard`; back returns to `/dashboard`.
- **Chart tab**: monthly ComposedChart (units bar + sales/profit lines) + summary sidebar.
- **History tab**: P&L matrix (metrics × months) from `dashboard.history.months`.
- API: `GET /dashboard?ebayAccountId=` — metrics + chart + history. No day/week/month segmented control; no active-listings chip.
- **Tiered profit** (per period): headline `netProfit` is **confirmed-only** (`cost_capture_status = 'linked'`, trusted Amazon costs). `profitProvisional` (product-only costs) and `revenueUncosted` (pending/failed/untracked — revenue only, no profit) are surfaced separately so users never confuse an unknown cost with a real zero. See "Net Profit Formula" for the enum semantics.

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
- Dual body typefaces (use Source Sans 3 tokens only)

### Atom extension pattern in `.style.ts`
Empty template literal + variant/weight/size props in JSX. Layout CSS only in template (margin/gap/flex/grid/position/dimensions). No font-size/font-weight/color/background/border/shadow in template — those go in props.
