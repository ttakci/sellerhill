# eBay API Resource Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the eBay call governor model what eBay actually meters: Trading per method, and every rate window eBay reports for a resource (not only the daily one).

**Architecture:** `EbayApiResource.TRADING` is replaced by one member per Trading method we call, each mapped to its exact eBay resource name inside the Trading entry — so no row is "partial" any more. The mapper keeps a resource's daily window AND its sub-daily windows; the governor checks all of them in ONE atomic Redis Lua call (all-or-nothing: a refusal on any window increments none). Daily windows keep today's UTC-day counter key; sub-daily windows use fixed time buckets.

**Tech Stack:** NestJS 10, Redis Lua via `RedisService.runScript`, Jest (ts-jest, `apps/api`), React + `@repo/ui` (web), `@repo/shared` (built to dist).

**Spec:** `docs/superpowers/specs/2026-09-25-ebay-real-api-limits-design.md` — scope item 6 (D5, Findings 1 and 3). Items 1–5 are already shipped; this plan builds on them.

## Global Constraints

- eBay is the only source of a ceiling (D1). No code default, env var or panel entry for any window's limit. A window eBay does not report is not gated.
- A resource eBay reports nothing for is counted but never refused (D2) — unchanged.
- The Media API image resource gets NO `EbayApiResource` member and no invented figure.
- Trading is metered PER METHOD. Each Trading method we call is its own governed resource, mapped by exact resource name, only inside an entry whose `apiContext` or `apiName` matches `/trading/i`.
- The Trading methods we call are exactly the `X-EBAY-API-CALL-NAME` values in `apps/api/src/modules` (today `GetMyeBaySelling`, `EndItem`). A guard spec enforces that each has a governed resource.
- A window with `timeWindow >= 86400` is daily; if several, the lowest limit wins. Sub-daily windows: one per distinct length, lowest limit wins.
- Multi-window acquire is ALL-OR-NOTHING: if any window would be exceeded, nothing is incremented.
- The daily counter key stays `ebay:budget:{resource}:{YYYY-MM-DD}` (via `redis.keys.key('ebay','budget',resource,day)`) so REST resources keep their counts across the deploy.
- The background reserve (`EBAY_BUDGET_RESERVE_PERCENT`) applies to every window the same way (`effectiveLimit`).
- Never compute a difference between eBay's used count and ours in the UI (reset times differ) — unchanged.
- Every user-visible string via i18n in both `en` and `tr`.
- Redis unreachable → fail open (allow the call) — unchanged.
- Commit messages end with: `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## Review Focus

1. **A sub-daily refusal must not increment the daily counter** (or any other window). Pinned in Task 2 by running the Lua against the real local Redis.
2. **A sub-daily bucket rolls over** — the next bucket starts from zero while the daily count keeps accumulating. Pinned in Task 2 (pure test of bucket keys across a boundary, plus the Redis run).
3. **A window with `timeWindow` 0, negative or non-numeric, or a negative limit** — ignored, never gated as "0 allowed". Pinned in Task 1.
4. **A Trading method eBay does not report** (or reports with no rates) — its resource is `null`, counted but never refused. Pinned in Task 1 (mapper) and Task 2 (governor).
5. **A new Trading call added without a governed resource** — fails the guard spec. Pinned in Task 1.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/shared/src/domain/ebay/ebay-call-budget.types.ts` | Enum: per-method Trading members replace `TRADING`. DTO cleanup in Task 3. |
| `apps/api/src/common/ebay-budget/ebay-rate-limits.ts` (+ spec) | Per-resource source table; mapper keeps daily + sub-daily windows |
| `apps/api/src/common/ebay-budget/trading-methods.guard.spec.ts` (create) | Every Trading call name has a governed resource |
| `apps/api/src/common/ebay-budget/ebay-call-budget.helpers.ts` (+ spec) | `governedWindows` (pure); overview adapts to new mapped shape |
| `apps/api/src/common/ebay-budget/ebay-call-budget.service.ts` (+ spec) | Multi-key Lua acquire, release, counts |
| `apps/api/src/common/ebay-budget/ebay-budget.errors.ts` | Error carries the failing window length |
| `apps/api/src/modules/ebay/ebay.service.ts` | Two Trading call sites use their method's resource |
| `apps/web/src/features/admin/hooks/useAdminEbayColumns.tsx` | Drop the "Partial" badge; windows copy |
| `packages/shared/src/i18n/resources/{en,tr}/admin.json` | Remove partial keys; windows copy |
| `CLAUDE.md` | Describe the new model |

---

### Task 1: Per-method Trading resources + mapper keeps every window

**Files:**
- Modify: `packages/shared/src/domain/ebay/ebay-call-budget.types.ts` (enum only)
- Modify: `apps/api/src/common/ebay-budget/ebay-rate-limits.ts`, `ebay-rate-limits.spec.ts`
- Modify: `apps/api/src/common/ebay-budget/ebay-call-budget.helpers.ts` (adapt `buildBudgetOverview` to the new mapped shape), `ebay-call-budget.helpers.spec.ts`
- Modify: `apps/api/src/modules/ebay/ebay.service.ts` (two `acquire` calls)
- Create: `apps/api/src/common/ebay-budget/trading-methods.guard.spec.ts`
- Fix any other spec that references `EbayApiResource.TRADING` or `TRADING_METHODS_WE_CALL` (grep).

**Interfaces:**
- Produces (shared): `EbayApiResource.TRADING_GET_MY_EBAY_SELLING = 'trading.GetMyeBaySelling'`, `EbayApiResource.TRADING_END_ITEM = 'trading.EndItem'`; `EbayApiResource.TRADING` is DELETED.
- Produces (api `ebay-rate-limits.ts`):
  - `interface ResourceSource { trading: boolean; name: string }`
  - `const RESOURCE_SOURCE: Record<EbayApiResource, ResourceSource>`
  - `interface MappedLimit { daily: EbayRateWindowDto | null; shortWindows: EbayRateWindowDto[]; sourceResource: string }` — `shortWindows` sorted by `timeWindowSeconds` ascending
  - `interface MappedRateLimits { byResource: Record<EbayApiResource, MappedLimit | null>; unmapped: EbayRateLimitResourceDto[] }` (unchanged shape)
  - `function pickShortWindows(windows: EbayRateWindowDto[]): EbayRateWindowDto[]`
  - `pickDailyWindow`, `parseRateLimitsResponse`, `DAILY_WINDOW_MIN_SECONDS` keep their signatures. `TRADING_METHODS_WE_CALL` is DELETED.
- `buildBudgetOverview` keeps returning today's `EbayBudgetOverviewDto` in this task (DTO changes are Task 3): `ebayLimit = mapped?.daily?.limit ?? null`, `ebayRemaining = mapped?.daily?.remaining ?? null`, `ebayResetAt = mapped?.daily?.resetAt ?? null`, `sourceResources = [RESOURCE_SOURCE[resource].name]`, `partial = false`, `otherWindows = mapped?.shortWindows ?? []`, `backgroundLimit` from `mapped?.daily`.

- [ ] **Step 1: Replace the enum member**

In `packages/shared/src/domain/ebay/ebay-call-budget.types.ts` replace the whole `TRADING = 'trading',` member and its comment with:

```ts
  /**
   * Trading `GetMyeBaySelling` — existing-listing discovery on import.
   *
   * eBay meters Trading PER METHOD (AddItem 100,000/day, GetMyeBaySelling
   * 5,000/day, …), so every Trading method we call is its own resource. Adding
   * a Trading call means adding a member here and a row in `RESOURCE_SOURCE`;
   * `trading-methods.guard.spec.ts` fails until both exist.
   */
  TRADING_GET_MY_EBAY_SELLING = 'trading.GetMyeBaySelling',
  /** Trading `EndItem` — ending a listing. */
  TRADING_END_ITEM = 'trading.EndItem',
```

Also update the file header comment's "Trading 5,000/day" style wording if present so it does not describe Trading as one pool. Then `pnpm --filter @repo/shared build`.

- [ ] **Step 2: Write the failing mapper tests**

In `apps/api/src/common/ebay-budget/ebay-rate-limits.spec.ts`, keep the `parseRateLimitsResponse` and `pickDailyWindow` tests. Add to the `parseRateLimitsResponse` describe:

```ts
  it.each([
    ['a zero window', { limit: 10, remaining: 10, timeWindow: 0 }],
    ['a negative window', { limit: 10, remaining: 10, timeWindow: -60 }],
    ['a negative limit', { limit: -1, remaining: 0, timeWindow: 86_400 }],
  ])('drops %s instead of gating on it', (_label, badRate) => {
    const flat = parseRateLimitsResponse({
      rateLimits: [{ apiContext: 'sell', apiName: 'Inventory', apiVersion: 'v1', resources: [{ name: 'sell.inventory', rates: [badRate] }] }],
    });
    expect(flat[0].windows).toEqual([]);
  });
```

Replace the whole `describe('mapRateLimits', …)` block with:

```ts
describe('pickShortWindows', () => {
  it('keeps one window per sub-daily length, the lowest limit, sorted by length', () => {
    const picked = pickShortWindows([
      { limit: 5_000, remaining: 5_000, timeWindowSeconds: 300, resetAt: null },
      { limit: 5_400, remaining: 5_400, timeWindowSeconds: 60, resetAt: null },
      { limit: 4_000, remaining: 4_000, timeWindowSeconds: 300, resetAt: null },
      { limit: 250_000, remaining: 250_000, timeWindowSeconds: 86_400, resetAt: null },
    ]);
    expect(picked.map((w) => [w.timeWindowSeconds, w.limit])).toEqual([
      [60, 5_400],
      [300, 4_000],
    ]);
  });

  it('returns [] when every window is daily', () => {
    expect(pickShortWindows([{ limit: 1, remaining: 1, timeWindowSeconds: 86_400, resetAt: null }])).toEqual([]);
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
    [EbayApiResource.TRADING_GET_MY_EBAY_SELLING, 5_000, 4_000],
    [EbayApiResource.TRADING_END_ITEM, 5_000, 4_900],
  ])('maps %s by its exact eBay resource name', (resource, limit, remaining) => {
    expect(mapped.byResource[resource]?.daily).toMatchObject({ limit, remaining });
  });

  it('names the single eBay resource each row came from', () => {
    expect(mapped.byResource[EbayApiResource.FULFILLMENT]?.sourceResource).toBe('sell.fulfillment');
    expect(mapped.byResource[EbayApiResource.TRADING_END_ITEM]?.sourceResource).toBe('EndItem');
  });

  it('puts every resource no governed resource uses in unmapped', () => {
    const names = mapped.unmapped.map((r) => r.resourceName).sort();
    expect(names).toEqual(['AddItem', 'Image', 'commerce.taxonomy.bulk', 'sell.fulfillment.payment_dispute'].sort());
  });

  it('keeps sub-daily windows as shortWindows beside the daily one', () => {
    const m = mapRateLimits(
      parseRateLimitsResponse({
        rateLimits: [{ apiContext: 'sell', apiName: 'Inventory', apiVersion: 'v1', resources: [{ name: 'sell.inventory', rates: [rate(2_000_000, 86_400), rate(5_400, 60)] }] }],
      }),
    );
    expect(m.byResource[EbayApiResource.INVENTORY]?.daily?.limit).toBe(2_000_000);
    expect(m.byResource[EbayApiResource.INVENTORY]?.shortWindows).toEqual([
      { limit: 5_400, remaining: 5_400, timeWindowSeconds: 60, resetAt: '2026-09-26T00:00:00.000Z' },
    ]);
  });

  it('governs a source that reports only sub-daily windows, with no daily ceiling', () => {
    const m = mapRateLimits(
      parseRateLimitsResponse({
        rateLimits: [{ apiContext: 'sell', apiName: 'Feed', apiVersion: 'v1', resources: [{ name: 'sell.feed', rates: [rate(50, 3_600)] }] }],
      }),
    );
    expect(m.byResource[EbayApiResource.FEED]).toMatchObject({ daily: null, shortWindows: [expect.objectContaining({ limit: 50 })] });
    expect(m.unmapped).toEqual([]);
  });

  it('returns null — never 0 — when eBay does not report a governed name', () => {
    const m = mapRateLimits([]);
    for (const resource of Object.values(EbayApiResource)) {
      expect(m.byResource[resource]).toBeNull();
    }
  });

  it('returns null for a Trading method eBay reports with no usable rates, and does not list it as unmapped', () => {
    const m = mapRateLimits(
      parseRateLimitsResponse({
        rateLimits: [{ apiContext: 'TradingAPI', apiName: 'TradingAPI', apiVersion: 'v1', resources: [{ name: 'EndItem' }] }],
      }),
    );
    expect(m.byResource[EbayApiResource.TRADING_END_ITEM]).toBeNull();
    expect(m.unmapped).toEqual([]);
  });

  it('does not match a Trading method name outside a Trading entry', () => {
    const m = mapRateLimits(
      parseRateLimitsResponse({
        rateLimits: [{ apiContext: 'sell', apiName: 'Other', apiVersion: 'v1', resources: [{ name: 'EndItem', rates: [rate(1, 86_400)] }] }],
      }),
    );
    expect(m.byResource[EbayApiResource.TRADING_END_ITEM]).toBeNull();
    expect(m.unmapped).toHaveLength(1);
  });

  it('does not let a longer name that merely starts with a mapped one take its place', () => {
    expect(mapped.byResource[EbayApiResource.FULFILLMENT]?.daily?.limit).toBe(100_000);
  });
});
```

Update the import line to `import { mapRateLimits, parseRateLimitsResponse, pickDailyWindow, pickShortWindows } from './ebay-rate-limits';`.

- [ ] **Step 3: Write the failing guard spec**

Create `apps/api/src/common/ebay-budget/trading-methods.guard.spec.ts`:

```ts
// Every Trading call this codebase makes must have its own governed resource.
//
// eBay meters Trading per METHOD, so a Trading call with no matching
// `RESOURCE_SOURCE` row is invisible to the budget: it spends a real,
// separately-metered eBay quota that no counter records. This is a
// source-grep because the failure is a missing line — it breaks nothing at
// runtime, the call just goes ungoverned.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { RESOURCE_SOURCE } from './ebay-rate-limits';

const MODULES_DIR = join(__dirname, '..', '..', 'modules');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      return sourceFiles(full);
    }
    return full.endsWith('.ts') && !full.endsWith('.spec.ts') ? [full] : [];
  });
}

describe('Trading methods are governed', () => {
  const called = new Set<string>();
  for (const file of sourceFiles(MODULES_DIR)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/'X-EBAY-API-CALL-NAME':\s*'([A-Za-z]+)'/g)) {
      called.add(match[1]);
    }
  }
  const governed = Object.values(RESOURCE_SOURCE)
    .filter((s) => s.trading)
    .map((s) => s.name);

  it('finds the Trading calls it is guarding', () => {
    // If this drops to zero the regex no longer matches the call sites and
    // the guard below would pass vacuously.
    expect(called.size).toBeGreaterThan(0);
  });

  it.each([...called])('governs the Trading call %s', (method) => {
    expect(governed).toContain(method);
  });

  it('declares no Trading resource for a method nothing calls', () => {
    expect([...governed].sort()).toEqual([...called].sort());
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `pnpm --filter api test -- ebay-rate-limits trading-methods`
Expected: FAIL (missing `pickShortWindows` / `RESOURCE_SOURCE`, and `TRADING_*` members not yet mapped).

- [ ] **Step 5: Implement the mapper**

In `ebay-rate-limits.ts`: delete `TRADING_METHODS_WE_CALL`, `REST_SOURCE`, the old `MappedLimit`, and `isTradingEntry`'s old use; keep the file's header comment and `DAILY_WINDOW_MIN_SECONDS`. Make `parseWindow` reject non-positive windows and negative limits by changing its guard to:

```ts
  if (
    typeof limit !== 'number' ||
    typeof timeWindow !== 'number' ||
    !Number.isFinite(limit) ||
    !Number.isFinite(timeWindow) ||
    limit < 0 ||
    timeWindow <= 0
  ) {
    return null;
  }
```

Then add/replace:

```ts
/** Where eBay reports each governed resource. Trading methods are resource names inside the Trading entry. */
export interface ResourceSource {
  trading: boolean;
  name: string;
}

/**
 * Exact eBay resource name per governed resource. Exact on purpose:
 * `sell.fulfillment.payment_dispute` is a different bucket from
 * `sell.fulfillment`, and a Trading method name only counts inside the
 * Trading entry.
 */
export const RESOURCE_SOURCE: Record<EbayApiResource, ResourceSource> = {
  [EbayApiResource.INVENTORY]: { trading: false, name: 'sell.inventory' },
  [EbayApiResource.TAXONOMY]: { trading: false, name: 'commerce.taxonomy' },
  [EbayApiResource.ACCOUNT]: { trading: false, name: 'sell.account' },
  [EbayApiResource.FULFILLMENT]: { trading: false, name: 'sell.fulfillment' },
  [EbayApiResource.FEED]: { trading: false, name: 'sell.feed' },
  [EbayApiResource.ANALYTICS]: { trading: false, name: 'developer.analytics.app_rate_limit' },
  [EbayApiResource.TRADING_GET_MY_EBAY_SELLING]: { trading: true, name: 'GetMyeBaySelling' },
  [EbayApiResource.TRADING_END_ITEM]: { trading: true, name: 'EndItem' },
};

/**
 * What eBay says about one governed resource. A resource may carry several
 * windows (eBay reports e.g. 5,400/60s AND 5,000/day for one resource); the
 * governor enforces every one of them.
 */
export interface MappedLimit {
  /** The daily window (lowest limit among windows >= 1 day), or null when eBay reports only shorter ones. */
  daily: EbayRateWindowDto | null;
  /** One window per distinct sub-daily length, lowest limit, sorted by length. */
  shortWindows: EbayRateWindowDto[];
  /** The eBay resource name this came from. */
  sourceResource: string;
}

export function pickShortWindows(windows: EbayRateWindowDto[]): EbayRateWindowDto[] {
  const byLength = new Map<number, EbayRateWindowDto>();
  for (const window of windows) {
    if (window.timeWindowSeconds >= DAILY_WINDOW_MIN_SECONDS) {
      continue;
    }
    const current = byLength.get(window.timeWindowSeconds);
    if (!current || window.limit < current.limit) {
      byLength.set(window.timeWindowSeconds, window);
    }
  }
  return [...byLength.values()].sort((a, b) => a.timeWindowSeconds - b.timeWindowSeconds);
}

const isTradingEntry = (r: EbayRateLimitResourceDto): boolean =>
  /trading/i.test(r.apiContext) || /trading/i.test(r.apiName);

export function mapRateLimits(resources: EbayRateLimitResourceDto[]): MappedRateLimits {
  const used = new Set<EbayRateLimitResourceDto>();
  const byResource = {} as Record<EbayApiResource, MappedLimit | null>;

  for (const resource of Object.values(EbayApiResource)) {
    const source = RESOURCE_SOURCE[resource];
    const matches = resources.filter(
      (r) => r.resourceName === source.name && isTradingEntry(r) === source.trading,
    );
    matches.forEach((m) => used.add(m));

    const windows = matches.flatMap((m) => m.windows);
    const daily = pickDailyWindow(windows);
    const shortWindows = pickShortWindows(windows);
    byResource[resource] =
      daily || shortWindows.length > 0 ? { daily, shortWindows, sourceResource: source.name } : null;
  }

  return { byResource, unmapped: resources.filter((r) => !used.has(r)) };
}
```

Note `isTradingEntry(r) === source.trading` also stops a REST name from matching inside a Trading entry.

- [ ] **Step 6: Adapt the overview and the call sites**

In `ebay-call-budget.helpers.ts` `buildBudgetOverview`, replace the per-row mapping with:

```ts
      const mapped = input.snapshot?.mapped.byResource[resource] ?? null;
      return {
        resource,
        ebayLimit: mapped?.daily?.limit ?? null,
        ebayRemaining: mapped?.daily?.remaining ?? null,
        ebayResetAt: mapped?.daily?.resetAt ?? null,
        sourceResources: [RESOURCE_SOURCE[resource].name],
        partial: false,
        otherWindows: mapped?.shortWindows ?? [],
        ourCount: input.counts[resource] ?? 0,
        backgroundLimit: mapped?.daily
          ? effectiveLimit(mapped.daily.limit, input.reservePercent, EbayCallPriority.BACKGROUND)
          : null,
        ourResetAt,
      };
```

(import `RESOURCE_SOURCE` instead of `TRADING_METHODS_WE_CALL`; remove the TRADING fallback comment). Update `ebay-call-budget.helpers.spec.ts` so its expectations match (a TRADING-specific test becomes: with `snapshot: null`, the `TRADING_END_ITEM` row has `sourceResources: ['EndItem']` and `partial: false`).

`EbayCallBudgetService.resolveLimit` must keep compiling in this task: change its body to `return snapshot?.mapped.byResource[resource]?.daily?.limit ?? null;` (Task 2 replaces it entirely).

In `apps/api/src/modules/ebay/ebay.service.ts`: the `acquire` before the `GetMyeBaySelling` request uses `EbayApiResource.TRADING_GET_MY_EBAY_SELLING`; the one before `EndItem` uses `EbayApiResource.TRADING_END_ITEM`. Update the comment above the EndItem acquire so it no longer calls Trading one 5,000/day pool (say `EndItem`'s own 5,000/day).

Grep the repo (`apps`, `packages`) for `EbayApiResource.TRADING\b` and `TRADING_METHODS_WE_CALL` and fix every remaining reference (specs included).

- [ ] **Step 7: Verify**

Run: `pnpm --filter api test -- ebay-rate-limits trading-methods ebay-call-budget` → PASS. Then the full `pnpm --filter api test`, `pnpm lint`, `pnpm typecheck` → all clean (web still compiles: DTO shape unchanged in this task).

- [ ] **Step 8: Commit**

```bash
git add packages/shared apps/api
git commit -m "refactor(ebay-budget): meter Trading per method, keep every rate window"
```

---

### Task 2: The governor enforces every window atomically

**Files:**
- Modify: `apps/api/src/common/ebay-budget/ebay-call-budget.helpers.ts` (+ `ebay-call-budget.helpers.spec.ts`)
- Modify: `apps/api/src/common/ebay-budget/ebay-call-budget.service.ts` (+ `ebay-call-budget.service.spec.ts`)
- Modify: `apps/api/src/common/ebay-budget/ebay-budget.errors.ts`

**Interfaces:**
- Consumes: `MappedLimit { daily, shortWindows, sourceResource }` (Task 1); `budgetWindow(now)` (existing: `{ day, resetAt, ttlSeconds }`); `effectiveLimit` (existing).
- Produces:
  - `interface GovernedWindow { windowSeconds: number; keyParts: string[]; limit: number | null; ttlSeconds: number; resetAt: Date }`
  - `function governedWindows(mapped: MappedLimit | null, now: Date): GovernedWindow[]` — ALWAYS returns the daily entry first (`keyParts: [day]`, `windowSeconds: 86400`, `limit: mapped?.daily?.limit ?? null`, ttl/reset from `budgetWindow`), then one entry per `shortWindows` item (`keyParts: ['w' + seconds, String(bucket)]`, `bucket = Math.floor(now.getTime() / (seconds * 1000))`, `resetAt = new Date((bucket + 1) * seconds * 1000)`, `ttlSeconds = seconds + SHORT_WINDOW_TTL_GRACE_SECONDS` where the constant is `60`).
  - `EbayBudgetExhaustedError(resource: string, resetAt: Date, windowSeconds = 86_400)` with a readonly `windowSeconds` field.
  - `EbayCallBudgetService.acquire/release/countsToday` keep their signatures.

- [ ] **Step 1: Failing tests for `governedWindows`**

Add to `ebay-call-budget.helpers.spec.ts` (merge imports at the top):

```ts
import { governedWindows } from './ebay-call-budget.helpers';

describe('governedWindows', () => {
  const now = new Date('2026-09-26T10:00:30.000Z');
  const daily = { limit: 5_000, remaining: 5_000, timeWindowSeconds: 86_400, resetAt: null };
  const minute = { limit: 100, remaining: 100, timeWindowSeconds: 60, resetAt: null };

  it('always returns the daily counter first, even with no eBay figure', () => {
    const [first, ...rest] = governedWindows(null, now);
    expect(first).toMatchObject({ windowSeconds: 86_400, keyParts: ['2026-09-26'], limit: null });
    expect(first.resetAt.toISOString()).toBe('2026-09-27T00:00:00.000Z');
    expect(rest).toEqual([]);
  });

  it('adds one bucketed counter per sub-daily window', () => {
    const windows = governedWindows({ daily, shortWindows: [minute], sourceResource: 'sell.inventory' }, now);
    expect(windows.map((w) => w.limit)).toEqual([5_000, 100]);
    const bucket = Math.floor(now.getTime() / 60_000);
    expect(windows[1]).toMatchObject({ windowSeconds: 60, keyParts: ['w60', String(bucket)], ttlSeconds: 120 });
    expect(windows[1].resetAt.getTime()).toBe((bucket + 1) * 60_000);
  });

  it('moves to a new bucket at the window boundary while the daily key stays', () => {
    const mapped = { daily, shortWindows: [minute], sourceResource: 'sell.inventory' };
    const before = governedWindows(mapped, new Date('2026-09-26T10:00:59.999Z'));
    const after = governedWindows(mapped, new Date('2026-09-26T10:01:00.000Z'));
    expect(after[0].keyParts).toEqual(before[0].keyParts);
    expect(after[1].keyParts).not.toEqual(before[1].keyParts);
  });

  it('keeps a sub-daily-only resource gated by its short window and count-only daily', () => {
    const windows = governedWindows({ daily: null, shortWindows: [minute], sourceResource: 'sell.feed' }, now);
    expect(windows.map((w) => w.limit)).toEqual([null, 100]);
  });
});
```

- [ ] **Step 2: Failing governor tests**

Replace `ebay-call-budget.service.spec.ts`'s `setup` + `acquire` describe so it exercises the multi-key call. Keep its existing fakes' style; the key assertions:

```ts
const minuteWindow = { limit: 100, remaining: 100, timeWindowSeconds: 60, resetAt: null };
const inventoryWithMinute = {
  apiContext: 'sell', apiName: 'Inventory', apiVersion: 'v1', resourceName: 'sell.inventory',
  windows: [{ limit: 2_000_000, remaining: 2_000_000, timeWindowSeconds: 86_400, resetAt: null }, minuteWindow],
};

it('sends every window in one script call: cost, then limit+ttl per key', async () => {
  const { service, runScript } = setup([inventoryWithMinute], [1, 0]);
  await service.acquire(EbayApiResource.INVENTORY, EbayCallPriority.BACKGROUND);
  const [, keys, args] = runScript.mock.calls[0];
  expect(keys).toHaveLength(2);
  expect(args[0]).toBe(1);                 // cost
  expect(args[1]).toBe(1_600_000);         // daily, background (20% reserve)
  expect(args[3]).toBe(80);                // 60s window, background
});

it('counts but never refuses a resource eBay has never reported: one daily key at -1', async () => {
  const { service, runScript } = setup(null, [1, 0]);
  await service.acquire(EbayApiResource.TRADING_END_ITEM);
  const [, keys, args] = runScript.mock.calls[0];
  expect(keys).toHaveLength(1);
  expect(args[1]).toBe(-1);
});

it('throws with the failing window’s reset and length', async () => {
  const { service } = setup([inventoryWithMinute], [0, 2]);
  const error = await service.acquire(EbayApiResource.INVENTORY).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(EbayBudgetExhaustedError);
  expect((error as EbayBudgetExhaustedError).windowSeconds).toBe(60);
  expect((error as EbayBudgetExhaustedError).resetAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
});

it('fails open when Redis throws', async () => {
  const { service, runScript } = setup([inventoryWithMinute], [1, 0]);
  runScript.mockRejectedValueOnce(new Error('redis down'));
  await expect(service.acquire(EbayApiResource.INVENTORY)).resolves.toBeUndefined();
});
```

Keep the existing `countsToday` test (the daily key shape is unchanged). Add a `release` test: with `inventoryWithMinute`, `release(EbayApiResource.INVENTORY)` calls `redis.command.decrby` once per window (twice).

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter api test -- ebay-call-budget`
Expected: FAIL (`governedWindows` missing; single-key script call).

- [ ] **Step 4: Implement**

`ebay-budget.errors.ts`:

```ts
export class EbayBudgetExhaustedError extends Error {
  readonly code = 'budget_exhausted';

  constructor(
    readonly resource: string,
    readonly resetAt: Date,
    /** Length of the window that ran out; 86,400 for the daily quota. */
    readonly windowSeconds = 86_400
  ) {
    super(
      `The eBay ${resource} call budget (${windowSeconds}s window) is exhausted; it resets at ${resetAt.toISOString()}.`
    );
    this.name = 'EbayBudgetExhaustedError';
  }
}
```

Update its class comment: it is no longer only the daily quota. Grep specs for the old message text (`daily eBay`) and update any assertion.

`ebay-call-budget.helpers.ts` — add:

```ts
/** Slack on a short window's counter TTL so a key never expires before its bucket ends. */
export const SHORT_WINDOW_TTL_GRACE_SECONDS = 60;

/** One counter the governor checks for a resource. */
export interface GovernedWindow {
  windowSeconds: number;
  /** Appended to `ebay:budget:{resource}` to form the Redis key. */
  keyParts: string[];
  /** eBay's limit for this window; null = count only. */
  limit: number | null;
  ttlSeconds: number;
  resetAt: Date;
}

/**
 * Every counter a call must pass.
 *
 * The daily counter is ALWAYS present, even with no eBay figure: it is what
 * the admin panel's "our count" reads, and its key is unchanged from before
 * windows existed so counts survive a deploy. Sub-daily windows use fixed
 * buckets (`floor(now / window)`). eBay's own windows may roll differently, so
 * a fixed bucket can admit up to one extra window's worth across a boundary —
 * eBay's 429 (handled by `withEbayRateLimitRetry`) stays the hard stop.
 */
export function governedWindows(mapped: MappedLimit | null, now: Date): GovernedWindow[] {
  const day = budgetWindow(now);
  const windows: GovernedWindow[] = [
    {
      windowSeconds: 86_400,
      keyParts: [day.day],
      limit: mapped?.daily?.limit ?? null,
      ttlSeconds: day.ttlSeconds,
      resetAt: day.resetAt,
    },
  ];
  for (const short of mapped?.shortWindows ?? []) {
    const lengthMs = short.timeWindowSeconds * 1000;
    const bucket = Math.floor(now.getTime() / lengthMs);
    windows.push({
      windowSeconds: short.timeWindowSeconds,
      keyParts: [`w${short.timeWindowSeconds}`, String(bucket)],
      limit: short.limit,
      ttlSeconds: short.timeWindowSeconds + SHORT_WINDOW_TTL_GRACE_SECONDS,
      resetAt: new Date((bucket + 1) * lengthMs),
    });
  }
  return windows;
}
```

(import `type MappedLimit` from `./ebay-rate-limits`.)

`ebay-call-budget.service.ts` — replace `ACQUIRE_LUA` and its comment:

```ts
/**
 * Reserve budget against every window of a resource, atomically and
 * all-or-nothing.
 *
 * Read-then-write in application code would let two workers each see "9,998
 * used of 10,000" and both proceed; checking every window and only then
 * incrementing every window inside one script makes the whole thing
 * indivisible, and means a call refused by a short window never spends any of
 * the daily allowance.
 *
 * KEYS[i] counter i. ARGV[1] cost; for key i, ARGV[2i] its limit and
 * ARGV[2i+1] its ttl seconds. A limit of -1 means eBay gave no ceiling for
 * that window: count, never refuse (spec D2).
 * Returns { 1, 0 } when granted, { 0, i } when window i refused.
 */
const ACQUIRE_LUA = `
local cost = tonumber(ARGV[1])
for i = 1, #KEYS do
  local limit = tonumber(ARGV[2 * i])
  if limit >= 0 then
    local used = tonumber(redis.call('GET', KEYS[i]) or '0')
    if used + cost > limit then
      return { 0, i }
    end
  end
end
for i = 1, #KEYS do
  local total = redis.call('INCRBY', KEYS[i], cost)
  if total == cost then
    redis.call('EXPIRE', KEYS[i], tonumber(ARGV[2 * i + 1]))
  end
end
return { 1, 0 }
`;
```

Export it (`export const ACQUIRE_LUA`) so Step 6 can run exactly this source. Rewrite `acquire`:

```ts
    const windows = governedWindows(await this.resolveMapped(resource), new Date());
    const reserve = await this.platformSettings.getNumber(PlatformSettingKey.EBAY_BUDGET_RESERVE_PERCENT);
    const keys = windows.map((w) => this.counterKey(resource, w.keyParts));
    const args: number[] = [cost];
    for (const w of windows) {
      args.push(w.limit === null ? -1 : effectiveLimit(w.limit, reserve, priority), w.ttlSeconds);
    }

    let result: [number, number];
    try {
      result = (await this.redis.runScript(ACQUIRE_SCRIPT, keys, args)) as [number, number];
    } catch (error: unknown) {
      // Fail open: an unreachable Redis must not stop the platform listing.
      this.logger.warn(
        `eBay call budget unavailable for ${resource}, allowing the call: ` +
          `${error instanceof Error ? error.message : String(error)}`
      );
      return;
    }

    if (result[0] !== 1) {
      const refused = windows[result[1] - 1] ?? windows[0];
      this.logger.warn(
        `eBay ${resource} budget exhausted for its ${refused.windowSeconds}s window ` +
          `(${priority}); deferring until ${refused.resetAt.toISOString()}`
      );
      throw new EbayBudgetExhaustedError(resource, refused.resetAt, refused.windowSeconds);
    }
```

`release`: decrement every window's current key (best-effort, same try/catch style):

```ts
  async release(resource: EbayApiResource, cost = 1): Promise<void> {
    try {
      const windows = governedWindows(await this.resolveMapped(resource), new Date());
      await Promise.all(windows.map((w) => this.redis.command.decrby(this.counterKey(resource, w.keyParts), cost)));
    } catch {
      // Best-effort: an un-refunded call only makes us slightly more conservative.
    }
  }
```

`countsToday`: use `this.counterKey(resource, [day])`. Replace `resolveLimit` with:

```ts
  private async resolveMapped(resource: EbayApiResource): Promise<MappedLimit | null> {
    const snapshot = await this.rateLimits.current();
    return snapshot?.mapped.byResource[resource] ?? null;
  }

  private counterKey(resource: EbayApiResource, keyParts: string[]): string {
    return this.redis.keys.key('ebay', 'budget', resource, ...keyParts);
  }
```

Check `redis.keys.key`'s signature accepts variadic parts (read `apps/api/src/common/redis/`); if it does not, join the parts the way the existing call did. The daily key must equal the old `key('ebay','budget',resource,day)` exactly. Update the class comment: ceilings come from eBay and every window eBay reports is enforced.

- [ ] **Step 5: Run to verify pass**

Run: `pnpm --filter api test -- ebay-call-budget` → PASS.

- [ ] **Step 6: Run the real Lua against the local Redis (Review Focus 1 and 2)**

Docker Redis is available (`docker exec sellerhill_redis redis-cli PING` → PONG). Write a throwaway script in the session scratchpad (NOT in the repo) that imports `ACQUIRE_LUA` from the built source — e.g. `pnpm --filter api exec tsx <scratch>/lua-check.ts` with `import { ACQUIRE_LUA } from '<abs path>/apps/api/src/common/ebay-budget/ebay-call-budget.service'` if that import works without booting Nest; otherwise copy the string verbatim from the file and say so — and runs it with `ioredis` (already an api dependency; connect with the host/port from `apps/api/.env`) on keys under a unique prefix `lua-check:<timestamp>:`. Assert and print:
1. Two keys (daily limit 10, short limit 2), cost 1: calls 1 and 2 return `{1,0}`; call 3 returns `{0,2}`; afterwards the daily counter is **2**, not 3 (refusal incremented nothing).
2. A key with limit `-1` is always granted and still incremented.
3. After granting, both keys carry a TTL (`TTL > 0`).
4. A fresh short-window key (next bucket) grants again while the daily key keeps its count.
Delete the test keys at the end. Put the script source and its output in your report. If any assertion fails, stop and report — do not adjust the test to fit.

- [ ] **Step 7: Verify and commit**

Full `pnpm --filter api test`, `pnpm lint`, `pnpm typecheck` → clean.

```bash
git add apps/api
git commit -m "feat(ebay-budget): enforce every eBay rate window atomically"
```

---

### Task 3: Panel and DTO drop "partial"; docs

**Files:**
- Modify: `packages/shared/src/domain/ebay/ebay-call-budget.types.ts` (DTO)
- Modify: `apps/api/src/common/ebay-budget/ebay-call-budget.helpers.ts` (+ spec)
- Modify: `apps/web/src/features/admin/hooks/useAdminEbayColumns.tsx`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/admin.json`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `buildBudgetOverview` from Task 1; `RESOURCE_SOURCE`.
- Produces: `EbayBudgetResourceRowDto` loses `partial` and `sourceResources`, gains `ebayResource: string` (the exact eBay resource name, e.g. `EndItem`). `otherWindows` keeps its name and type; its doc comment says these windows are ENFORCED, not informational.

- [ ] **Step 1: DTO + overview**

In the shared types: delete `partial` and `sourceResources` (and their comments) from `EbayBudgetResourceRowDto`; add

```ts
  /** The exact eBay resource this row is metered under (e.g. `sell.inventory`, `EndItem`). */
  ebayResource: string;
```

and change `otherWindows`' comment to: `/** Sub-daily windows eBay also enforces on this resource. The governor enforces them too. */`. Build shared.

In `buildBudgetOverview`: replace `sourceResources`/`partial` with `ebayResource: RESOURCE_SOURCE[resource].name`. Update its spec accordingly (assert `ebayResource` for one REST and one Trading row; delete `partial` assertions).

- [ ] **Step 2: Panel**

In `useAdminEbayColumns.tsx`: remove the Partial badge/tooltip branch entirely. The resource cell renders `row.resource` as today plus, beneath it, `Text variant="caption" color="text.tertiary"` with `row.ebayResource`. Keep the `otherWindows` lines under the eBay-limit cell, using the updated `otherWindow` copy below. Remove now-unused imports (e.g. `Tooltip`) so lint stays clean.

- [ ] **Step 3: i18n** — in both `admin.json` files under `admin.ebayLimits`: delete `partial` and `partialHint`; change `otherWindow`:
  - en: `"otherWindow": "also limited to {{limit}} per {{seconds}}s"`
  - tr: `"otherWindow": "ayrıca {{seconds}} sn'de en fazla {{limit}}"`
  Grep both locales and `apps/web` to confirm no reference to `partial`/`partialHint` remains.

- [ ] **Step 4: CLAUDE.md** — edit only these, found by grep:
  - In "eBay API call budget & bulk writes", the bullet starting "**Ceilings come from eBay's `getRateLimits` and nowhere else**": replace the sentence "TRADING maps to the lowest limit among `GetMyeBaySelling`/`EndItem` (`TRADING_METHODS_WE_CALL` — add a new Trading call there)." with: "Trading is governed PER METHOD — `EbayApiResource.TRADING_GET_MY_EBAY_SELLING` / `TRADING_END_ITEM`, each mapped to its exact resource name in `RESOURCE_SOURCE` (`ebay-rate-limits.ts`); adding a Trading call means adding a member and a row, and `trading-methods.guard.spec.ts` fails until both exist. Every window eBay reports for a resource is enforced, not only the daily one: `governedWindows` gives the daily UTC-day counter (key unchanged) plus one fixed-bucket counter per sub-daily window, and one Lua call checks all of them all-or-nothing, so a refusal on a short window spends none of the daily allowance. `EbayBudgetExhaustedError.windowSeconds` says which window ran out; a short-window refusal defers the job by the existing 60s floor." 
  - In the "Order Sync" → "Also noted" area or elsewhere, any remaining sentence that describes `TRADING` as one resource — grep `EbayApiResource.TRADING\b` and `TRADING_METHODS_WE_CALL` in CLAUDE.md and update each to the per-method names.

- [ ] **Step 5: Verify and commit**

`pnpm --filter @repo/shared build`, `pnpm --filter api test`, `pnpm lint`, `pnpm typecheck` → clean. Browser: `pnpm dev`, log in as an ADMIN (or create a throwaway one with `pnpm user:set-role` and delete it after), open `/en/admin?tab=ebayLimits` and `/tr/admin?tab=ebayLimits`: two Trading rows (`trading.GetMyeBaySelling`, `trading.EndItem`), no "Partial" badge, each row showing its eBay resource name. Stop any dev server you started.

```bash
git add packages/shared apps/api apps/web CLAUDE.md
git commit -m "feat(admin): show Trading per method, drop the partial row"
```
