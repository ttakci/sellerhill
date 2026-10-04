# Finances consent flag + billing capture-only sweep — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a store grant eBay's `sell.finances` scope behind a panel switch, and read each such store's billing activity every 4 hours into verbatim files on disk, so the real ad-fee `feeType` can be learned before any parser is written.

**Architecture:**
- **Consent.** The scope list becomes per consent. `EbayOAuthService.getScopes(includeFinances)` adds `sell.finances` when the panel setting `ebay.oauth.financesScopeEnabled` is on. The choice travels inside the OAuth `state`, so the callback records exactly what that consent asked for in `ebay_accounts.granted_scopes`.
- **Capture sweep.** A new `ebay-finances` module copies the return-sweep shape: a claim stamped on `ebay_accounts.last_billing_sync_at` (migration 142), a once-a-minute tick, and a GET client that is budget-governed with `withEbayRateLimitRetry`. Each page of `GET /sell/finances/v1/billing_activity` is written to disk verbatim, and a one-line summary of the `feeType` values seen is logged. Nothing is written to the database except the claim stamp.

**Tech Stack:** NestJS 10, raw `pg`, BullMQ, axios, Jest (ts-jest), shared package dual build.

**Spec:** `docs/superpowers/specs/2026-10-03-ad-campaigns-and-listing-rules-design.md`, Part C2 and the capture-only part of C3. Part E step 2 says this ships before Part B, "so the operator can reconnect sipastan and the capture can accumulate".

## Global Constraints

- Panel setting **`ebay.oauth.financesScopeEnabled`** (default **false**). When on, the consent URL includes `sell.finances`. `ebay_accounts.granted_scopes` records it at connect/reconnect (the messaging-scope pattern). If eBay refuses consents with it, the operator switches it off; no redeploy.
- Existing stores need one reconnect. A same-owner reconnect is an in-place re-consent.
- **Source:** `GET /sell/finances/v1/billing_activity` (`getBillingActivities`, scope `sell.finances`).
  - Host: `apiz.ebay.com` (the local OpenAPI's first server).
  - Filter `transactionDate:[start..end]` in UTC, at most 120 days back.
  - `limit` at most 200; `offset` is zero-based; `total` / `next` are in the response.
- **Quota:** `payoutapi.sell.finances`, **15,000/day** (live `getRateLimits`; production snapshot read 2026-10-04: resource `payoutapi.sell.finances`, `apiContext` `sell`, `apiName` `finances`, one 86,400 s window).
- **Billing sweep:** every 4 h per store **with the scope** (claim pattern, `ebay_accounts.last_billing_sync_at`).
- **Capture-only:** write the raw response to disk (the feed-capture pattern) and nothing to the database.
- No parser exists before its capture exists (Part E).
- Production access for verification is read-only (CLAUDE.md "Production access for agents").

## Review Focus

1. **A store connected while the switch was OFF, then the switch turned ON.** Its `granted_scopes` lacks `sell.finances`, so the sweep must never call the Finances API for it (that would be a 403 on a shared quota). The sweep's claim only takes stores whose `granted_scopes` contains the scope. → test in Task 3.
2. **The switch flips between the consent page and the callback.** The callback must record what the consent ASKED for (carried in `state`), never the current switch value. → test in Task 1.
3. **An old `state` minted before this change (no finances field).** It decodes as "no finances" and does not throw. → test in Task 1.
4. **A failed or empty billing read.** It is logged and nothing else happens. No page is written as if it were complete, and the next sweep of other stores continues. → test in Task 3.
5. **A store with more activity than one page.** The sweep follows `offset` up to `BILLING_MAX_PAGES` and stops there with a warning. It never loops on a missing or odd `total`. → test in Task 3.

**Not in this plan (rulings, recorded here so the executor does not add them):**
- **The Action Center item `EBAY_ACCOUNT_FINANCES_SCOPE_MISSING` is deferred to Part B.** The spec defines it as "a store has at least one promoted listing but lacks the scope". Since migration 141 nothing promotes a listing, so the condition can never be true until Part B's campaign data exists. The operator reconnects a store from Stores → connect.
- **`ebay.finances.captureOnly` is not added.** With no parser there is nothing for "off" to do. The C3 plan adds the flag together with the parser.
- **No `orders` columns.** They arrive with C3.

---

### Task 1: The finances scope is chosen per consent

**Files:**
- Modify: `packages/shared/src/domain/ebay/ebay.constants.ts` — add `EBAY_FINANCES_SCOPE` and `hasFinancesScope`.
- Modify: `packages/shared/src/domain/admin/platform-settings.types.ts` — add the key `EBAY_OAUTH_FINANCES_SCOPE_ENABLED = 'ebay.oauth.financesScopeEnabled'`.
- Modify: `apps/api/src/common/settings/platform-settings.registry.ts` — add the entry (category EBAY, BOOLEAN, env `EBAY_OAUTH_FINANCES_SCOPE_ENABLED`, default `'false'`).
- Modify: `packages/shared/src/i18n/resources/{en,tr}/admin.json` — title and description, both locales.
- Modify: `apps/api/src/modules/ebay/ebay-oauth.service.ts`:
  - `getScopes(includeFinances = false)`;
  - `generateConsentUrl(marketplaceId, userId, includeFinances = false)`;
  - `generateState` / `decodeState` / `validateState` carry `fin`.
- Modify: `apps/api/src/modules/ebay/ebay.service.ts`:
  - `createConnectUrl` becomes async and reads the setting;
  - `handleCallback` records `getScopes(includeFinances)`;
  - the constructor gains `@Optional() private readonly platformSettings?: PlatformSettingsService` as its **last** parameter, so the two specs that build `EbayService` positionally keep compiling.
- Modify: `apps/api/src/modules/ebay/ebay-messaging-lifecycle.guard.spec.ts:18` — the regex becomes `/this\.oauthService\.getScopes\(/g`. It still requires two call sites.
- Test: `apps/api/src/modules/ebay/ebay-oauth-finances-scope.spec.ts` (new).

**Interfaces — Produces:**
- `EBAY_FINANCES_SCOPE = 'https://api.ebay.com/oauth/api_scope/sell.finances'`.
- `hasFinancesScope(granted: readonly string[] | null | undefined): boolean`.
- `EbayOAuthService.getScopes(includeFinances?: boolean): readonly string[]`.
- `EbayOAuthService.validateState(state): { userId; marketplaceId; includeFinances: boolean }`.
- `PlatformSettingKey.EBAY_OAUTH_FINANCES_SCOPE_ENABLED`.

- [ ] **Step 1: Write the failing test** (`ebay-oauth-finances-scope.spec.ts`):

```ts
import { ConfigService } from '@nestjs/config';
import { EBAY_FINANCES_SCOPE, EBAY_MARKETPLACE, EBAY_OAUTH_CONSTANTS, hasFinancesScope } from '@repo/shared';

import { EbayOAuthService } from './ebay-oauth.service';

const config = new ConfigService({
  EBAY_CLIENT_ID: 'id',
  EBAY_CLIENT_SECRET: 'secret',
  EBAY_RUNAME: 'runame',
  EBAY_ENVIRONMENT: 'production',
  EBAY_AUTH_URL: 'https://auth.ebay.com/oauth2/authorize',
  EBAY_TOKEN_URL: 'https://api.ebay.com/identity/v1/oauth2/token',
  EBAY_REST_API_URL: 'https://api.ebay.com',
});

const scopesIn = (url: string): string[] => (new URL(url).searchParams.get('scope') ?? '').split(' ');

describe('the finances scope is chosen per consent', () => {
  const oauth = new EbayOAuthService(config);

  it('is not requested by default', () => {
    expect(oauth.getScopes()).toEqual([...EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES]);
    const { url } = oauth.generateConsentUrl(EBAY_MARKETPLACE.US, 'user-1');
    expect(scopesIn(url)).not.toContain(EBAY_FINANCES_SCOPE);
  });

  it('is requested, and remembered in the state, when asked for', () => {
    const { url, state } = oauth.generateConsentUrl(EBAY_MARKETPLACE.US, 'user-1', true);
    expect(scopesIn(url)).toContain(EBAY_FINANCES_SCOPE);
    expect(oauth.validateState(state)).toEqual({
      userId: 'user-1',
      marketplaceId: EBAY_MARKETPLACE.US,
      includeFinances: true,
    });
    expect(oauth.getScopes(true)).toContain(EBAY_FINANCES_SCOPE);
  });

  it('reads a state minted before this change as "no finances"', () => {
    const legacy = Buffer.from(
      JSON.stringify({ userId: 'user-1', marketplaceId: EBAY_MARKETPLACE.US, random: 'r', timestamp: Date.now() })
    ).toString('base64url');
    expect(oauth.validateState(legacy).includeFinances).toBe(false);
  });

  it('hasFinancesScope reads granted_scopes', () => {
    expect(hasFinancesScope(null)).toBe(false);
    expect(hasFinancesScope([...EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES])).toBe(false);
    expect(hasFinancesScope([EBAY_FINANCES_SCOPE])).toBe(true);
  });
});
```

Also add one source-grep case to the same file (Review Focus 2). The callback must take the choice from the state, never re-read the switch:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

it('the callback records what the consent asked for, not the current switch', () => {
  const src = readFileSync(join(__dirname, 'ebay.service.ts'), 'utf8');
  const start = src.indexOf('async handleCallback(');
  const body = src.slice(start, src.indexOf('private async subscribeToMessages(', start));
  expect(body).toMatch(/includeFinances\s*\}\s*=\s*this\.oauthService\.validateState\(state\)/);
  expect(body).not.toMatch(/EBAY_OAUTH_FINANCES_SCOPE_ENABLED/);
  expect(body.match(/this\.oauthService\.getScopes\(includeFinances\)/g)?.length).toBe(2);
});
```

- [ ] **Step 2: Run it.** `cd apps/api && npx jest src/modules/ebay/ebay-oauth-finances-scope.spec.ts`. Expected: FAIL, because `EBAY_FINANCES_SCOPE` / `hasFinancesScope` do not exist.

- [ ] **Step 3: Implement.**
  - **Shared (`ebay.constants.ts`)**, after `EBAY_OAUTH_CONSTANTS`:

```ts
/**
 * eBay Finances API scope (billing activity: the ad fee eBay actually
 * charged). Requested only while `ebay.oauth.financesScopeEnabled` is on, so
 * it is NOT in DEFAULT_SCOPES; a store gains it on its next consent.
 */
export const EBAY_FINANCES_SCOPE = 'https://api.ebay.com/oauth/api_scope/sell.finances';

export function hasFinancesScope(granted: readonly string[] | null | undefined): boolean {
  return Boolean(granted?.includes(EBAY_FINANCES_SCOPE));
}
```

  - **OAuth service.** Delete the `scopes` field and its constructor assignment.

```ts
getScopes(includeFinances = false): readonly string[] {
  return includeFinances
    ? [...EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES, EBAY_FINANCES_SCOPE]
    : EBAY_OAUTH_CONSTANTS.DEFAULT_SCOPES;
}
```

  - **`generateConsentUrl`** takes a third parameter `includeFinances = false`. It uses `scope: this.getScopes(includeFinances).join(' ')` and passes the flag to `generateState`.
  - **`stateData`** gains `fin: includeFinances`.
  - **`decodeState`'s type** gains `fin?: boolean`.
  - **`validateState`** returns `{ userId, marketplaceId, includeFinances: decoded.fin === true }`.
  - **`EbayService.createConnectUrl`** becomes `async` and returns a `Promise`:

```ts
const includeFinances =
  (await this.platformSettings?.getBoolean(PlatformSettingKey.EBAY_OAUTH_FINANCES_SCOPE_ENABLED)) ?? false;
const { url, state } = this.oauthService.generateConsentUrl(marketplace, userId, includeFinances);
```

  - **The controller**: `ebay.controller.ts:64` already returns the call, so it only becomes `async` + `await`.
  - **`handleCallback`**: `const { userId, marketplaceId, includeFinances } = this.oauthService.validateState(state);`. Both `[...this.oauthService.getScopes()]` become `[...this.oauthService.getScopes(includeFinances)]`.
  - **Registry entry**:

```ts
def({
  key: PlatformSettingKey.EBAY_OAUTH_FINANCES_SCOPE_ENABLED,
  category: PlatformSettingCategory.EBAY,
  type: PlatformSettingType.BOOLEAN,
  envVar: 'EBAY_OAUTH_FINANCES_SCOPE_ENABLED',
  defaultValue: 'false',
}),
```

  - **i18n**. In `admin.settings.keys`:
    - en: "Ask stores for the Finances permission";
    - tr: "Mağazalardan Finans iznini iste".

    In `admin.settings.descriptions`:
    - en: "Adds eBay's sell.finances scope to the consent screen, so a store connected or reconnected afterwards lets SellerHill read the ad fees eBay charged. Stores connected before must reconnect once. Turn it off if eBay starts refusing consents.";
    - tr: "eBay izin ekranına sell.finances iznini ekler; bundan sonra bağlanan ya da yeniden bağlanan mağaza, eBay'in kestiği reklam ücretlerini SellerHill'in okumasına izin verir. Önceden bağlanmış mağazaların bir kez yeniden bağlanması gerekir. eBay izinleri reddetmeye başlarsa kapatın."
  - **Guard spec** line 18 regex: `getScopes\(\)` → `getScopes\(`.

- [ ] **Step 4: Run the tests.** Run `npx jest src/modules/ebay src/common/settings` from `apps/api`. Expected: PASS, including `platform-settings-i18n.guard.spec.ts` and `ebay-messaging-lifecycle.guard.spec.ts`.
- [ ] **Step 5: Commit** — `feat(api): the eBay Finances scope is requested per consent behind ebay.oauth.financesScopeEnabled`.

---

### Task 2: Migration 142 and the Finances budget resource

**Files:**
- Create: `apps/api/migrations/142_ebay_accounts_last_billing_sync_at.sql`.
- Modify: `packages/shared/src/domain/ebay/ebay-call-budget.types.ts` — `FINANCES = 'sell.finances'`.
- Modify: `apps/api/src/common/ebay-budget/ebay-rate-limits.ts` — `RESOURCE_SOURCE` row `[EbayApiResource.FINANCES]: { trading: false, name: 'payoutapi.sell.finances' }`.
- Test: `apps/api/src/common/ebay-budget/ebay-rate-limits.spec.ts` (existing file; add one case).

**Interfaces — Produces:**
- Column `ebay_accounts.last_billing_sync_at TIMESTAMPTZ NULL`.
- `EbayApiResource.FINANCES`.

```sql
-- Watermark + claim stamp for the billing-activity capture sweep (spec Part C3,
-- capture-only). NULL sorts first, so a store that just granted sell.finances
-- is swept on the next tick.
ALTER TABLE ebay_accounts ADD COLUMN IF NOT EXISTS last_billing_sync_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_ebay_accounts_last_billing_sync_at
  ON ebay_accounts (last_billing_sync_at NULLS FIRST)
  WHERE status = 'active';
```

- [ ] **Step 1: Failing test** in `ebay-rate-limits.spec.ts`. Use the file's existing builder for a `getRateLimits` resource entry:
  - Input: a resource `{ apiContext: 'sell', apiName: 'finances', resourceName: 'payoutapi.sell.finances', windows: [{ limit: 15000, timeWindowSeconds: 86400, … }] }`.
  - Expected: `mapRateLimits(...).byResource[EbayApiResource.FINANCES]?.daily?.limit` is `15000`.
- [ ] **Step 2: Run it** and confirm it fails (`FINANCES` is undefined).
- [ ] **Step 3: Implement.** Add the enum member, with a doc comment naming the 15,000/day pool and the 4-hour sweep, and the `RESOURCE_SOURCE` row.
- [ ] **Step 4: Run the tests.**
  - Run `npx jest src/common/ebay-budget src/modules/ebay`. `trading-methods.guard.spec.ts` and the Record type force the row to exist.
  - Apply 142 to a stock Postgres: init.sql plus every migration in order through `psql -v ON_ERROR_STOP=1`. Expected: exit 0.
- [ ] **Step 5: Commit** — `feat(api): ebay_accounts.last_billing_sync_at and the Finances call budget`.

---

### Task 3: The billing-activity capture sweep

**Files (new module `apps/api/src/modules/ebay-finances/`):**
- `ebay-finances.constants.ts`:
  - `EBAY_BILLING_SYNC_QUEUE = 'ebay-billing-sync'`;
  - `BILLING_PAGE_LIMIT = 200`;
  - `BILLING_MAX_PAGES = 10`;
  - `BILLING_MAX_WINDOW_DAYS = 120`.
- `billing-capture.helpers.ts` (pure) + `billing-capture.helpers.spec.ts`.
- `finances.client.ts`: `getBillingActivities`.
- `billing-capture.service.ts` + `billing-capture.service.spec.ts`.
- `billing-capture.processor.ts`: the tick.
- `ebay-finances.module.ts`.
- `ebay-finances.guard.spec.ts`: capture-only and egress greps.

**Modify:**
- `apps/api/src/app.module.ts`: import `EbayFinancesModule`.
- `apps/api/src/modules/admin/admin.module.ts`, `admin.controller.ts`, `admin.service.ts` (`ADMIN_QUEUE_NAMES`), `queue-events-collector.service.ts` (`OBSERVED_QUEUE_NAMES`): add `'ebay-billing-sync'` exactly as `'ebay-returns-sync'` is added.
- `packages/shared/src/domain/admin/platform-settings.types.ts`:
  - `EBAY_BILLING_SYNC_ENABLED = 'ebay.finances.billingSync.enabled'`;
  - `EBAY_BILLING_SYNC_CRON = 'ebay.finances.billingSync.cron'`;
  - `EBAY_BILLING_SYNC_INTERVAL_HOURS = 'ebay.finances.billingSync.intervalHours'`;
  - `EBAY_BILLING_SYNC_MAX_ACCOUNTS_PER_RUN = 'ebay.finances.billingSync.maxAccountsPerRun'`;
  - `EBAY_BILLING_SYNC_WINDOW_DAYS = 'ebay.finances.billingSync.windowDays'`.
- `platform-settings.registry.ts`. Defaults, with env vars named after the keys:
  - enabled `'true'` — it only ever touches stores that granted the scope;
  - cron `'*/10 * * * *'`, `requiresRestart`;
  - intervalHours `'4'`, bounds 1–48;
  - maxAccountsPerRun `'10'`, bounds 1–100;
  - windowDays `'30'`, bounds 1–120.
- `admin.json` en + tr: title + description for each of the five keys.

**Interfaces:**
- **Consumes:**
  - `EBAY_FINANCES_SCOPE` (Task 1);
  - `EbayApiResource.FINANCES` and `last_billing_sync_at` (Task 2);
  - `EbayService.getAccountAccessToken(accountId)`;
  - `QuotaEnforcementService.isSuspended(userId)`;
  - `withEbayRateLimitRetry`;
  - `EbayCallBudgetService` (as in `post-order.client.ts`).
- **Produces:**
  - `buildBillingDateFilter(now: Date, windowDays: number): string`;
  - `readBillingPage(body: unknown): BillingPage | null`;
  - `summarizeFeeTypes(pages: BillingPage[]): string`;
  - `BillingCaptureService.runSweep(): Promise<void>`.

**Pure helpers (`billing-capture.helpers.ts`).** Types go in `ebay-finances.types.ts`; apps/api is exempt from the 4-file rule, but keep it tidy.

```ts
/** `transactionDate:[start..end]` in UTC, at most 120 days back (eBay's documented bound). */
export function buildBillingDateFilter(now: Date, windowDays: number): string {
  const days = Math.min(Math.max(Math.floor(windowDays), 1), BILLING_MAX_WINDOW_DAYS);
  const start = new Date(now.getTime() - days * 86_400_000);
  return `transactionDate:[${start.toISOString()}..${now.toISOString()}]`;
}

/** Paging facts of one response, or null when the body is not the documented shape. */
export function readBillingPage(body: unknown): BillingPage | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const activities = Array.isArray(record.billingActivities) ? record.billingActivities : [];
  const total = typeof record.total === 'number' && Number.isFinite(record.total) ? record.total : null;
  const feeTypes = activities
    .map((a) => (a && typeof a === 'object' ? (a as Record<string, unknown>).feeType : undefined))
    .filter((t): t is string => typeof t === 'string');
  return { count: activities.length, total, hasNext: typeof record.next === 'string' && record.next !== '', feeTypes };
}

/** "AD_FEE×3, FINAL_VALUE_FEE×12" — the one thing the capture is for, readable in the log. */
export function summarizeFeeTypes(pages: readonly BillingPage[]): string {
  const counts = new Map<string, number>();
  for (const page of pages) for (const type of page.feeTypes) counts.set(type, (counts.get(type) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([t, n]) => `${t}×${n}`).join(', ') || 'none';
}
```

(The `feeType` values in the example comment are illustrative. The real values are exactly what the capture will show.)

**Client (`finances.client.ts`).**
- `getBillingActivities(accessToken, { filter, offset })` → `Promise<unknown>`, the raw JSON body.
- It is `axios.get` against `${apizBase}/sell/finances/v1/billing_activity` with params `{ filter, limit: BILLING_PAGE_LIMIT, offset }` and header `Authorization: Bearer <token>`.
- `apizBase` = `EBAY_REST_API_URL` with `://api.` replaced by `://apiz.` (the identity service's rule).
- Inside `withEbayRateLimitRetry(..., { logger, acquireBudget: () => this.budget.acquire(EbayApiResource.FINANCES, EbayCallPriority.BACKGROUND) })`. Copy the acquire call's exact shape from `post-order.client.ts` `chargeReturn`.
- `timeout` 30 s. It never logs the body.

**Service (`billing-capture.service.ts`).**
- **`runSweep`**: `getBoolean(EBAY_BILLING_SYNC_ENABLED)`, else return. `claimDueAccounts()`, then for each store `captureAccount` inside try/catch with `logger.warn`; one store never stops the others.
- **`claimDueAccounts`**: the returns-sweep SQL with two changes:
  - the column is `last_billing_sync_at`;
  - one extra predicate, `AND granted_scopes @> ARRAY[$3]::text[]`, bound to `EBAY_FINANCES_SCOPE`.

  The claim returns `id, user_id`.
- **`captureAccount(account)`**:
  - `if (await isSuspended(user_id)) return;`
  - `token = await ebay.getAccountAccessToken(id)`; none → warn and return.
  - `filter = buildBillingDateFilter(new Date(), windowDays)`.
  - Loop `page = 0 .. BILLING_MAX_PAGES - 1`:
    - `body = await client.getBillingActivities(token, { filter, offset: page * BILLING_PAGE_LIMIT })`;
    - `facts = readBillingPage(body)`;
    - write `body` verbatim (`JSON.stringify(body)`) to `<captureDir>/<accountId>/<Date.now()>-p<page>.json`, where `captureDir` = `process.env.EBAY_FINANCES_CAPTURE_DIR || path.join(process.cwd(), 'logs', 'ebay-finances-captures')`. The unreadable body IS written too — it is the evidence.
    - `if (!facts) { warn('…not the documented shape…'); break; }`;
    - `pages.push(facts)`;
    - stop when `facts.count < BILLING_PAGE_LIMIT || !facts.hasNext || (facts.total !== null && (page + 1) * BILLING_PAGE_LIMIT >= facts.total)`.
  - Hitting `BILLING_MAX_PAGES` logs a warn: more activity than the cap, the oldest is unread.
  - Finally `logger.log('Billing capture for eBay account <id>: <n> page(s), <sum count> line(s) of <total>, fee types: <summarizeFeeTypes>')`.
  - A thrown read propagates to `runSweep`'s catch (Review Focus 4). The pages already written stay on disk as partial evidence, and the log line says the read failed.

**Processor.** Copy `ebay-feed-sync.processor.ts`:
- queue `EBAY_BILLING_SYNC_QUEUE`, concurrency 1;
- cron from `EBAY_BILLING_SYNC_CRON`, fallback `'*/10 * * * *'`;
- `jobId: 'ebay-billing-sync-tick'`;
- clear the schedulers first.

**Module.** Imports `ConfigModule`, `DatabaseModule`, `EbayModule`, `BillingModule`, and `BullModule.registerQueue({ name: EBAY_BILLING_SYNC_QUEUE })`. Providers: client, service, processor.

- [ ] **Step 1: Failing tests.**
  - **`billing-capture.helpers.spec.ts`:**
    - `buildBillingDateFilter(new Date('2026-10-04T00:00:00Z'), 30)` → `'transactionDate:[2026-09-04T00:00:00.000Z..2026-10-04T00:00:00.000Z]'`;
    - `windowDays` 500 clamps to 120 and 0 to 1;
    - `readBillingPage(null)`, `readBillingPage([])` and `readBillingPage('x')` → null;
    - `readBillingPage({ billingActivities: [{ feeType: 'A' }, {}], total: 2, next: '' })` → `{ count: 2, total: 2, hasNext: false, feeTypes: ['A'] }`;
    - `summarizeFeeTypes([])` → `'none'`, and two pages with `['B','A']` / `['A']` → `'A×2, B×1'`.
  - **`billing-capture.service.spec.ts`** (fakes; `EBAY_FINANCES_CAPTURE_DIR` set to `fs.mkdtempSync(os.tmpdir() + '/bc-')`):
    1. **Disabled** → `db.query` never called.
    2. **The claim SQL** contains `granted_scopes @> ARRAY[$3]::text[]` and binds `EBAY_FINANCES_SCOPE` as `$3` (Review Focus 1).
    3. **A suspended owner** → the client is never called.
    4. **A 450-line store**: the fake client answers pages of 200 / 200 / 50 with `total: 450` and `next` set on the first two. Expect 3 client calls with offsets 0 / 200 / 400 and 3 files written (Review Focus 5).
    5. **A body without the documented shape** on page 0 → 1 file written, no second call.
    6. **Every page full and `next` always set** → exactly `BILLING_MAX_PAGES` calls (no runaway).
    7. **Two stores, the first one's client call throws** → the second store is still read (Review Focus 4).
  - **`ebay-finances.guard.spec.ts`:**
    - the module's `.ts` sources (comments stripped) contain no `INSERT INTO`, no `UPDATE orders`, no `DELETE`, and exactly one `UPDATE ebay_accounts` (the claim);
    - `finances.client.ts` contains `axios.get` and no `axios.post|put|delete`;
    - the only path is `/sell/finances/v1/billing_activity`.
- [ ] **Step 2: Run them** (`npx jest src/modules/ebay-finances`) and confirm they fail (modules missing).
- [ ] **Step 3: Implement** the files above, the registry entries, admin i18n en + tr (five keys × title and description), and the four admin queue registrations.
- [ ] **Step 4: Run the tests.**
  - `npx jest src/modules/ebay-finances src/modules/admin src/common/settings`, then the full `pnpm --filter api test`, then api `tsc`.
  - `PREPARE` the claim SQL against the Task 2 container (`PREPARE c AS <sql>; EXECUTE c('4', 10, '<scope>');`).
- [ ] **Step 5: Commit** — `feat(api): capture-only billing activity sweep for stores that granted sell.finances`.

---

### Task 4: Docs and hand-off

**Files:**
- `CLAUDE.md`. Add a section "eBay Finances: consent + billing capture (2026-10-04, migration 142)" under "Order Management", covering:
  - the switch;
  - the per-consent scope and the `state` field;
  - the sweep (claim on `last_billing_sync_at` and the scope; capture dir; nothing in the DB);
  - the five settings;
  - the Finances quota;
  - why the Action Center item and `captureOnly` are deferred;
  - the operator steps.

  Also add migration row `142`, and the `FINANCES` budget resource to the eBay call-budget paragraph.
- The spec: mark C2 and the capture "built 2026-10-04".
- `docs/ebay-reference/README.md`: one line under the Finances entry recording the production rate-limit resource name `payoutapi.sell.finances` (15,000/day, read 2026-10-04).

- [ ] **Step 1: Write the docs.**
- [ ] **Step 2: Full checks:** `pnpm --filter @repo/shared build`, api `tsc`, `pnpm --filter api test`, web `tsc` (the shared change touches nothing the web uses beyond types), `pnpm lint`.
- [ ] **Step 3: Commit, push `development`, merge to UAT and main** (the operator asked for ship-on-green).
- [ ] **Step 4: Operator hand-off** (the final message, not code):
  1. Turn on `/admin` → Settings → eBay → "Ask stores for the Finances permission".
  2. Stores → connect, and sign in to the sipastan eBay account (an in-place re-consent).
  3. Within ~10 minutes the sweep writes `apps/api/logs/ebay-finances-captures/<accountId>/*.json` and logs the `feeType` summary.
  4. If eBay refuses the consent, turn the switch off.

## Self-review notes

- **Spec coverage:**
  - C2 switch → Task 1.
  - granted_scopes recording → Task 1.
  - Reconnect → operator step (same-owner re-consent already exists).
  - Action Center item → deferred with a ruling (its spec condition is unreachable before Part B).
  - Capture-only billing sweep every 4 h per store with the scope, with the `last_billing_sync_at` claim → Tasks 2–3.
  - Quota resource → Task 2.
  - "No parser before capture" → the sweep only counts `feeType` strings for the log and writes nothing derived.
- **Placeholders:** none. The `feeType` example values in a comment are marked illustrative.
- **Type consistency:**
  - `getScopes(includeFinances)` is used identically in Tasks 1 and 4.
  - `BillingPage` is `{ count; total; hasNext; feeTypes }` in both the helpers and the service.
