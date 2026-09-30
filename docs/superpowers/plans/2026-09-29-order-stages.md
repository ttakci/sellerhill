# Order Stages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two order badges (eBay status + Amazon fulfillment) with ONE seller-facing `OrderStage` — shown with an icon and a legend, filtered by counted tabs — so a seller sees at a glance which orders need them and what is happening to the rest.

**Architecture:** A pure `deriveOrderStage` in `@repo/shared` plus a byte-for-byte-equivalent `buildOrderStageSql` (locked by an exhaustive guard spec, the same technique `fulfillment-state-sql.guard.spec.ts` uses). The API adds `stage` to `OrderDto`, a `stage` list filter and a `GET /orders/stage-counts` endpoint; the web renders one `OrderStageBadge`, a `TabNav` with counts, a `Status` select and an `OrderStageLegend` popover. No migration: every input column already exists.

**Tech Stack:** TypeScript, NestJS + `pg` (raw SQL), React + RTK Query, Emotion, `@repo/ui` atoms (`Badge`, `Icon`, `TabNav`, `Popover`, `Tooltip`, `Select`), Jest (`apps/api`), Vitest (`apps/web`), i18next (15 locales).

**Spec:** `docs/superpowers/specs/2026-09-29-order-stages-design.md`

## Global Constraints

- Commit and push to `development` ONLY — no UAT/main merge until the operator says so (memory `no-main-merge-until-told`).
- Stage the commit by explicit path (`git commit -- <paths>`); another session has staged files in this tree. Never `git add -A`, never `git stash`.
- 4-file split for every web component (`.component.tsx` / `.container.tsx` / `.style.ts` / `.types.ts`); no hooks in components, no `styled` outside `.style.ts`, tokens via `tkn()`, no hardcoded strings, every new i18n key in all 15 locales (`en tr ru hi ur ar az de fr es it ro uk zh pt`).
- No new enum string literals in code — every stage value comes from `OrderStage`.
- `@repo/shared` and `@repo/ui` load from `dist/`: rebuild (`pnpm --filter @repo/shared build`, `pnpm --filter @repo/ui build`) after editing them, before running api Jest or web Vitest/tsc.
- The Jest harness for shared pure code lives in `apps/api` (`pnpm --filter api exec jest <path>`); web tests are Vitest (`pnpm --filter web exec vitest run <path>`).
- `pnpm lint` runs in the pre-commit hook (`--max-warnings 0`); run `npx eslint <changed files> --max-warnings 0` and `npx prettier --write <changed files>` before each commit. Never pass a directory to prettier (it reformats files you did not touch).
- Every SQL condition in `buildOrderStageSql` must be one the guard's evaluator understands: `IS NULL` / `IS NOT NULL` / `= '<literal>'` / `<> '<literal>'` / `IN ('a', 'b')` / `LIKE 'SIM-%'` on `COALESCE(...)` / `AND` / `NOT (...)`. No `OR` — nest `CASE WHEN` instead.

## Review Focus

1. **An order that is both `amazon_cancelled_at` set and `status = shipped`** (Amazon cancelled after the push): must read `amazon_cancelled` (row 1 wins), never `shipped` — a shipped-looking order the seller thinks is done. Pinned in Task 1's priority test.
2. **`status = pending` (unpaid) with `auto_fulfill_status = skipped`** (`order_not_paid`): must read `awaiting_payment`, not `to_purchase` — the seller must not buy for an unpaid sale. Pinned in Task 1.
3. **A legacy shipped order with `ebay_tracking_pushed_at` NULL and `shipped_detected_at` NULL** (pre-migration-089 rows): must read `shipped`, not `to_purchase`. Pinned in Task 1 and by the exhaustive guard in Task 2.
4. **`?stage=` carrying an unknown value** (typo, old bookmark): the API must ignore it and return the unfiltered list, never 500 or an empty list. Pinned in Task 3.
5. **Demo mode** (`sessionStorage sellerhill_demo`): the demo fixtures must carry `stage` and answer `/orders/stage-counts`, or the demo list renders blank tabs and every demo row an em dash. Pinned in Task 10.

---

### Task 1: `OrderStage` enum + `deriveOrderStage` (pure, shared)

**Files:**
- Create: `packages/shared/src/domain/orders/order-stage.ts`
- Modify: `packages/shared/src/domain/orders/orders.types.ts` (add the enum next to `OrderFulfillmentState`)
- Modify: `packages/shared/src/domain/orders/index.ts` (export the new module — check how `fulfillment-state` is exported there and mirror it)
- Test: `apps/api/src/modules/orders/order-stage.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  export enum OrderStage {
    AMAZON_CANCELLED = 'amazon_cancelled',
    CANCELLED = 'cancelled',
    DELIVERED = 'delivered',
    TEST_RUN = 'test_run',
    SHIPPED = 'shipped',
    TRACKING_HELD = 'tracking_held',
    BUYING = 'buying',
    PURCHASED = 'purchased',
    PURCHASE_BLOCKED = 'purchase_blocked',
    AWAITING_PAYMENT = 'awaiting_payment',
    TO_PURCHASE = 'to_purchase',
  }
  export interface OrderStageInput {
    status: OrderStatus;
    autoFulfillStatus?: AutoFulfillStatus | null;
    amazonOrderId?: string | null;
    amazonCancelledAt?: string | Date | null;
    shippedDetectedAt?: string | Date | null;
    ebayTrackingPushedAt?: string | Date | null;
  }
  export function deriveOrderStage(input: OrderStageInput): OrderStage;
  export const ACTIONABLE_ORDER_STAGES: readonly OrderStage[]; // AMAZON_CANCELLED, TRACKING_HELD, PURCHASE_BLOCKED
  export const ORDER_STAGE_ORDER: readonly OrderStage[];       // display/legend order, = enum order
  export enum OrderStageTab { ALL = 'all', ACTION = 'action', TO_PURCHASE = 'to_purchase', IN_PROGRESS = 'in_progress', DONE = 'done' }
  export const ORDER_STAGE_TABS: Readonly<Record<OrderStageTab, readonly OrderStage[]>>;
  export const TRACKING_HELD_ALARM_HOURS = 12;
  export function isTrackingHeldOverdue(shippedDetectedAt: string | Date | null | undefined, now: Date): boolean;
  ```

- [ ] **Step 1: Add the enum to `orders.types.ts`** directly under `OrderFulfillmentState`:

```ts
/**
 * ONE seller-facing status per order, derived from columns that already exist.
 * Answers "what is happening to this order, and do I need to act?" — which
 * neither the eBay status (`OrderStatus`) nor `OrderFulfillmentState` did on
 * its own. Priority order = enum order: `deriveOrderStage` returns the FIRST
 * matching member. See docs/superpowers/specs/2026-09-29-order-stages-design.md.
 */
export enum OrderStage {
  AMAZON_CANCELLED = 'amazon_cancelled',
  CANCELLED = 'cancelled',
  DELIVERED = 'delivered',
  TEST_RUN = 'test_run',
  SHIPPED = 'shipped',
  TRACKING_HELD = 'tracking_held',
  BUYING = 'buying',
  PURCHASED = 'purchased',
  PURCHASE_BLOCKED = 'purchase_blocked',
  AWAITING_PAYMENT = 'awaiting_payment',
  TO_PURCHASE = 'to_purchase',
}

/** The list page's counted tabs — groupings over `OrderStage`. */
export enum OrderStageTab {
  ALL = 'all',
  ACTION = 'action',
  TO_PURCHASE = 'to_purchase',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}
```

- [ ] **Step 2: Write the failing test** `apps/api/src/modules/orders/order-stage.spec.ts`:

```ts
import {
  ACTIONABLE_ORDER_STAGES,
  AutoFulfillStatus,
  deriveOrderStage,
  isTrackingHeldOverdue,
  ORDER_STAGE_TABS,
  OrderStage,
  OrderStageTab,
  OrderStatus,
  TRACKING_HELD_ALARM_HOURS,
} from '@repo/shared';

const paid = { status: OrderStatus.WAITING_SHIPMENT };

describe('deriveOrderStage', () => {
  it('reads a paid order with no Amazon purchase as "to purchase" — automation off included', () => {
    expect(deriveOrderStage(paid)).toBe(OrderStage.TO_PURCHASE);
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.SKIPPED })).toBe(OrderStage.TO_PURCHASE);
  });

  it('never asks the seller to buy for an unpaid sale', () => {
    expect(deriveOrderStage({ status: OrderStatus.PENDING })).toBe(OrderStage.AWAITING_PAYMENT);
    expect(
      deriveOrderStage({ status: OrderStatus.PENDING, autoFulfillStatus: AutoFulfillStatus.SKIPPED }),
    ).toBe(OrderStage.AWAITING_PAYMENT);
  });

  it('reports a blocked or failed automatic purchase with no Amazon order as blocked', () => {
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.BLOCKED })).toBe(OrderStage.PURCHASE_BLOCKED);
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.FAILED })).toBe(OrderStage.PURCHASE_BLOCKED);
  });

  it('reports a blocked purchase the seller then linked by hand as purchased', () => {
    expect(
      deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.BLOCKED, amazonOrderId: '113-0158186-6357035' }),
    ).toBe(OrderStage.PURCHASED);
  });

  it('reports queued and running automation as buying', () => {
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.PENDING })).toBe(OrderStage.BUYING);
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.RUNNING })).toBe(OrderStage.BUYING);
  });

  it('reports a placed or hand-linked Amazon order as purchased until Amazon ships it', () => {
    expect(deriveOrderStage({ ...paid, autoFulfillStatus: AutoFulfillStatus.PLACED, amazonOrderId: '111-1' })).toBe(OrderStage.PURCHASED);
    expect(deriveOrderStage({ ...paid, amazonOrderId: '111-1' })).toBe(OrderStage.PURCHASED);
  });

  it('holds once Amazon shipped but nothing reached eBay', () => {
    expect(
      deriveOrderStage({ ...paid, amazonOrderId: '111-1', shippedDetectedAt: '2026-09-30T00:00:00Z' }),
    ).toBe(OrderStage.TRACKING_HELD);
  });

  it('is shipped once eBay has the tracking, or the eBay status says so', () => {
    expect(
      deriveOrderStage({
        ...paid,
        amazonOrderId: '111-1',
        shippedDetectedAt: '2026-09-30T00:00:00Z',
        ebayTrackingPushedAt: '2026-09-30T01:00:00Z',
      }),
    ).toBe(OrderStage.SHIPPED);
    // Legacy rows (pre-089) carry neither timestamp — the eBay status decides.
    expect(deriveOrderStage({ status: OrderStatus.SHIPPED })).toBe(OrderStage.SHIPPED);
  });

  it('is delivered on completed, cancelled on cancelled', () => {
    expect(deriveOrderStage({ status: OrderStatus.COMPLETED, amazonOrderId: '111-1' })).toBe(OrderStage.DELIVERED);
    expect(deriveOrderStage({ status: OrderStatus.CANCELLED })).toBe(OrderStage.CANCELLED);
  });

  it('lets an Amazon cancellation outrank a shipped or purchased order, but not a settled one', () => {
    expect(
      deriveOrderStage({ status: OrderStatus.SHIPPED, amazonOrderId: '111-1', amazonCancelledAt: '2026-09-30T00:00:00Z' }),
    ).toBe(OrderStage.AMAZON_CANCELLED);
    expect(
      deriveOrderStage({ status: OrderStatus.COMPLETED, amazonOrderId: '111-1', amazonCancelledAt: '2026-09-30T00:00:00Z' }),
    ).toBe(OrderStage.DELIVERED);
  });

  it('never lets a dry run look purchased or shipped', () => {
    expect(deriveOrderStage({ ...paid, amazonOrderId: 'SIM-123', autoFulfillStatus: AutoFulfillStatus.DRY_RUN })).toBe(OrderStage.TEST_RUN);
    expect(deriveOrderStage({ ...paid, amazonOrderId: 'SIM-123', shippedDetectedAt: '2026-09-30T00:00:00Z' })).toBe(OrderStage.TEST_RUN);
  });
});

describe('stage groupings', () => {
  it('flags exactly the stages a seller must act on', () => {
    expect([...ACTIONABLE_ORDER_STAGES].sort()).toEqual(
      [OrderStage.AMAZON_CANCELLED, OrderStage.TRACKING_HELD, OrderStage.PURCHASE_BLOCKED].sort(),
    );
  });

  it('assigns every stage to exactly one tab besides ALL', () => {
    const tabs = Object.values(OrderStageTab).filter((t) => t !== OrderStageTab.ALL);
    for (const stage of Object.values(OrderStage)) {
      const owners = tabs.filter((t) => ORDER_STAGE_TABS[t].includes(stage));
      expect({ stage, owners }).toEqual({ stage, owners: [expect.any(String)] });
    }
    expect(ORDER_STAGE_TABS[OrderStageTab.ALL]).toEqual(Object.values(OrderStage));
  });
});

describe('isTrackingHeldOverdue', () => {
  const now = new Date('2026-09-30T12:00:00Z');
  it(`turns red only after ${TRACKING_HELD_ALARM_HOURS} hours`, () => {
    expect(isTrackingHeldOverdue('2026-09-30T01:00:00Z', now)).toBe(false);
    expect(isTrackingHeldOverdue('2026-09-29T23:59:00Z', now)).toBe(true);
    expect(isTrackingHeldOverdue(null, now)).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm --filter @repo/shared build && pnpm --filter api exec jest src/modules/orders/order-stage.spec.ts`
Expected: FAIL — `deriveOrderStage` is not exported.

- [ ] **Step 4: Implement** `packages/shared/src/domain/orders/order-stage.ts`:

```ts
// packages/shared/src/domain/orders/order-stage.ts
//
// ONE seller-facing status per order. `deriveOrderStage` and
// `buildOrderStageSql` (order-stage-sql.ts) are the same decision in two
// languages; `order-stage-sql.guard.spec.ts` proves it on every input
// combination, so change them together.

import { isSimulatedAmazonOrderId } from './fulfillment-state';
import { AutoFulfillStatus, OrderStage, OrderStageTab, OrderStatus } from './orders.types';

export interface OrderStageInput {
  status: OrderStatus;
  autoFulfillStatus?: AutoFulfillStatus | null;
  amazonOrderId?: string | null;
  amazonCancelledAt?: string | Date | null;
  /** `orders.shipped_detected_at` — Amazon observed shipped (migration 089). */
  shippedDetectedAt?: string | Date | null;
  /** `orders.ebay_tracking_pushed_at` — eBay received a fulfillment (089). */
  ebayTrackingPushedAt?: string | Date | null;
}

/** Priority order — the first rule that matches wins. */
export function deriveOrderStage(input: OrderStageInput): OrderStage {
  const settled = input.status === OrderStatus.COMPLETED;
  if (input.amazonCancelledAt && !settled) {
    return OrderStage.AMAZON_CANCELLED;
  }
  if (input.status === OrderStatus.CANCELLED) {
    return OrderStage.CANCELLED;
  }
  if (settled) {
    return OrderStage.DELIVERED;
  }
  if (isSimulatedAmazonOrderId(input.amazonOrderId) || input.autoFulfillStatus === AutoFulfillStatus.DRY_RUN) {
    return OrderStage.TEST_RUN;
  }
  if (input.status === OrderStatus.SHIPPED || input.ebayTrackingPushedAt) {
    return OrderStage.SHIPPED;
  }
  if (input.shippedDetectedAt) {
    return OrderStage.TRACKING_HELD;
  }
  if (input.autoFulfillStatus === AutoFulfillStatus.PENDING || input.autoFulfillStatus === AutoFulfillStatus.RUNNING) {
    return OrderStage.BUYING;
  }
  if (input.amazonOrderId) {
    return OrderStage.PURCHASED;
  }
  if (input.autoFulfillStatus === AutoFulfillStatus.BLOCKED || input.autoFulfillStatus === AutoFulfillStatus.FAILED) {
    return OrderStage.PURCHASE_BLOCKED;
  }
  if (input.status === OrderStatus.PENDING) {
    return OrderStage.AWAITING_PAYMENT;
  }
  return OrderStage.TO_PURCHASE;
}

/** Legend / select order — the enum's own order. */
export const ORDER_STAGE_ORDER: readonly OrderStage[] = Object.values(OrderStage);

/** Stages the seller must act on — red badges, the "Needs action" tab. */
export const ACTIONABLE_ORDER_STAGES: readonly OrderStage[] = [
  OrderStage.AMAZON_CANCELLED,
  OrderStage.TRACKING_HELD,
  OrderStage.PURCHASE_BLOCKED,
];

export const ORDER_STAGE_TABS: Readonly<Record<OrderStageTab, readonly OrderStage[]>> = {
  [OrderStageTab.ALL]: ORDER_STAGE_ORDER,
  [OrderStageTab.ACTION]: ACTIONABLE_ORDER_STAGES,
  [OrderStageTab.TO_PURCHASE]: [OrderStage.TO_PURCHASE, OrderStage.AWAITING_PAYMENT],
  [OrderStageTab.IN_PROGRESS]: [OrderStage.BUYING, OrderStage.PURCHASED, OrderStage.SHIPPED, OrderStage.TEST_RUN],
  [OrderStageTab.DONE]: [OrderStage.DELIVERED, OrderStage.CANCELLED],
};

/** A held order is "waiting" for this long, then it is "a problem" (red).
 *  Same grace the Action Center's ORDER_TRACKING_CONVERSION_HELD uses. */
export const TRACKING_HELD_ALARM_HOURS = 12;

export function isTrackingHeldOverdue(
  shippedDetectedAt: string | Date | null | undefined,
  now: Date,
): boolean {
  if (!shippedDetectedAt) {
    return false;
  }
  const since = new Date(shippedDetectedAt).getTime();
  return now.getTime() - since >= TRACKING_HELD_ALARM_HOURS * 3_600_000;
}
```

Export it from `packages/shared/src/domain/orders/index.ts` the same way `fulfillment-state` is exported (`export * from './order-stage';`).

- [ ] **Step 5: Run the test to see it pass**

Run: `pnpm --filter @repo/shared build && pnpm --filter api exec jest src/modules/orders/order-stage.spec.ts`
Expected: PASS (all).

- [ ] **Step 6: Commit**

```bash
npx prettier --write packages/shared/src/domain/orders/order-stage.ts packages/shared/src/domain/orders/orders.types.ts apps/api/src/modules/orders/order-stage.spec.ts
npx eslint packages/shared/src/domain/orders/ apps/api/src/modules/orders/order-stage.spec.ts --max-warnings 0
git add apps/api/src/modules/orders/order-stage.spec.ts packages/shared/src/domain/orders/order-stage.ts
git commit -m "feat(orders): OrderStage — one seller-facing status derived from existing columns" -- packages/shared/src/domain/orders/order-stage.ts packages/shared/src/domain/orders/orders.types.ts packages/shared/src/domain/orders/index.ts apps/api/src/modules/orders/order-stage.spec.ts
```

---

### Task 2: `buildOrderStageSql` + exhaustive agreement guard

**Files:**
- Create: `packages/shared/src/domain/orders/order-stage-sql.ts`
- Modify: `packages/shared/src/domain/orders/index.ts` (export)
- Test: `apps/api/src/modules/orders/order-stage-sql.guard.spec.ts`

**Interfaces:**
- Consumes: `OrderStage`, `deriveOrderStage`, `SIMULATED_AMAZON_ORDER_PREFIX` (Task 1 / existing).
- Produces: `export function buildOrderStageSql(alias: string): string` — a `CASE … END` expression over `<alias>.status`, `<alias>.auto_fulfill_status`, `<alias>.amazon_order_id`, `<alias>.amazon_cancelled_at`, `<alias>.shipped_detected_at`, `<alias>.ebay_tracking_pushed_at`, returning the `OrderStage` string.

- [ ] **Step 1: Write the failing guard spec.** Copy `apps/api/src/modules/orders/fulfillment-state-sql.guard.spec.ts` to `order-stage-sql.guard.spec.ts` and change it as follows (keep `splitTopLevel`, `evaluateCase` and the CASE-parsing helpers verbatim):

```ts
import {
  AutoFulfillStatus,
  buildOrderStageSql,
  deriveOrderStage,
  OrderStage,
  OrderStatus,
  SIMULATED_AMAZON_ORDER_PREFIX,
} from '@repo/shared';

interface Row {
  status: OrderStatus;
  auto_fulfill_status: AutoFulfillStatus | null;
  amazon_order_id: string | null;
  amazon_cancelled_at: string | null;
  shipped_detected_at: string | null;
  ebay_tracking_pushed_at: string | null;
}

function evaluateCondition(condition: string, row: Row, alias: string): boolean {
  const c = condition.trim();
  if (c.startsWith('NOT (') && c.endsWith(')')) {
    return !evaluateCondition(c.slice(5, -1), row, alias);
  }
  const and = splitTopLevel(c, ' AND ');
  if (and.length > 1) {
    return and.every((part) => evaluateCondition(part, row, alias));
  }
  const col = (name: keyof Row) => `${alias}.${name}`;
  for (const name of ['amazon_cancelled_at', 'amazon_order_id', 'shipped_detected_at', 'ebay_tracking_pushed_at'] as const) {
    if (c === `${col(name)} IS NOT NULL`) {
      return row[name] !== null;
    }
    if (c === `${col(name)} IS NULL`) {
      return row[name] === null;
    }
  }
  const statusEq = c.match(new RegExp(`^${alias}\\.status = '([a-z_]+)'$`));
  if (statusEq) {
    return row.status === statusEq[1];
  }
  const statusNe = c.match(new RegExp(`^${alias}\\.status <> '([a-z_]+)'$`));
  if (statusNe) {
    return row.status !== statusNe[1];
  }
  const autoEq = c.match(new RegExp(`^${alias}\\.auto_fulfill_status = '([a-z_]+)'$`));
  if (autoEq) {
    return row.auto_fulfill_status === autoEq[1];
  }
  const autoIn = c.match(new RegExp(`^${alias}\\.auto_fulfill_status IN \\(([^)]+)\\)$`));
  if (autoIn) {
    const values = autoIn[1].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
    return row.auto_fulfill_status !== null && values.includes(row.auto_fulfill_status);
  }
  if (c === `COALESCE(${alias}.amazon_order_id, '') LIKE '${SIMULATED_AMAZON_ORDER_PREFIX}%'`) {
    return (row.amazon_order_id ?? '').startsWith(SIMULATED_AMAZON_ORDER_PREFIX);
  }
  throw new Error(`Unrecognized SQL condition — update this evaluator: ${c}`);
}

// … splitTopLevel / evaluateCase copied verbatim from fulfillment-state-sql.guard.spec.ts …

const ALIAS = 'o';
const sql = buildOrderStageSql(ALIAS);

describe('buildOrderStageSql', () => {
  const statuses = Object.values(OrderStatus);
  const autos: (AutoFulfillStatus | null)[] = [null, ...Object.values(AutoFulfillStatus)];
  const amazonIds = [null, '111-2222222-3333333', `${SIMULATED_AMAZON_ORDER_PREFIX}1`];
  const stamps = [null, '2026-09-30T00:00:00Z'];

  it('agrees with deriveOrderStage on every combination of inputs', () => {
    let combos = 0;
    for (const status of statuses)
      for (const auto of autos)
        for (const amazonId of amazonIds)
          for (const cancelledAt of stamps)
            for (const shippedAt of stamps)
              for (const pushedAt of stamps) {
                const row: Row = {
                  status,
                  auto_fulfill_status: auto,
                  amazon_order_id: amazonId,
                  amazon_cancelled_at: cancelledAt,
                  shipped_detected_at: shippedAt,
                  ebay_tracking_pushed_at: pushedAt,
                };
                const expected = deriveOrderStage({
                  status,
                  autoFulfillStatus: auto,
                  amazonOrderId: amazonId,
                  amazonCancelledAt: cancelledAt,
                  shippedDetectedAt: shippedAt,
                  ebayTrackingPushedAt: pushedAt,
                });
                expect({ row, stage: evaluateCase(sql, row, ALIAS) }).toEqual({ row, stage: expected });
                combos += 1;
              }
    expect(combos).toBe(statuses.length * autos.length * amazonIds.length * 8);
  });

  it('can produce every stage, so no branch is unreachable', () => {
    const seen = new Set<string>();
    for (const status of statuses)
      for (const auto of autos)
        for (const amazonId of amazonIds)
          for (const cancelledAt of stamps)
            for (const shippedAt of stamps)
              for (const pushedAt of stamps) {
                seen.add(
                  evaluateCase(
                    sql,
                    { status, auto_fulfill_status: auto, amazon_order_id: amazonId, amazon_cancelled_at: cancelledAt, shipped_detected_at: shippedAt, ebay_tracking_pushed_at: pushedAt },
                    ALIAS,
                  ),
                );
              }
    expect([...seen].sort()).toEqual(Object.values(OrderStage).sort());
  });

  it('honours the caller alias', () => {
    expect(buildOrderStageSql('orders')).toContain('orders.shipped_detected_at');
    expect(buildOrderStageSql('orders')).not.toContain('o.shipped_detected_at');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter api exec jest src/modules/orders/order-stage-sql.guard.spec.ts`
Expected: FAIL — `buildOrderStageSql` is not exported.

- [ ] **Step 3: Implement** `packages/shared/src/domain/orders/order-stage-sql.ts`:

```ts
// packages/shared/src/domain/orders/order-stage-sql.ts
//
// SQL twin of `deriveOrderStage` — one ordered CASE so the list filter, the
// tab counts and the Action Center all read the same stage the DTO carries.
// Grammar is deliberately tiny (no OR: nest CASE instead) because
// `order-stage-sql.guard.spec.ts` interprets it and compares it with the
// TypeScript on every input combination. Only enum constants are
// interpolated.

import { SIMULATED_AMAZON_ORDER_PREFIX } from './fulfillment-state';
import { AutoFulfillStatus, OrderStage, OrderStatus } from './orders.types';

export function buildOrderStageSql(alias: string): string {
  const status = `${alias}.status`;
  const auto = `${alias}.auto_fulfill_status`;
  const cancelled = `${alias}.amazon_cancelled_at IS NOT NULL`;
  const simulated = `COALESCE(${alias}.amazon_order_id, '') LIKE '${SIMULATED_AMAZON_ORDER_PREFIX}%'`;
  const hasAmazonOrder = `${alias}.amazon_order_id IS NOT NULL`;
  const shippedDetected = `${alias}.shipped_detected_at IS NOT NULL`;
  const pushed = `${alias}.ebay_tracking_pushed_at IS NOT NULL`;

  return `CASE
    WHEN ${cancelled} AND ${status} <> '${OrderStatus.COMPLETED}' THEN '${OrderStage.AMAZON_CANCELLED}'
    WHEN ${status} = '${OrderStatus.CANCELLED}' THEN '${OrderStage.CANCELLED}'
    WHEN ${status} = '${OrderStatus.COMPLETED}' THEN '${OrderStage.DELIVERED}'
    WHEN ${simulated} THEN '${OrderStage.TEST_RUN}'
    WHEN ${auto} = '${AutoFulfillStatus.DRY_RUN}' THEN '${OrderStage.TEST_RUN}'
    WHEN ${status} = '${OrderStatus.SHIPPED}' THEN '${OrderStage.SHIPPED}'
    WHEN ${pushed} THEN '${OrderStage.SHIPPED}'
    WHEN ${shippedDetected} THEN '${OrderStage.TRACKING_HELD}'
    WHEN ${auto} IN ('${AutoFulfillStatus.PENDING}', '${AutoFulfillStatus.RUNNING}') THEN '${OrderStage.BUYING}'
    WHEN ${hasAmazonOrder} THEN '${OrderStage.PURCHASED}'
    WHEN ${auto} IN ('${AutoFulfillStatus.BLOCKED}', '${AutoFulfillStatus.FAILED}') THEN '${OrderStage.PURCHASE_BLOCKED}'
    WHEN ${status} = '${OrderStatus.PENDING}' THEN '${OrderStage.AWAITING_PAYMENT}'
    ELSE '${OrderStage.TO_PURCHASE}'
  END`;
}
```

Add `export * from './order-stage-sql';` to `packages/shared/src/domain/orders/index.ts`.

- [ ] **Step 4: Run the guard to see it pass**

Run: `pnpm --filter @repo/shared build && pnpm --filter api exec jest src/modules/orders/order-stage-sql.guard.spec.ts src/modules/orders/order-stage.spec.ts`
Expected: PASS; the combination count printed by the first test is `6 × 8 × 3 × 8 = 1152`.

- [ ] **Step 5: Commit**

```bash
npx prettier --write packages/shared/src/domain/orders/order-stage-sql.ts apps/api/src/modules/orders/order-stage-sql.guard.spec.ts
npx eslint packages/shared/src/domain/orders/ apps/api/src/modules/orders/order-stage-sql.guard.spec.ts --max-warnings 0
git add packages/shared/src/domain/orders/order-stage-sql.ts apps/api/src/modules/orders/order-stage-sql.guard.spec.ts
git commit -m "feat(orders): buildOrderStageSql, proven equal to deriveOrderStage on 1152 rows" -- packages/shared/src/domain/orders/order-stage-sql.ts packages/shared/src/domain/orders/index.ts apps/api/src/modules/orders/order-stage-sql.guard.spec.ts
```

---

### Task 3: API — `stage` on `OrderDto`, `stage` filter, actionable-first sort, `GET /orders/stage-counts`

**Files:**
- Modify: `packages/shared/src/domain/orders/orders.types.ts` (`OrderDto` + `OrderFiltersDto` + new `OrderStageCountsDto`)
- Modify: `apps/api/src/modules/orders/orders.service.ts` (`OrderRow`, `findAll`, `mapRowToDto`, new `getStageCounts`)
- Modify: `apps/api/src/modules/orders/orders.controller.ts`
- Test: `apps/api/src/modules/orders/order-stage-api.guard.spec.ts`

**Interfaces:**
- Consumes: `OrderStage`, `buildOrderStageSql`, `deriveOrderStage`, `ACTIONABLE_ORDER_STAGES`.
- Produces:
  ```ts
  // orders.types.ts
  export interface OrderDto { …; stage: OrderStage; shippedDetectedAt?: string | null; ebayTrackingPushedAt?: string | null; }
  export interface OrderFiltersDto { …; /** One or more stages; the API ANDs them as `IN (...)`. */ stages?: OrderStage[]; }
  export type OrderStageCountsDto = Record<OrderStage, number>;
  // controller
  GET /orders?stage=a,b,c          → stages filter (unknown values dropped)
  GET /orders/stage-counts?ebayAccountId=&tracked=  → OrderStageCountsDto (every stage present, 0 when none)
  ```

- [ ] **Step 1: Write the failing guard spec** `apps/api/src/modules/orders/order-stage-api.guard.spec.ts` (source-grep, like the module's other guards):

```ts
import * as fs from 'fs';
import * as path from 'path';

function read(file: string): string {
  return fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/\r\n/g, '\n');
}

describe('orders API — stage', () => {
  const service = read('orders.service.ts');
  const controller = read('orders.controller.ts');

  it('filters the list through buildOrderStageSql, never a hand-written predicate', () => {
    const findAll = service.slice(service.indexOf('async findAll('));
    const body = findAll.slice(0, findAll.indexOf('\n  }\n'));
    expect(body).toMatch(/buildOrderStageSql\('o'\)\} = ANY\(\$/);
  });

  it('sorts actionable stages first when the caller did not choose a sort', () => {
    expect(service).toMatch(/ACTIONABLE_ORDER_STAGES/);
    expect(service).toMatch(/THEN 0 ELSE 1 END, o\.order_date DESC/);
  });

  it('maps stage onto the DTO through deriveOrderStage with both 089 timestamps', () => {
    const map = service.slice(service.indexOf('private mapRowToDto('));
    expect(map).toMatch(/stage: deriveOrderStage\(\{/);
    expect(map).toMatch(/shippedDetectedAt: row\.shipped_detected_at/);
    expect(map).toMatch(/ebayTrackingPushedAt: row\.ebay_tracking_pushed_at/);
  });

  it('counts stages with one GROUP BY over the same expression', () => {
    const counts = service.slice(service.indexOf('async getStageCounts('));
    expect(counts).toMatch(/GROUP BY 1/);
    expect(counts).toMatch(/buildOrderStageSql\('o'\)/);
  });

  it('drops unknown stage values instead of forwarding them', () => {
    expect(controller).toMatch(/Object\.values\(OrderStage\)\.includes/);
  });

  it('exposes GET /orders/stage-counts before the :id route', () => {
    const counts = controller.indexOf("@Get('stage-counts')");
    const byId = controller.indexOf("@Get(':id')");
    expect(counts).toBeGreaterThan(-1);
    expect(counts).toBeLessThan(byId);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter api exec jest src/modules/orders/order-stage-api.guard.spec.ts`
Expected: FAIL on every `it`.

- [ ] **Step 3: Shared types.** In `orders.types.ts`, on `OrderDto` add (next to `fulfillmentState`):

```ts
  /** The one seller-facing status — see `OrderStage` / `deriveOrderStage`. */
  stage: OrderStage;
  /** `orders.shipped_detected_at` (089): Amazon first observed shipped. Drives
   *  the "tracking held" badge's amber → red switch on the web. */
  shippedDetectedAt?: string | null;
  /** `orders.ebay_tracking_pushed_at` (089): eBay received the fulfillment. */
  ebayTrackingPushedAt?: string | null;
```

On `OrderFiltersDto` add:

```ts
  /** Filter to one or more stages (`?stage=a,b`). The list page's tabs send
   *  a group, the Status select sends one. Unknown values are dropped by the
   *  controller. */
  stages?: OrderStage[];
```

And a new type after `OrderFiltersDto`:

```ts
/** `GET /orders/stage-counts` — every stage is present, 0 when empty, so the
 *  tabs never render an undefined count. */
export type OrderStageCountsDto = Record<OrderStage, number>;
```

- [ ] **Step 4: Service.** In `orders.service.ts`:
  - Extend `OrderRow` with `shipped_detected_at: Date | null;` and `ebay_tracking_pushed_at: Date | null;` (the list SELECT is `o.*`, so no SELECT change).
  - In `findAll`, after the `fulfillmentState` block:

```ts
    if (filters?.stages && filters.stages.length > 0) {
      // Same CASE the DTO's `stage` is derived from, so a row can never be
      // listed under a tab whose badge it does not carry.
      conditions.push(`${buildOrderStageSql('o')} = ANY($${paramIndex}::text[])`);
      params.push(filters.stages);
      paramIndex++;
    }
```

  - Replace the `ORDER BY o.${safeSortBy} ${safeSortOrder}` with an actionable-first prefix when the caller did not pick a sort:

```ts
    // "What needs me" floats to the top of the default view; an explicit
    // sortBy from the caller is honoured as-is.
    const actionableIdx = paramIndex;
    params.push([...ACTIONABLE_ORDER_STAGES]);
    paramIndex++;
    const orderBy = filters?.sortBy
      ? `o.${safeSortBy} ${safeSortOrder}`
      : `CASE WHEN ${buildOrderStageSql('o')} = ANY($${actionableIdx}::text[]) THEN 0 ELSE 1 END, o.order_date DESC`;
```

  (Check how `safeSortBy`/`safeSortOrder` are computed just above and keep them; the two query strings — count and page — must both use the same `conditions`; only the page query gets `ORDER BY ${orderBy}`.)
  - In `mapRowToDto`, next to `fulfillmentState`:

```ts
      stage: deriveOrderStage({
        status: row.status as OrderStatus,
        autoFulfillStatus: row.auto_fulfill_status as AutoFulfillStatus | null,
        amazonOrderId: row.amazon_order_id,
        amazonCancelledAt: row.amazon_cancelled_at,
        shippedDetectedAt: row.shipped_detected_at,
        ebayTrackingPushedAt: row.ebay_tracking_pushed_at,
      }),
      shippedDetectedAt: row.shipped_detected_at ? row.shipped_detected_at.toISOString() : null,
      ebayTrackingPushedAt: row.ebay_tracking_pushed_at ? row.ebay_tracking_pushed_at.toISOString() : null,
```

  - New method:

```ts
  /** One row per stage for the list page's tabs. Store and listing-link
   *  filters apply (they narrow the whole page); stage/search/date do not
   *  (the counts describe the tabs, not the current tab). */
  async getStageCounts(
    userId: string,
    filters: Pick<OrderFiltersDto, 'ebayAccountId' | 'isTracked'>,
  ): Promise<OrderStageCountsDto> {
    const conditions = ['o.user_id = $1'];
    const params: unknown[] = [userId];
    if (filters.ebayAccountId) {
      params.push(filters.ebayAccountId);
      conditions.push(`o.ebay_account_id = $${params.length}`);
    }
    if (filters.isTracked !== undefined) {
      conditions.push(`o.listing_id IS ${filters.isTracked ? 'NOT NULL' : 'NULL'}`);
    }
    const rows = await this.databaseService.query<{ stage: string; count: string }>(
      `SELECT ${buildOrderStageSql('o')} AS stage, COUNT(*) AS count
         FROM orders o
        WHERE ${conditions.join(' AND ')}
        GROUP BY 1`,
      params,
    );
    const counts = Object.fromEntries(Object.values(OrderStage).map((s) => [s, 0])) as OrderStageCountsDto;
    for (const row of rows) {
      if ((Object.values(OrderStage) as string[]).includes(row.stage)) {
        counts[row.stage as OrderStage] = Number(row.count);
      }
    }
    return counts;
  }
```

  Import `ACTIONABLE_ORDER_STAGES`, `buildOrderStageSql`, `deriveOrderStage`, `OrderStage`, `OrderStageCountsDto` from `@repo/shared`.

- [ ] **Step 5: Controller.** In `orders.controller.ts` add `@Query('stage') stage?: string` to the list handler and build the filter:

```ts
    // `?stage=a,b` — unknown values are dropped, not forwarded (the service
    // interpolates nothing from here, but an unknown stage would silently
    // return an empty list, which reads as "no orders").
    const stages = (stage ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is OrderStage => (Object.values(OrderStage) as string[]).includes(s));
```

  and `stages: stages.length > 0 ? stages : undefined` in `filters`. Add, ABOVE the `@Get(':id')` handler:

```ts
  @Get('stage-counts')
  async getStageCounts(
    @Req() req: AuthenticatedRequest,
    @Query('ebayAccountId') ebayAccountId?: string,
    @Query('tracked') tracked?: string,
  ): Promise<OrderStageCountsDto> {
    const isTracked = tracked === 'true' ? true : tracked === 'false' ? false : undefined;
    return this.ordersService.getStageCounts(req.user.sub, { ebayAccountId, isTracked });
  }
```

- [ ] **Step 6: Run the guard + the whole orders suite**

Run: `pnpm --filter @repo/shared build && pnpm --filter api exec jest src/modules/orders && cd apps/api && npx tsc --noEmit -p tsconfig.json`
Expected: all PASS, tsc exit 0.

- [ ] **Step 7: Commit**

```bash
npx prettier --write apps/api/src/modules/orders/orders.service.ts apps/api/src/modules/orders/orders.controller.ts apps/api/src/modules/orders/order-stage-api.guard.spec.ts packages/shared/src/domain/orders/orders.types.ts
npx eslint apps/api/src/modules/orders/ packages/shared/src/domain/orders/ --max-warnings 0
git add apps/api/src/modules/orders/order-stage-api.guard.spec.ts
git commit -m "feat(orders): stage on OrderDto, ?stage= filter, actionable-first sort, GET /orders/stage-counts" -- apps/api/src/modules/orders/orders.service.ts apps/api/src/modules/orders/orders.controller.ts apps/api/src/modules/orders/order-stage-api.guard.spec.ts packages/shared/src/domain/orders/orders.types.ts
```

---

### Task 4: Action Center links and counts read the stage

**Files:**
- Modify: `apps/api/src/modules/action-center/action-center.service.ts` (the ORDERS probes: `ORDER_AMAZON_CANCELLED`, `ORDER_FULFILLMENT_BLOCKED`, `ORDER_AWAITING_PURCHASE`, `ORDER_TRACKING_CONVERSION_HELD`)
- Test: `apps/api/src/modules/action-center/action-center-stage-links.guard.spec.ts`

**Interfaces:**
- Consumes: `buildOrderStageSql`, `OrderStage` (Task 2).

- [ ] **Step 1: Write the failing spec**

```ts
import * as fs from 'fs';
import * as path from 'path';

// Every Action Center order row deep-links to the list page; since the list
// filters by `?stage=` (2026-09-29), a link still carrying
// `?fulfillmentState=` lands on an unfiltered list — the seller is told
// "3 need you" and handed all 400 again.
describe('Action Center order links', () => {
  const src = fs.readFileSync(path.join(__dirname, 'action-center.service.ts'), 'utf8').replace(/\r\n/g, '\n');

  it('links every order item with ?stage=, never ?fulfillmentState=', () => {
    expect(src).not.toMatch(/\/orders\?fulfillmentState=/);
    expect(src).toMatch(/\/orders\?stage=\$\{OrderStage\.AMAZON_CANCELLED\}/);
    expect(src).toMatch(/\/orders\?stage=\$\{OrderStage\.PURCHASE_BLOCKED\}/);
    expect(src).toMatch(/\/orders\?stage=\$\{OrderStage\.TO_PURCHASE\}/);
    expect(src).toMatch(/\/orders\?stage=\$\{OrderStage\.TRACKING_HELD\}/);
  });

  it('counts blocked, cancelled and awaiting-purchase orders through buildOrderStageSql', () => {
    expect(src).toMatch(/buildOrderStageSql\('o'\)/);
    expect(src).not.toMatch(/buildFulfillmentStateSql/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter api exec jest src/modules/action-center/action-center-stage-links.guard.spec.ts`
Expected: FAIL.

- [ ] **Step 3: Implement.** In `action-center.service.ts`:
  - Replace `const fulfillmentState = buildFulfillmentStateSql('o');` with `const stage = buildOrderStageSql('o');` and use `stage` in the three probes, comparing against `OrderStage.AMAZON_CANCELLED`, `OrderStage.PURCHASE_BLOCKED`, `OrderStage.TO_PURCHASE` respectively (the `AWAITING_PURCHASE_GRACE_HOURS` age condition stays).
  - `actionPath`s: `` `/orders?stage=${OrderStage.AMAZON_CANCELLED}` ``, `` `/orders?stage=${OrderStage.PURCHASE_BLOCKED}` ``, `` `/orders?stage=${OrderStage.TO_PURCHASE}` ``; and the `ORDER_TRACKING_CONVERSION_HELD` item's `actionPath: '/orders'` becomes `` `/orders?stage=${OrderStage.TRACKING_HELD}` ``.
  - Swap the imports (`buildOrderStageSql`, `OrderStage` in; `buildFulfillmentStateSql`, `OrderFulfillmentState` out if now unused).
  - Update the doc comment block at the top of the orders probes ("Both order-state probes count through …") to name `buildOrderStageSql`.

- [ ] **Step 4: Run the action-center + orders suites**

Run: `pnpm --filter api exec jest src/modules/action-center src/modules/orders`
Expected: PASS. (`action-center.helpers.spec.ts` does not assert paths; if any spec asserts the old `?fulfillmentState=` path, update it to `?stage=`.)

- [ ] **Step 5: Commit**

```bash
npx prettier --write apps/api/src/modules/action-center/action-center.service.ts apps/api/src/modules/action-center/action-center-stage-links.guard.spec.ts
npx eslint apps/api/src/modules/action-center/ --max-warnings 0
git add apps/api/src/modules/action-center/action-center-stage-links.guard.spec.ts
git commit -m "feat(action-center): order rows count and link by OrderStage" -- apps/api/src/modules/action-center/action-center.service.ts apps/api/src/modules/action-center/action-center-stage-links.guard.spec.ts
```

---

### Task 5: i18n — `orders.stage.*`, tabs, legend, eBay-status row, listing-link relabel (15 locales)

**Files:**
- Modify: `packages/shared/src/i18n/resources/<locale>/orders.json` for all 15 locales
- Test: `apps/api/src/modules/orders/order-stage-i18n.guard.spec.ts`

**Interfaces:**
- Produces keys (under the `orders` wrapper):
  ```
  orders.stage.<stage>.label | .meaning | .action     (action only on the 3 actionable stages + to_purchase)
  orders.stageTabs.{all,action,to_purchase,in_progress,done}
  orders.stageLegend.{title,open,columnStage,columnMeaning,columnAction}
  orders.filters.allStages
  orders.detail.ebayStatus
  orders.tracking.{tracked,untracked} (relabelled) · orders.filters.allTrackingStates (relabelled)
  ```

- [ ] **Step 1: Write the failing guard spec** `apps/api/src/modules/orders/order-stage-i18n.guard.spec.ts`:

```ts
import { OrderStage, OrderStageTab, SUPPORTED_LOCALES } from '@repo/shared';
import * as fs from 'fs';
import * as path from 'path';

const ACTION_STAGES = [OrderStage.AMAZON_CANCELLED, OrderStage.TRACKING_HELD, OrderStage.PURCHASE_BLOCKED, OrderStage.TO_PURCHASE];

function load(locale: string): Record<string, unknown> {
  const file = path.join(__dirname, '..', '..', '..', '..', '..', 'packages', 'shared', 'src', 'i18n', 'resources', locale, 'orders.json');
  return (JSON.parse(fs.readFileSync(file, 'utf8')) as { orders: Record<string, unknown> }).orders;
}

describe('orders.stage i18n', () => {
  it.each(SUPPORTED_LOCALES)('%s carries label + meaning for every stage, action where one exists', (locale) => {
    const stage = load(locale).stage as Record<string, Record<string, string>>;
    for (const s of Object.values(OrderStage)) {
      expect({ locale, s, label: stage[s]?.label }).toEqual({ locale, s, label: expect.any(String) });
      expect({ locale, s, meaning: stage[s]?.meaning }).toEqual({ locale, s, meaning: expect.any(String) });
      if (ACTION_STAGES.includes(s)) {
        expect({ locale, s, action: stage[s]?.action }).toEqual({ locale, s, action: expect.any(String) });
      }
    }
  });

  it.each(SUPPORTED_LOCALES)('%s carries every tab and the legend strings', (locale) => {
    const o = load(locale);
    const tabs = o.stageTabs as Record<string, string>;
    for (const tab of Object.values(OrderStageTab)) {
      expect({ locale, tab, label: tabs[tab] }).toEqual({ locale, tab, label: expect.any(String) });
    }
    const legend = o.stageLegend as Record<string, string>;
    for (const k of ['title', 'open', 'columnStage', 'columnMeaning', 'columnAction']) {
      expect({ locale, k, v: legend[k] }).toEqual({ locale, k, v: expect.any(String) });
    }
    expect((o.filters as Record<string, string>).allStages).toEqual(expect.any(String));
    expect((o.detail as Record<string, string>).ebayStatus).toEqual(expect.any(String));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter api exec jest src/modules/orders/order-stage-i18n.guard.spec.ts`
Expected: FAIL for every locale.

- [ ] **Step 3: Add the English block** to `packages/shared/src/i18n/resources/en/orders.json` inside `"orders": { … }` (files are LF; insert with a node script or the editor, keeping the 2-space indent), and relabel the two existing keys:

```json
"stage": {
  "amazon_cancelled": { "label": "Amazon cancelled", "meaning": "Amazon cancelled the purchase. The eBay buyer is still owed the item.", "action": "Fulfil this order another way, then link the new Amazon order." },
  "cancelled": { "label": "Cancelled", "meaning": "The eBay order was cancelled." },
  "delivered": { "label": "Delivered", "meaning": "Amazon reports the parcel delivered. Nothing left to do." },
  "test_run": { "label": "Test run", "meaning": "A dry run of automatic ordering. No Amazon order was placed and no money moved." },
  "shipped": { "label": "Shipped", "meaning": "Tracking has been sent to eBay. Waiting for delivery." },
  "tracking_held": { "label": "Tracking held", "meaning": "Amazon shipped, but the tracking has not reached eBay yet — usually the tracking conversion is still pending.", "action": "Convert the tracking, or fix the cause shown on the order." },
  "buying": { "label": "Buying on Amazon", "meaning": "Automatic ordering is placing this order on Amazon right now." },
  "purchased": { "label": "Purchased · awaiting shipment", "meaning": "An Amazon order is linked. Waiting for Amazon to ship it." },
  "purchase_blocked": { "label": "Purchase blocked", "meaning": "Automatic ordering stopped at a safety check before buying. No money moved.", "action": "Fix the reason shown, or buy on Amazon by hand and link the order." },
  "awaiting_payment": { "label": "Awaiting payment", "meaning": "The buyer has not paid yet. Do not buy until they do." },
  "to_purchase": { "label": "To purchase", "meaning": "Paid, and no Amazon order is linked yet.", "action": "Buy on Amazon and link the order." }
},
"stageTabs": { "all": "All", "action": "Needs action", "to_purchase": "To purchase", "in_progress": "In progress", "done": "Done" },
"stageLegend": { "title": "What the statuses mean", "open": "Explain the statuses", "columnStage": "Status", "columnMeaning": "What it means", "columnAction": "What you do" }
```

Also: `"filters": { …, "allStages": "All statuses", "allTrackingStates": "Linked and not linked" }`, `"tracking": { "tracked": "Linked to a listing", "untracked": "Not linked to a listing" }`, `"detail": { …, "ebayStatus": "eBay status" }`.

- [ ] **Step 4: Add the Turkish block** to `tr/orders.json` (written natively, not word-for-word):

```json
"stage": {
  "amazon_cancelled": { "label": "Amazon iptal etti", "meaning": "Amazon satın almayı iptal etti. eBay alıcısına ürün hâlâ borçlu.", "action": "Siparişi başka yoldan gönderin, sonra yeni Amazon siparişini bağlayın." },
  "cancelled": { "label": "İptal", "meaning": "eBay siparişi iptal edildi." },
  "delivered": { "label": "Teslim edildi", "meaning": "Amazon paketi teslim edildi olarak bildirdi. Yapılacak bir şey kalmadı." },
  "test_run": { "label": "Test", "meaning": "Otomatik siparişin deneme çalışması. Amazon'da sipariş verilmedi, para çıkmadı." },
  "shipped": { "label": "Kargolandı", "meaning": "Takip numarası eBay'e gönderildi. Teslimat bekleniyor." },
  "tracking_held": { "label": "Takip bekletiliyor", "meaning": "Amazon kargoladı ama takip henüz eBay'e ulaşmadı — genellikle takip dönüşümü bekliyordur.", "action": "Takibi dönüştürün ya da siparişte görünen nedeni giderin." },
  "buying": { "label": "Amazon'da alınıyor", "meaning": "Otomatik sipariş şu anda Amazon'da bu siparişi veriyor." },
  "purchased": { "label": "Satın alındı · kargo bekleniyor", "meaning": "Bir Amazon siparişi bağlı. Amazon'un kargolaması bekleniyor." },
  "purchase_blocked": { "label": "Satın alma engellendi", "meaning": "Otomatik sipariş, satın almadan önce bir güvenlik kontrolünde durdu. Para çıkmadı.", "action": "Görünen nedeni giderin ya da Amazon'dan elle alıp siparişi bağlayın." },
  "awaiting_payment": { "label": "Ödeme bekleniyor", "meaning": "Alıcı henüz ödemedi. Ödemeden önce satın almayın." },
  "to_purchase": { "label": "Satın alınacak", "meaning": "Ödendi, henüz bağlı bir Amazon siparişi yok.", "action": "Amazon'dan satın alın ve siparişi bağlayın." }
},
"stageTabs": { "all": "Tümü", "action": "Aksiyon gerekli", "to_purchase": "Satın alınacak", "in_progress": "Devam eden", "done": "Tamamlanan" },
"stageLegend": { "title": "Durumlar ne anlama geliyor", "open": "Durumları açıkla", "columnStage": "Durum", "columnMeaning": "Anlamı", "columnAction": "Siz ne yaparsınız" }
```

`"allStages": "Tüm durumlar"`, `"allTrackingStates": "Bağlı ve bağlı olmayan"`, `"tracked": "Bir listeye bağlı"`, `"untracked": "Listeye bağlı değil"`, `"ebayStatus": "eBay durumu"`.

- [ ] **Step 5: Write the other 13 locales natively** with the same key tree (the guard enforces the tree). Stage labels to use — meanings/actions are translated from the English block in the same register:

| locale | amazon_cancelled | cancelled | delivered | test_run | shipped | tracking_held | buying | purchased | purchase_blocked | awaiting_payment | to_purchase |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ru | Amazon отменил | Отменён | Доставлен | Тестовый прогон | Отправлен | Трекинг задержан | Покупается на Amazon | Куплен · ждёт отправки | Покупка заблокирована | Ожидает оплаты | Нужно купить |
| uk | Amazon скасував | Скасовано | Доставлено | Тестовий запуск | Відправлено | Трекінг затримано | Купується на Amazon | Куплено · очікує відправки | Покупку заблоковано | Очікує оплати | Потрібно купити |
| de | Von Amazon storniert | Storniert | Zugestellt | Testlauf | Versandt | Tracking zurückgehalten | Wird bei Amazon gekauft | Gekauft · wartet auf Versand | Kauf blockiert | Wartet auf Zahlung | Zu kaufen |
| fr | Annulé par Amazon | Annulée | Livrée | Essai | Expédiée | Suivi en attente | Achat sur Amazon en cours | Achetée · en attente d'expédition | Achat bloqué | En attente de paiement | À acheter |
| es | Cancelado por Amazon | Cancelado | Entregado | Prueba | Enviado | Rastreo retenido | Comprando en Amazon | Comprado · esperando envío | Compra bloqueada | Esperando pago | Por comprar |
| it | Annullato da Amazon | Annullato | Consegnato | Prova | Spedito | Tracking in attesa | Acquisto su Amazon in corso | Acquistato · in attesa di spedizione | Acquisto bloccato | In attesa di pagamento | Da acquistare |
| pt | Cancelado pela Amazon | Cancelado | Entregue | Teste | Enviado | Rastreio retido | Comprando na Amazon | Comprado · aguardando envio | Compra bloqueada | Aguardando pagamento | A comprar |
| ro | Anulat de Amazon | Anulată | Livrată | Test | Expediată | Urmărire reținută | Se cumpără pe Amazon | Cumpărată · așteaptă expedierea | Cumpărare blocată | Așteaptă plata | De cumpărat |
| az | Amazon ləğv etdi | Ləğv edildi | Çatdırıldı | Sınaq | Göndərildi | İzləmə saxlanılıb | Amazon-da alınır | Alındı · göndəriş gözlənilir | Alış bloklandı | Ödəniş gözlənilir | Alınacaq |
| hi | Amazon ने रद्द किया | रद्द | डिलीवर हुआ | टेस्ट रन | शिप हुआ | ट्रैकिंग रोकी गई | Amazon पर ख़रीदा जा रहा है | ख़रीदा गया · शिपमेंट की प्रतीक्षा | ख़रीद अवरुद्ध | भुगतान की प्रतीक्षा | ख़रीदना है |
| ur | Amazon نے منسوخ کیا | منسوخ | پہنچ گیا | آزمائشی | بھیج دیا گیا | ٹریکنگ روکی گئی | Amazon پر خریدا جا رہا ہے | خرید لیا · ترسیل کا انتظار | خریداری رک گئی | ادائیگی کا انتظار | خریدنا ہے |
| ar | ألغته أمازون | ملغى | تم التسليم | تجربة | تم الشحن | التتبع معلّق | جارٍ الشراء من أمازون | تم الشراء · بانتظار الشحن | الشراء محظور | بانتظار الدفع | للشراء |
| zh | Amazon 已取消 | 已取消 | 已送达 | 测试运行 | 已发货 | 物流信息暂缓 | 正在 Amazon 下单 | 已购买 · 等待发货 | 下单被阻止 | 等待付款 | 待购买 |

Tabs (all / action / to_purchase / in_progress / done) and legend strings follow the same pattern per locale (e.g. de: `Alle / Handlungsbedarf / Zu kaufen / In Bearbeitung / Erledigt`; legend `Was die Status bedeuten / Status erklären / Status / Bedeutung / Was Sie tun`).

- [ ] **Step 6: Run the guard**

Run: `pnpm --filter @repo/shared build && pnpm --filter api exec jest src/modules/orders/order-stage-i18n.guard.spec.ts`
Expected: PASS for all 15.

- [ ] **Step 7: Commit**

```bash
npx prettier --write packages/shared/src/i18n/resources/*/orders.json apps/api/src/modules/orders/order-stage-i18n.guard.spec.ts
git add apps/api/src/modules/orders/order-stage-i18n.guard.spec.ts
git commit -m "i18n(orders): stage labels, meanings, actions, tabs and legend in 15 locales" -- packages/shared/src/i18n/resources/*/orders.json apps/api/src/modules/orders/order-stage-i18n.guard.spec.ts
```

---

### Task 6: Web — stage presentation map, `OrderStageBadge`, `OrderStageLegend`

**Files:**
- Create: `apps/web/src/features/orders/shared/order-stage.ts` (pure presentation map)
- Create: `apps/web/src/features/orders/shared/OrderStageBadge/{OrderStageBadge.component.tsx,OrderStageBadge.container.tsx,OrderStageBadge.style.ts,OrderStageBadge.types.ts,index.ts}`
- Create: `apps/web/src/features/orders/shared/OrderStageLegend/{OrderStageLegend.component.tsx,OrderStageLegend.container.tsx,OrderStageLegend.style.ts,OrderStageLegend.types.ts,index.ts}`
- Test: `apps/web/src/features/orders/shared/order-stage.test.ts` (Vitest)

**Interfaces:**
- Produces:
  ```ts
  // order-stage.ts
  export interface OrderStagePresentation { variant: BadgeVariant; icon: IconName; }
  export function orderStagePresentation(stage: OrderStage, opts: { shippedDetectedAt?: string | null; now: Date }): OrderStagePresentation;
  export function orderStageHasAction(stage: OrderStage): boolean; // the 4 with an `action` string
  // OrderStageBadge
  export interface OrderStageBadgeProps { stage: OrderStage; shippedDetectedAt?: string | null; size?: 'xs' | 'sm' | 'md'; withTooltip?: boolean; }
  // OrderStageLegend — a Popover triggered by a `help-circle` IconButton (props: none)
  ```

- [ ] **Step 1: Write the failing Vitest** `apps/web/src/features/orders/shared/order-stage.test.ts`:

```ts
import { OrderStage } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { orderStageHasAction, orderStagePresentation } from './order-stage';

const now = new Date('2026-09-30T12:00:00Z');

describe('orderStagePresentation', () => {
  it('gives every stage an icon and a badge variant', () => {
    for (const stage of Object.values(OrderStage)) {
      const p = orderStagePresentation(stage, { now });
      expect({ stage, icon: p.icon, variant: p.variant }).toEqual({ stage, icon: expect.any(String), variant: expect.any(String) });
    }
  });

  it('renders the actionable stages red, "to purchase" amber', () => {
    expect(orderStagePresentation(OrderStage.PURCHASE_BLOCKED, { now }).variant).toBe('error');
    expect(orderStagePresentation(OrderStage.AMAZON_CANCELLED, { now }).variant).toBe('error');
    expect(orderStagePresentation(OrderStage.TO_PURCHASE, { now }).variant).toBe('warning');
  });

  it('keeps a held tracking amber for 12 hours, then red', () => {
    expect(orderStagePresentation(OrderStage.TRACKING_HELD, { shippedDetectedAt: '2026-09-30T02:00:00Z', now }).variant).toBe('warning');
    expect(orderStagePresentation(OrderStage.TRACKING_HELD, { shippedDetectedAt: '2026-09-29T23:00:00Z', now }).variant).toBe('error');
  });

  it('knows which stages carry a "what you do" sentence', () => {
    expect(orderStageHasAction(OrderStage.TO_PURCHASE)).toBe(true);
    expect(orderStageHasAction(OrderStage.TRACKING_HELD)).toBe(true);
    expect(orderStageHasAction(OrderStage.SHIPPED)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter web exec vitest run src/features/orders/shared/order-stage.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** `apps/web/src/features/orders/shared/order-stage.ts`:

```ts
import { ACTIONABLE_ORDER_STAGES, isTrackingHeldOverdue, OrderStage } from '@repo/shared';
import type { BadgeVariant, IconName } from '@repo/ui';

export interface OrderStagePresentation {
  variant: BadgeVariant;
  icon: IconName;
}

// Colours group by MEANING (red = money/reputation at risk, amber = your
// work, blue/primary/secondary = the system is working, green/grey = done);
// the icon and the legend tell the stages within a group apart.
const PRESENTATION: Record<OrderStage, OrderStagePresentation> = {
  [OrderStage.AMAZON_CANCELLED]: { variant: 'error', icon: 'x-circle' },
  [OrderStage.CANCELLED]: { variant: 'neutral', icon: 'x-circle' },
  [OrderStage.DELIVERED]: { variant: 'success', icon: 'package-check' },
  [OrderStage.TEST_RUN]: { variant: 'neutral', icon: 'info' },
  [OrderStage.SHIPPED]: { variant: 'info', icon: 'truck' },
  [OrderStage.TRACKING_HELD]: { variant: 'warning', icon: 'alert-circle' },
  [OrderStage.BUYING]: { variant: 'secondary', icon: 'loader' },
  [OrderStage.PURCHASED]: { variant: 'primary', icon: 'shopping-bag' },
  [OrderStage.PURCHASE_BLOCKED]: { variant: 'error', icon: 'alert-triangle' },
  [OrderStage.AWAITING_PAYMENT]: { variant: 'neutral', icon: 'circle-dollar-sign' },
  [OrderStage.TO_PURCHASE]: { variant: 'warning', icon: 'shopping-cart' },
};

export function orderStagePresentation(
  stage: OrderStage,
  opts: { shippedDetectedAt?: string | null; now: Date },
): OrderStagePresentation {
  const base = PRESENTATION[stage];
  if (stage === OrderStage.TRACKING_HELD && isTrackingHeldOverdue(opts.shippedDetectedAt, opts.now)) {
    return { ...base, variant: 'error' };
  }
  return base;
}

const STAGES_WITH_ACTION: readonly OrderStage[] = [...ACTIONABLE_ORDER_STAGES, OrderStage.TO_PURCHASE];

export function orderStageHasAction(stage: OrderStage): boolean {
  return STAGES_WITH_ACTION.includes(stage);
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm --filter @repo/shared build && pnpm --filter web exec vitest run src/features/orders/shared/order-stage.test.ts`
Expected: PASS.

- [ ] **Step 5: `OrderStageBadge`** (4-file split; the container resolves `t()` strings and the presentation, the component only renders).

`OrderStageBadge.types.ts`:
```ts
import type { OrderStage } from '@repo/shared';
import type { BadgeSize, BadgeVariant, IconName } from '@repo/ui';

export interface OrderStageBadgeProps {
  stage: OrderStage;
  shippedDetectedAt?: string | null;
  size?: BadgeSize;
  /** Hover shows the stage's `meaning` (and `action`). Off in the legend, where the text is already visible. */
  withTooltip?: boolean;
}

export interface OrderStageBadgeViewProps {
  label: string;
  tooltip: string | null;
  variant: BadgeVariant;
  icon: IconName;
  size: BadgeSize;
}
```

`OrderStageBadge.style.ts`:
```ts
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/** Icon + label inside the Badge, on one line. */
export const Inner = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  white-space: nowrap;
`;
```

`OrderStageBadge.component.tsx`:
```tsx
import { Badge, Icon, Tooltip } from '@repo/ui';
import React from 'react';

import * as S from './OrderStageBadge.style';
import type { OrderStageBadgeViewProps } from './OrderStageBadge.types';

export const OrderStageBadgeComponent: React.FC<OrderStageBadgeViewProps> = ({ label, tooltip, variant, icon, size }) => {
  const badge = (
    <Badge variant={variant} size={size} isPill>
      <S.Inner>
        <Icon name={icon} size={size === 'md' ? 16 : 12} />
        {label}
      </S.Inner>
    </Badge>
  );
  return tooltip ? <Tooltip content={tooltip}>{badge}</Tooltip> : badge;
};
```
(`Tooltip` takes `content: React.ReactNode` + `children` — verified in `packages/ui/src/molecules/Tooltip/Tooltip.types.ts`.)

`OrderStageBadge.container.tsx`:
```tsx
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { orderStageHasAction, orderStagePresentation } from '../order-stage';

import { OrderStageBadgeComponent } from './OrderStageBadge.component';
import type { OrderStageBadgeProps } from './OrderStageBadge.types';

export const OrderStageBadge: React.FC<OrderStageBadgeProps> = ({ stage, shippedDetectedAt, size = 'xs', withTooltip = true }) => {
  const { t } = useTranslation(['orders']);
  const presentation = useMemo(
    () => orderStagePresentation(stage, { shippedDetectedAt, now: new Date() }),
    [stage, shippedDetectedAt],
  );
  const tooltip = useMemo(() => {
    if (!withTooltip) {
      return null;
    }
    const meaning = t(`orders.stage.${stage}.meaning`);
    return orderStageHasAction(stage) ? `${meaning} ${t(`orders.stage.${stage}.action`)}` : meaning;
  }, [stage, t, withTooltip]);
  return (
    <OrderStageBadgeComponent
      label={t(`orders.stage.${stage}.label`)}
      tooltip={tooltip}
      variant={presentation.variant}
      icon={presentation.icon}
      size={size}
    />
  );
};
```

`index.ts`: `export { OrderStageBadge } from './OrderStageBadge.container'; export type { OrderStageBadgeProps } from './OrderStageBadge.types';`

- [ ] **Step 6: `OrderStageLegend`** (Popover with a three-column table of every stage).

`OrderStageLegend.types.ts`:
```ts
import type { OrderStage } from '@repo/shared';

export interface OrderStageLegendRow {
  stage: OrderStage;
  meaning: string;
  action: string | null;
}

export interface OrderStageLegendViewProps {
  rows: OrderStageLegendRow[];
  title: string;
  openLabel: string;
  columnStage: string;
  columnMeaning: string;
  columnAction: string;
}
```

`OrderStageLegend.style.ts`:
```ts
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Panel = styled.div`
  width: min(32rem, calc(100vw - 2 * ${tkn('spacing.md')}));
  max-height: 70vh;
  overflow: auto;
  padding: ${tkn('spacing.md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(9rem, auto) 1fr 1fr;
  gap: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  align-items: start;

  @media (max-width: ${tkn('breakpoints.sm')}) {
    grid-template-columns: 1fr;
  }
`;
```

`OrderStageLegend.component.tsx`:
```tsx
import { Icon, IconButton, Popover, Text } from '@repo/ui';
import React from 'react';

import { OrderStageBadge } from '../OrderStageBadge';

import * as S from './OrderStageLegend.style';
import type { OrderStageLegendViewProps } from './OrderStageLegend.types';

export const OrderStageLegendComponent: React.FC<OrderStageLegendViewProps> = ({ rows, title, openLabel, columnStage, columnMeaning, columnAction }) => (
  <Popover
    trigger={
      <IconButton variant="ghost" aria-label={openLabel} title={openLabel}>
        <Icon name="info" size={16} />
      </IconButton>
    }
    content={
      <S.Panel role="dialog" aria-label={title}>
        <Text variant="h5">{title}</Text>
        <S.Grid>
          <Text variant="caption" color="text.tertiary">{columnStage}</Text>
          <Text variant="caption" color="text.tertiary">{columnMeaning}</Text>
          <Text variant="caption" color="text.tertiary">{columnAction}</Text>
          {rows.map((row) => (
            <React.Fragment key={row.stage}>
              <OrderStageBadge stage={row.stage} size="sm" withTooltip={false} />
              <Text variant="body-sm">{row.meaning}</Text>
              <Text variant="body-sm" color="text.secondary">{row.action ?? '—'}</Text>
            </React.Fragment>
          ))}
        </S.Grid>
      </S.Panel>
    }
  />
);
```
(`IconButton` — verified — takes `variant: 'ghost' | 'outlined' | 'elevated'` plus native button attributes, and renders its `children` as the icon; the icon set has `info` but no `help-circle`.)

`OrderStageLegend.container.tsx`:
```tsx
import { ORDER_STAGE_ORDER } from '@repo/shared';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { orderStageHasAction } from '../order-stage';

import { OrderStageLegendComponent } from './OrderStageLegend.component';
import type { OrderStageLegendRow } from './OrderStageLegend.types';

export const OrderStageLegend: React.FC = () => {
  const { t } = useTranslation(['orders']);
  const rows = useMemo<OrderStageLegendRow[]>(
    () =>
      ORDER_STAGE_ORDER.map((stage) => ({
        stage,
        meaning: t(`orders.stage.${stage}.meaning`),
        action: orderStageHasAction(stage) ? t(`orders.stage.${stage}.action`) : null,
      })),
    [t],
  );
  return (
    <OrderStageLegendComponent
      rows={rows}
      title={t('orders.stageLegend.title')}
      openLabel={t('orders.stageLegend.open')}
      columnStage={t('orders.stageLegend.columnStage')}
      columnMeaning={t('orders.stageLegend.columnMeaning')}
      columnAction={t('orders.stageLegend.columnAction')}
    />
  );
};
```

`index.ts`: `export { OrderStageLegend } from './OrderStageLegend.container';`

- [ ] **Step 7: Typecheck + lint**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json | grep -v "packages/ui/src/atoms/Icon" | grep "error TS"; cd ../.. && npx eslint apps/web/src/features/orders/shared/ --max-warnings 0`
Expected: no errors printed; LINT clean. (The three `dominantBaseline` errors in `packages/ui` icons are pre-existing.)

- [ ] **Step 8: Commit**

```bash
npx prettier --write apps/web/src/features/orders/shared/order-stage.ts apps/web/src/features/orders/shared/order-stage.test.ts apps/web/src/features/orders/shared/OrderStageBadge/*.ts apps/web/src/features/orders/shared/OrderStageBadge/*.tsx apps/web/src/features/orders/shared/OrderStageLegend/*.ts apps/web/src/features/orders/shared/OrderStageLegend/*.tsx
git add apps/web/src/features/orders/shared/order-stage.ts apps/web/src/features/orders/shared/order-stage.test.ts apps/web/src/features/orders/shared/OrderStageBadge apps/web/src/features/orders/shared/OrderStageLegend
git commit -m "feat(orders): OrderStageBadge (icon + tooltip) and OrderStageLegend popover" -- apps/web/src/features/orders/shared/order-stage.ts apps/web/src/features/orders/shared/order-stage.test.ts apps/web/src/features/orders/shared/OrderStageBadge apps/web/src/features/orders/shared/OrderStageLegend
```

---

### Task 7: Web — orders list: counted tabs, Status select, one Status column

**Files:**
- Modify: `apps/web/src/features/orders/api/orders.api.ts` (add `getOrderStageCounts`)
- Modify: `apps/web/src/features/orders/all/hooks/useOrdersFilters.ts`
- Modify: `apps/web/src/features/orders/all/hooks/useOrdersColumns.tsx`
- Modify: `apps/web/src/features/orders/all/OrdersAllPage.{container,component,types}.tsx|ts`
- Modify: `apps/web/src/features/orders/all/OrdersAllPage.style.ts` (a `TabsRow` wrapper)

**Interfaces:**
- Consumes: `OrderStage`, `OrderStageTab`, `ORDER_STAGE_TABS`, `OrderStageCountsDto`, `OrderStageBadge`, `OrderStageLegend`.
- Produces (hook return additions): `tab: OrderStageTab`, `tabItems: TabNavItem[]` (label with count), `handleTabChange(tabId: string)`, `stage: string` (the select), `stageOptions`, `handleStageChange`; removes `status/statusOptions/handleStatusChange` and `fulfillmentState/fulfillmentStateOptions/handleFulfillmentStateChange`.

- [ ] **Step 1: API slice.** In `orders.api.ts` add:

```ts
    getOrderStageCounts: builder.query<OrderStageCountsDto, { ebayAccountId?: string; isTracked?: boolean } | void>({
      query: (args) => {
        const params = new URLSearchParams();
        if (args?.ebayAccountId) {
          params.set('ebayAccountId', args.ebayAccountId);
        }
        if (args?.isTracked !== undefined) {
          params.set('tracked', String(args.isTracked));
        }
        const qs = params.toString();
        return `/orders/stage-counts${qs ? `?${qs}` : ''}`;
      },
      providesTags: ['Orders'],
    }),
```
(`'Orders'` is the tag `getOrders` already provides, so a mutation that invalidates the list also refreshes the counts.) Export `useGetOrderStageCountsQuery`.

- [ ] **Step 2: Filters hook.** In `useOrdersFilters.ts`:
  - Replace the `fulfillmentState` URL/state with `stage`: `const stageFromUrl = searchParams.get('stage') ?? ''`, `const [stage, setStage] = useState(stageFromUrl)`, the same `useEffect` resync (Action Center links now carry `?stage=`).
  - Tab state, derived from `stage` and URL: `const tabFromUrl = searchParams.get('tab') ?? ''` → `const [tab, setTab] = useState<OrderStageTab>(isTab(tabFromUrl) ? tabFromUrl : OrderStageTab.ALL)` where `isTab = (v: string): v is OrderStageTab => (Object.values(OrderStageTab) as string[]).includes(v)`.
  - Delete `statusOptions`/`status`/`handleStatusChange` and `fulfillmentStateOptions`/`handleFulfillmentStateChange`.
  - `stageOptions`:
```ts
  const stageOptions = useMemo(
    () => [
      { value: '', label: t('orders.filters.allStages') },
      ...ORDER_STAGE_ORDER.map((s) => ({ value: s, label: t(`orders.stage.${s}.label`) })),
    ],
    [t],
  );
```
  - Server query: `stages` = the select's single stage when set, else the tab's group when the tab is not ALL:
```ts
      stages: stage
        ? [stage as OrderStage]
        : tab === OrderStageTab.ALL
          ? undefined
          : [...ORDER_STAGE_TABS[tab]],
```
  - Handlers: `handleStageChange(value)` sets `stage`, resets page, writes `?stage=` (or deletes it) into the URL like `handleTrackingStateChange` does. `handleTabChange(tabId)` sets `tab` (validated with `isTab`), clears `stage`, resets page, writes `?tab=` (deleting `stage`).
  - `hasActiveFilters` includes `stage` and `tab !== OrderStageTab.ALL`; `handleClearFilters` resets both.
  - Return `tab, handleTabChange, stage, stageOptions, handleStageChange` (plus existing store/tracking/search bits).

- [ ] **Step 3: Container.** In `OrdersAllPage.container.tsx`:
  - `const { data: stageCounts } = useGetOrderStageCountsQuery({ ebayAccountId: filters.ebayAccountId || undefined, isTracked: filters.serverQuery.isTracked });`
  - Build `tabItems`:
```ts
  const tabItems = useMemo<TabNavItem[]>(() => {
    const countFor = (tabId: OrderStageTab): number =>
      stageCounts ? ORDER_STAGE_TABS[tabId].reduce((sum, s) => sum + (stageCounts[s] ?? 0), 0) : 0;
    return Object.values(OrderStageTab).map((tabId) => ({
      id: tabId,
      label: tabId === OrderStageTab.ALL ? t(`orders.stageTabs.${tabId}`) : `${t(`orders.stageTabs.${tabId}`)} (${countFor(tabId)})`,
    }));
  }, [stageCounts, t]);
```
  - Default tab once, when counts arrive and nothing was chosen in the URL: if `tab === OrderStageTab.ALL`, no `?tab`/`?stage` in the URL and `countFor(ACTION) > 0` → `handleTabChange(OrderStageTab.ACTION)`. Guard it with a `useRef` so it runs once per mount (a seller who clicks "All" must not be bounced back).
  - Pass `tab`, `tabItems`, `onTabChange`, `stage`, `stageOptions`, `onStageChange` to the component; drop the status/fulfillment props.

- [ ] **Step 4: Component + types + style.** In `OrdersAllPage.types.ts` replace `status/statusOptions/onStatusChange` and `fulfillmentState/fulfillmentStateOptions/onFulfillmentStateChange` with:
```ts
  tab: OrderStageTab;
  tabItems: TabNavItem[];
  onTabChange: (tabId: string) => void;
  stage: string;
  stageOptions: { value: string; label: string }[];
  onStageChange: (value: string | number) => void;
```
  In `OrdersAllPage.style.ts` add:
```ts
export const TabsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.sm')};
`;
```
  In `OrdersAllPage.component.tsx`: above `<S.FilterBar>` render
```tsx
      <S.TabsRow>
        <TabNav items={tabItems} value={tab} onChange={onTabChange} variant="underline" ariaLabel={t('orders.stageLegend.columnStage')} />
        <OrderStageLegend />
      </S.TabsRow>
```
  and in the filter bar replace the eBay-status `Select` and the fulfillment `Select` with ONE `Select value={stage} onChange={onStageChange} options={stageOptions} placeholder={t('orders.filters.allStages')} size="medium" fullWidth`. Keep store, listing-link (`trackingStateOptions`, now relabelled by Task 5) and search.

- [ ] **Step 5: Columns.** In `useOrdersColumns.tsx` delete the `status` column and replace the `fulfillmentState` column with:

```tsx
      {
        // ONE column: the stage badge, then the one line of context that makes
        // it actionable — the blocked reason, the Amazon order id, the tracking
        // number. The eBay status is a fact, not a status, and lives on the
        // detail page's eBay card.
        key: 'stage',
        header: t('orders.stageLegend.columnStage'),
        width: '14rem',
        render: (_value, order) => {
          const reasonLabel =
            order.stage === OrderStage.PURCHASE_BLOCKED && order.autoFulfillBlockedReason
              ? t(`orders.autoFulfill.reason.${order.autoFulfillBlockedReason}`)
              : undefined;
          return (
            <S.AutoFulfillCell>
              <OrderStageBadge stage={order.stage} shippedDetectedAt={order.shippedDetectedAt} size="xs" />
              {reasonLabel && (
                <Text variant="caption" color="text.secondary">{reasonLabel}</Text>
              )}
              {order.amazonOrderId && !order.isSimulated && (
                <Text variant="caption" color="text.tertiary" numeric>{order.amazonOrderId}</Text>
              )}
              {order.stage === OrderStage.SHIPPED && (order.convertedTrackingNumber || order.amazonTrackingNumber) && (
                <Text variant="caption" color="text.tertiary" numeric>{order.convertedTrackingNumber || order.amazonTrackingNumber}</Text>
              )}
            </S.AutoFulfillCell>
          );
        },
      },
```
  (Check the DTO's simulated flag name — `isSimulated` per `orders.types.ts:201`.) Remove the now-unused imports (`StatusBadge`, `orderStatusToBadgeStatus`, `fulfillmentStateToBadgeVariant`, `Badge`).

- [ ] **Step 6: Typecheck, lint, Vitest**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json | grep -v "packages/ui/src/atoms/Icon" | grep "error TS"; npx vitest run; cd ../.. && npx eslint apps/web/src/features/orders/ --max-warnings 0`
Expected: no TS errors printed, Vitest green, lint clean.

- [ ] **Step 7: Verify in the browser** (`pnpm dev`, `/tr/orders`, then 375 px width): tabs show counts and switch the list; the Status select narrows within a tab; `?stage=purchase_blocked` from the Action Center lands filtered; the legend opens from `?` and scrolls on a phone; rows needing action sort first.

- [ ] **Step 8: Commit**

```bash
npx prettier --write apps/web/src/features/orders/api/orders.api.ts apps/web/src/features/orders/all/hooks/useOrdersFilters.ts apps/web/src/features/orders/all/hooks/useOrdersColumns.tsx apps/web/src/features/orders/all/OrdersAllPage.container.tsx apps/web/src/features/orders/all/OrdersAllPage.component.tsx apps/web/src/features/orders/all/OrdersAllPage.types.ts apps/web/src/features/orders/all/OrdersAllPage.style.ts
git commit -m "feat(orders): list shows one stage column, counted tabs and a Status filter" -- apps/web/src/features/orders/api/orders.api.ts apps/web/src/features/orders/all/
```

---

### Task 8: Web — order detail hero shows the stage; eBay status becomes an info row

**Files:**
- Modify: `apps/web/src/features/orders/details/OrderDetailsPage.component.tsx` (hero `S.StatusBadgeSlot`, eBay card)
- Modify: `apps/web/src/features/orders/details/OrderDetailsPage.container.tsx` (`stageMeaning`, `stageAction`)
- Modify: `apps/web/src/features/orders/details/OrderDetailsPage.types.ts`
- Modify: `apps/web/src/features/orders/shared/fulfillment-state.ts` (delete `fulfillmentStateToBadgeVariant`/`fulfillmentStateNoticeKey`/`fulfillmentStateToIcon` if nothing else imports them — grep first)

**Interfaces:**
- Consumes: `OrderStageBadge`, `orderStageHasAction`.
- Produces props: `stageMeaning: string`, `stageAction: string | null`.

- [ ] **Step 1: Container.** Add:
```ts
  const stageMeaning = useMemo(() => (order ? t(`orders.stage.${order.stage}.meaning`) : ''), [order, t]);
  const stageAction = useMemo(
    () => (order && orderStageHasAction(order.stage) ? t(`orders.stage.${order.stage}.action`) : null),
    [order, t],
  );
```
  and pass both. Remove `statusLabel` if the hero no longer uses it (it is reused by the eBay card row below — keep it).

- [ ] **Step 2: Component.** Replace the hero's `S.StatusBadgeSlot` contents with:
```tsx
          <S.StatusBadgeSlot>
            <OrderStageBadge stage={order.stage} shippedDetectedAt={order.shippedDetectedAt} size="md" withTooltip={false} />
          </S.StatusBadgeSlot>
          <Text variant="body-sm" color="text.secondary">{stageMeaning}</Text>
          {stageAction ? (
            <Text variant="body-sm" weight="semibold">{stageAction}</Text>
          ) : null}
```
  Keep the existing blocked-reason `InfoMessage` (it names the reason); drop the `fulfillmentStateNoticeKey` notice (the meaning sentence replaces it). In the eBay summary card, add as the FIRST row of "What your buyer paid":
```tsx
              <Meta icon="info" label={t('orders.detail.ebayStatus')}>
                <Text variant="body" weight="semibold">{statusLabel}</Text>
              </Meta>
```
  (`tag` is not in the icon set; `info` is.)

- [ ] **Step 3: Typecheck + lint + look**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json | grep -v "packages/ui/src/atoms/Icon" | grep "error TS"; cd ../.. && npx eslint apps/web/src/features/orders/ --max-warnings 0`
Then open `/tr/orders/<id>` for the first live order: hero reads "Satın alındı · kargo bekleniyor" with the meaning sentence; eBay card's first row reads "eBay durumu — Kargo Bekleniyor".

- [ ] **Step 4: Commit**

```bash
npx prettier --write apps/web/src/features/orders/details/OrderDetailsPage.component.tsx apps/web/src/features/orders/details/OrderDetailsPage.container.tsx apps/web/src/features/orders/details/OrderDetailsPage.types.ts apps/web/src/features/orders/shared/fulfillment-state.ts
git commit -m "feat(orders): detail hero shows the stage and its meaning; eBay status becomes an info row" -- apps/web/src/features/orders/details/OrderDetailsPage.component.tsx apps/web/src/features/orders/details/OrderDetailsPage.container.tsx apps/web/src/features/orders/details/OrderDetailsPage.types.ts apps/web/src/features/orders/shared/fulfillment-state.ts
```

---

### Task 9: Dashboard order card uses the stage badge

**Files:**
- Modify: `apps/web/src/features/orders/shared/order-card.mapper.ts` (map `stage` + `shippedDetectedAt` instead of `status`/`statusLabel`)
- Modify: `apps/web/src/features/orders/shared/OrderCard/OrderCard.{component.tsx,types.ts}`

- [ ] **Step 1:** In `OrderCard.types.ts` replace `status: OrderStatus; statusLabel: string;` with `stage: OrderStage; shippedDetectedAt?: string | null;`. In the mapper set `stage: order.stage, shippedDetectedAt: order.shippedDetectedAt`. In `OrderCard.component.tsx` replace the `StatusBadge` with `<OrderStageBadge stage={stage} shippedDetectedAt={shippedDetectedAt} size="sm" />` and drop the `orderStatusToBadgeStatus` import. Delete `orderStatusToBadgeStatus` from `order-status.ts` if nothing else imports it (`grep -rn orderStatusToBadgeStatus apps/web/src`).

- [ ] **Step 2: Typecheck + lint**

Run: `cd apps/web && npx tsc --noEmit -p tsconfig.json | grep -v "packages/ui/src/atoms/Icon" | grep "error TS"; cd ../.. && npx eslint apps/web/src/features/orders/shared/ --max-warnings 0`

- [ ] **Step 3: Commit**

```bash
npx prettier --write apps/web/src/features/orders/shared/order-card.mapper.ts apps/web/src/features/orders/shared/OrderCard/OrderCard.component.tsx apps/web/src/features/orders/shared/OrderCard/OrderCard.types.ts apps/web/src/features/orders/shared/order-status.ts
git commit -m "feat(orders): dashboard order card shows the stage" -- apps/web/src/features/orders/shared/
```

---

### Task 10: Demo fixtures, CLAUDE.md, final verification

**Files:**
- Modify: `apps/web/src/features/demo/demoData.ts` (every demo `OrderDto` gets `stage` via `deriveOrderStage`, plus `shippedDetectedAt`/`ebayTrackingPushedAt` where the fixture is shipped)
- Modify: `apps/web/src/features/demo/demoBaseQuery.ts` (answer `GET /orders/stage-counts` by counting the demo orders' `stage`)
- Modify: `CLAUDE.md` ("Order Management" → a new "Order stages" paragraph; the Action Center section's `?fulfillmentState=` mentions → `?stage=`; the "Orders list shows ONE unified fulfillment column" sentence)

- [ ] **Step 1: Demo data.** Where each demo order object is built (around `demoData.ts:703`, where `fulfillmentState` is chosen), add:
```ts
    stage: deriveOrderStage({
      status,
      autoFulfillStatus,
      amazonOrderId,
      amazonCancelledAt,
      shippedDetectedAt,
      ebayTrackingPushedAt,
    }),
    shippedDetectedAt,
    ebayTrackingPushedAt,
```
  with `shippedDetectedAt`/`ebayTrackingPushedAt` set to the order date + a few hours on the fixtures whose `status` is `shipped`/`completed`, `null` otherwise — so the demo shows every stage at least once (pin one fixture per stage: one `tracking_held` with `shippedDetectedAt` 2 h ago, one 20 h ago).

- [ ] **Step 2: Demo query.** In `demoBaseQuery.ts`, next to the `/orders` branch:
```ts
  if (path === '/orders/stage-counts') {
    const counts = Object.fromEntries(Object.values(OrderStage).map((s) => [s, 0])) as Record<OrderStage, number>;
    for (const order of DEMO_ORDERS) {
      counts[order.stage] += 1;
    }
    return { data: counts };
  }
```
  and make the `/orders` branch honour `stage` (comma list) the way it honours `fulfillmentState` today.

- [ ] **Step 3: CLAUDE.md.** Under "Order Management" add:

> **Order stages (2026-09-29).** `OrderStage` (`packages/shared/src/domain/orders/order-stage.ts`, pure `deriveOrderStage`, SQL twin `buildOrderStageSql`, proven equal on 1152 rows by `order-stage-sql.guard.spec.ts`) is the ONE seller-facing status: amazon_cancelled → cancelled → delivered → test_run → shipped → tracking_held → buying → purchased → purchase_blocked → awaiting_payment → to_purchase, first match wins. `OrderDto.stage` carries it; `GET /orders?stage=a,b` filters through the same CASE; `GET /orders/stage-counts` feeds the list page's counted tabs (`OrderStageTab`, `ORDER_STAGE_TABS`); the default list sort puts `ACTIONABLE_ORDER_STAGES` first. The web renders it with `OrderStageBadge` (icon + tooltip; `tracking_held` turns from amber to red after `TRACKING_HELD_ALARM_HOURS` = 12, web-side from `shippedDetectedAt`) and explains it with `OrderStageLegend`. Copy is `orders.stage.<stage>.{label,meaning,action}` in all 15 locales. The eBay status (`OrderStatus`) is still stored and synced unchanged; it is shown only as an info row on the detail page. `OrderFulfillmentState` stays for the Action Center's non-order probes and the API's back-compat `?fulfillmentState=` filter; new code reads the stage. Design: `docs/superpowers/specs/2026-09-29-order-stages-design.md`.

  Fix the Action Center paragraph ("every one of its order rows links here with `?fulfillmentState=`") to say `?stage=`.

- [ ] **Step 4: Full verification**

Run:
```bash
pnpm --filter @repo/shared build && pnpm --filter @repo/ui build
pnpm --filter api test
pnpm --filter web test
cd apps/api && npx tsc --noEmit -p tsconfig.json && cd ../web && npx tsc --noEmit -p tsconfig.json | grep -v "packages/ui/src/atoms/Icon" | grep -c "error TS"
cd ../.. && pnpm lint
```
Expected: api and web tests green, api tsc exit 0, web error count 0, lint clean. Then enter the demo (`/` → "Live demo") and open Orders: tabs carry counts, every stage appears once, the legend opens.

- [ ] **Step 5: Commit and push development only**

```bash
npx prettier --write apps/web/src/features/demo/demoData.ts apps/web/src/features/demo/demoBaseQuery.ts
git commit -m "feat(orders): demo fixtures carry stages; CLAUDE.md documents the stage model" -- apps/web/src/features/demo/demoData.ts apps/web/src/features/demo/demoBaseQuery.ts CLAUDE.md
git push origin development
```
No UAT/main merge — the operator decides when.
