# Net Profit Correctness (A1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make net profit trustworthy across every order — unknown costs are shown as unknown (never faked as zero or inflated), real Amazon costs are captured automatically for manual-mode users, and the dashboard exposes profit confidence tiers.

**Architecture:** Nullable `net_profit` + a new `cost_capture_status` enum on `orders`. `recalculateProfit` becomes `recomputeProfit` (no tracked-only gate; sets status). Amazon scraping gains failure detection (no silent zeroing). A new `amazon-order-sync` BullMQ job scrapes each Amazon account's order list and matches orders to capture costs. Dashboard aggregates split profit into confirmed / provisional / uncosted tiers.

**Tech Stack:** NestJS 10, raw `pg` (`DatabaseService`), BullMQ (Redis), PostgreSQL 16. Jest + ts-jest (installed, unused) — wired minimally in Task 2 for pure logic only.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-17-net-profit-correctness-design.md` — every requirement traces to a task below.
- **No `any`**, no hardcoded status/constant strings — use enums from `packages/shared`. New constants go in shared first.
- **i18n / UI strings:** any new user-facing string (e.g. scrape-failure message) goes in `packages/shared/src/i18n/resources/{en,tr}/` first, used via `t()`. (Backend uses hardcoded English only for log lines.)
- **Shared package builds from `dist/`:** after changing `packages/shared`, run `pnpm --filter @repo/shared build`. API imports `@repo/shared`.
- **Migrations:** filename format `NNN_<verb>_<table>_<desc>.sql`, sequential. API auto-runs pending migrations on boot (`DatabaseService.onModuleInit` → `MigrationRunner`). After adding SQL, **restart API**.
- **Testing policy (this plan):** pure logic (profit math, status derivation, match scoring) is TDD with Jest (Task 2 wires the harness). DB / queue / scraping tasks use **manual verification** with exact SQL and expected results, because the repo has no DB integration harness and building one is out of scope.
- **Pre-commit runs `pnpm lint` (max-warnings 0).** Do not use `--no-verify`. Ensure new code passes lint before committing.
- **Container/Component split, design-system rules** apply only to `apps/web`/`packages/ui` — this plan is backend-only, so they do not apply except for the small shared-types addition.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/shared/src/domain/orders/orders.types.ts` | `OrderCostCaptureStatus` enum + tiered `PeriodMetricsDto` / `OrderDto` fields | Modify |
| `packages/shared/src/domain/orders/orders.dto.ts` (or `.types.ts` where DTOs live) | `DashboardDataDto` tiered fields if defined here | Modify |
| `apps/api/migrations/033_alter_orders_cost_capture_status.sql` | nullable `net_profit`, drop defaults, add enum column + index + backfill | Create |
| `apps/api/src/modules/orders/profit-calculation.ts` | PURE helpers: `computeNetProfit`, `deriveCostCaptureStatus` | Create |
| `apps/api/src/modules/orders/profit-calculation.spec.ts` | Jest tests for the above | Create |
| `apps/api/src/modules/orders/order-sync.service.ts` | `recalculateProfit` → `recomputeProfit`; re-sync trigger | Modify |
| `apps/api/src/modules/orders/ebay-fulfillment.service.ts` | insert path writes `net_profit = NULL`, `cost_capture_status = 'pending'` | Modify |
| `apps/api/src/modules/amazon/amazon-order-parser.service.ts` | `extractFinancials` returns tagged `{ ok: false }` on miss | Modify |
| `apps/api/src/modules/amazon/amazon.controller.ts` | `linkAmazonOrder` honors scrape failure (no overwrite, `failed`) | Modify |
| `apps/api/src/modules/amazon/order-matcher.ts` | PURE `scoreAmazonOrderMatch` heuristic | Create |
| `apps/api/src/modules/amazon/order-matcher.spec.ts` | Jest tests for matcher | Create |
| `apps/api/src/modules/amazon/amazon-order-sync.service.ts` | scrape account order list, match, write costs | Create |
| `apps/api/src/modules/amazon/amazon-order-sync.processor.ts` | BullMQ processor | Create |
| `apps/api/src/modules/amazon/amazon-order-sync.queue.ts` | queue registration (`@InjectQueue`) | Create |
| `apps/api/src/modules/amazon/amazon.module.ts` | wire queue + processor + service | Modify |
| `apps/api/src/modules/dashboard/dashboard.service.ts` | tiered `periodSelect`, recent-orders mapper fix | Modify |
| `apps/api/jest.config.js` | Jest config for API | Create |

---

## Task 1: Shared enum + migration

**Files:**
- Modify: `packages/shared/src/domain/orders/orders.types.ts`
- Create: `apps/api/migrations/033_alter_orders_cost_capture_status.sql`

**Interfaces:**
- Produces: `OrderCostCaptureStatus` enum (`pending | linked | provisional | failed | untracked`) exported from `@repo/shared`; DB column `orders.cost_capture_status order_cost_capture_status NOT NULL DEFAULT 'pending'`; nullable `orders.net_profit`.

- [ ] **Step 1: Add the enum to shared**

Append to `packages/shared/src/domain/orders/orders.types.ts` (after the `OrderStatus` enum):

```ts
/**
 * Confidence/state of Amazon cost capture for an order.
 * Drives which profit tier an order belongs to on the dashboard.
 */
export enum OrderCostCaptureStatus {
  PENDING = 'pending',       // eBay order in, nothing captured yet, product cost unknown
  LINKED = 'linked',         // Amazon costs fully captured (scraped from a real Amazon order) — TRUSTED
  PROVISIONAL = 'provisional', // product/purchase cost known, Amazon tax+shipping not yet captured
  FAILED = 'failed',         // Amazon scrape ran but returned no usable data; prior values retained
  UNTRACKED = 'untracked',   // no listing match; source cost can never be known
}
```

Ensure it is exported from the package barrel: check `packages/shared/src/domain/orders/index.ts` re-exports `orders.types.ts` (it does — `OrderStatus` is already importable from `@repo/shared`). If there is a barrel filter, add `OrderCostCaptureStatus`.

- [ ] **Step 2: Build shared**

Run: `pnpm --filter @repo/shared build`
Expected: build succeeds, no errors.

- [ ] **Step 3: Write the migration**

Create `apps/api/migrations/033_alter_orders_cost_capture_status.sql`:

```sql
-- net_profit: NULL = unknown, 0 = computed real zero. Drop default so inserts must be explicit.
ALTER TABLE orders ALTER COLUMN net_profit DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN net_profit DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN purchase_price DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN amazon_tax DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN amazon_shipping DROP DEFAULT;

-- Confidence/state of Amazon cost capture
CREATE TYPE order_cost_capture_status AS ENUM
  ('pending', 'linked', 'provisional', 'failed', 'untracked');

ALTER TABLE orders
  ADD COLUMN cost_capture_status order_cost_capture_status NOT NULL DEFAULT 'pending';

-- Backfill from current data (order matters)
UPDATE orders SET cost_capture_status = 'linked'
  WHERE amazon_linked_at IS NOT NULL;
UPDATE orders SET cost_capture_status = 'untracked'
  WHERE listing_id IS NULL AND cost_capture_status = 'pending';
UPDATE orders SET cost_capture_status = 'provisional'
  WHERE listing_id IS NOT NULL AND amazon_linked_at IS NULL
    AND cost_capture_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_orders_cost_capture_status ON orders(cost_capture_status);
```

- [ ] **Step 4: Verify migration applies**

Run: `pnpm dev:api` (API auto-runs pending migrations on boot), then stop it.
Expected: API logs show migration `033` applied; no SQL errors.

- [ ] **Step 5: Verify backfill + nullability**

Run (via psql / pgAdmin):
```sql
SELECT cost_capture_status, COUNT(*) FROM orders GROUP BY cost_capture_status ORDER BY 1;
-- expect: rows distributed across linked/provisional/untracked/pending per your data
SELECT column_name, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders' AND column_name IN ('net_profit','cost_capture_status');
-- expect: net_profit is_nullable=YES, column_default=NULL;
--         cost_capture_status is_nullable=NO, default='pending'::order_cost_capture_status
```

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/domain/orders/orders.types.ts apps/api/migrations/033_alter_orders_cost_capture_status.sql packages/shared/dist
git commit -m "feat(orders): add cost_capture_status enum + nullable net_profit (migration 033)"
```

---

## Task 2: Jest harness for `apps/api` + pure profit/status helpers (TDD)

**Files:**
- Create: `apps/api/jest.config.js`
- Create: `apps/api/src/modules/orders/profit-calculation.ts`
- Create: `apps/api/src/modules/orders/profit-calculation.spec.ts`
- Modify: `apps/api/package.json` (add `test`/`test:watch` scripts)

**Interfaces:**
- Produces:
  - `computeNetProfit(input: { ebayEarnings: number; purchasePrice: number; amazonTax: number; amazonShipping: number }): number | null`
  - `deriveCostCaptureStatus(input: { hasListingMatch: boolean; asinResolved: boolean; amazonLinked: boolean; amazonCostsCaptured: boolean; scrapeFailed: boolean }): OrderCostCaptureStatus`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/orders/profit-calculation.spec.ts`:

```ts
import {
  computeNetProfit,
  deriveCostCaptureStatus,
} from './profit-calculation';
import { OrderCostCaptureStatus } from '@repo/shared';

describe('computeNetProfit', () => {
  it('returns full formula when all costs known', () => {
    expect(
      computeNetProfit({ ebayEarnings: 100, purchasePrice: 60, amazonTax: 5, amazonShipping: 5 }),
    ).toBe(30);
  });

  it('rounds to 2 decimals', () => {
    expect(
      computeNetProfit({ ebayEarnings: 10, purchasePrice: 3.333, amazonTax: 0, amazonShipping: 0 }),
    ).toBe(6.67);
  });

  it('returns null when purchase price unknown (<= 0 means unknown here)', () => {
    expect(
      computeNetProfit({ ebayEarnings: 100, purchasePrice: 0, amazonTax: 0, amazonShipping: 0 }),
    ).toBeNull();
  });
});

describe('deriveCostCaptureStatus', () => {
  const T = { hasListingMatch: true, asinResolved: true, amazonLinked: false, amazonCostsCaptured: false, scrapeFailed: false };

  it('linked when amazon costs captured', () => {
    expect(deriveCostCaptureStatus({ ...T, amazonLinked: true, amazonCostsCaptured: true }))
      .toBe(OrderCostCaptureStatus.LINKED);
  });

  it('failed when a scrape ran but produced nothing', () => {
    expect(deriveCostCaptureStatus({ ...T, scrapeFailed: true }))
      .toBe(OrderCostCaptureStatus.FAILED);
  });

  it('untracked when no listing and no asin', () => {
    expect(deriveCostCaptureStatus({ ...T, hasListingMatch: false, asinResolved: false }))
      .toBe(OrderCostCaptureStatus.UNTRACKED);
  });

  it('provisional when product cost known but amazon not linked', () => {
    expect(deriveCostCaptureStatus({ ...T, amazonLinked: false }))
      .toBe(OrderCostCaptureStatus.PROVISIONAL);
  });

  it('pending when nothing resolved at all', () => {
    expect(deriveCostCaptureStatus({ hasListingMatch: false, asinResolved: false, amazonLinked: false, amazonCostsCaptured: false, scrapeFailed: false }))
      .toBe(OrderCostCaptureStatus.PENDING);
  });
});
```

- [ ] **Step 2: Add Jest config + scripts, run tests to confirm they fail**

Create `apps/api/jest.config.js`:

```js
module.exports = {
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  moduleFileExtensions: ['js', 'json', 'ts'],
  testEnvironment: 'node',
};
```

In `apps/api/package.json`, add to `scripts`:
```json
"test": "jest --passWithNoTests",
"test:watch": "jest --watch"
```
Ensure `jest`, `ts-jest`, `@types/jest`, `typescript` are in `apps/api/devDependencies` (the monorepo already installs them globally per `CLAUDE.md`; if `pnpm --filter api test` reports missing, run `pnpm --filter api add -D jest ts-jest @types/jest`).

Run: `pnpm --filter api test`
Expected: FAIL — `Cannot find module './profit-calculation'`.

- [ ] **Step 3: Implement the pure helpers**

Create `apps/api/src/modules/orders/profit-calculation.ts`:

```ts
import { OrderCostCaptureStatus } from '@repo/shared';

export interface NetProfitInput {
  ebayEarnings: number;
  purchasePrice: number;
  amazonTax: number;
  amazonShipping: number;
}

/**
 * Net profit = ebayEarnings - purchasePrice - amazonTax - amazonShipping.
 * `ebayEarnings` (eBay totalDueSeller) is already net of eBay commission.
 * Returns null when purchase price is unknown (<=0) — caller should also set
 * status to PENDING/UNTRACKED rather than persist a meaningless number.
 */
export function computeNetProfit(input: NetProfitInput): number | null {
  const { ebayEarnings, purchasePrice, amazonTax, amazonShipping } = input;
  if (!purchasePrice || purchasePrice <= 0) {
    return null;
  }
  return Math.round((ebayEarnings - purchasePrice - amazonTax - amazonShipping) * 100) / 100;
}

export interface CostCaptureStatusInput {
  hasListingMatch: boolean;
  asinResolved: boolean;
  amazonLinked: boolean;
  amazonCostsCaptured: boolean;
  scrapeFailed: boolean;
}

/**
 * Derives the order's cost-capture confidence tier. Priority:
 *   scrapeFailed -> FAILED (prior values retained, flagged)
 *   amazonCostsCaptured -> LINKED (trusted)
 *   product cost resolvable (listing OR asin) but amazon not captured -> PROVISIONAL
 *   nothing resolvable -> UNTRACKED if not even a listing/asin, else PENDING
 */
export function deriveCostCaptureStatus(input: CostCaptureStatusInput): OrderCostCaptureStatus {
  const { hasListingMatch, asinResolved, amazonLinked, amazonCostsCaptured, scrapeFailed } = input;
  if (scrapeFailed) {
    return OrderCostCaptureStatus.FAILED;
  }
  if (amazonLinked && amazonCostsCaptured) {
    return OrderCostCaptureStatus.LINKED;
  }
  const productResolvable = hasListingMatch || asinResolved;
  if (productResolvable) {
    return OrderCostCaptureStatus.PROVISIONAL;
  }
  // No product match at all — if there's no listing AND no asin, source cost is unknowable.
  return OrderCostCaptureStatus.UNTRACKED;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter api test`
Expected: PASS (all 8 tests).

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add apps/api/jest.config.js apps/api/package.json apps/api/src/modules/orders/profit-calculation.ts apps/api/src/modules/orders/profit-calculation.spec.ts
git commit -m "feat(orders): pure net-profit + cost-capture-status helpers with jest"
```

---

## Task 3: `recalculateProfit` → `recomputeProfit` (drop gate, ASIN fallback, set status, insert path)

**Files:**
- Modify: `apps/api/src/modules/orders/order-sync.service.ts` (the `recalculateProfit` method, ~`:276-360`)
- Modify: `apps/api/src/modules/orders/ebay-fulfillment.service.ts` (insert mapper, ~`:190-238`)

**Interfaces:**
- Consumes: `computeNetProfit`, `deriveCostCaptureStatus` from Task 2; `OrderCostCaptureStatus` from Task 1.
- Produces: `async recomputeProfit(ebayOrderId: string): Promise<void>` — writes `net_profit` (nullable) + `cost_capture_status` + `transaction_fee` + `ad_fee` in one UPDATE.

- [ ] **Step 1: Rewrite the recomputer**

In `apps/api/src/modules/orders/order-sync.service.ts`, replace the existing `recalculateProfit` method body. Import the helpers at the top:

```ts
import { OrderCostCaptureStatus } from '@repo/shared';
import { computeNetProfit, deriveCostCaptureStatus } from './profit-calculation';
```

Rename the method `recalculateProfit` → `recomputeProfit` and rewrite:

```ts
/**
 * Recompute net_profit + cost_capture_status for an order.
 * - Resolves purchase cost by listing_id, then by ASIN fallback (eBay line item ASIN).
 * - Never fakes unknown costs: unknown -> net_profit NULL.
 * - Always sets cost_capture_status in the same UPDATE.
 * Best-effort: logs and swallows errors so sync never fails.
 */
async recomputeProfit(ebayOrderId: string): Promise<void> {
  try {
    // Pull the order + product ASIN + settings-group fees in one go.
    const rows = await this.databaseService.query<{
      id: string;
      sale_total: string | number;
      ebay_earnings: string | number | null;
      purchase_price: string | number | null;
      amazon_tax: string | number | null;
      amazon_shipping: string | number | null;
      amazon_linked_at: Date | null;
      listing_id: string | null;
      asin: string | null;
      fees: { ebayFeePercent?: number; fixedFeeAmount?: number; taxPercent?: number } | null;
    }>(
      `SELECT o.id, o.sale_total, o.ebay_earnings, o.purchase_price,
              o.amazon_tax, o.amazon_shipping, o.amazon_linked_at,
              o.listing_id, p.asin,
              lsg.fees
       FROM orders o
       LEFT JOIN listings l ON l.id = o.listing_id
       LEFT JOIN products p ON p.id = l.product_id
       LEFT JOIN listing_settings_groups lsg ON lsg.id = l.listing_settings_group_id
       WHERE o.ebay_order_id = $1`,
      [ebayOrderId],
    );
    if (rows.length === 0) return;
    const o = rows[0];

    const hasListingMatch = !!o.listing_id;
    const asinResolved = !!o.asin;
    const amazonLinked = !!o.amazon_linked_at;
    const amazonCostsCaptured = amazonLinked && (Number(o.amazon_tax) > 0 || Number(o.amazon_shipping) > 0);

    const status = deriveCostCaptureStatus({
      hasListingMatch,
      asinResolved,
      amazonLinked,
      amazonCostsCaptured,
      scrapeFailed: false, // scrape failure path sets this via linkAmazonOrder (Task 5) -> separate UPDATE
    });

    const purchasePrice = Number(o.purchase_price) || 0;
    const netProfit = computeNetProfit({
      ebayEarnings: Number(o.ebay_earnings) || 0,
      purchasePrice,
      amazonTax: Number(o.amazon_tax) || 0,
      amazonShipping: Number(o.amazon_shipping) || 0,
    });

    // Fallback: resolve purchase price from product if still unknown.
    let resolvedPurchase = purchasePrice;
    if (resolvedPurchase <= 0 && hasListingMatch) {
      const productData = await this.productsService.getProductPriceAndImageByListingId(o.listing_id as string);
      if (productData?.purchasePrice) {
        resolvedPurchase = productData.purchasePrice;
      }
    }

    const finalNetProfit =
      resolvedPurchase > 0
        ? computeNetProfit({
            ebayEarnings: Number(o.ebay_earnings) || 0,
            purchasePrice: resolvedPurchase,
            amazonTax: Number(o.amazon_tax) || 0,
            amazonShipping: Number(o.amazon_shipping) || 0,
          })
        : null;

    const saleTotal = Number(o.sale_total) || 0;
    const ebayFeePercent = Number(o.fees?.ebayFeePercent) || 0;
    const fixedFeeAmount = Number(o.fees?.fixedFeeAmount) || 0;
    const transactionFee = Math.round(saleTotal * (ebayFeePercent / 100) * 100) / 100;
    const adFee = fixedFeeAmount;

    await this.databaseService.query(
      `UPDATE orders SET
         transaction_fee = $1,
         ad_fee = $2,
         net_profit = $3,
         purchase_price = COALESCE(NULLIF($4, 0), purchase_price),
         cost_capture_status = $5,
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        transactionFee,
        adFee,
        finalNetProfit, // null when unknown
        resolvedPurchase,
        status,
        o.id,
      ],
    );
  } catch (err) {
    this.logger.error(`recomputeProfit failed for ${ebayOrderId}: ${(err as Error).message}`, (err as Error).stack);
  }
}
```

Update the call site at `order-sync.service.ts:144-147` (inside the sync loop) from `this.recalculateProfit(entity.ebayOrderId)` (guarded by `if (listingId)`) to **unconditional**:

```ts
await this.recalculateProfit(entity.ebayOrderId);
```

Remove the `if (listingId)` guard around it so untracked orders also get status `untracked` + null profit. (The recomputer itself handles the no-listing case.)

- [ ] **Step 2: Fix the insert path to write NULL + pending**

In `apps/api/src/modules/orders/ebay-fulfillment.service.ts`, the order-to-entity mapper (~`:222-225`) currently sets `transactionFee: 0, adFee: 0, netProfit: 0, purchasePrice: <...>`. Change `netProfit` to `null` and add `costCaptureStatus`. Concretely, in the mapped entity object set:

```ts
netProfit: null,
costCaptureStatus: 'pending' as const,
```

Then find the `INSERT … ON CONFLICT` in `order-sync.service.ts` (`:208-240`): the INSERT column list and `$N` values must include `cost_capture_status` with value `'pending'`, and `net_profit` must be inserted as NULL (not `0`). Leave the `ON CONFLICT DO UPDATE SET …` list **unchanged** (it already excludes profit fields — Task 4 adds the conditional recompute trigger there).

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: no new errors in `apps/api` (the web app's pre-existing errors are unrelated and allowed).

- [ ] **Step 4: Manual verification**

With API running and at least one eBay order in DB:
```sql
-- after triggering/awaiting an order sync (or calling recompute via a test):
SELECT ebay_order_id, listing_id, net_profit, cost_capture_status FROM orders ORDER BY order_date DESC LIMIT 20;
```
Expected: matched+Amazon-linked orders show `linked` + a real `net_profit`; matched-not-linked show `provisional`; unmatched show `untracked` + `net_profit` NULL.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/orders/order-sync.service.ts apps/api/src/modules/orders/ebay-fulfillment.service.ts
git commit -m "feat(orders): recomputeProfit drops tracked-only gate, sets cost_capture_status, nullable net_profit"
```

---

## Task 4: Re-sync freshness — recompute when `ebay_earnings` changes

**Files:**
- Modify: `apps/api/src/modules/orders/order-sync.service.ts` (`upsertOrder`, the `ON CONFLICT DO UPDATE` block ~`:205-271`)

**Interfaces:**
- Consumes: `recomputeProfit` from Task 3.

- [ ] **Step 1: Add conditional recompute after upsert**

In `upsertOrder`, after the `INSERT … ON CONFLICT` query resolves, capture whether `ebay_earnings` changed and trigger a recompute. The cleanest approach given the existing shape: compare the pre-upsert stored `ebay_earnings` to the incoming value.

Add before the upsert query, fetch current value when the row exists:

```ts
const existing = await this.databaseService.query<{ ebay_earnings: string | number | null }>(
  `SELECT ebay_earnings FROM orders WHERE ebay_order_id = $1`,
  [entity.ebayOrderId],
);
const prevEbayEarnings = existing.length > 0 ? Number(existing[0].ebay_earnings) : null;
```

After the upsert, recompute when earnings changed:

```ts
const incomingEarnings = Number(entity.ebayEarnings) || 0;
if (prevEbayEarnings !== null && Math.abs(prevEbayEarnings - incomingEarnings) > 0.001) {
  await this.recomputeProfit(entity.ebayOrderId);
}
```

(For brand-new inserts, the sync loop already calls `recomputeProfit` unconditionally per Task 3.)

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no new `apps/api` errors.

- [ ] **Step 3: Manual verification**

Simulate an eBay re-sync that adjusts `totalDueSeller` (e.g. partial refund): update the order's `ebay_earnings` externally then re-trigger sync, or directly:
```sql
-- before: note net_profit
SELECT ebay_order_id, ebay_earnings, net_profit FROM orders WHERE ebay_order_id = '<id>';
-- after a sync that changes ebay_earnings, net_profit should differ from the before value
```

- [ ] **Step 4: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/orders/order-sync.service.ts
git commit -m "feat(orders): recompute net_profit when ebay_earnings changes on re-sync"
```

---

## Task 5: Amazon scrape integrity (no silent zeroing)

**Files:**
- Modify: `apps/api/src/modules/amazon/amazon-order-parser.service.ts` (`extractFinancials` ~`:114-141`)
- Modify: `apps/api/src/modules/amazon/amazon.controller.ts` (`linkAmazonOrder` ~`:96-171`)

**Interfaces:**
- Produces: `extractFinancials` returns `{ ok: true; subtotal; shipping; tax; grandTotal; ... } | { ok: false }`.

- [ ] **Step 1: Change `extractFinancials` return type to a tagged result**

In `amazon-order-parser.service.ts`, refactor `extractFinancials` so that when the summary selectors are missing OR all parsed values are zero/NaN, it returns `{ ok: false }`:

```ts
export type AmazonFinancials =
  | { ok: true; subtotal: number; shipping: number; tax: number; grandTotal: number }
  | { ok: false };

extractFinancials(...): AmazonFinancials {
  // ...existing selector + regex logic, but collect raw values first
  const subtotal = /* regex parse */;
  const shipping = /* regex parse */;
  const tax = /* regex parse */;
  const grandTotal = /* regex parse */;

  const foundSummary = /* whether #orderSummary / .payment-breakdown / [data-component=orderSummary] matched */;
  const allZero = !subtotal && !shipping && !tax && !grandTotal;
  if (!foundSummary || allZero) {
    this.logger.warn('Amazon financials could not be parsed (DOM miss or all-zero)');
    return { ok: false };
  }
  return { ok: true, subtotal, shipping, tax, grandTotal };
}
```

(Keep tracking extraction unchanged — it is separate from financials.)

- [ ] **Step 2: Honor the failure in `linkAmazonOrder`**

In `amazon.controller.ts` `linkAmazonOrder`, branch on the tagged result. On `{ ok: false }`:
- Do **not** overwrite `purchase_price` / `amazon_tax` / `amazon_shipping`.
- Set `cost_capture_status = 'failed'`.
- Return a structured result the FE shows via `MessageModal` (add i18n key `amazon.link.costCaptureFailed` in both `en`/`tr` translation files; the controller returns `{ linked: false, reason: 'cost_capture_failed' }` and the existing FE handler maps it to `showMessage`).

On `{ ok: true }`: keep the existing write logic but set `cost_capture_status = 'linked'` in the same UPDATE (instead of relying on `amazon_linked_at` alone), then call `recalculateProfit` → `recomputeProfit`.

Sketch:
```ts
const fin = this.parser.extractFinancials(...);
if (!fin.ok) {
  await this.db.query(
    `UPDATE orders SET cost_capture_status = 'failed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [orderId],
  );
  await this.orderSyncService.recomputeProfit(ebayOrderId);
  return { linked: false, reason: 'cost_capture_failed' };
}
// ...existing purchase-price heuristic + UPDATE, adding cost_capture_status = 'linked'
```

- [ ] **Step 3: Add the i18n key**

In `packages/shared/src/i18n/resources/en/translation.json` and `tr/translation.json`, add under `amazon.link`:
```json
"costCaptureFailed": "Amazon order was found but the cost details couldn't be read. Profit kept at last known value."
```
(TR equivalent in the `tr` file.) Rebuild shared: `pnpm --filter @repo/shared build`.

- [ ] **Step 4: Typecheck + manual verification**

Run: `pnpm typecheck`. Manually call `POST /amazon/orders/:orderId/link-amazon` against an order whose Amazon page DOM has changed (or unit-test `extractFinancials` with empty HTML) → expect `{ linked: false, reason: 'cost_capture_failed' }` and `cost_capture_status = 'failed'`, prior `purchase_price` retained.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/amazon/amazon-order-parser.service.ts apps/api/src/modules/amazon/amazon.controller.ts packages/shared/src/i18n
git commit -m "fix(amazon): detect scrape failure, never silently zero costs (cost_capture_status=failed)"
```

---

## Task 6: Order-match heuristic (pure, TDD)

**Files:**
- Create: `apps/api/src/modules/amazon/order-matcher.ts`
- Create: `apps/api/src/modules/amazon/order-matcher.spec.ts`

**Interfaces:**
- Produces: `scoreAmazonOrderMatch(input: { amazon: { asin?: string; quantity: number; grandTotal: number; orderDate: string }; ebay: { asin?: string; quantity: number; saleTotal: number; orderDate: string }; tolerancePct: number; windowDays: number }): { match: boolean; score: number }`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/amazon/order-matcher.spec.ts`:

```ts
import { scoreAmazonOrderMatch } from './order-matcher';

const base = {
  tolerancePct: 5,
  windowDays: 7,
};

describe('scoreAmazonOrderMatch', () => {
  it('matches when asin+qty+amount+date all align', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { asin: 'B0XYZ', quantity: 1, grandTotal: 50, orderDate: '2026-07-10' },
      ebay: { asin: 'B0XYZ', quantity: 1, saleTotal: 49.5, orderDate: '2026-07-12' },
      ...base,
    });
    expect(r.match).toBe(true);
    expect(r.score).toBeGreaterThan(0);
  });

  it('rejects when asin differs', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { asin: 'B0AAA', quantity: 1, grandTotal: 50, orderDate: '2026-07-10' },
      ebay: { asin: 'B0BBB', quantity: 1, saleTotal: 50, orderDate: '2026-07-10' },
      ...base,
    });
    expect(r.match).toBe(false);
  });

  it('rejects when quantity differs', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { asin: 'B0XYZ', quantity: 2, grandTotal: 100, orderDate: '2026-07-10' },
      ebay: { asin: 'B0XYZ', quantity: 1, saleTotal: 50, orderDate: '2026-07-10' },
      ...base,
    });
    expect(r.match).toBe(false);
  });

  it('rejects when amount outside tolerance', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { asin: 'B0XYZ', quantity: 1, grandTotal: 100, orderDate: '2026-07-10' },
      ebay: { asin: 'B0XYZ', quantity: 1, saleTotal: 50, orderDate: '2026-07-10' },
      ...base,
    });
    expect(r.match).toBe(false);
  });

  it('rejects when date outside window', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { asin: 'B0XYZ', quantity: 1, grandTotal: 50, orderDate: '2026-07-01' },
      ebay: { asin: 'B0XYZ', quantity: 1, saleTotal: 50, orderDate: '2026-07-20' },
      ...base,
    });
    expect(r.match).toBe(false);
  });

  it('rejects when asin missing on either side', () => {
    const r = scoreAmazonOrderMatch({
      amazon: { quantity: 1, grandTotal: 50, orderDate: '2026-07-10' },
      ebay: { asin: 'B0XYZ', quantity: 1, saleTotal: 50, orderDate: '2026-07-10' },
      ...base,
    });
    expect(r.match).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter api test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/api/src/modules/amazon/order-matcher.ts`:

```ts
export interface AmazonMatchCandidate {
  asin?: string;
  quantity: number;
  grandTotal: number;
  orderDate: string; // ISO date
}
export interface EbayMatchCandidate {
  asin?: string;
  quantity: number;
  saleTotal: number;
  orderDate: string; // ISO date
}
export interface ScoreInput {
  amazon: AmazonMatchCandidate;
  ebay: EbayMatchCandidate;
  tolerancePct: number;
  windowDays: number;
}
export interface ScoreResult {
  match: boolean;
  score: number;
}

const DAY_MS = 86_400_000;

/**
 * Strict multi-signal matcher. Requires ALL of: same ASIN, same quantity,
 * amount within tolerance, date within window. Any miss -> no match (never
 * force-link, to avoid wrong cost attribution).
 */
export function scoreAmazonOrderMatch(input: ScoreInput): ScoreResult {
  const { amazon, ebay, tolerancePct, windowDays } = input;
  let score = 0;

  if (!amazon.asin || !ebay.asin || amazon.asin !== ebay.asin) return { match: false, score: 0 };
  score += 40;

  if (amazon.quantity !== ebay.quantity) return { match: false, score: 0 };
  score += 20;

  const ref = Math.max(amazon.grandTotal, ebay.saleTotal) || 1;
  const diffPct = (Math.abs(amazon.grandTotal - ebay.saleTotal) / ref) * 100;
  if (diffPct > tolerancePct) return { match: false, score: 0 };
  score += Math.round(40 * (1 - diffPct / 100));

  const aTime = new Date(amazon.orderDate).getTime();
  const eTime = new Date(ebay.orderDate).getTime();
  if (Number.isNaN(aTime) || Number.isNaN(eTime)) return { match: false, score: 0 };
  const dayDiff = Math.abs(aTime - eTime) / DAY_MS;
  if (dayDiff > windowDays) return { match: false, score: 0 };
  score += Math.max(0, 20 - Math.round(dayDiff));

  return { match: true, score };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter api test`
Expected: PASS (all matcher tests + Task 2 tests).

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/amazon/order-matcher.ts apps/api/src/modules/amazon/order-matcher.spec.ts
git commit -m "feat(amazon): pure order-match heuristic with tests"
```

---

## Task 7: Auto cost-capture job — Amazon order-list scrape + match + write

**Files:**
- Create: `apps/api/src/modules/amazon/amazon-order-sync.service.ts`
- Create: `apps/api/src/modules/amazon/amazon-order-sync.processor.ts`
- Create: `apps/api/src/modules/amazon/amazon-order-sync.queue.ts`
- Modify: `apps/api/src/modules/amazon/amazon.module.ts`
- Modify: `apps/api/src/modules/amazon/amazon-accounts.service.ts` (add `last_orders_sync_at` read/update) — or store on `amazon_accounts`
- Create: `apps/api/migrations/034_alter_amazon_accounts_add_last_orders_sync.sql`

**Interfaces:**
- Consumes: `AmazonScrapingService`, `AmazonRateLimiter`, `BrowserStateManager`, `scoreAmazonOrderMatch` (Task 6), `recomputeProfit` (Task 3), `OrderCostCaptureStatus`.
- Produces: BullMQ queue `amazon-order-sync`; method `AmazonOrderSyncService.runForAccount(accountId)`.

> **Note:** The account order-list scraping reuses `AmazonScrapingService`'s Playwright/stealth stack. If `scrapeAccountOrders` does not exist, add a method that navigates to the account's "Your Orders" page, extracts the order list for the period since `last_orders_sync_at`, and returns the candidate rows. Keep selectors in one place so DOM changes are easy to patch (same fragility discipline as Task 5).

- [ ] **Step 1: Migration — `last_orders_sync_at` on `amazon_accounts`**

Create `apps/api/migrations/034_alter_amazon_accounts_add_last_orders_sync.sql`:

```sql
ALTER TABLE amazon_accounts ADD COLUMN IF NOT EXISTS last_orders_sync_at TIMESTAMP WITH TIME ZONE;
```

Verify column: `SELECT column_name FROM information_schema.columns WHERE table_name='amazon_accounts' AND column_name='last_orders_sync_at';`

Commit migration separately if desired, or fold into this task's commit.

- [ ] **Step 2: Implement the queue + processor scaffolding**

Create `apps/api/src/modules/amazon/amazon-order-sync.queue.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Logger } from '@nestjs/common';

export const AMAZON_ORDER_SYNC_QUEUE = 'amazon-order-sync';

@Injectable()
export class AmazonOrderSyncQueueService {
  private readonly logger = new Logger(AmazonOrderSyncQueueService.name);
  constructor(@InjectQueue(AMAZON_ORDER_SYNC_QUEUE) private readonly queue: Queue) {}

  async enqueueAccount(accountId: string): Promise<void> {
    await this.queue.add('sync-account', { accountId }, { jobId: `acct-${accountId}`, removeOnComplete: 100, attempts: 3, backoff: { type: 'exponential', delay: 60_000 } });
  }
}
```

Create `apps/api/src/modules/amazon/amazon-order-sync.processor.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AMAZON_ORDER_SYNC_QUEUE } from './amazon-order-sync.queue';
import { AmazonOrderSyncService } from './amazon-order-sync.service';

@Processor(AMAZON_ORDER_SYNC_QUEUE, { concurrency: Number(process.env.AMAZON_ORDER_SYNC_CONCURRENCY || 2) })
export class AmazonOrderSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(AmazonOrderSyncProcessor.name);
  constructor(private readonly svc: AmazonOrderSyncService) { super(); }

  async handle(job: Job<{ accountId: string }>): Promise<void> {
    this.logger.log(`syncing Amazon orders for account ${job.data.accountId}`);
    await this.svc.runForAccount(job.data.accountId);
  }
}
```

- [ ] **Step 3: Implement the service (scrape → match → write → recompute)**

Create `apps/api/src/modules/amazon/amazon-order-sync.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { AmazonScrapingService } from './amazon-scraping.service';
import { OrderSyncService } from '../orders/order-sync.service';
import { scoreAmazonOrderMatch } from './order-matcher';

@Injectable()
export class AmazonOrderSyncService {
  private readonly logger = new Logger(AmazonOrderSyncService.name);
  private readonly tolerancePct = Number(process.env.AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT || 5);
  private readonly windowDays = Number(process.env.AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS || 7);

  constructor(
    private readonly db: DatabaseService,
    private readonly scraping: AmazonScrapingService,
    private readonly orderSync: OrderSyncService,
  ) {}

  async runForAccount(accountId: string): Promise<void> {
    const account = await this.db.query<{ last_orders_sync_at: Date | null; user_id: string }>(
      `SELECT last_orders_sync_at, user_id FROM amazon_accounts WHERE id = $1`,
      [accountId],
    );
    if (account.length === 0) return;
    const since = account[0].last_orders_sync_at ?? new Date(Date.now() - 30 * 86_400_000);

    let amazonOrders: Awaited<ReturnType<AmazonScrapingService['scrapeAccountOrders']>>;
    try {
      amazonOrders = await this.scraping.scrapeAccountOrders(accountId, since);
    } catch (err) {
      this.logger.warn(`scrapeAccountOrders failed for ${accountId}: ${(err as Error).message}`);
      return; // transport failure — BullMQ retries the job
    }

    // Load candidate eBay orders for this user that still need cost capture.
    const candidates = await this.db.query<{
      id: string; ebay_order_id: string; asin: string | null; quantity: number;
      sale_total: string | number; order_date: Date;
    }>(
      `SELECT o.id, o.ebay_order_id, p.asin, o.quantity, o.sale_total, o.order_date
       FROM orders o
       LEFT JOIN listings l ON l.id = o.listing_id
       LEFT JOIN products p ON p.id = l.product_id
       WHERE o.user_id = $1
         AND o.cost_capture_status IN ('pending','provisional')
         AND o.order_date >= NOW() - INTERVAL '60 days'`,
      [account[0].user_id],
    );

    for (const ao of amazonOrders) {
      try {
        let best: { orderId: string; ebayOrderId: string; score: number } | null = null;
        for (const c of candidates) {
          const r = scoreAmazonOrderMatch({
            amazon: { asin: ao.asin, quantity: ao.quantity, grandTotal: ao.grandTotal, orderDate: ao.orderDate.toISOString() },
            ebay: { asin: c.asin ?? undefined, quantity: c.quantity, saleTotal: Number(c.sale_total), orderDate: c.order_date.toISOString() },
            tolerancePct: this.tolerancePct,
            windowDays: this.windowDays,
          });
          if (r.match && (!best || r.score > best.score)) {
            best = { orderId: c.id, ebayOrderId: c.ebay_order_id, score: r.score };
          }
        }
        if (!best) continue; // never force-link

        await this.db.query(
          `UPDATE orders SET
             amazon_account_id = $1,
             amazon_order_id = $2,
             purchase_price = $3,
             amazon_tax = $4,
             amazon_shipping = $5,
             amazon_linked_at = CURRENT_TIMESTAMP,
             cost_capture_status = 'linked',
             updated_at = CURRENT_TIMESTAMP
           WHERE id = $6`,
          [accountId, ao.amazonOrderId, ao.purchasePrice, ao.tax, ao.shipping, best.orderId],
        );
        await this.orderSync.recomputeProfit(best.ebayOrderId);
      } catch (err) {
        this.logger.warn(`cost-capture for Amazon order ${ao.amazonOrderId} failed: ${(err as Error).message}`);
      }
    }

    await this.db.query(
      `UPDATE amazon_accounts SET last_orders_sync_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [accountId],
    );
  }
}
```

`scrapeAccountOrders` return type (add to `AmazonScrapingService` if absent):

```ts
async scrapeAccountOrders(
  accountId: string,
  since: Date,
): Promise<Array<{ amazonOrderId: string; asin?: string; quantity: number; grandTotal: number; tax: number; shipping: number; purchasePrice: number; orderDate: Date }>>
```

- [ ] **Step 4: Register queue + processor + scheduler in the module**

In `apps/api/src/modules/amazon/amazon.module.ts`:
- `BullModule.registerQueue({ name: AMAZON_ORDER_SYNC_QUEUE })`.
- providers: `AmazonOrderSyncService`, `AmazonOrderSyncProcessor`, `AmazonOrderSyncQueueService`.
- Add a repeatable scheduler (mirror the existing `refresh-scheduler` pattern): register a repeatable job `tick` every `process.env.AMAZON_ORDER_SYNC_CRON || '*/30 * * * *'` whose handler loads all Amazon accounts and enqueues one `sync-account` job each. (Put the scheduler in a small `AmazonOrderSyncSchedulerService` with `@OnApplicationBootstrap` if the repo pattern uses that; otherwise follow the existing `RefreshSchedulerService`.)

Export `AmazonOrderSyncQueueService` if other modules need to enqueue manually.

- [ ] **Step 5: Add env defaults**

Add to `apps/api/.env.example` (and mention in `.env.production` comments):
```
AMAZON_ORDER_SYNC_CRON='*/30 * * * *'
AMAZON_ORDER_SYNC_CONCURRENCY=2
AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT=5
AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS=7
```

- [ ] **Step 6: Typecheck + manual verification**

Run: `pnpm typecheck`. Then with API running and ≥1 Amazon account connected: wait for the cron (or enqueue manually) and verify:
```sql
SELECT ebay_order_id, amazon_order_id, cost_capture_status, purchase_price, amazon_tax, amazon_shipping, net_profit
FROM orders WHERE cost_capture_status = 'linked' ORDER BY amazon_linked_at DESC LIMIT 10;
```
Expected: previously-unlinked matched orders now `linked` with real Amazon costs + recomputed `net_profit`.

- [ ] **Step 7: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/amazon apps/api/migrations/034_alter_amazon_accounts_add_last_orders_sync.sql apps/api/.env.example
git commit -m "feat(amazon): auto cost-capture job scrapes account orders, matches, links costs"
```

---

## Task 8: Dashboard tiered aggregates + recent-orders mapper fix

**Files:**
- Modify: `apps/api/src/modules/dashboard/dashboard.service.ts` (`periodSelect`, `buildPeriod`, `getRecentOrders` mapper, `getHistory`)
- Modify: `packages/shared/src/domain/orders/orders.types.ts` (extend `PeriodMetricsDto`)

**Interfaces:**
- Produces: `PeriodMetricsDto` gains `profitConfirmed`, `profitProvisional`, `revenueUncosted`, `ordersPendingCapture`, `ordersCaptureFailed`, `ordersUntracked`.

- [ ] **Step 1: Extend the shared DTO**

In `packages/shared/src/domain/orders/orders.types.ts`, add optional fields to `PeriodMetricsDto`:

```ts
export interface PeriodMetricsDto {
  // ...existing fields...
  profitConfirmed: number;
  profitProvisional: number;
  revenueUncosted: number;
  ordersPendingCapture: number;
  ordersCaptureFailed: number;
  ordersUntracked: number;
}
```

Run `pnpm --filter @repo/shared build`.

- [ ] **Step 2: Rewrite `periodSelect` to tiered FILTER aggregates**

Replace the body of `periodSelect()` in `dashboard.service.ts`:

```ts
private periodSelect(): string {
  const cancelled = OrderStatus.CANCELLED;
  return `
    COALESCE(SUM(sale_total) FILTER (WHERE status <> '${cancelled}'), 0) AS sales,
    COUNT(*) FILTER (WHERE status <> '${cancelled}') AS orders,
    COALESCE(SUM(quantity) FILTER (WHERE status <> '${cancelled}'), 0) AS units,
    COUNT(*) FILTER (WHERE status = '${cancelled}') AS refunds,
    COALESCE(SUM(COALESCE(ebay_earnings,0) - COALESCE(purchase_price,0))
      FILTER (WHERE status <> '${cancelled}'), 0) AS gross_profit,
    COALESCE(SUM(COALESCE(ebay_earnings,0)) FILTER (WHERE status <> '${cancelled}'), 0) AS payout,
    COALESCE(SUM(net_profit) FILTER (WHERE status <> '${cancelled}' AND cost_capture_status = 'linked'), 0) AS profit_confirmed,
    COALESCE(SUM(net_profit) FILTER (WHERE status <> '${cancelled}' AND cost_capture_status = 'provisional'), 0) AS profit_provisional,
    COALESCE(SUM(sale_total) FILTER (WHERE status <> '${cancelled}' AND cost_capture_status IN ('pending','failed','untracked')), 0) AS revenue_uncosted,
    COUNT(*) FILTER (WHERE status <> '${cancelled}' AND cost_capture_status = 'pending') AS orders_pending_capture,
    COUNT(*) FILTER (WHERE status <> '${cancelled}' AND cost_capture_status = 'failed') AS orders_capture_failed,
    COUNT(*) FILTER (WHERE status <> '${cancelled}' AND cost_capture_status = 'untracked') AS orders_untracked
  `;
}
```

(`profit` for backward-compat can be dropped or aliased to `profit_confirmed`; update `buildPeriod` accordingly — see Step 3.)

- [ ] **Step 3: Update `buildPeriod` + `emptyPeriod`**

Change `buildPeriod` signature to accept the tiered fields and map snake_case DB rows. Update every caller (`getMetrics`, `getChart` summary, `getRevenueTrend`) to pass the new columns. The headline `netProfit` shown on the dashboard = `profitConfirmed`. Replace the existing `profit` parameter with `profitConfirmed`/`profitProvisional` etc.:

```ts
private buildPeriod(p: {
  sales: number; orders: number; units: number; refunds: number; grossProfit: number; payout: number;
  profitConfirmed: number; profitProvisional: number; revenueUncosted: number;
  ordersPendingCapture: number; ordersCaptureFailed: number; ordersUntracked: number;
  prevSales: number; prevProfitConfirmed: number;
}): PeriodMetricsDto {
  return {
    sales: p.sales, orders: p.orders, units: p.units, refunds: p.refunds,
    grossProfit: p.grossProfit,
    netProfit: p.profitConfirmed, // headline = trusted only
    estimatedPayout: p.payout,
    margin: p.sales > 0 ? Math.round((p.profitConfirmed / p.sales) * 1000) / 10 : 0,
    avgOrderValue: p.orders > 0 ? Math.round((p.sales / p.orders) * 100) / 100 : 0,
    trend: this.calcChange(p.sales, p.prevSales),
    profitTrend: this.calcChange(p.profitConfirmed, p.prevProfitConfirmed),
    profitConfirmed: p.profitConfirmed,
    profitProvisional: p.profitProvisional,
    revenueUncosted: p.revenueUncosted,
    ordersPendingCapture: p.ordersPendingCapture,
    ordersCaptureFailed: p.ordersCaptureFailed,
    ordersUntracked: p.ordersUntracked,
  };
}
```

Map the DB rows (snake_case → buildPeriod) in each consumer. Update `emptyPeriod()` to pass zeros for all new fields.

- [ ] **Step 4: Fix `getRecentOrders` mapper**

In `getRecentOrders` (`:600-623`), stop hardcoding zeros. Add the financial columns to the SELECT and map them:

```sql
SELECT o.id, o.ebay_order_id, o.sale_total, o.sale_price, o.sale_shipping, o.sale_tax,
       o.ebay_earnings, o.purchase_price, o.amazon_tax, o.amazon_shipping,
       o.transaction_fee, o.ad_fee, o.net_profit, o.cost_capture_status,
       o.status, o.order_date, o.updated_at, o.quantity, o.listing_id,
       l.title, l.asin, p.image_urls
FROM orders o
LEFT JOIN listings l ON l.id = o.listing_id
LEFT JOIN products p ON p.id = l.product_id
WHERE o.user_id = $1 ...
```

Map real values (no `?? 0` overrides on financial fields); include `costCaptureStatus`.

- [ ] **Step 5: Extend `getHistory` P&L matrix**

In `getHistory` (`:443-465`), add `profit_confirmed` and `profit_provisional` columns alongside the existing component breakdown, sourced from the same FILTER pattern.

- [ ] **Step 6: Typecheck + manual verification**

Run: `pnpm typecheck`. Hit `GET /dashboard` and confirm the response now includes `profitConfirmed`, `profitProvisional`, `revenueUncosted`, and the counts, and that `recentOrders[].purchasePrice` etc. are real numbers, not zeros.

```bash
curl -s localhost:3000/v1/dashboard -H "Authorization: Bearer <token>" | jq '.metrics.today'
```
Expected: object with all new tiered fields; `profitConfirmed` ≤ `profitConfirmed + profitProvisional`; `revenueUncosted` ≥ 0.

- [ ] **Step 7: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/dashboard/dashboard.service.ts packages/shared/src/domain/orders/orders.types.ts packages/shared/dist
git commit -m "feat(dashboard): tiered profit aggregates (confirmed/provisional/uncosted) + real recent-order fields"
```

---

## Task 9: Spec/CLAUDE.md sync + open-question resolution

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Under "Order Management → Net Profit Formula", document: `net_profit` is now nullable (NULL = unknown); add `cost_capture_status` enum and the three dashboard tiers; note the `amazon-order-sync` queue and that the matcher is strict (ASIN+qty+amount+date). Add the new env vars to the env list. Add migration `033`/`034` to the migrations table. (Per architectural rule 11 — keep CLAUDE.md current.)

- [ ] **Step 2: Resolve spec open questions**

- Confirm eBay inbound orders expose the item ASIN (currently the listing-match path uses `legacyItemId`). If ASIN is not on the eBay order payload, the untracked-ASIN-fallback in `recomputeProfit` silently degrades to listing-only resolution — acceptable; document it.
- Decision on Jest harness: kept minimal (Tasks 2 & 6 only) — record in CLAUDE.md that `apps/api` now has `pnpm --filter api test`.

- [ ] **Step 3: Lint + commit**

```bash
pnpm lint
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for cost_capture_status + amazon-order-sync + tiered dashboard"
```

---

## Self-Review (completed)

**Spec coverage:** every spec section maps to a task — §1 data model → T1+T2; §2 recomputation → T2+T3; §3 integrity → T5; §4 auto-capture → T6+T7; §5 dashboard → T8; insert path → T3; re-sync → T4; shared enum → T1; DTO → T8. Open questions → T9. No spec section is unaddressed.

**Placeholder scan:** `scrapeAccountOrders` is flagged as "add if absent" with a concrete return type — the implementer must verify it exists before T7; this is the one external dependency. No "TBD"/"add error handling" steps.

**Type consistency:** `recomputeProfit` (not `recalculateProfit`) used uniformly from T3 onward; `OrderCostCaptureStatus` values match across migration, helper, and dashboard FILTERs (`pending|linked|provisional|failed|untracked`); `PeriodMetricsDto` field names match between shared (T8.1) and `buildPeriod` (T8.3).
