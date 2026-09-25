# eBay Real API Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take eBay's daily API ceilings from eBay's own `getRateLimits` (persisted, refreshed hourly), remove every human-settable ceiling, and show eBay's figures beside our own counter in the admin eBay Limits tab.

**Architecture:** A pure parser/mapper turns eBay's `rate_limit` response into flat resource rows and maps them onto `EbayApiResource`. An `EbayRateLimitStore` persists the last snapshot eBay gave (one-row table) and serves it from memory. `EbayAnalyticsService` fetches with an application token (boot + hourly tick + panel reads cached 60s). The governor reads its ceiling from the store and does not gate when eBay has never reported one. The admin endpoint composes eBay's figures, our Redis counts and the reserve into one overview DTO.

**Tech Stack:** NestJS 10, raw `pg` via `DatabaseService`, BullMQ repeatable job, Redis Lua (existing), Jest (ts-jest, `apps/api`), React + RTK Query + `@repo/ui` (web).

**Spec:** `docs/superpowers/specs/2026-09-25-ebay-real-api-limits-design.md` — scope items 1-5 only. Item 6 (the `EbayApiResource` refactor into per-method Trading and multi-window budgets) is NOT in this plan.

## Global Constraints

- **No human-settable ceiling anywhere, and no fallback to one** (D1). The six `EBAY_BUDGET_{INVENTORY,TAXONOMY,ACCOUNT,FULFILLMENT,TRADING,FEED}_DAILY_LIMIT` keys leave `platform-settings.registry.ts`, `PlatformSettingKey`, both `admin.json` locales and the database. Never introduce a hardcoded default ceiling (e.g. "5,000 if eBay is silent") in code either.
- `EBAY_BUDGET_ENABLED` and `EBAY_BUDGET_RESERVE_PERCENT` **stay** — they are policy, not ceilings (D3).
- **The last value eBay gave always applies** (D2): a failed refresh changes nothing; the stored snapshot stands. With no snapshot ever stored, the governor does **not gate** (it still counts).
- The Media API image resource reports no rate. No daily figure for it may be invented, and no `EbayApiResource` member is added for it.
- TRADING's ceiling = the **lowest daily limit among the Trading methods we actually call**: `GetMyeBaySelling` and `EndItem` (the only two `X-EBAY-API-CALL-NAME` values in `apps/api/src/modules`). This is a mapping, not an invented number; the panel must mark it as partial (D5).
- A "daily" window is any rate whose `timeWindow >= 86400` seconds. eBay reports non-86400 day windows (sandbox showed `createListingDraft` at `89999`). If several qualify, use the one with the **lowest** limit.
- **Never compute a difference between eBay's used count and our counter.** eBay's day window resets at its own time (sandbox showed `20:13:30Z`), ours at UTC midnight; the subtraction would be meaningless. Show both side by side with both reset times.
- Our counter is **per resource, per UTC day** (`ebay:budget:{resource}:{day}`). It has no per-user dimension today; the spec's "per-user consumption" wording is not implemented by this plan and must not be claimed in UI copy. Column label is "Our count".
- Every user-visible string via i18n, in **both** `en` and `tr` (`admin.json`). Turkish written natively.
- Frontend: container/component/style/types split; no hardcoded colours/spacing; `@repo/ui` primitives only; `@repo/shared` changes need `pnpm --filter @repo/shared build` before the web app sees them.
- An applied migration is never edited. New migration number is **`121`**.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## Review Focus

1. **A resource with no `rates` array at all** (sandbox: `sell.negotiation`; production: the Media `Image` resource) — must parse to `windows: []`, show in the unmapped block, and never crash or produce a `0` ceiling. Pinned in Task 1.
2. **A day window that is not exactly 86400s** (`89999`) — must still count as the daily ceiling. Pinned in Task 1.
3. **eBay returns an unparseable / empty body, or the Analytics call 403s/500s** — must leave the stored snapshot untouched (never overwrite with an empty list, which would ungate everything). Pinned in Task 3.
4. **A mapped resource name eBay stops reporting** (rename) — the row must show "no eBay figure" and the governor must not gate that resource, instead of silently gating at 0. Pinned in Task 1 (mapper returns `null`) and Task 4 (governor with `null` limit counts but never refuses).
5. **Two API replicas: one refreshes, the other still serves its in-memory snapshot** — the store must re-read the DB after its memory TTL, so a replica does not run on a stale ceiling forever. Pinned in Task 2.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/domain/ebay/ebay-call-budget.types.ts` (modify) | Replace `EbayCallBudgetStatusDto` with the snapshot/overview DTOs |
| `apps/api/src/common/ebay-budget/ebay-rate-limits.ts` (create) | Pure: parse eBay response, pick the daily window, map to `EbayApiResource` |
| `apps/api/src/common/ebay-budget/ebay-rate-limits.spec.ts` (create) | Tests for the above |
| `apps/api/migrations/121_ebay_rate_limits.sql` (create) | Snapshot table + delete orphaned ceiling settings |
| `apps/api/src/common/ebay-budget/ebay-rate-limit.store.ts` (create) | Persist/read the last snapshot, memory cache, memoized mapping |
| `apps/api/src/common/ebay-budget/ebay-rate-limit.store.spec.ts` (create) | Tests with a fake `DatabaseService` |
| `apps/api/src/common/ebay-budget/ebay-analytics.service.ts` (create) | Application token + `getRateLimits`; persist on success; 60s panel cache |
| `apps/api/src/common/ebay-budget/ebay-analytics.service.spec.ts` (create) | Tests with a stubbed `fetch` |
| `apps/api/src/common/ebay-budget/ebay-rate-limit-refresh.processor.ts` (create) | Hourly repeatable tick + boot fetch |
| `apps/api/src/common/ebay-budget/ebay-budget.module.ts` (modify) | Register store, analytics, processor, overview service, queue |
| `apps/api/src/common/ebay-budget/ebay-call-budget.service.ts` (modify) | Ceiling from store; `null` = count, never refuse; `countsToday()` |
| `apps/api/src/common/ebay-budget/ebay-call-budget.helpers.ts` (modify) | `buildBudgetOverview` pure composer |
| `apps/api/src/common/ebay-budget/ebay-budget-overview.service.ts` (create) | Composes analytics + counts + reserve for the endpoint |
| `apps/api/src/common/settings/platform-settings.registry.ts` (modify) | Remove six ceiling entries |
| `packages/shared/src/domain/admin/platform-settings.types.ts` (modify) | Remove six enum members |
| `apps/api/src/modules/admin/{admin.controller.ts,admin.module.ts,admin.service.ts}` (modify) | Endpoint returns overview; register the new queue |
| `apps/web/src/features/admin/**` (modify) | Three-column table, age line, unmapped block |
| `packages/shared/src/i18n/resources/{en,tr}/admin.json` (modify) | Remove ceiling setting copy; add panel copy |
| `CLAUDE.md` (modify) | Correct the Trading and ceiling statements |

---

### Task 1: Shared DTOs + pure parser/mapper

**Files:**
- Modify: `packages/shared/src/domain/ebay/ebay-call-budget.types.ts`
- Create: `apps/api/src/common/ebay-budget/ebay-rate-limits.ts`
- Test: `apps/api/src/common/ebay-budget/ebay-rate-limits.spec.ts`

**Interfaces:**
- Produces (shared, exported from `@repo/shared` via the existing `domain/ebay` barrel):
  - `interface EbayRateWindowDto { limit: number; remaining: number; timeWindowSeconds: number; resetAt: string | null }`
  - `interface EbayRateLimitResourceDto { apiContext: string; apiName: string; apiVersion: string; resourceName: string; windows: EbayRateWindowDto[] }`
  - `interface EbayBudgetResourceRowDto { resource: EbayApiResource; ebayLimit: number | null; ebayRemaining: number | null; ebayResetAt: string | null; sourceResources: string[]; partial: boolean; otherWindows: EbayRateWindowDto[]; ourCount: number; backgroundLimit: number | null; ourResetAt: string }`
  - `interface EbayBudgetOverviewDto { fetchedAt: string | null; live: boolean; rows: EbayBudgetResourceRowDto[]; unmapped: EbayRateLimitResourceDto[] }`
  - `EbayCallBudgetStatusDto` is **deleted**.
- Produces (api, `ebay-rate-limits.ts`):
  - `const DAILY_WINDOW_MIN_SECONDS = 86_400`
  - `const TRADING_METHODS_WE_CALL: readonly string[] = ['GetMyeBaySelling', 'EndItem']`
  - `function parseRateLimitsResponse(body: unknown): EbayRateLimitResourceDto[]`
  - `function pickDailyWindow(windows: EbayRateWindowDto[]): EbayRateWindowDto | null`
  - `interface MappedLimit { limit: number; remaining: number; resetAt: string | null; sourceResources: string[]; partial: boolean; otherWindows: EbayRateWindowDto[] }`
  - `interface MappedRateLimits { byResource: Record<EbayApiResource, MappedLimit | null>; unmapped: EbayRateLimitResourceDto[] }`
  - `function mapRateLimits(resources: EbayRateLimitResourceDto[]): MappedRateLimits`

- [ ] **Step 1: Replace the shared DTO**

In `packages/shared/src/domain/ebay/ebay-call-budget.types.ts`, keep both enums and their comments exactly; update the `TRADING` member's comment and replace the `EbayCallBudgetStatusDto` interface (and its comment) with:

```ts
  /**
   * Legacy XML calls (store discovery, EndItem).
   *
   * eBay meters Trading PER METHOD, not as one pool (AddItem 100,000/day,
   * GetMyeBaySelling 5,000/day, ...). This single member is therefore mapped to
   * the lowest daily limit among the methods we actually call — a mapping, not
   * the whole truth about Trading.
   */
  TRADING = 'trading',
```

```ts
/** One rate window eBay reports for a resource. A resource may report several. */
export interface EbayRateWindowDto {
  limit: number;
  remaining: number;
  /** Window length in seconds. A "day" is not always exactly 86400. */
  timeWindowSeconds: number;
  /** When eBay's own window resets — NOT UTC midnight in general. */
  resetAt: string | null;
}

/** One resource exactly as eBay's `getRateLimits` reports it, flattened. */
export interface EbayRateLimitResourceDto {
  apiContext: string;
  apiName: string;
  apiVersion: string;
  resourceName: string;
  /** Empty when eBay reports no rate at all (e.g. the Media API image resource). */
  windows: EbayRateWindowDto[];
}

/**
 * One governed resource in the admin panel: eBay's figure beside our counter.
 *
 * The two are deliberately never subtracted. eBay's day resets at its own time
 * and ours at UTC midnight, so a difference would be meaningless — the operator
 * compares them by eye, and a large mismatch means some caller bypasses the
 * governor.
 */
export interface EbayBudgetResourceRowDto {
  resource: EbayApiResource;
  /** eBay's daily ceiling; null when eBay reported none — the governor then does not gate. */
  ebayLimit: number | null;
  ebayRemaining: number | null;
  ebayResetAt: string | null;
  /** eBay resource names this row was derived from. */
  sourceResources: string[];
  /** True when the row stands for part of what eBay meters (Trading). */
  partial: boolean;
  /** Sub-daily windows eBay also enforces on the same source. */
  otherWindows: EbayRateWindowDto[];
  /** Calls our governor counted today (UTC). */
  ourCount: number;
  /** Ceiling background work is held to; null when there is no eBay ceiling. */
  backgroundLimit: number | null;
  /** When our counter resets (UTC midnight). */
  ourResetAt: string;
}

/** `GET /v1/admin/ebay/budget`. */
export interface EbayBudgetOverviewDto {
  /** When eBay's figures were captured; null when eBay has never answered. */
  fetchedAt: string | null;
  /** False when the latest fetch failed and a stored snapshot is being shown. */
  live: boolean;
  rows: EbayBudgetResourceRowDto[];
  /** Everything eBay reports that no governed resource uses — shown, never hidden. */
  unmapped: EbayRateLimitResourceDto[];
}
```

- [ ] **Step 2: Write the failing tests**

Create `apps/api/src/common/ebay-budget/ebay-rate-limits.spec.ts`:

```ts
import { EbayApiResource } from '@repo/shared';

import {
  mapRateLimits,
  parseRateLimitsResponse,
  pickDailyWindow,
} from './ebay-rate-limits';

const rate = (limit: number, timeWindow: number, remaining = limit, reset = '2026-09-26T00:00:00.000Z') => ({
  count: limit - remaining,
  limit,
  remaining,
  reset,
  timeWindow,
});

/** Shape copied from a real getRateLimits body (sandbox capture, 2026-09-25) with production names. */
const body = {
  rateLimits: [
    { apiContext: 'sell', apiName: 'Inventory', apiVersion: 'v1', resources: [{ name: 'sell.inventory', rates: [rate(2_000_000, 86_400, 1_999_000)] }] },
    { apiContext: 'commerce', apiName: 'Taxonomy', apiVersion: 'v1', resources: [{ name: 'commerce.taxonomy', rates: [rate(5_000, 86_400)] }, { name: 'commerce.taxonomy.bulk', rates: [rate(100, 86_400)] }] },
    { apiContext: 'sell', apiName: 'Account', apiVersion: 'v1', resources: [{ name: 'sell.account', rates: [rate(25_000, 86_400)] }] },
    {
      apiContext: 'sell', apiName: 'Fulfillment', apiVersion: 'v1',
      resources: [
        { name: 'sell.fulfillment', rates: [rate(100_000, 86_400, 90_000)] },
        { name: 'sell.fulfillment.payment_dispute', rates: [rate(250_000, 86_400), rate(5_000, 300)] },
      ],
    },
    { apiContext: 'sell', apiName: 'Feed', apiVersion: 'v1', resources: [{ name: 'sell.feed', rates: [rate(100_000, 86_400)] }] },
    { apiContext: 'developer', apiName: 'Analytics', apiVersion: 'v1_beta', resources: [{ name: 'developer.analytics.app_rate_limit', rates: [rate(5_000, 86_400)] }] },
    {
      apiContext: 'TradingAPI', apiName: 'TradingAPI', apiVersion: 'v1',
      resources: [
        { name: 'AddItem', rates: [rate(100_000, 86_400)] },
        { name: 'GetMyeBaySelling', rates: [rate(5_000, 86_400, 4_000)] },
        { name: 'EndItem', rates: [rate(5_000, 86_400, 4_900)] },
      ],
    },
    { apiContext: 'commerce', apiName: 'Media', apiVersion: 'v1_beta', resources: [{ name: 'Image' }] },
  ],
};

describe('parseRateLimitsResponse', () => {
  it('flattens every resource with its windows', () => {
    const flat = parseRateLimitsResponse(body);
    const inventory = flat.find((r) => r.resourceName === 'sell.inventory');
    expect(inventory).toEqual({
      apiContext: 'sell',
      apiName: 'Inventory',
      apiVersion: 'v1',
      resourceName: 'sell.inventory',
      windows: [{ limit: 2_000_000, remaining: 1_999_000, timeWindowSeconds: 86_400, resetAt: '2026-09-26T00:00:00.000Z' }],
    });
  });

  it('keeps a resource that reports no rates, with no windows', () => {
    const image = parseRateLimitsResponse(body).find((r) => r.resourceName === 'Image');
    expect(image?.windows).toEqual([]);
  });

  it('drops malformed rates and nameless resources instead of throwing', () => {
    const flat = parseRateLimitsResponse({
      rateLimits: [
        { apiContext: 'x', apiName: 'y', apiVersion: 'v1', resources: [{ rates: [rate(1, 86_400)] }, { name: 'ok', rates: [{ limit: 'nope' }, rate(10, 86_400)] }] },
      ],
    });
    expect(flat).toHaveLength(1);
    expect(flat[0].windows).toHaveLength(1);
  });

  it.each([null, undefined, 'text', 42, {}, { rateLimits: 'x' }])('returns [] for %p', (input) => {
    expect(parseRateLimitsResponse(input)).toEqual([]);
  });
});

describe('pickDailyWindow', () => {
  it('treats a window longer than 86400s as daily', () => {
    const picked = pickDailyWindow([{ limit: 5_000, remaining: 5_000, timeWindowSeconds: 89_999, resetAt: null }]);
    expect(picked?.limit).toBe(5_000);
  });

  it('ignores sub-daily windows', () => {
    expect(pickDailyWindow([{ limit: 5_000, remaining: 5_000, timeWindowSeconds: 300, resetAt: null }])).toBeNull();
  });

  it('prefers the lowest daily limit when several qualify', () => {
    const picked = pickDailyWindow([
      { limit: 9_000, remaining: 9_000, timeWindowSeconds: 86_400, resetAt: null },
      { limit: 5_000, remaining: 4_000, timeWindowSeconds: 172_800, resetAt: null },
    ]);
    expect(picked?.limit).toBe(5_000);
  });

  it('returns null for no windows', () => {
    expect(pickDailyWindow([])).toBeNull();
  });
});

describe('mapRateLimits', () => {
  const mapped = mapRateLimits(parseRateLimitsResponse(body));

  it.each([
    [EbayApiResource.INVENTORY, 2_000_000, 1_999_000],
    [EbayApiResource.TAXONOMY, 5_000, 5_000],
    [EbayApiResource.ACCOUNT, 25_000, 25_000],
    [EbayApiResource.FULFILLMENT, 100_000, 90_000],
    [EbayApiResource.FEED, 100_000, 100_000],
    [EbayApiResource.ANALYTICS, 5_000, 5_000],
  ])('maps %s by its exact eBay resource name', (resource, limit, remaining) => {
    expect(mapped.byResource[resource]).toMatchObject({ limit, remaining, partial: false });
  });

  it('does not let a longer name that merely starts with a mapped one take its place', () => {
    // sell.fulfillment.payment_dispute is 250,000 — it must not become Fulfillment's ceiling.
    expect(mapped.byResource[EbayApiResource.FULFILLMENT]?.sourceResources).toEqual(['sell.fulfillment']);
  });

  it('maps Trading to the lowest daily limit among the methods we call, marked partial', () => {
    expect(mapped.byResource[EbayApiResource.TRADING]).toMatchObject({
      limit: 5_000,
      partial: true,
      sourceResources: ['GetMyeBaySelling', 'EndItem'],
    });
    // Remaining is that of the method the limit came from (GetMyeBaySelling, first of equals).
    expect(mapped.byResource[EbayApiResource.TRADING]?.remaining).toBe(4_000);
  });

  it('puts every resource no governed resource uses in unmapped', () => {
    const names = mapped.unmapped.map((r) => r.resourceName).sort();
    expect(names).toEqual(['AddItem', 'Image', 'commerce.taxonomy.bulk', 'sell.fulfillment.payment_dispute'].sort());
  });

  it('keeps sub-daily windows of a mapped source as otherWindows', () => {
    const m = mapRateLimits(
      parseRateLimitsResponse({
        rateLimits: [{ apiContext: 'sell', apiName: 'Inventory', apiVersion: 'v1', resources: [{ name: 'sell.inventory', rates: [rate(2_000_000, 86_400), rate(5_400, 60)] }] }],
      }),
    );
    expect(m.byResource[EbayApiResource.INVENTORY]?.otherWindows).toEqual([
      { limit: 5_400, remaining: 5_400, timeWindowSeconds: 60, resetAt: '2026-09-26T00:00:00.000Z' },
    ]);
  });

  it('returns null — never 0 — when eBay no longer reports a mapped name', () => {
    const m = mapRateLimits([]);
    for (const resource of Object.values(EbayApiResource)) {
      expect(m.byResource[resource]).toBeNull();
    }
  });

  it('returns null when a mapped source reports only sub-daily windows', () => {
    const m = mapRateLimits(
      parseRateLimitsResponse({
        rateLimits: [{ apiContext: 'sell', apiName: 'Feed', apiVersion: 'v1', resources: [{ name: 'sell.feed', rates: [rate(50, 3_600)] }] }],
      }),
    );
    expect(m.byResource[EbayApiResource.FEED]).toBeNull();
    // Matched, so it is not unmapped either.
    expect(m.unmapped).toEqual([]);
  });

  it('does not match Trading method names outside a Trading entry', () => {
    const m = mapRateLimits(
      parseRateLimitsResponse({
        rateLimits: [{ apiContext: 'sell', apiName: 'Other', apiVersion: 'v1', resources: [{ name: 'EndItem', rates: [rate(1, 86_400)] }] }],
      }),
    );
    expect(m.byResource[EbayApiResource.TRADING]).toBeNull();
    expect(m.unmapped).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @repo/shared build; pnpm --filter api test -- ebay-rate-limits`
Expected: FAIL — `Cannot find module './ebay-rate-limits'`.

- [ ] **Step 4: Implement `ebay-rate-limits.ts`**

```ts
import {
  EbayApiResource,
  type EbayRateLimitResourceDto,
  type EbayRateWindowDto,
} from '@repo/shared';

/**
 * Pure reading of eBay's `getRateLimits` response.
 *
 * eBay is the only source of a ceiling (spec D1): these functions turn its
 * answer into what the governor and the admin panel need, and are deliberately
 * tolerant — a response we cannot read must degrade to "no figure", never to a
 * zero ceiling that would stop every call.
 */

/** A window at least this long is a daily ceiling. eBay reports 89,999s for some. */
export const DAILY_WINDOW_MIN_SECONDS = 86_400;

/**
 * The Trading methods this codebase actually calls — the only two
 * `X-EBAY-API-CALL-NAME` values in `apps/api/src/modules`. Adding a Trading call
 * means adding its name here, or its quota is not governed.
 */
export const TRADING_METHODS_WE_CALL: readonly string[] = ['GetMyeBaySelling', 'EndItem'];

/** Exact eBay resource name per REST resource. Exact on purpose: `sell.fulfillment.payment_dispute` is a different bucket. */
const REST_SOURCE: Record<Exclude<EbayApiResource, EbayApiResource.TRADING>, string> = {
  [EbayApiResource.INVENTORY]: 'sell.inventory',
  [EbayApiResource.TAXONOMY]: 'commerce.taxonomy',
  [EbayApiResource.ACCOUNT]: 'sell.account',
  [EbayApiResource.FULFILLMENT]: 'sell.fulfillment',
  [EbayApiResource.FEED]: 'sell.feed',
  [EbayApiResource.ANALYTICS]: 'developer.analytics.app_rate_limit',
};

export interface MappedLimit {
  limit: number;
  remaining: number;
  resetAt: string | null;
  sourceResources: string[];
  partial: boolean;
  otherWindows: EbayRateWindowDto[];
}

export interface MappedRateLimits {
  byResource: Record<EbayApiResource, MappedLimit | null>;
  unmapped: EbayRateLimitResourceDto[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string => (typeof value === 'string' ? value : '');

function parseWindow(raw: unknown): EbayRateWindowDto | null {
  if (!isRecord(raw)) return null;
  const { limit, remaining, timeWindow, reset } = raw;
  if (typeof limit !== 'number' || typeof timeWindow !== 'number' || !Number.isFinite(limit) || !Number.isFinite(timeWindow)) {
    return null;
  }
  return {
    limit,
    remaining: typeof remaining === 'number' && Number.isFinite(remaining) ? remaining : limit,
    timeWindowSeconds: timeWindow,
    resetAt: typeof reset === 'string' ? reset : null,
  };
}

export function parseRateLimitsResponse(body: unknown): EbayRateLimitResourceDto[] {
  if (!isRecord(body) || !Array.isArray(body.rateLimits)) return [];
  const out: EbayRateLimitResourceDto[] = [];
  for (const entry of body.rateLimits) {
    if (!isRecord(entry) || !Array.isArray(entry.resources)) continue;
    for (const resource of entry.resources) {
      if (!isRecord(resource) || !str(resource.name)) continue;
      const rates = Array.isArray(resource.rates) ? resource.rates : [];
      out.push({
        apiContext: str(entry.apiContext),
        apiName: str(entry.apiName),
        apiVersion: str(entry.apiVersion),
        resourceName: str(resource.name),
        windows: rates.map(parseWindow).filter((w): w is EbayRateWindowDto => w !== null),
      });
    }
  }
  return out;
}

export function pickDailyWindow(windows: EbayRateWindowDto[]): EbayRateWindowDto | null {
  let best: EbayRateWindowDto | null = null;
  for (const window of windows) {
    if (window.timeWindowSeconds < DAILY_WINDOW_MIN_SECONDS) continue;
    if (!best || window.limit < best.limit) best = window;
  }
  return best;
}

const isTradingEntry = (r: EbayRateLimitResourceDto): boolean =>
  /trading/i.test(r.apiContext) || /trading/i.test(r.apiName);

export function mapRateLimits(resources: EbayRateLimitResourceDto[]): MappedRateLimits {
  const used = new Set<EbayRateLimitResourceDto>();
  const byResource = {} as Record<EbayApiResource, MappedLimit | null>;

  for (const resource of Object.values(EbayApiResource)) {
    const sources =
      resource === EbayApiResource.TRADING
        ? resources.filter((r) => isTradingEntry(r) && TRADING_METHODS_WE_CALL.includes(r.resourceName))
        : resources.filter((r) => r.resourceName === REST_SOURCE[resource]);
    sources.forEach((s) => used.add(s));

    let chosen: { source: EbayRateLimitResourceDto; daily: EbayRateWindowDto } | null = null;
    for (const source of sources) {
      const daily = pickDailyWindow(source.windows);
      if (daily && (!chosen || daily.limit < chosen.daily.limit)) chosen = { source, daily };
    }

    byResource[resource] = chosen
      ? {
          limit: chosen.daily.limit,
          remaining: chosen.daily.remaining,
          resetAt: chosen.daily.resetAt,
          sourceResources: sources.map((s) => s.resourceName),
          partial: resource === EbayApiResource.TRADING,
          otherWindows: chosen.source.windows.filter((w) => w.timeWindowSeconds < DAILY_WINDOW_MIN_SECONDS),
        }
      : null;
  }

  return { byResource, unmapped: resources.filter((r) => !used.has(r)) };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter api test -- ebay-rate-limits`
Expected: PASS (all). The build of `@repo/shared` is required first because `apps/api` jest maps `@repo/shared` to `dist/cjs`.

Note: `EbayCallBudgetStatusDto` is now gone, so `apps/api` and `apps/web` will not typecheck until Tasks 4-5. That is expected; do not stub it back.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/domain/ebay/ebay-call-budget.types.ts apps/api/src/common/ebay-budget/ebay-rate-limits.ts apps/api/src/common/ebay-budget/ebay-rate-limits.spec.ts
git commit -m "feat(ebay-budget): parse and map eBay's own rate limits"
```

---

### Task 2: Migration 121 + `EbayRateLimitStore`

**Files:**
- Create: `apps/api/migrations/121_ebay_rate_limits.sql`
- Create: `apps/api/src/common/ebay-budget/ebay-rate-limit.store.ts`
- Test: `apps/api/src/common/ebay-budget/ebay-rate-limit.store.spec.ts`

**Interfaces:**
- Consumes: `parseRateLimitsResponse`-shaped `EbayRateLimitResourceDto[]`, `mapRateLimits`, `MappedRateLimits` (Task 1); `DatabaseService.query<T>(sql, params): Promise<T[]>` (`apps/api/src/common/database/database.service.ts`).
- Produces:
  - `interface EbayRateLimitSnapshot { resources: EbayRateLimitResourceDto[]; fetchedAt: Date; mapped: MappedRateLimits }`
  - `class EbayRateLimitStore` with `save(resources: EbayRateLimitResourceDto[], fetchedAt: Date): Promise<void>`, `current(): Promise<EbayRateLimitSnapshot | null>`
  - `const STORE_MEMORY_TTL_MS = 60_000`

- [ ] **Step 1: Write the migration**

`apps/api/migrations/121_ebay_rate_limits.sql`:

```sql
-- eBay's own API call limits, as eBay last reported them.
--
-- The governor's daily ceilings used to be platform settings an operator typed
-- in from eBay's published table. They are now taken from eBay's getRateLimits
-- and from nowhere else: no panel entry, no env var, no code default. This
-- table holds the last answer eBay gave, so a restart, a deploy or an Analytics
-- outage does not lose it — a failed refresh changes nothing.
--
-- One row, always. `resources` is the flattened response (every resource eBay
-- reports, including ones we do not govern), so the admin panel can show
-- eBay's whole picture rather than only the rows that happen to map.

CREATE TABLE IF NOT EXISTS ebay_rate_limits (
    id          SMALLINT    PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    resources   JSONB       NOT NULL,
    fetched_at  TIMESTAMPTZ NOT NULL
);

-- The six hand-typed ceilings are gone from the registry; their override rows
-- would otherwise sit in platform_settings with nothing reading them.
DELETE FROM platform_settings
 WHERE key IN (
   'ebay.budget.inventoryDailyLimit',
   'ebay.budget.taxonomyDailyLimit',
   'ebay.budget.accountDailyLimit',
   'ebay.budget.fulfillmentDailyLimit',
   'ebay.budget.tradingDailyLimit',
   'ebay.budget.feedDailyLimit'
 );
```

- [ ] **Step 2: Write the failing tests**

`apps/api/src/common/ebay-budget/ebay-rate-limit.store.spec.ts`:

```ts
import { EbayApiResource, type EbayRateLimitResourceDto } from '@repo/shared';

import type { DatabaseService } from '../database/database.service';

import { EbayRateLimitStore, STORE_MEMORY_TTL_MS } from './ebay-rate-limit.store';

const inventory: EbayRateLimitResourceDto = {
  apiContext: 'sell',
  apiName: 'Inventory',
  apiVersion: 'v1',
  resourceName: 'sell.inventory',
  windows: [{ limit: 2_000_000, remaining: 2_000_000, timeWindowSeconds: 86_400, resetAt: null }],
};

function fakeDb(rows: Array<{ resources: unknown; fetched_at: Date }> = []) {
  const query = jest.fn(async (sql: string) => (sql.trim().startsWith('SELECT') ? rows : []));
  return { db: { query } as unknown as DatabaseService, query };
}

describe('EbayRateLimitStore', () => {
  afterEach(() => jest.useRealTimers());

  it('returns null when eBay has never answered', async () => {
    const { db } = fakeDb();
    expect(await new EbayRateLimitStore(db).current()).toBeNull();
  });

  it('reads and maps the stored snapshot', async () => {
    const fetchedAt = new Date('2026-09-25T10:00:00Z');
    const { db } = fakeDb([{ resources: [inventory], fetched_at: fetchedAt }]);
    const snapshot = await new EbayRateLimitStore(db).current();
    expect(snapshot?.fetchedAt).toEqual(fetchedAt);
    expect(snapshot?.mapped.byResource[EbayApiResource.INVENTORY]?.limit).toBe(2_000_000);
  });

  it('upserts the single row on save and serves it from memory afterwards', async () => {
    const { db, query } = fakeDb();
    const store = new EbayRateLimitStore(db);
    await store.save([inventory], new Date('2026-09-25T10:00:00Z'));
    const upsert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO ebay_rate_limits'));
    expect(upsert?.[0]).toContain('ON CONFLICT (id) DO UPDATE');
    query.mockClear();
    expect((await store.current())?.resources).toEqual([inventory]);
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses to store an empty list — that would ungate every resource', async () => {
    const { db, query } = fakeDb();
    await new EbayRateLimitStore(db).save([], new Date());
    expect(query).not.toHaveBeenCalled();
  });

  it('re-reads the database once its memory is older than the TTL (another replica refreshed)', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00Z'));
    const rows = [{ resources: [inventory], fetched_at: new Date('2026-09-25T09:00:00Z') }];
    const { db, query } = fakeDb(rows);
    const store = new EbayRateLimitStore(db);
    await store.current();
    await store.current();
    expect(query).toHaveBeenCalledTimes(1);
    jest.setSystemTime(new Date(Date.now() + STORE_MEMORY_TTL_MS + 1));
    await store.current();
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('keeps the last value it had when the database read fails', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00Z'));
    const { db, query } = fakeDb([{ resources: [inventory], fetched_at: new Date() }]);
    const store = new EbayRateLimitStore(db);
    await store.current();
    query.mockRejectedValueOnce(new Error('db down'));
    jest.setSystemTime(new Date(Date.now() + STORE_MEMORY_TTL_MS + 1));
    expect((await store.current())?.resources).toEqual([inventory]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter api test -- ebay-rate-limit.store`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the store**

`apps/api/src/common/ebay-budget/ebay-rate-limit.store.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import type { EbayRateLimitResourceDto } from '@repo/shared';

import { DatabaseService } from '../database/database.service';

import { mapRateLimits, type MappedRateLimits } from './ebay-rate-limits';

/** How long a replica trusts its in-memory snapshot before re-reading the row another replica may have refreshed. */
export const STORE_MEMORY_TTL_MS = 60_000;

export interface EbayRateLimitSnapshot {
  resources: EbayRateLimitResourceDto[];
  fetchedAt: Date;
  mapped: MappedRateLimits;
}

/**
 * The last limits eBay reported, persisted.
 *
 * The governor reads this on every acquire, so it is served from memory and
 * the mapping is computed once per snapshot. A failed database read keeps the
 * previous value (spec D2: the last value eBay gave always applies).
 */
@Injectable()
export class EbayRateLimitStore {
  private readonly logger = new Logger(EbayRateLimitStore.name);
  private snapshot: EbayRateLimitSnapshot | null = null;
  private loadedAt = 0;

  constructor(private readonly database: DatabaseService) {}

  async save(resources: EbayRateLimitResourceDto[], fetchedAt: Date): Promise<void> {
    // An empty answer is not evidence that eBay stopped metering — storing it
    // would remove every ceiling at once.
    if (resources.length === 0) return;
    await this.database.query(
      `INSERT INTO ebay_rate_limits (id, resources, fetched_at)
       VALUES (1, $1::jsonb, $2)
       ON CONFLICT (id) DO UPDATE SET resources = EXCLUDED.resources, fetched_at = EXCLUDED.fetched_at`,
      [JSON.stringify(resources), fetchedAt],
    );
    this.snapshot = { resources, fetchedAt, mapped: mapRateLimits(resources) };
    this.loadedAt = Date.now();
  }

  async current(): Promise<EbayRateLimitSnapshot | null> {
    if (this.loadedAt > 0 && Date.now() - this.loadedAt < STORE_MEMORY_TTL_MS) {
      return this.snapshot;
    }
    try {
      const rows = await this.database.query<{ resources: EbayRateLimitResourceDto[]; fetched_at: Date }>(
        'SELECT resources, fetched_at FROM ebay_rate_limits WHERE id = 1',
        [],
      );
      const row = rows[0];
      if (row && Array.isArray(row.resources)) {
        this.snapshot = { resources: row.resources, fetchedAt: new Date(row.fetched_at), mapped: mapRateLimits(row.resources) };
      }
      this.loadedAt = Date.now();
    } catch (error: unknown) {
      this.logger.warn(
        `Could not read stored eBay rate limits, keeping the last known value: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return this.snapshot;
  }
}
```

Check `DatabaseService.query`'s actual signature in `apps/api/src/common/database/database.service.ts` before running; if it returns `QueryResult` rather than rows, adapt the two call sites (and the fake) to it — the existing `admin.service.ts` usage `const observed = await this.databaseService.query<{...}>(...)` then `observed.map(...)` indicates it returns rows.

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter api test -- ebay-rate-limit.store`
Expected: PASS.

- [ ] **Step 6: Replay the migration against a stock Postgres**

Per CLAUDE.md: `docker run -d --name t121 -e POSTGRES_PASSWORD=x -e POSTGRES_DB=testdb postgres:18-alpine`, `CREATE ROLE sellerhill_user LOGIN;`, then pipe `docker/postgres/init.sql` and every `apps/api/migrations/*.sql` in order through `psql -v ON_ERROR_STOP=1`. Expected: `121` applies cleanly; re-running `121` alone also succeeds (idempotent). Remove the container afterwards.

- [ ] **Step 7: Commit**

```bash
git add apps/api/migrations/121_ebay_rate_limits.sql apps/api/src/common/ebay-budget/ebay-rate-limit.store.ts apps/api/src/common/ebay-budget/ebay-rate-limit.store.spec.ts
git commit -m "feat(ebay-budget): persist the last rate limits eBay reported"
```

---

### Task 3: `EbayAnalyticsService` + hourly refresh tick

**Files:**
- Create: `apps/api/src/common/ebay-budget/ebay-analytics.service.ts`
- Test: `apps/api/src/common/ebay-budget/ebay-analytics.service.spec.ts`
- Create: `apps/api/src/common/ebay-budget/ebay-rate-limit-refresh.processor.ts`
- Modify: `apps/api/src/common/ebay-budget/ebay-budget.module.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts` (`ADMIN_QUEUE_NAMES`), `admin.module.ts` (`registerQueue`), `admin.controller.ts` (`@InjectQueue` + `queues()` entry) — the three edits `admin-queue-coverage.guard.spec.ts` requires; also add the name to `OBSERVED_QUEUE_NAMES` in `queue-events-collector.service.ts`.

**Interfaces:**
- Consumes: `EbayRateLimitStore.save/current` (Task 2), `parseRateLimitsResponse` (Task 1), `EbayCallBudgetService.acquire(resource, priority, cost)` (existing), `ConfigService` keys `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_TOKEN_URL`, `EBAY_REST_API_URL`.
- Produces:
  - `class EbayAnalyticsService` with `refresh(): Promise<boolean>` (fetch + persist; true on success) and `forPanel(): Promise<{ snapshot: EbayRateLimitSnapshot | null; live: boolean }>`
  - `const PANEL_CACHE_MS = 60_000`
  - `export const EBAY_RATE_LIMIT_REFRESH_QUEUE = 'ebay-rate-limit-refresh'`

- [ ] **Step 1: Write the failing tests**

`apps/api/src/common/ebay-budget/ebay-analytics.service.spec.ts`:

```ts
import { EbayApiResource, EbayCallPriority } from '@repo/shared';
import type { ConfigService } from '@nestjs/config';

import { EbayBudgetExhaustedError } from './ebay-budget.errors';
import { EbayAnalyticsService, PANEL_CACHE_MS } from './ebay-analytics.service';
import type { EbayCallBudgetService } from './ebay-call-budget.service';
import type { EbayRateLimitStore } from './ebay-rate-limit.store';

const CONFIG: Record<string, string> = {
  EBAY_CLIENT_ID: 'id',
  EBAY_CLIENT_SECRET: 'secret',
  EBAY_TOKEN_URL: 'https://api.ebay.com/identity/v1/oauth2/token',
  EBAY_REST_API_URL: 'https://api.ebay.com/',
};

const rateBody = {
  rateLimits: [
    { apiContext: 'sell', apiName: 'Inventory', apiVersion: 'v1', resources: [{ name: 'sell.inventory', rates: [{ limit: 2_000_000, remaining: 1, timeWindow: 86_400, reset: null }] }] },
  ],
};

const response = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }) as Response;

function setup(config: Record<string, string> = CONFIG) {
  const store = { save: jest.fn(async () => undefined), current: jest.fn(async () => null) };
  const budget = { acquire: jest.fn(async () => undefined) };
  const cfg = { get: (k: string) => config[k] } as unknown as ConfigService;
  const fetchMock = jest.fn();
  global.fetch = fetchMock as unknown as typeof fetch;
  const service = new EbayAnalyticsService(
    cfg,
    store as unknown as EbayRateLimitStore,
    budget as unknown as EbayCallBudgetService,
  );
  return { service, store, budget, fetchMock };
}

describe('EbayAnalyticsService.refresh', () => {
  afterEach(() => jest.useRealTimers());

  it('gets an application token, calls rate_limit, and persists the parsed resources', async () => {
    const { service, store, budget, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValueOnce(response(200, rateBody));

    expect(await service.refresh()).toBe(true);

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0];
    expect(tokenUrl).toBe(CONFIG.EBAY_TOKEN_URL);
    expect(String(tokenInit.body)).toContain('grant_type=client_credentials');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.ebay.com/developer/analytics/v1_beta/rate_limit/');
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer tok');
    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.ANALYTICS, EbayCallPriority.INTERACTIVE, 1);
    expect(store.save).toHaveBeenCalledWith(
      [expect.objectContaining({ resourceName: 'sell.inventory' })],
      expect.any(Date),
    );
  });

  it('reuses the application token until shortly before it expires', async () => {
    const { service, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValue(response(200, rateBody));
    await service.refresh();
    await service.refresh();
    const tokenCalls = fetchMock.mock.calls.filter(([url]) => url === CONFIG.EBAY_TOKEN_URL);
    expect(tokenCalls).toHaveLength(1);
  });

  it.each([
    ['a 403', () => response(403, 'forbidden')],
    ['a 500', () => response(500, 'boom')],
    ['a non-JSON body', () => response(200, 'not json')],
    ['an empty rateLimits', () => response(200, { rateLimits: [] })],
  ])('leaves the stored snapshot alone on %s', async (_label, make) => {
    const { service, store, fetchMock } = setup();
    fetchMock.mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 })).mockResolvedValueOnce(make());
    expect(await service.refresh()).toBe(false);
    expect(store.save).not.toHaveBeenCalled();
  });

  it('never throws on a network error', async () => {
    const { service, fetchMock } = setup();
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));
    await expect(service.refresh()).resolves.toBe(false);
  });

  it('does not call eBay when credentials are missing', async () => {
    const { service, fetchMock } = setup({});
    expect(await service.refresh()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an exhausted Analytics budget as a failed refresh', async () => {
    const { service, budget, fetchMock } = setup();
    budget.acquire.mockRejectedValueOnce(new EbayBudgetExhaustedError(EbayApiResource.ANALYTICS, new Date()));
    fetchMock.mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 }));
    expect(await service.refresh()).toBe(false);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('rate_limit'))).toBe(false);
  });
});

describe('EbayAnalyticsService.forPanel', () => {
  afterEach(() => jest.useRealTimers());

  it('calls eBay at most once per cache window', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-25T10:00:00Z'));
    const { service, fetchMock } = setup();
    fetchMock
      .mockResolvedValueOnce(response(200, { access_token: 'tok', expires_in: 7200 }))
      .mockResolvedValue(response(200, rateBody));
    await service.forPanel();
    await service.forPanel();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('rate_limit'))).toHaveLength(1);
    jest.setSystemTime(new Date(Date.now() + PANEL_CACHE_MS + 1));
    await service.forPanel();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('rate_limit'))).toHaveLength(2);
  });

  it('reports live=false and serves the stored snapshot when the fetch fails', async () => {
    const { service, store, fetchMock } = setup();
    const stored = { resources: [], fetchedAt: new Date('2026-09-24T00:00:00Z'), mapped: {} };
    store.current.mockResolvedValue(stored as never);
    fetchMock.mockRejectedValue(new Error('down'));
    expect(await service.forPanel()).toEqual({ snapshot: stored, live: false });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter api test -- ebay-analytics`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the service**

`apps/api/src/common/ebay-budget/ebay-analytics.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EbayApiResource, EbayCallPriority } from '@repo/shared';

import { EbayCallBudgetService } from './ebay-call-budget.service';
import { EbayRateLimitStore, type EbayRateLimitSnapshot } from './ebay-rate-limit.store';
import { parseRateLimitsResponse } from './ebay-rate-limits';

/** The admin panel asks eBay at most this often; ~1,440 calls/day worst case against Analytics' 5,000. */
export const PANEL_CACHE_MS = 60_000;

/** Refresh the application token this long before eBay says it expires. */
const TOKEN_SAFETY_MS = 60_000;

/**
 * Asks eBay what THIS keyset's real call limits are.
 *
 * Uses an APPLICATION token (client credentials): limits belong to the keyset,
 * not to a seller, so no connected store is involved. Never throws — every
 * failure returns false and leaves the stored snapshot exactly as it was.
 */
@Injectable()
export class EbayAnalyticsService {
  private readonly logger = new Logger(EbayAnalyticsService.name);
  private token: { value: string; expiresAt: number } | null = null;
  private lastAttemptAt = 0;
  private lastLive = false;

  constructor(
    private readonly config: ConfigService,
    private readonly store: EbayRateLimitStore,
    private readonly budget: EbayCallBudgetService,
  ) {}

  async refresh(): Promise<boolean> {
    const clientId = this.config.get<string>('EBAY_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('EBAY_CLIENT_SECRET')?.trim();
    const tokenUrl = this.config.get<string>('EBAY_TOKEN_URL')?.trim();
    const restBase = this.config.get<string>('EBAY_REST_API_URL')?.trim();
    if (!clientId || !clientSecret || !tokenUrl || !restBase) {
      this.logger.warn('eBay credentials not configured; cannot read eBay rate limits.');
      return false;
    }

    try {
      const token = await this.applicationToken(tokenUrl, clientId, clientSecret);
      // Counted like any other call so our column is comparable with eBay's.
      await this.budget.acquire(EbayApiResource.ANALYTICS, EbayCallPriority.INTERACTIVE, 1);
      const response = await fetch(`${restBase.replace(/\/+$/, '')}/developer/analytics/v1_beta/rate_limit/`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
      const text = await response.text();
      if (!response.ok) {
        this.logger.warn(`eBay rate_limit call failed (${response.status}): ${text.slice(0, 300)}`);
        return false;
      }
      let body: unknown;
      try {
        body = JSON.parse(text);
      } catch {
        this.logger.warn('eBay rate_limit returned a non-JSON body; keeping the stored limits.');
        return false;
      }
      const resources = parseRateLimitsResponse(body);
      if (resources.length === 0) {
        this.logger.warn('eBay rate_limit returned no resources; keeping the stored limits.');
        return false;
      }
      await this.store.save(resources, new Date());
      return true;
    } catch (error: unknown) {
      this.logger.warn(`Could not refresh eBay rate limits: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  async forPanel(): Promise<{ snapshot: EbayRateLimitSnapshot | null; live: boolean }> {
    if (Date.now() - this.lastAttemptAt >= PANEL_CACHE_MS) {
      this.lastAttemptAt = Date.now();
      this.lastLive = await this.refresh();
    }
    return { snapshot: await this.store.current(), live: this.lastLive };
  }

  private async applicationToken(tokenUrl: string, clientId: string, clientSecret: string): Promise<string> {
    if (this.token && Date.now() < this.token.expiresAt - TOKEN_SAFETY_MS) {
      return this.token.value;
    }
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // eBay wants the production scope string even against the sandbox host.
      body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`application token request failed (${response.status})`);
    }
    const parsed = JSON.parse(text) as { access_token?: string; expires_in?: number };
    if (!parsed.access_token) {
      throw new Error('application token response carried no access_token');
    }
    this.token = { value: parsed.access_token, expiresAt: Date.now() + (parsed.expires_in ?? 7200) * 1000 };
    return parsed.access_token;
  }
}
```

Note the ordering: the token call happens before `acquire`, so the "exhausted Analytics budget" test sees a token call but no `rate_limit` call — matching the test. `EbayBudgetExhaustedError` is caught by the generic catch.

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter api test -- ebay-analytics`
Expected: PASS.

- [ ] **Step 5: Add the refresh processor**

`apps/api/src/common/ebay-budget/ebay-rate-limit-refresh.processor.ts`:

```ts
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { EbayAnalyticsService } from './ebay-analytics.service';

export const EBAY_RATE_LIMIT_REFRESH_QUEUE = 'ebay-rate-limit-refresh';
const REFRESH_JOB = 'refresh-ebay-rate-limits';
/** Hourly is ample: ceilings change on an Application Growth Check approval, which is rare. */
const REFRESH_CRON = '7 * * * *';

/**
 * Keeps the stored eBay limits current: once at boot, then hourly.
 *
 * A failed refresh changes nothing — the governor keeps using the last value
 * eBay gave (spec D2).
 */
@Processor(EBAY_RATE_LIMIT_REFRESH_QUEUE, { concurrency: 1 })
@Injectable()
export class EbayRateLimitRefreshProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(EbayRateLimitRefreshProcessor.name);

  constructor(
    @InjectQueue(EBAY_RATE_LIMIT_REFRESH_QUEUE) private readonly queue: Queue,
    private readonly analytics: EbayAnalyticsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(REFRESH_JOB, {}, {
        repeat: { pattern: REFRESH_CRON },
        jobId: 'ebay-rate-limit-refresh-tick',
        removeOnComplete: true,
        removeOnFail: { age: 86_400 },
      });
    } catch (error: unknown) {
      this.logger.warn(`Failed to schedule eBay rate-limit refresh: ${error instanceof Error ? error.message : String(error)}`);
    }
    // Boot fetch, not awaited: a slow eBay must not delay startup.
    void this.analytics.refresh();
  }

  async process(job: Job): Promise<{ refreshed: boolean }> {
    if (job.name !== REFRESH_JOB) return { refreshed: false };
    return { refreshed: await this.analytics.refresh() };
  }
}
```

- [ ] **Step 6: Wire the module**

`ebay-budget.module.ts` — add `imports: [BullModule.registerQueue({ name: EBAY_RATE_LIMIT_REFRESH_QUEUE })]`, providers `EbayRateLimitStore`, `EbayAnalyticsService`, `EbayRateLimitRefreshProcessor`, and export `EbayRateLimitStore`, `EbayAnalyticsService` alongside `EbayCallBudgetService`. Extend the module comment: the store is depended on by both the governor and the analytics service, and the analytics service depends on the governor — never the reverse, which would be a DI cycle. `DatabaseService` and `ConfigService` come from global modules; confirm by checking that `SettingsModule` does not import them explicitly.

Admin three edits: add `'ebay-rate-limit-refresh'` to `ADMIN_QUEUE_NAMES` and `OBSERVED_QUEUE_NAMES`; `{ name: 'ebay-rate-limit-refresh' }` in `admin.module.ts`'s `BullModule.registerQueue(...)`; `@InjectQueue('ebay-rate-limit-refresh') private readonly ebayRateLimitRefreshQueue: Queue` in the controller constructor and `{ name: 'ebay-rate-limit-refresh', queue: this.ebayRateLimitRefreshQueue }` in `queues()`.

- [ ] **Step 7: Run the guard + new specs**

Run: `pnpm --filter api test -- admin-queue-coverage ebay-analytics ebay-rate-limit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/common/ebay-budget apps/api/src/modules/admin/admin.service.ts apps/api/src/modules/admin/admin.module.ts apps/api/src/modules/admin/admin.controller.ts apps/api/src/modules/admin/queue-events-collector.service.ts
git commit -m "feat(ebay-budget): fetch eBay's rate limits at boot and hourly"
```

---

### Task 4: Governor ceilings from eBay; remove the typed-in ceilings; overview endpoint

**Files:**
- Modify: `apps/api/src/common/ebay-budget/ebay-call-budget.service.ts`
- Modify: `apps/api/src/common/ebay-budget/ebay-call-budget.helpers.ts` (+ `.spec.ts`)
- Create: `apps/api/src/common/ebay-budget/ebay-budget-overview.service.ts`
- Create: `apps/api/src/common/ebay-budget/ebay-call-budget.service.spec.ts`
- Modify: `apps/api/src/common/ebay-budget/ebay-budget.module.ts` (provide/export overview service)
- Modify: `apps/api/src/common/settings/platform-settings.registry.ts`, `packages/shared/src/domain/admin/platform-settings.types.ts`, both `admin.json` (`admin.settings.keys` + `admin.settings.descriptions`: delete the six `ebay.budget.*DailyLimit` entries; keep `enabled` and `reservePercent`)
- Modify: `apps/api/src/modules/admin/admin.controller.ts` (endpoint)

**Interfaces:**
- Consumes: `EbayRateLimitStore.current()` (Task 2), `EbayAnalyticsService.forPanel()` (Task 3), `MappedRateLimits` (Task 1), `EbayBudgetOverviewDto` (Task 1).
- Produces:
  - `EbayCallBudgetService.countsToday(): Promise<Record<EbayApiResource, number>>` (replaces `status()`, which is deleted)
  - `function buildBudgetOverview(input: { snapshot: EbayRateLimitSnapshot | null; live: boolean; counts: Record<EbayApiResource, number>; reservePercent: number; now: Date }): EbayBudgetOverviewDto` in helpers
  - `class EbayBudgetOverviewService { get(): Promise<EbayBudgetOverviewDto> }`
  - `GET /v1/admin/ebay/budget` → `EbayBudgetOverviewDto`

- [ ] **Step 1: Write the failing governor tests**

`apps/api/src/common/ebay-budget/ebay-call-budget.service.spec.ts`:

```ts
import { EbayApiResource, EbayCallPriority, PlatformSettingKey } from '@repo/shared';

import type { RedisService } from '../redis/redis.service';
import type { PlatformSettingsService } from '../settings/platform-settings.service';

import { EbayBudgetExhaustedError } from './ebay-budget.errors';
import { EbayCallBudgetService } from './ebay-call-budget.service';
import type { EbayRateLimitStore } from './ebay-rate-limit.store';
import { mapRateLimits } from './ebay-rate-limits';

const taxonomy = {
  apiContext: 'commerce', apiName: 'Taxonomy', apiVersion: 'v1', resourceName: 'commerce.taxonomy',
  windows: [{ limit: 5_000, remaining: 5_000, timeWindowSeconds: 86_400, resetAt: null }],
};

function setup(resources: typeof taxonomy[] | null, scriptResult: [number, number] = [1, 10]) {
  const runScript = jest.fn(async () => scriptResult);
  const redis = { registerScript: jest.fn(), runScript, keys: { key: (...p: string[]) => p.join(':') }, command: { get: jest.fn(async () => '7'), decrby: jest.fn() } };
  const settings = {
    getBoolean: jest.fn(async () => true),
    getNumber: jest.fn(async (k: PlatformSettingKey) => (k === PlatformSettingKey.EBAY_BUDGET_RESERVE_PERCENT ? 20 : 0)),
  };
  const store = {
    current: jest.fn(async () => (resources ? { resources, fetchedAt: new Date(), mapped: mapRateLimits(resources) } : null)),
  };
  const service = new EbayCallBudgetService(
    redis as unknown as RedisService,
    settings as unknown as PlatformSettingsService,
    store as unknown as EbayRateLimitStore,
  );
  return { service, runScript };
}

describe('EbayCallBudgetService.acquire', () => {
  it('gates against eBay\'s ceiling minus the reserve for background work', async () => {
    const { service, runScript } = setup([taxonomy]);
    await service.acquire(EbayApiResource.TAXONOMY, EbayCallPriority.BACKGROUND);
    expect(runScript.mock.calls[0][2][0]).toBe(4_000);
  });

  it('counts but never refuses when eBay has never reported limits', async () => {
    const { service, runScript } = setup(null);
    await service.acquire(EbayApiResource.TAXONOMY);
    // -1 = unlimited in the Lua script: still INCRBY, never a refusal.
    expect(runScript.mock.calls[0][2][0]).toBe(-1);
  });

  it('counts but never refuses a resource eBay stopped reporting', async () => {
    const { service, runScript } = setup([taxonomy]);
    await service.acquire(EbayApiResource.INVENTORY);
    expect(runScript.mock.calls[0][2][0]).toBe(-1);
  });

  it('throws EbayBudgetExhaustedError when the script refuses', async () => {
    const { service } = setup([taxonomy], [0, 0]);
    await expect(service.acquire(EbayApiResource.TAXONOMY)).rejects.toBeInstanceOf(EbayBudgetExhaustedError);
  });
});

describe('EbayCallBudgetService.countsToday', () => {
  it('returns our counter for every resource', async () => {
    const { service } = setup([taxonomy]);
    const counts = await service.countsToday();
    expect(Object.keys(counts).sort()).toEqual(Object.values(EbayApiResource).sort());
    expect(counts[EbayApiResource.TAXONOMY]).toBe(7);
  });
});
```

- [ ] **Step 2: Write the failing overview tests** — add to `ebay-call-budget.helpers.spec.ts`. Merge the imports below into the file's existing import block at the top (do not leave `import` statements mid-file; `EbayApiResource` / helper imports may already be there), then append the `describe`:

```ts
import { EbayApiResource } from '@repo/shared';

import { buildBudgetOverview } from './ebay-call-budget.helpers';
import { mapRateLimits } from './ebay-rate-limits';

describe('buildBudgetOverview', () => {
  const now = new Date('2026-09-25T10:00:00Z');
  const counts = Object.fromEntries(Object.values(EbayApiResource).map((r) => [r, 3])) as Record<EbayApiResource, number>;
  const resources = [
    { apiContext: 'commerce', apiName: 'Taxonomy', apiVersion: 'v1', resourceName: 'commerce.taxonomy', windows: [{ limit: 5_000, remaining: 4_100, timeWindowSeconds: 86_400, resetAt: '2026-09-25T20:13:30.000Z' }] },
    { apiContext: 'commerce', apiName: 'Media', apiVersion: 'v1_beta', resourceName: 'Image', windows: [] },
  ];

  it('puts eBay\'s figures beside our count, never a difference', () => {
    const dto = buildBudgetOverview({ snapshot: { resources, fetchedAt: now, mapped: mapRateLimits(resources) }, live: true, counts, reservePercent: 20, now });
    const row = dto.rows.find((r) => r.resource === EbayApiResource.TAXONOMY);
    expect(row).toMatchObject({ ebayLimit: 5_000, ebayRemaining: 4_100, ebayResetAt: '2026-09-25T20:13:30.000Z', ourCount: 3, backgroundLimit: 4_000, ourResetAt: '2026-09-26T00:00:00.000Z' });
    expect(dto.fetchedAt).toBe(now.toISOString());
    expect(dto.unmapped.map((r) => r.resourceName)).toEqual(['Image']);
  });

  it('shows a row for every governed resource even without an eBay figure', () => {
    const dto = buildBudgetOverview({ snapshot: null, live: false, counts, reservePercent: 20, now });
    expect(dto.rows).toHaveLength(Object.values(EbayApiResource).length);
    expect(dto.rows.every((r) => r.ebayLimit === null && r.backgroundLimit === null)).toBe(true);
    expect(dto.fetchedAt).toBeNull();
    expect(dto.unmapped).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter api test -- ebay-call-budget`
Expected: FAIL (constructor arity, missing `buildBudgetOverview`, missing `countsToday`).

- [ ] **Step 4: Implement governor changes**

In `ebay-call-budget.service.ts`:
- Delete `LIMIT_SETTING` and `status()`.
- Change the Lua so `-1` means unlimited:

```ts
const ACQUIRE_LUA = `
local used = tonumber(redis.call('GET', KEYS[1]) or '0')
local limit = tonumber(ARGV[1])
local cost = tonumber(ARGV[2])

if limit >= 0 and used + cost > limit then
  return { 0, limit - used }
end

local total = redis.call('INCRBY', KEYS[1], cost)
if total == cost then
  redis.call('EXPIRE', KEYS[1], tonumber(ARGV[3]))
end
return { 1, limit - total }
`;
```

  Add to the script comment: `ARGV[1] = -1` means eBay has given no ceiling for this resource — count, never refuse (spec D2).
- Constructor gains `private readonly rateLimits: EbayRateLimitStore` (third parameter).
- In `acquire`: `const limit = await this.resolveLimit(resource); const ceiling = limit === null ? -1 : effectiveLimit(limit, reserve, priority);` and pass `ceiling`.
- `resolveLimit`:

```ts
  /** eBay's own daily ceiling, or null when eBay has not given one — never a number we made up. */
  private async resolveLimit(resource: EbayApiResource): Promise<number | null> {
    const snapshot = await this.rateLimits.current();
    return snapshot?.mapped.byResource[resource]?.limit ?? null;
  }
```

- `countsToday`:

```ts
  /** Our own count for today, per resource — compared against eBay's, never substituted for it. */
  async countsToday(): Promise<Record<EbayApiResource, number>> {
    const day = budgetWindow(new Date()).day;
    const entries = await Promise.all(
      Object.values(EbayApiResource).map(async (resource) => {
        try {
          return [resource, Number(await this.redis.command.get(this.counterKey(resource, day))) || 0] as const;
        } catch {
          return [resource, 0] as const;
        }
      }),
    );
    return Object.fromEntries(entries) as Record<EbayApiResource, number>;
  }
```

- Update the class comment: ceilings come from eBay's `getRateLimits` via `EbayRateLimitStore`; there is no configured ceiling.

In `ebay-call-budget.helpers.ts` add `buildBudgetOverview`:

```ts
import {
  EbayApiResource,
  EbayCallPriority,
  type EbayBudgetOverviewDto,
} from '@repo/shared';

import type { EbayRateLimitSnapshot } from './ebay-rate-limit.store';

export function buildBudgetOverview(input: {
  snapshot: EbayRateLimitSnapshot | null;
  live: boolean;
  counts: Record<EbayApiResource, number>;
  reservePercent: number;
  now: Date;
}): EbayBudgetOverviewDto {
  const ourResetAt = budgetWindow(input.now).resetAt.toISOString();
  return {
    fetchedAt: input.snapshot ? input.snapshot.fetchedAt.toISOString() : null,
    live: input.live,
    rows: Object.values(EbayApiResource).map((resource) => {
      const mapped = input.snapshot?.mapped.byResource[resource] ?? null;
      return {
        resource,
        ebayLimit: mapped?.limit ?? null,
        ebayRemaining: mapped?.remaining ?? null,
        ebayResetAt: mapped?.resetAt ?? null,
        sourceResources: mapped?.sourceResources ?? [],
        partial: resource === EbayApiResource.TRADING,
        otherWindows: mapped?.otherWindows ?? [],
        ourCount: input.counts[resource] ?? 0,
        backgroundLimit: mapped ? effectiveLimit(mapped.limit, input.reservePercent, EbayCallPriority.BACKGROUND) : null,
        ourResetAt,
      };
    }),
    unmapped: input.snapshot?.mapped.unmapped ?? [],
  };
}
```

(Keep `EbayCallPriority` in the existing import rather than duplicating it.) Note `partial` is set for TRADING even when eBay gave no figure, so the panel always flags it.

`ebay-budget-overview.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PlatformSettingKey, type EbayBudgetOverviewDto } from '@repo/shared';

import { PlatformSettingsService } from '../settings/platform-settings.service';

import { EbayAnalyticsService } from './ebay-analytics.service';
import { buildBudgetOverview } from './ebay-call-budget.helpers';
import { EbayCallBudgetService } from './ebay-call-budget.service';

/** The admin panel's read model: eBay's figures (cached 60s) beside our own counter. */
@Injectable()
export class EbayBudgetOverviewService {
  constructor(
    private readonly analytics: EbayAnalyticsService,
    private readonly budget: EbayCallBudgetService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  async get(): Promise<EbayBudgetOverviewDto> {
    const [{ snapshot, live }, counts, reservePercent] = await Promise.all([
      this.analytics.forPanel(),
      this.budget.countsToday(),
      this.platformSettings.getNumber(PlatformSettingKey.EBAY_BUDGET_RESERVE_PERCENT),
    ]);
    return buildBudgetOverview({ snapshot, live, counts, reservePercent, now: new Date() });
  }
}
```

Provide + export it from `EbayBudgetModule`. In `admin.controller.ts`, replace the `EbayCallBudgetService` injection with `EbayBudgetOverviewService` (if nothing else in the controller uses the budget service) and the endpoint:

```ts
  async getEbayCallBudget(): Promise<EbayBudgetOverviewDto> {
    return this.ebayBudgetOverview.get();
  }
```

Update the `@ApiOperation` summary: "eBay's own daily limits beside our call counter (read-only)".

- [ ] **Step 5: Remove the six ceiling settings**

Delete the six `EBAY_BUDGET_*_DAILY_LIMIT` entries from `platform-settings.registry.ts`, the six enum members from `PlatformSettingKey`, and their `keys`/`descriptions` entries from both `admin.json` files. Then:

Run: `pnpm --filter @repo/shared build` then `grep -rn "DailyLimit\|DAILY_LIMIT" apps/api/src packages/shared/src apps/web/src docker-compose*.yml apps/api/.env.example`
Expected: no matches for the six keys (other unrelated `DAILY_LIMIT` names, if any, are fine — inspect each hit).

- [ ] **Step 6: Run the full API suite and typecheck**

Run: `pnpm --filter api test` then `pnpm --filter api exec tsc --noEmit -p tsconfig.json`
Expected: all suites PASS (including `platform-settings-i18n.guard.spec.ts`); API typecheck clean. The web app still fails typecheck until Task 5.

- [ ] **Step 7: Commit**

```bash
git add apps/api packages/shared
git commit -m "feat(ebay-budget): take ceilings from eBay, drop the typed-in ones"
```

---

### Task 5: Admin panel — eBay figures beside ours, with their age; docs

**Files:**
- Modify: `apps/web/src/features/admin/api/admin.api.ts` (`getAdminEbayBudget` → `EbayBudgetOverviewDto`)
- Modify: `apps/web/src/features/admin/hooks/useAdminEbayColumns.tsx` (budget columns over `EbayBudgetResourceRowDto`; add `unmappedColumns` over `EbayRateLimitResourceDto`)
- Modify: `apps/web/src/features/admin/AdminPage/AdminPage.{container.tsx,component.tsx,types.ts,style.ts}`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/admin.json` (`admin.ebayLimits.*`)
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `EbayBudgetOverviewDto`, `EbayBudgetResourceRowDto`, `EbayRateLimitResourceDto`, `EbayRateWindowDto` (Task 1); `GET /admin/ebay/budget` (Task 4).
- Produces (component props, `AdminPage.types.ts`): replace `ebayBudget: EbayCallBudgetStatusDto[]` with `ebayBudgetRows: EbayBudgetResourceRowDto[]`, `ebayUnmapped: EbayRateLimitResourceDto[]`, `ebayFigureNote: string` (the age sentence, already translated), `ebayFigureStale: boolean` (`!live && fetchedAt !== null`), `ebayFigureMissing: boolean` (`fetchedAt === null`), `unmappedColumns: TableColumn<EbayRateLimitResourceDto>[]`; `budgetColumns` retyped.

- [ ] **Step 1: i18n** — replace the `admin.ebayLimits` block in `en/admin.json` with:

```json
"ebayLimits": {
  "description": "eBay meters API calls per application, not per seller - every customer draws from one daily pool. The limits come from eBay itself; nobody sets them here. Background jobs stop at the reduced ceiling so seller-triggered actions always have budget left.",
  "resource": "Resource",
  "ebayLimit": "eBay daily limit",
  "ebayRemaining": "eBay remaining",
  "ebayResetAt": "eBay resets",
  "ourCount": "Our count",
  "backgroundLimit": "Background ceiling",
  "ourResetAt": "Our count resets",
  "noEbayFigure": "eBay reports no daily limit - not gated",
  "partial": "Partial",
  "partialHint": "eBay meters Trading per method. This row uses the lowest limit among the methods we call ({{methods}}); every other Trading method is listed below.",
  "otherWindow": "also {{limit}} per {{seconds}}s",
  "compareHint": "eBay's day and ours reset at different times, so compare the two counts by eye. Our count far below eBay's usage means some call is bypassing the budget.",
  "figuresAsOf": "eBay figures captured {{time}} ({{relative}}).",
  "figuresStale": "Could not reach eBay just now - showing the last figures it gave.",
  "figuresMissing": "eBay has not reported its limits yet, so nothing is being gated. Calls are still counted.",
  "unmappedTitle": "Other APIs eBay reports",
  "unmappedDescription": "Everything eBay meters that the budget does not govern, shown so a mapping that stops matching is visible.",
  "apiName": "API",
  "resourceName": "eBay resource",
  "windows": "Limits",
  "noRate": "no rate reported",
  "empty": "No usage recorded yet",
  "emptyDescription": "Rows appear once eBay reports its limits or the platform makes its first eBay call today."
}
```

and in `tr/admin.json` (native Turkish, same keys):

```json
"ebayLimits": {
  "description": "eBay API çağrılarını satıcı başına değil uygulama başına sayar; bütün müşteriler aynı günlük havuzdan harcar. Limitler eBay'in kendisinden gelir, burada kimse belirlemez. Arka plan işleri düşürülmüş tavanda durur, böylece satıcının kendi başlattığı işlemlere her zaman pay kalır.",
  "resource": "Kaynak",
  "ebayLimit": "eBay günlük limiti",
  "ebayRemaining": "eBay'de kalan",
  "ebayResetAt": "eBay sıfırlanma",
  "ourCount": "Bizim sayımız",
  "backgroundLimit": "Arka plan tavanı",
  "ourResetAt": "Bizim sayaç sıfırlanma",
  "noEbayFigure": "eBay günlük limit bildirmiyor - sınırlanmıyor",
  "partial": "Kısmi",
  "partialHint": "eBay Trading'i metod başına sayar. Bu satır, çağırdığımız metodlar ({{methods}}) arasındaki en düşük limiti kullanır; diğer Trading metodlarının hepsi aşağıda listelenir.",
  "otherWindow": "ayrıca {{seconds}} sn'de {{limit}}",
  "compareHint": "eBay'in günü ile bizimki farklı saatlerde sıfırlanır; iki sayıyı gözle karşılaştırın. Bizim sayımız eBay'in kullanımının çok altındaysa bir çağrı bütçeyi atlıyor demektir.",
  "figuresAsOf": "eBay rakamları {{time}} tarihinde alındı ({{relative}}).",
  "figuresStale": "Şu an eBay'e ulaşılamadı - verdiği son rakamlar gösteriliyor.",
  "figuresMissing": "eBay henüz limitlerini bildirmedi, bu yüzden hiçbir şey sınırlanmıyor. Çağrılar yine de sayılıyor.",
  "unmappedTitle": "eBay'in bildirdiği diğer API'ler",
  "unmappedDescription": "eBay'in saydığı ama bütçenin yönetmediği her şey; eşleşmesi bozulan bir kaynak gözden kaybolmasın diye gösterilir.",
  "apiName": "API",
  "resourceName": "eBay kaynağı",
  "windows": "Limitler",
  "noRate": "limit bildirilmemiş",
  "empty": "Henüz kullanım kaydı yok",
  "emptyDescription": "Satırlar eBay limitlerini bildirdiğinde ya da platform bugünkü ilk eBay çağrısını yaptığında görünür."
}
```

- [ ] **Step 2: Columns** — rewrite the budget half of `useAdminEbayColumns.tsx`. Keep `utilizationVariant` but feed it eBay's usage: `used = ebayLimit - ebayRemaining`, `limit = ebayLimit`; return `'neutral'` when `ebayLimit === null`. Columns in order: `resource` (text + a `Badge variant="warning" size="sm"` reading `admin.ebayLimits.partial` when `row.partial`, wrapped in `Tooltip` with `partialHint` and `methods: row.sourceResources.join(', ')` if `Tooltip` is used elsewhere in admin — otherwise render the hint as a `Text variant="caption" color="text.tertiary"` under the name), `ebayLimit` (number, or `Text variant="caption" color="text.tertiary"` with `noEbayFigure`; beneath the number render each `otherWindows` entry as a caption via `otherWindow`), `ebayRemaining` (`Badge` with `utilizationVariant`, `—` when null), `ebayResetAt`, `ourCount`, `backgroundLimit` (`—` when null), `ourResetAt`. Numbers `align: 'right'` + `<Text numeric>`. Dates `new Date(x).toLocaleString(i18n.language)`, `—` when null.

Add `unmappedColumns`: `apiName` (`${apiName} (${apiContext}, ${apiVersion})`), `resourceName` (`Text variant="mono"`), `windows` (one caption line per window: `${limit.toLocaleString()} / ${timeWindowSeconds}s · ${remaining.toLocaleString()} left` built via `t('admin.ebayLimits.otherWindow', ...)`-style keys is acceptable only if it reads naturally — use a new key `"windowLine": "{{limit}} per {{seconds}}s, {{remaining}} left"` / `"windowLine": "{{seconds}} sn'de {{limit}}, {{remaining}} kaldı"` in both locales; `noRate` when `windows` is empty). Return `{ budgetColumns, unmappedColumns, failureColumns }`.

- [ ] **Step 3: Container** — in `AdminPage.container.tsx`, from `useGetAdminEbayBudgetQuery` derive the props named under Interfaces. Build `ebayFigureNote` only when `fetchedAt` is non-null:

```ts
const ebayFigureNote = useMemo(() => {
  if (!ebayBudget?.fetchedAt) return '';
  const at = new Date(ebayBudget.fetchedAt);
  const minutes = Math.round((at.getTime() - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(i18n.language, { numeric: 'auto' });
  const relative = Math.abs(minutes) < 60 ? rtf.format(minutes, 'minute') : rtf.format(Math.round(minutes / 60), 'hour');
  return t('admin.ebayLimits.figuresAsOf', { time: at.toLocaleString(i18n.language), relative });
}, [ebayBudget?.fetchedAt, i18n.language, t]);
```

(Use whatever `t`/`i18n` the container already has from `useTranslation`; add `useMemo` import if missing.)

- [ ] **Step 4: Component** — replace the `ebayLimits` tab body with: description caption; `InfoMessage` (from `@repo/ui`) with `figuresMissing` when `ebayFigureMissing`, else a caption with `ebayFigureNote` plus an `InfoMessage` with `figuresStale` when `ebayFigureStale` (check `InfoMessage`'s props in `packages/ui/src/atoms/InfoMessage/` for the variant/type prop name before using a warning variant); a caption with `compareHint`; the budget `Table`; then an `h5` `Text` `unmappedTitle`, a caption `unmappedDescription`, and a second `Table` with `unmappedColumns` / `ebayUnmapped` rendered only when `ebayUnmapped.length > 0`. Layout-only styles, if any are needed, go in `AdminPage.style.ts`.

- [ ] **Step 5: Build and verify**

Run: `pnpm --filter @repo/shared build; pnpm --filter @repo/ui build; pnpm lint; pnpm --filter web exec tsc --noEmit -p tsconfig.json`
Expected: lint clean (max-warnings 0). Web typecheck: no NEW errors in `features/admin` (CLAUDE.md notes pre-existing web TS errors elsewhere — compare against `git stash`-free baseline by grepping the output for `features/admin`).

Then in a browser (`pnpm dev`, log in as an ADMIN, `/en/admin?tab=ebayLimits`, also at 375px width): with the local sandbox keyset the table shows a row per governed resource with "eBay reports no daily limit — not gated" (sandbox reports only dummy names), and the sandbox's `api name` / `sell.logistics` / `listingapi` / `Negotiation` resources appear in "Other APIs eBay reports", `Negotiation` showing "no rate reported". The age sentence is present. Repeat with `/tr/admin?tab=ebayLimits`.

- [ ] **Step 6: CLAUDE.md**

In the "eBay API call budget & bulk writes" section:
- Replace "Published defaults ([API Call Limits](...)): Inventory **2,000,000/day**, … Trading 5,000." with the measured figures and the per-method Trading fact: "Measured against the production keyset 2026-09-24 (`ebay:limits-probe`): Inventory 2,000,000, Feed 100,000, Fulfillment 100,000, Account 25,000, Taxonomy 5,000 per day. **Trading is metered PER METHOD**: `AddItem` 100,000, `RelistItem` 50,000, `GetMyeBaySelling`/`GetItem`/`UploadSiteHostedPictures` and ~85 others 5,000 each — never cite 'Trading 5,000' as one pool."
- Replace "Ceilings are platform settings (`ebay.budget.*`), so an approved Application Growth Check is a panel edit, not a deploy." with: "**Ceilings come from eBay's `getRateLimits` and nowhere else** (migration `121`, `EbayAnalyticsService` + `EbayRateLimitStore`): fetched at boot and hourly with an application token, persisted, and the last value eBay gave always applies. There is no panel entry, env var or code default for a ceiling. With no snapshot ever stored the governor counts but does not gate. TRADING maps to the lowest limit among `GetMyeBaySelling`/`EndItem` (`TRADING_METHODS_WE_CALL` — add a new Trading call there). Only `ebay.budget.enabled` and `ebay.budget.reservePercent` remain settings. The admin eBay Limits tab shows eBay's figures beside our Redis count (per resource, per UTC day — no per-user split exists) and never subtracts them: the two days reset at different times."
- In "Order Sync" → "Also noted": delete the "`EbayApiResource.ANALYTICS` exists in the enum but **nothing calls it**" sentence.
- Add a row for `121` to the migrations table.

- [ ] **Step 7: Commit**

```bash
git add apps/web packages/shared/src/i18n CLAUDE.md
git commit -m "feat(admin): show eBay's own limits beside our call count"
```

---

## Out of scope (spec item 6, and follow-ups)

- Per-method Trading budgets and multiple windows per governed resource (`EbayApiResource` refactor).
- Per-user attribution of eBay calls (the counter has no user dimension).
- Routing `createShippingFulfillment` through the governor — the new panel is what will make that gap visible.
- Reopening disputes/refunds via the Fulfillment API (spec Finding 2).
