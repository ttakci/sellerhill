# Automated Amazon Fulfillment (A2) Implementation Plan

> **⚠ Historical document — implemented, then partially superseded
> (2026-07-28).** The per-user *residential* proxy stack this plan describes
> was refactored to a fixed ISP proxy pool (`proxies` table, migration `057`,
> one static proxy per user); tracking cadence is env-tunable with shipped
> default 24h; and the checkout/tracking pipeline gained cart-hygiene steps,
> a `cart` blocked reason, and Amazon-cancel handling. See CLAUDE.md for the
> current state.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After an eBay sale, automatically place the matching Amazon order via Playwright using the user's buyer account (round-robined across enabled accounts), ship to the eBay buyer's address, link real costs back to the order (A1 trust machinery), and let the existing Amazon→eBay status tracker close the loop — all behind fail-closed guardrails (master toggle, per-account enable, hard review-step cost cap, dry-run) and a per-user residential-proxy + per-account browser-profile anti-ban stack.

**Architecture:** Three migrations add a master toggle (`store_settings`), per-account guardrails (`amazon_accounts`), and an `auto_fulfill_status` lifecycle (`orders`). A new `auto-fulfill` BullMQ queue is produced from the existing `upsertOrder` `xmax = 0` genuine-insert hook (same seam as sale-driven stock-sync) and consumed by an `AmazonCheckoutService` in the Amazon module that drives a step-structured Playwright checkout. `BrowserStateManager` is upgraded to proxy-aware persistent contexts (per-account user-data-dir), reusing the login/2FA-TOTP/stealth/rate-limit stack. A pluggable `TrackingConverter` (real-only `LocalTrackingConverter`, reserved `ApiTrackingConverter`) slots into the existing tracking processor. Post-purchase, the confirmation-page costs are written transactionally + `recomputeProfit` + the existing tracking scheduler auto-starts.

**Tech Stack:** NestJS 10, raw `pg` (`DatabaseService`), BullMQ (Redis), PostgreSQL 16, Playwright (`playwright-extra` + stealth). Jest + ts-jest for pure logic. React 18 + RTK Query + Emotion + i18n (EN/TR) for the frontend.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-18-auto-fulfillment-design.md` — every requirement traces to a task below.
- **No `any`**, no hardcoded status/constant strings — use enums from `packages/shared` (rule 10). New constants/enums go in shared first.
- **i18n / UI strings:** every user-facing string goes in `packages/shared/src/i18n/resources/{en,tr}/` first, used via `t()` (rule 12). Backend uses hardcoded English only for log lines.
- **Shared + UI build from `dist/`:** after changing `packages/shared` run `pnpm --filter @repo/shared build`; after `packages/ui` changes run `pnpm --filter @repo/ui build`. API/web import from `dist/`.
- **Migrations:** filename `NNN_<verb>_<table>_<desc>.sql`, sequential after `035`. API auto-runs pending migrations on boot. **Restart API** after adding SQL.
- **Testing policy:** pure logic (cap gate, round-robin, status transitions, tracking-converter mapping, proxy strategy) is TDD with Jest (harness already exists from A1 Task 2). DB / Playwright / queue / UI tasks use **manual verification** (dry-run is the primary safe-validation path for checkout) — consistent with A1 and the project's deferred-integration-tests policy.
- **Pre-commit runs `pnpm lint` (max-warnings 0).** Never `--no-verify`. Never `eslint-disable`. Ensure new code passes lint before committing.
- **Container/Component split + design-system-only rules** apply to all `apps/web/src` feature files (4-file split; no native form controls; `MessageModal`/`showMessage` for messages; floating labels on inputs).
- **No fabricated tracking numbers** — `LocalTrackingConverter` only remaps real carriers or passes TBA through as `Amazon_Logistics` (spec §6; research 2026-07-18).
- **Proxy mandatory for auto-fulfill:** `auto_fulfill_enabled` is rejected if proxy env is absent. Existing scraping falls back to direct (no proxy) when env is absent — no regression.
- **Fail-closed money flow:** the hard cost cap is checked at Amazon's review step before "Place Order"; no charge without it. Idempotency re-check on job start prevents double-orders on BullMQ retry.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `packages/shared/src/domain/orders/orders.types.ts` | `AutoFulfillStatus` enum | Modify |
| `packages/shared/src/domain/amazon/amazon.types.ts` | `TrackingConversionProvider` enum, `TrackingConverter` interface, `AutoFulfillSettings` types | Modify |
| `apps/api/migrations/036_alter_store_settings_add_auto_fulfill.sql` | master toggle + provider column | Create |
| `apps/api/migrations/037_alter_amazon_accounts_add_auto_fulfill.sql` | per-account enable/cap/dry-run | Create |
| `apps/api/migrations/038_alter_orders_add_auto_fulfill_status.sql` | `auto_fulfill_status` enum + blocked_reason + attempted_at + index | Create |
| `apps/api/src/modules/amazon/auto-fulfill-helpers.ts` | PURE: cap gate, round-robin pick, status skip predicate, proxy session token | Create |
| `apps/api/src/modules/amazon/auto-fulfill-helpers.spec.ts` | Jest tests for the above | Create |
| `apps/api/src/modules/amazon/tracking-converter.ts` | `TrackingConverter` impls: `LocalTrackingConverter`, `ApiTrackingConverter` (stub) | Create |
| `apps/api/src/modules/amazon/tracking-converter.spec.ts` | Jest tests (incl. TBA no-fabrication guard) | Create |
| `apps/api/src/modules/amazon/amazon-tracking-processor.service.ts` | wire converter into `handleShipped` | Modify |
| `apps/api/src/modules/amazon/proxy.service.ts` | `ProxyService.resolve()` + `ProxyAssignmentStrategy` | Create |
| `apps/api/src/modules/amazon/browser-state-manager.service.ts` | proxy-aware persistent context (user-data-dir) | Modify |
| `apps/api/src/orders/auto-fulfill-queue.service.ts` | BullMQ producer (`@InjectQueue('auto-fulfill')`) | Create |
| `apps/api/src/modules/orders/order-sync.service.ts` | producer hook in `upsertOrder` `xmax=0` block | Modify |
| `apps/api/src/modules/orders/orders.module.ts` | register `auto-fulfill` queue | Modify |
| `apps/api/src/modules/amazon/amazon-checkout.service.ts` | step-structured Playwright checkout + evidence capture | Create |
| `apps/api/src/modules/amazon/auto-fulfill-processor.service.ts` | BullMQ `@Processor('auto-fulfill')` | Create |
| `apps/api/src/modules/amazon/amazon.module.ts` | wire processor + checkout service + proxy service | Modify |
| `apps/api/src/modules/store-settings/store-settings.service.ts` | persist `auto_fulfill_enabled` + `tracking_conversion_provider` | Modify |
| `apps/api/src/modules/store-settings/dto/save-store-settings.dto.ts` | new fields + validation | Modify |
| `apps/api/src/modules/amazon/amazon-accounts.service.ts` | persist + guardrail-enforce the 3 account columns | Modify |
| `packages/shared/src/domain/store-settings/store-settings.dto.ts` | `SaveStoreSettingsRequest` new fields | Modify |
| `packages/shared/src/domain/amazon/amazon.dto.ts` | account DTO new fields | Modify |
| `apps/api/.env.example` | new env vars | Modify |
| `apps/web/.../StoreSettingsDrawer/{container,component,types}` | master toggle + provider select | Modify |
| `apps/web/.../amazon` account edit form | enable/cap/dry-run fields | Modify |
| `apps/web/.../orders` list + detail | `auto_fulfill_status` chip + needs-attention filter | Modify |
| `packages/shared/src/i18n/resources/{en,tr}/translation.json` | new keys | Modify |
| `CLAUDE.md` | A2 architecture, migrations 036–038, env, queues | Modify |

---

## Task 1: Shared enums + three migrations

**Files:**
- Modify: `packages/shared/src/domain/orders/orders.types.ts`
- Modify: `packages/shared/src/domain/amazon/amazon.types.ts`
- Create: `apps/api/migrations/036_alter_store_settings_add_auto_fulfill.sql`
- Create: `apps/api/migrations/037_alter_amazon_accounts_add_auto_fulfill.sql`
- Create: `apps/api/migrations/038_alter_orders_add_auto_fulfill_status.sql`

**Interfaces:**
- Produces: `AutoFulfillStatus` enum (`pending|running|placed|blocked|failed|dry_run|skipped`) exported from `@repo/shared`; `TrackingConversionProvider` enum (`LOCAL='local'|API='api'`); DB columns on `store_settings`, `amazon_accounts`, `orders`.

- [ ] **Step 1: Add `AutoFulfillStatus` to shared**

Append to `packages/shared/src/domain/orders/orders.types.ts` (after `OrderCostCaptureStatus`):

```ts
/**
 * Lifecycle of automated Amazon fulfillment for an order.
 * pending  -> new order, not yet attempted / not eligible
 * running  -> checkout job in progress
 * placed   -> Amazon order placed, costs + amazon_order_id written, recomputeProfit queued
 * blocked  -> checkout attempted, hit a fail-closed obstacle (no charge); see blocked_reason
 * failed   -> unexpected error (transport/infra); BullMQ may retry
 * dry_run  -> dry-run account: full flow up to (not incl.) Place Order; review total captured
 * skipped  -> not eligible (auto off / no enabled account / coarse cap gate failed)
 */
export enum AutoFulfillStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PLACED = 'placed',
  BLOCKED = 'blocked',
  FAILED = 'failed',
  DRY_RUN = 'dry_run',
  SKIPPED = 'skipped',
}
```

Append to `packages/shared/src/domain/amazon/amazon.types.ts`:

```ts
/** Tracking-number conversion provider. Only LOCAL is active; API is reserved (no-op stub). */
export enum TrackingConversionProvider {
  LOCAL = 'local',
  API = 'api',
}
```

Verify both are exported from their barrels (`packages/shared/src/domain/orders/index.ts`, `.../amazon/index.ts`).

- [ ] **Step 2: Build shared**

Run: `pnpm --filter @repo/shared build`
Expected: build succeeds.

- [ ] **Step 3: Migration 036 — store_settings master toggle**

Create `apps/api/migrations/036_alter_store_settings_add_auto_fulfill.sql`:

```sql
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS auto_fulfill_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tracking_conversion_provider VARCHAR(20) NOT NULL DEFAULT 'local';
```

- [ ] **Step 4: Migration 037 — amazon_accounts per-account guardrails**

Create `apps/api/migrations/037_alter_amazon_accounts_add_auto_fulfill.sql`:

```sql
ALTER TABLE amazon_accounts
  ADD COLUMN IF NOT EXISTS auto_fulfill_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS auto_fulfill_cap_total NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS auto_fulfill_dry_run BOOLEAN NOT NULL DEFAULT FALSE;
```

- [ ] **Step 5: Migration 038 — orders auto_fulfill_status**

Create `apps/api/migrations/038_alter_orders_add_auto_fulfill_status.sql`:

```sql
CREATE TYPE auto_fulfill_status AS ENUM
  ('pending','running','placed','blocked','failed','dry_run','skipped');

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS auto_fulfill_status auto_fulfill_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS auto_fulfill_blocked_reason VARCHAR(200),
  ADD COLUMN IF NOT EXISTS auto_fulfill_attempted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_auto_fulfill_status
  ON orders(auto_fulfill_status) WHERE auto_fulfill_status IN ('blocked','failed');
```

- [ ] **Step 6: Verify migrations apply**

Run: `pnpm dev:api`, wait for "migrations applied" log, then stop it.
Verify via psql/pgAdmin:
```sql
SELECT column_name, data_type FROM information_schema.columns
 WHERE (table_name='store_settings' AND column_name IN ('auto_fulfill_enabled','tracking_conversion_provider'))
    OR (table_name='amazon_accounts' AND column_name IN ('auto_fulfill_enabled','auto_fulfill_cap_total','auto_fulfill_dry_run'))
    OR (table_name='orders' AND column_name IN ('auto_fulfill_status','auto_fulfill_blocked_reason','auto_fulfill_attempted_at'));
-- expect 8 rows
SELECT typname FROM pg_type WHERE typname IN ('auto_fulfill_status'); -- expect 1 row
```

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/domain packages/shared/dist apps/api/migrations/036_*.sql apps/api/migrations/037_*.sql apps/api/migrations/038_*.sql
git commit -m "feat(a2): AutoFulfillStatus + TrackingConversionProvider enums, migrations 036-038"
```

---

## Task 2: Pure auto-fulfill helpers (TDD)

**Files:**
- Create: `apps/api/src/modules/amazon/auto-fulfill-helpers.ts`
- Create: `apps/api/src/modules/amazon/auto-fulfill-helpers.spec.ts`

**Interfaces:**
- Produces:
  - `AutoFulfillBlockedReason` union type.
  - `meetsCoarseCapGate(saleTotal: number, capTotal: number | null): boolean`
  - `pickRoundRobinAccount<T extends { id: string; lastUsedAt: Date | null }>(accounts: T[]): T | null`
  - `shouldSkipFulfillStart(status: AutoFulfillStatus): boolean` (idempotency guard — terminal/no-op states)
  - `proxySessionToken(strategy: 'perUser' | 'perAccount', userId: string, amazonAccountId: string): string`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/amazon/auto-fulfill-helpers.spec.ts`:

```ts
import { AutoFulfillStatus } from '@repo/shared';
import {
  meetsCoarseCapGate,
  pickRoundRobinAccount,
  shouldSkipFulfillStart,
  proxySessionToken,
} from './auto-fulfill-helpers';

describe('meetsCoarseCapGate', () => {
  it('passes when sale_total within cap', () => {
    expect(meetsCoarseCapGate(40, 50)).toBe(true);
  });
  it('passes at exact cap', () => {
    expect(meetsCoarseCapGate(50, 50)).toBe(true);
  });
  it('fails when over cap', () => {
    expect(meetsCoarseCapGate(60, 50)).toBe(false);
  });
  it('fails when cap is null (auto disabled)', () => {
    expect(meetsCoarseCapGate(40, null)).toBe(false);
  });
  it('fails when sale_total is zero/negative', () => {
    expect(meetsCoarseCapGate(0, 50)).toBe(false);
  });
});

describe('pickRoundRobinAccount', () => {
  const mk = (id: string, ts: number | null) => ({ id, lastUsedAt: ts === null ? null : new Date(ts) });
  it('returns null for empty pool', () => {
    expect(pickRoundRobinAccount([])).toBeNull();
  });
  it('picks the oldest lastUsedAt', () => {
    const pool = [mk('A', 300), mk('B', 100), mk('C', 200)];
    expect(pickRoundRobinAccount(pool)?.id).toBe('B');
  });
  it('treats null lastUsedAt as oldest (0)', () => {
    const pool = [mk('A', 100), mk('B', null)];
    expect(pickRoundRobinAccount(pool)?.id).toBe('B');
  });
  it('breaks ties by id ascending', () => {
    const pool = [mk('B', null), mk('A', null)];
    expect(pickRoundRobinAccount(pool)?.id).toBe('A');
  });
});

describe('shouldSkipFulfillStart', () => {
  it('skips terminal states (no double-order / no retry of deliberate stop)', () => {
    expect(shouldSkipFulfillStart(AutoFulfillStatus.PLACED)).toBe(true);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.BLOCKED)).toBe(true);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.DRY_RUN)).toBe(true);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.SKIPPED)).toBe(true);
  });
  it('allows (re)start on pending/running/failed', () => {
    expect(shouldSkipFulfillStart(AutoFulfillStatus.PENDING)).toBe(false);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.RUNNING)).toBe(false);
    expect(shouldSkipFulfillStart(AutoFulfillStatus.FAILED)).toBe(false);
  });
});

describe('proxySessionToken', () => {
  it('perUser strategy uses userId', () => {
    expect(proxySessionToken('perUser', 'u1', 'a1')).toBe('u1');
  });
  it('perAccount strategy uses accountId', () => {
    expect(proxySessionToken('perAccount', 'u1', 'a1')).toBe('a1');
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter api test`
Expected: FAIL — `Cannot find module './auto-fulfill-helpers'`.

- [ ] **Step 3: Implement**

Create `apps/api/src/modules/amazon/auto-fulfill-helpers.ts`:

```ts
import { AutoFulfillStatus } from '@repo/shared';

/** Fail-closed obstacle reasons. Each maps to a blocked_reason string + a UI message. */
export type AutoFulfillBlockedReason =
  | 'no_asin'
  | 'captcha'
  | 'otp'
  | 'login'
  | 'out_of_stock'
  | 'address'
  | 'payment'
  | 'cap'
  | 'no_confirmation';

/**
 * Coarse pre-filter using the eBay sale_total. This is NOT the hard cap — the
 * hard cap is the Amazon review-step grand-total check. This only avoids
 * enqueueing orders that obviously exceed the cap.
 */
export function meetsCoarseCapGate(saleTotal: number, capTotal: number | null): boolean {
  if (capTotal === null) return false;
  return saleTotal > 0 && saleTotal <= capTotal;
}

/**
 * Round-robin selection: the enabled account with the oldest lastUsedAt
 * (null treated as 0 = oldest). Ties broken by id ascending. Deterministic.
 */
export function pickRoundRobinAccount<T extends { id: string; lastUsedAt: Date | null }>(
  accounts: T[],
): T | null {
  if (accounts.length === 0) return null;
  return [...accounts].sort((a, b) => {
    const at = a.lastUsedAt ? a.lastUsedAt.getTime() : 0;
    const bt = b.lastUsedAt ? b.lastUsedAt.getTime() : 0;
    if (at !== bt) return at - bt;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  })[0];
}

/**
 * Idempotency guard. The fulfillment job re-reads status on start; if the
 * order is already in a terminal/no-op state, do nothing (prevents a BullMQ
 * retry from double-ordering or re-running a deliberate stop).
 */
export function shouldSkipFulfillStart(status: AutoFulfillStatus): boolean {
  return (
    status === AutoFulfillStatus.PLACED ||
    status === AutoFulfillStatus.BLOCKED ||
    status === AutoFulfillStatus.DRY_RUN ||
    status === AutoFulfillStatus.SKIPPED
  );
}

/** Sticky residential-proxy session token — per user (default) or per account. */
export function proxySessionToken(
  strategy: 'perUser' | 'perAccount',
  userId: string,
  amazonAccountId: string,
): string {
  return strategy === 'perAccount' ? amazonAccountId : userId;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter api test`
Expected: PASS (all helper tests + existing A1/A1.1 tests).

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/amazon/auto-fulfill-helpers.ts apps/api/src/modules/amazon/auto-fulfill-helpers.spec.ts
git commit -m "feat(a2): pure auto-fulfill helpers (cap gate, round-robin, idempotency, proxy token)"
```

---

## Task 3: Pluggable TrackingConverter + wire into tracking processor (TDD)

**Files:**
- Create: `apps/api/src/modules/amazon/tracking-converter.ts`
- Create: `apps/api/src/modules/amazon/tracking-converter.spec.ts`
- Modify: `apps/api/src/modules/amazon/amazon-tracking-processor.service.ts` (`handleShipped`, where `mapCarrierForEbay` is called)

**Interfaces:**
- Consumes: `TrackingConversionProvider` from Task 1.
- Produces:
  - `TrackingConverter` interface: `convert(rawNumber: string, rawCarrier: string): { trackingNumber: string; shippingCarrierCode: string }`
  - `LocalTrackingConverter` (active), `ApiTrackingConverter` (stub, throws).
  - `resolveConverter(provider: TrackingConversionProvider): TrackingConverter`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/amazon/tracking-converter.spec.ts`:

```ts
import { LocalTrackingConverter, ApiTrackingConverter, resolveConverter } from './tracking-converter';
import { TrackingConversionProvider } from '@repo/shared';

const conv = new LocalTrackingConverter();

describe('LocalTrackingConverter', () => {
  it('remaps real UPS', () => {
    expect(conv.convert('1Z999AA10123456784', 'UPS')).toEqual({
      trackingNumber: '1Z999AA10123456784', shippingCarrierCode: 'UPS',
    });
  });
  it('remaps real USPS (case-insensitive carrier)', () => {
    expect(conv.convert('9400111899223100000000', 'U.S. Postal Service')).toEqual({
      trackingNumber: '9400111899223100000000', shippingCarrierCode: 'USPS',
    });
  });
  it('remaps FedEx and DHL', () => {
    expect(conv.convert('12345', 'FedEx').shippingCarrierCode).toBe('FedEx');
    expect(conv.convert('12345', 'DHL').shippingCarrierCode).toBe('DHL_Express');
  });
  it('passes TBA through as Amazon_Logistics (NO fabrication)', () => {
    const r = conv.convert('TBA123456789', 'Amazon Logistics');
    expect(r).toEqual({ trackingNumber: 'TBA123456789', shippingCarrierCode: 'Amazon_Logistics' });
    // regression guard: the number is unchanged — never rewritten into a fake USPS/UPS number
    expect(r.trackingNumber).toBe('TBA123456789');
  });
  it('detects TBA by number prefix even with empty carrier', () => {
    expect(conv.convert('TBM000111222', '').shippingCarrierCode).toBe('Amazon_Logistics');
  });
  it('passes unknown real carrier through under raw label', () => {
    const r = conv.convert('ABC123', 'OnTrac');
    expect(r.trackingNumber).toBe('ABC123');
    expect(['OnTrac', 'Other']).toContain(r.shippingCarrierCode);
  });
});

describe('resolveConverter', () => {
  it('returns Local for LOCAL', () => {
    expect(resolveConverter(TrackingConversionProvider.LOCAL)).toBeInstanceOf(LocalTrackingConverter);
  });
  it('returns Api stub for API', () => {
    expect(resolveConverter(TrackingConversionProvider.API)).toBeInstanceOf(ApiTrackingConverter);
  });
  it('Api stub throws NotImplemented on convert', () => {
    expect(() => resolveConverter(TrackingConversionProvider.API).convert('x', 'y')).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `pnpm --filter api test`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the converters**

Create `apps/api/src/modules/amazon/tracking-converter.ts`:

```ts
import { TrackingConversionProvider } from '@repo/shared';

export interface ConverterResult {
  trackingNumber: string;
  shippingCarrierCode: string;
}

export interface TrackingConverter {
  convert(rawNumber: string, rawCarrier: string): ConverterResult;
}

/** Lowercased carrier label -> eBay carrier enum. */
const EBAY_CARRIER_MAP: Record<string, string> = {
  ups: 'UPS',
  usps: 'USPS',
  'u.s. postal service': 'USPS',
  'united states postal service': 'USPS',
  fedex: 'FedEx',
  'federal express': 'FedEx',
  dhl: 'DHL_Express',
  'dhl express': 'DHL_Express',
};

/**
 * Real-only converter. Real carriers (UPS/USPS/FedEx/DHL) are remapped to eBay's
 * enum. TBA/TBM/TBC (Amazon Logistics) are passed through unchanged under
 * Amazon_Logistics — NEVER fabricated into a USPS/UPS number (research 2026-07-18:
 * eBay deprecated Bluecare/Aquiline validation; fabricated numbers are fraud and
 * sink seller tracking/defect metrics).
 */
export class LocalTrackingConverter implements TrackingConverter {
  convert(rawNumber: string, rawCarrier: string): ConverterResult {
    const num = (rawNumber || '').trim();
    const car = (rawCarrier || '').trim();
    // Amazon Logistics: by number prefix OR carrier label.
    if (/^TB[ABC]/i.test(num) || /amazon/i.test(car)) {
      return { trackingNumber: num, shippingCarrierCode: 'Amazon_Logistics' };
    }
    const mapped = EBAY_CARRIER_MAP[car.toLowerCase()];
    if (mapped) {
      return { trackingNumber: num, shippingCarrierCode: mapped };
    }
    // Real but unrecognized — pass through; eBay accepts/rejects server-side.
    return { trackingNumber: num, shippingCarrierCode: car || 'Other' };
  }
}

/** Reserved for a future sanctioned paid conversion API. Inactive — throws. */
export class ApiTrackingConverter implements TrackingConverter {
  convert(): ConverterResult {
    throw new Error('ApiTrackingConverter not implemented — no sanctioned provider configured');
  }
}

export function resolveConverter(provider: TrackingConversionProvider): TrackingConverter {
  return provider === TrackingConversionProvider.API
    ? new ApiTrackingConverter()
    : new LocalTrackingConverter();
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `pnpm --filter api test`
Expected: PASS.

- [ ] **Step 5: Wire the converter into the tracking processor**

In `apps/api/src/modules/amazon/amazon-tracking-processor.service.ts`, locate `handleShipped` where `mapCarrierForEbay(...)` is currently called to build the `{ trackingNumber, shippingCarrierCode }` for `createShippingFulfillment`. Replace that mapping with the converter:

```ts
import { resolveConverter } from './tracking-converter';
// ...
// Resolve the user's configured provider once (best-effort; default LOCAL).
// (Read store_settings.tracking_conversion_provider for the order's user; if
//  unavailable, default to LOCAL. Cache per-request.)
const converter = resolveConverter(providerFromSettings ?? TrackingConversionProvider.LOCAL);
const { trackingNumber, shippingCarrierCode } = converter.convert(
  order.amazon_tracking_number,
  order.amazon_tracking_carrier,
);
```

Keep `mapCarrierForEbay` in place only if other call sites still use it; otherwise leave it (do not delete — minimize blast radius). `createShippingFulfillment` is then called with the converter's output.

Note: `providerFromSettings` comes from `StoreSettingsService.getResolvedSettings(order.user_id, null).trackingConversionProvider` — inject `StoreSettingsService` into the processor if not already present (AmazonModule already imports the needed modules; if StoreSettingsModule is not imported, add it to the processor's module imports or resolve settings via a thin query).

- [ ] **Step 6: Typecheck + manual verification**

Run: `pnpm typecheck` (no new `apps/api` errors).
Manual: on an order whose Amazon scrape yielded a real UPS number, confirm the eBay fulfillment posts carrier `UPS`; on a TBA order, confirm it posts `Amazon_Logistics` with the unchanged TBA number (no fake USPS/UPS).

- [ ] **Step 7: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/amazon/tracking-converter.ts apps/api/src/modules/amazon/tracking-converter.spec.ts apps/api/src/modules/amazon/amazon-tracking-processor.service.ts
git commit -m "feat(a2): pluggable real-only TrackingConverter wired into tracking processor"
```

---

## Task 4: ProxyService + ProxyAssignmentStrategy + proxy-aware BrowserStateManager

**Files:**
- Create: `apps/api/src/modules/amazon/proxy.service.ts`
- Modify: `apps/api/src/modules/amazon/browser-state-manager.service.ts`
- Modify: `apps/api/src/modules/amazon/amazon.module.ts` (provide `ProxyService`)

**Interfaces:**
- Consumes: `proxySessionToken` from Task 2.
- Produces:
  - `ProxyService.resolve(userId: string, amazonAccountId: string): { server: string; username: string; password: string } | null` (`null` when proxy env absent → direct connection, no regression to scraping).
  - `BrowserStateManager` contexts now launch **persistent** (per-account user-data-dir) and **proxy-injected**.

> **Risk note:** this task changes the browser stack used by **existing** scraping. The hard requirement is: when proxy env is absent, behavior is identical to today (scraping still logs in). Verify with the existing login flow before committing.

- [ ] **Step 1: Implement `ProxyService`**

Create `apps/api/src/modules/amazon/proxy.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { proxySessionToken } from './auto-fulfill-helpers';

export interface ProxyConfig {
  server: string;
  username: string;
  password: string;
}

/**
 * SellerHill-provided residential proxy. Users never configure this.
 * Sticky session token = userId (perUser, default) or amazonAccountId (perAccount, reserved),
 * so each user (or account) always exits from the same residential IP across all Amazon traffic.
 * Returns null when proxy env is absent — callers fall back to a direct connection
 * (existing scraping MUST NOT regress when no proxy is configured).
 */
@Injectable()
export class ProxyService {
  private readonly endpoint = process.env.PROXY_ENDPOINT; // e.g. gate.smartproxy.com:7000
  private readonly user = process.env.PROXY_USER;         // base username
  private readonly passTpl = process.env.PROXY_PASS_TEMPLATE; // may contain {session}
  private readonly strategy = (process.env.PROXY_STRATEGY as 'perUser' | 'perAccount') || 'perUser';

  /** True iff a proxy provider is configured (required for auto-fulfill). */
  isConfigured(): boolean {
    return Boolean(this.endpoint && this.user);
  }

  resolve(userId: string, amazonAccountId: string): ProxyConfig | null {
    if (!this.isConfigured()) return null;
    const session = proxySessionToken(this.strategy, userId, amazonAccountId);
    // Provider-specific: many residential providers encode the sticky session in the username
    // (e.g. user-session-<token>) or password. Adjust the template format to the chosen provider.
    const username = this.user.includes('{session}') ? this.user.replace('{session}', session) : `${this.user}-session-${session}`;
    const password = this.passTpl ? this.passTpl.replace('{session}', session) : '';
    return { server: this.endpoint, username, password };
  }
}
```

- [ ] **Step 2: Upgrade `BrowserStateManager` to persistent + proxy-aware**

In `apps/api/src/modules/amazon/browser-state-manager.service.ts`:

1. Inject `ProxyService`. The manager needs the `userId` for the account it's opening — extend its internal lookups to resolve `userId` from `amazon_accounts` (one cheap `SELECT user_id FROM amazon_accounts WHERE id = $1`) when `getContext(accountId)` is called, then `proxy.resolve(userId, accountId)`.
2. Replace the current `browser.newContext({ storageState })` path with **`chromium.launchPersistentContext(user_data_dir, { proxy, ...fingerprint, plugins })`**, where `user_data_dir = ${stateDir}/profiles/${accountId}/`. Keep the existing per-account **deterministic fingerprint** (UA/viewport/timezone from `hashCode(accountId)`) and the stealth plugin.
3. When `proxy` is `null` (no env), launch persistent context with no `proxy` option — identical network behavior to today, just persistent profile. Cache the context in the existing `activeContexts` map keyed by `accountId`.
4. `clearState(accountId)` must now also recursively remove the `profiles/${accountId}/` directory (not just the `.json` storageState file). `saveState` becomes a no-op for persistent contexts (state is written to disk continuously) — keep the method for back-compat but it can just ensure the dir exists.
5. Keep `isSessionValid`, `releaseContext`, `closeAll` semantics; adapt them to persistent contexts.

Sketch (the implementer adapts to the real file shape; preserve all existing call sites' signatures):
```ts
async getContext(accountId: string): Promise<BrowserContext> {
  if (this.activeContexts.has(accountId)) return this.activeContexts.get(accountId)!;
  const { user_id } = (await this.db.query<{ user_id: string }>(
    `SELECT user_id FROM amazon_accounts WHERE id = $1`, [accountId],
  ))[0];
  const proxy = this.proxyService.resolve(user_id, accountId) ?? undefined; // undefined => direct
  const dir = `${this.stateDir}/profiles/${accountId}`;
  await fs.mkdir(dir, { recursive: true });
  const ctx = await chromium.launchPersistentContext(dir, {
    headless: true,
    proxy,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-blink-features=AutomationControlled'],
    userAgent: this.userAgentFor(accountId),
    viewport: this.viewportFor(accountId),
    locale: 'en-US',
    timezoneId: this.timezoneFor(accountId),
  });
  this.activeContexts.set(accountId, ctx);
  return ctx;
}
```
Inject `DatabaseService` (or reuse whatever the manager already uses) for the `user_id` lookup.

- [ ] **Step 3: Register `ProxyService` in the module**

In `apps/api/src/modules/amazon/amazon.module.ts`, add `ProxyService` to providers and exports.

- [ ] **Step 4: Add env example**

In `apps/api/.env.example`, append:
```
# A2 — Automated Amazon fulfillment (all optional; proxy REQUIRED to enable auto_fulfill on any account)
AUTO_FULFILL_QUEUE_CONCURRENCY=1
AUTO_FULFILL_CHECKOUT_MIN_TIME_MS=4500
AUTO_FULFILL_REVIEW_CAP_HARD_STOP=true
FULFILLMENT_EVIDENCE_DIR=
FULFILLMENT_EVIDENCE_TTL_DAYS=7
# SellerHill-provided residential proxy (sticky session per user by default)
PROXY_PROVIDER=              # smartproxy | brightdata | iproyal
PROXY_ENDPOINT=              # gate.smartproxy.com:7000
PROXY_USER=                  # base username; may contain {session}
PROXY_PASS_TEMPLATE=         # may contain {session}
PROXY_STRATEGY=perUser       # perUser (default) | perAccount (reserved)
```

- [ ] **Step 5: Typecheck + verify no scraping regression**

Run: `pnpm typecheck` (no new `apps/api` errors).
With proxy env **unset**, start API and trigger an Amazon account verify (`POST /amazon/accounts/:id/verify` or wait for the verify queue). Expected: login still succeeds, account goes `ACTIVE`. This proves the persistent-context change didn't break existing scraping.
With proxy env **set** (even a dummy), confirm `ProxyService.resolve()` returns a config and `getContext` launches with it (logs only — a dummy proxy will fail login, that's fine for this check).

- [ ] **Step 6: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/amazon/proxy.service.ts apps/api/src/modules/amazon/browser-state-manager.service.ts apps/api/src/modules/amazon/amazon.module.ts apps/api/.env.example
git commit -m "feat(a2): ProxyService + per-account persistent proxy-aware browser contexts"
```

---

## Task 5: `auto-fulfill` queue + producer hook in `upsertOrder`

**Files:**
- Create: `apps/api/src/modules/orders/auto-fulfill-queue.service.ts`
- Modify: `apps/api/src/modules/orders/orders.module.ts` (register queue + provide service)
- Modify: `apps/api/src/modules/orders/order-sync.service.ts` (inject service, add producer in the `xmax = 0` block)

**Interfaces:**
- Consumes: `meetsCoarseCapGate`, `pickRoundRobinAccount` (Task 2); `store_settings.auto_fulfill_enabled`; `amazon_accounts.auto_fulfill_*`.
- Produces: BullMQ queue `auto-fulfill`; `AutoFulfillQueueService.enqueue(ebayOrderId: string, amazonAccountId: string): Promise<void>`.

> **Why queue lives in OrdersModule:** the producer is in `OrderSyncService` (Orders module). The consumer (processor, Task 8) lives in the Amazon module and connects to the same Redis queue by name — BullMQ workers need no `registerQueue` on the consumer side. This keeps OrdersModule from importing AmazonModule (no circular dep; AmazonModule already imports OrdersModule for `recomputeProfit`).

- [ ] **Step 1: Create the queue service (producer)**

Create `apps/api/src/modules/orders/auto-fulfill-queue.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

export const AUTO_FULFILL_QUEUE = 'auto-fulfill';

@Injectable()
export class AutoFulfillQueueService {
  private readonly logger = new Logger(AutoFulfillQueueService.name);
  constructor(@InjectQueue(AUTO_FULFILL_QUEUE) private readonly queue: Queue) {}

  async enqueue(ebayOrderId: string, amazonAccountId: string): Promise<void> {
    // jobId per order => dedup; one fulfillment attempt per order across BullMQ retries.
    await this.queue.add(
      'fulfill-order',
      { ebayOrderId, amazonAccountId },
      {
        jobId: `fulfill-${ebayOrderId}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 100,
        removeOnFail: { age: 86_400 },
      },
    );
    this.logger.log(`enqueued auto-fulfill for ${ebayOrderId} on account ${amazonAccountId}`);
  }
}
```

- [ ] **Step 2: Register the queue + service in OrdersModule**

In `apps/api/src/modules/orders/orders.module.ts`, alongside the existing `BullModule.registerQueue({ name: 'order-sync' }, { name: 'stock-sync' })`, add `{ name: AUTO_FULFILL_QUEUE }` (import the constant). Add `AutoFulfillQueueService` to providers and exports.

- [ ] **Step 3: Add the producer hook in `upsertOrder`**

In `apps/api/src/modules/orders/order-sync.service.ts`:
- Inject `AutoFulfillQueueService` and `StoreSettingsService` (and `DatabaseService` is already present).
- In the `if (inserted && listingId && entity.quantity > 0) { … }` block (the existing stock-sync block, ~`:158-178`), after the stock-sync `try/catch`, add a separate best-effort auto-fulfill enqueue block:

```ts
// Auto-fulfill (best-effort; never fails order sync). Fires only on a genuine new matched order.
if (inserted && listingId && entity.quantity > 0) {
  try {
    await this.maybeEnqueueAutoFulfill(entity);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    this.logger.warn(`Auto-fulfill enqueue skipped for ${entity.ebayOrderId}: ${msg}`);
  }
}
```

Add the private method:

```ts
private async maybeEnqueueAutoFulfill(entity: OrderEntity): Promise<void> {
  // 1. Master toggle (global per-user settings).
  const settings = await this.storeSettings.getResolvedSettings(entity.userId, null);
  if (!settings.autoFulfillEnabled) {
    await this.setAutoFulfillStatus(entity.ebayOrderId, AutoFulfillStatus.SKIPPED);
    return;
  }
  // 2. Round-robin across enabled accounts with a cap.
  const enabled = await this.databaseService.query<{
    id: string; last_used_at: Date | null; auto_fulfill_cap_total: string | number | null;
  }>(
    `SELECT id, last_used_at, auto_fulfill_cap_total FROM amazon_accounts
      WHERE user_id = $1 AND auto_fulfill_enabled = TRUE AND auto_fulfill_cap_total IS NOT NULL`,
    [entity.userId],
  );
  if (enabled.length === 0) {
    await this.setAutoFulfillStatus(entity.ebayOrderId, AutoFulfillStatus.SKIPPED);
    return;
  }
  const pick = pickRoundRobinAccount(
    enabled.map((a) => ({ id: a.id, lastUsedAt: a.last_used_at })),
  );
  if (!pick) {
    await this.setAutoFulfillStatus(entity.ebayOrderId, AutoFulfillStatus.SKIPPED);
    return;
  }
  const cap = Number(enabled.find((a) => a.id === pick.id)!.auto_fulfill_cap_total);
  // 3. Coarse pre-filter (hard check is the Amazon review step in the checkout service).
  if (!meetsCoarseCapGate(Number(entity.saleTotal) || 0, cap)) {
    await this.setAutoFulfillStatus(entity.ebayOrderId, AutoFulfillStatus.SKIPPED);
    return;
  }
  // Stamp last_used_at so the next order rotates to the next account.
  await this.databaseService.query(
    `UPDATE amazon_accounts SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [pick.id],
  );
  await this.autoFulfillQueue.enqueue(entity.ebayOrderId, pick.id);
}
```

Add a small status setter helper on the service:
```ts
private async setAutoFulfillStatus(ebayOrderId: string, status: AutoFulfillStatus): Promise<void> {
  await this.databaseService.query(
    `UPDATE orders SET auto_fulfill_status = $1, updated_at = CURRENT_TIMESTAMP WHERE ebay_order_id = $2`,
    [status, ebayOrderId],
  );
}
```

Imports at top: `AutoFulfillStatus` from `@repo/shared`; `meetsCoarseCapGate, pickRoundRobinAccount` from `../amazon/auto-fulfill-helpers` (or move the helpers to a shared location — they live in the amazon module; importing across modules is fine for pure functions). `OrderEntity` = the existing entity type used in `upsertOrder`; ensure it carries `userId` and `saleTotal` (add to the entity if absent).

> Note on cross-module import: `auto-fulfill-helpers.ts` is pure (no DI), so importing it from `orders` is safe. If the lint/module boundaries complain, copy the two functions into a shared util under `apps/api/src/common/` instead — but prefer the single source.

- [ ] **Step 4: Typecheck + manual verification**

Run: `pnpm typecheck`.
Manual: with `store_settings.auto_fulfill_enabled = true`, one `amazon_accounts` row with `auto_fulfill_enabled = true` + a `cap`, ingest a new eBay order. Verify a job appears on the `auto-fulfill` queue (Redis / BullMQ admin) and `orders.auto_fulfill_status` is `pending` (no processor yet → job waits). With the toggle off or no enabled account, verify `auto_fulfill_status = 'skipped'` and no job.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/orders/auto-fulfill-queue.service.ts apps/api/src/modules/orders/orders.module.ts apps/api/src/modules/orders/order-sync.service.ts
git commit -m "feat(a2): auto-fulfill queue + round-robin producer in upsertOrder genuine-insert hook"
```

---

## Task 6: AmazonCheckoutService — step-structured Playwright checkout + evidence

**Files:**
- Create: `apps/api/src/modules/amazon/amazon-checkout.service.ts`

**Interfaces:**
- Consumes: `AmazonScrapingService` (login/session), `AmazonRateLimiter`, `BrowserStateManager`, `DatabaseService`, `ProxyService`; `AutoFulfillBlockedReason`, `shouldSkipFulfillStart` (Task 2); `AutoFulfillStatus` (Task 1).
- Produces: `AmazonCheckoutService.runForOrder(ebayOrderId: string): Promise<void>` — sets `auto_fulfill_status` (`running` → `placed` | `blocked` | `dry_run`), captures admin-only evidence, throws on transport errors (→ BullMQ retry).

> **Verification:** manual + dry-run. The Playwright flow cannot be unit-tested; the typed blocked-reason taxonomy (Task 2) is what makes fail-closed reliable. **Dry-run mode is the primary safe-validation path** — enable `auto_fulfill_dry_run` on a test account first and confirm the flow reaches the review step and stops.

- [ ] **Step 1: Define the blocked-error class + result types**

At the top of `amazon-checkout.service.ts`:

```ts
import { AutoFulfillStatus } from '@repo/shared';
import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { Page } from 'playwright-extra';
import { AutoFulfillBlockedReason } from './auto-fulfill-helpers';

export class AutoFulfillBlockedError extends Error {
  constructor(public readonly reason: AutoFulfillBlockedReason, message?: string) {
    super(message ?? reason);
    this.name = 'AutoFulfillBlockedError';
  }
}

export interface PlacedResult {
  amazonOrderId: string;
  purchasePrice: number;
  tax: number;
  shipping: number;
}
```

- [ ] **Step 2: Implement the step-structured service (sketch — adapt selectors to live DOM)**

```ts
@Injectable()
export class AmazonCheckoutService {
  private readonly logger = new Logger(AmazonCheckoutService.name);
  private readonly minTimeMs = Number(process.env.AUTO_FULFILL_CHECKOUT_MIN_TIME_MS || 4500);
  private readonly hardStop = process.env.AUTO_FULFILL_REVIEW_CAP_HARD_STOP !== 'false';
  private readonly evidenceDir = process.env.FULFILLMENT_EVIDENCE_DIR
    || path.join(process.cwd(), 'fulfillment-evidence');

  constructor(
    private readonly db: DatabaseService,
    private readonly scraping: AmazonScrapingService, // for performLogin + session reuse
    private readonly rateLimiter: AmazonRateLimiter,
    private readonly browserState: BrowserStateManager,
  ) {}

  async runForOrder(ebayOrderId: string, amazonAccountId: string): Promise<void> {
    // Idempotency: never double-order on BullMQ retry.
    const [order] = await this.db.query<{ auto_fulfill_status: AutoFulfillStatus }>(
      `SELECT auto_fulfill_status FROM orders WHERE ebay_order_id = $1`, [ebayOrderId],
    );
    if (!order || shouldSkipFulfillStart(order.auto_fulfill_status)) {
      this.logger.log(`skip fulfill ${ebayOrderId}: status ${order?.auto_fulfill_status}`);
      return;
    }
    await this.setStatus(ebayOrderId, AutoFulfillStatus.RUNNING);

    try {
      await this.rateLimiter.schedule(amazonAccountId, () => this.checkout(ebayOrderId, amazonAccountId));
    } catch (err) {
      if (err instanceof AutoFulfillBlockedError) {
        await this.block(ebayOrderId, err.reason, err.message);
        return; // deliberate stop — do NOT throw (no BullMQ retry)
      }
      // transport/infra — let BullMQ retry; mark failed only on final exhaustion (processor does that)
      throw err;
    }
  }

  private async checkout(ebayOrderId: string, amazonAccountId: string): Promise<void> {
    const { userId, asin, quantity, ship, capTotal, dryRun } = await this.loadInputs(ebayOrderId, amazonAccountId);
    if (!asin) throw new AutoFulfillBlockedError('no_asin');

    const ctx = await this.browserState.getContext(amazonAccountId); // proxy-aware persistent context
    const page = await ctx.newPage();
    try {
      await this.humanDelay();
      // Step 2: session/login (reuse scraping's login incl. 2FA-TOTP)
      await this.ensureLoggedIn(page, amazonAccountId, userId);
      // Step 3: product page + add to cart
      await page.goto(`https://www.amazon.com/dp/${asin}`, { waitUntil: 'domcontentloaded' });
      await this.humanDelay();
      if (await this.isUnavailable(page)) throw new AutoFulfillBlockedError('out_of_stock');
      await this.setQuantityAndAddToCart(page, quantity);
      // Step 4: proceed to checkout + address
      await this.humanDelay();
      await page.click('text=Go to Cart'); // adapt selector
      await this.humanDelay();
      await page.click('text=Proceed to checkout');
      await this.detectCaptchaOrOtp(page); // throws 'captcha' | 'otp'
      await this.selectShipToAddress(page, ship); // throws 'address' on validation friction
      // Step 5: payment
      await this.humanDelay();
      await this.selectDefaultPayment(page); // throws 'payment' on decline signals
      // Step 6: review-step HARD CAP
      await this.humanDelay();
      const grandTotal = await this.readReviewGrandTotal(page);
      if (this.hardStop && grandTotal > capTotal) {
        await this.snap(page, ebayOrderId, 'cap');
        throw new AutoFulfillBlockedError('cap', `grandTotal ${grandTotal} > cap ${capTotal}`);
      }
      // Step 7: place order OR dry-run
      if (dryRun) {
        await this.snap(page, ebayOrderId, 'dry_run_review');
        await this.setStatus(ebayOrderId, AutoFulfillStatus.DRY_RUN);
        return;
      }
      await this.humanDelay();
      await page.click('input[name=placeYourOrder1]'); // adapt selector
      await page.waitForLoadState('domcontentloaded');
      const placed = await this.parseConfirmation(page); // throws 'no_confirmation' if no order id
      await this.onPlaced(ebayOrderId, amazonAccountId, placed);
      await this.setStatus(ebayOrderId, AutoFulfillStatus.PLACED);
    } finally {
      await page.close();
    }
  }

  // --- step helpers (adapt selectors to live Amazon DOM) ---
  private async ensureLoggedIn(page: Page, accountId: string, userId: string): Promise<void> {
    // Delegate to AmazonScrapingService.performLogin() if session invalid; detect captcha/otp there.
    // Throw AutoFulfillBlockedError('captcha' | 'otp' | 'login') accordingly.
  }
  private async isUnavailable(page: Page): Promise<boolean> { /* 'Currently unavailable' / no Add to Cart */ return false; }
  private async setQuantityAndAddToCart(page: Page, qty: number): Promise<void> { /* #quantity + #add-to-cart-button */ }
  private async detectCaptchaOrOtp(page: Page): Promise<void> { /* #auth-mfa-otpcode -> 'otp'; captcha box -> 'captcha' */ }
  private async selectShipToAddress(page: Page, ship: Address): Promise<void> { /* choose/add buyer address; 'address' on friction */ }
  private async selectDefaultPayment(page: Page): Promise<void> { /* default radio; 'payment' on decline */ }
  private async readReviewGrandTotal(page: Page): Promise<number> { /* parse review total */ return 0; }
  private async parseConfirmation(page: Page): Promise<PlacedResult> { /* confirmation DOM -> amazonOrderId + costs; throw 'no_confirmation' */ return {} as PlacedResult; }

  private async humanDelay(): Promise<void> {
    const base = this.minTimeMs;
    const jitter = Math.floor((Math.floor(Math.random() * 1000)) % 800); // bounded human-like jitter
    await new Promise((r) => setTimeout(r, base + jitter));
  }
  private async snap(page: Page, ebayOrderId: string, stage: string): Promise<void> {
    const dir = path.join(this.evidenceDir, ebayOrderId);
    await fs.mkdir(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, `${stage}-${Date.now()}.png`), fullPage: true });
  }

  private async loadInputs(ebayOrderId: string, accountId: string): Promise<{
    userId: string; asin: string | null; quantity: number; ship: Address;
    capTotal: number; dryRun: boolean;
  }> {
    const [row] = await this.db.query<{
      user_id: string; asin: string | null; quantity: number;
      shipping_address: unknown; auto_fulfill_cap_total: string | number; auto_fulfill_dry_run: boolean;
    }>(
      `SELECT o.user_id, p.asin, o.quantity, o.shipping_address,
              a.auto_fulfill_cap_total, a.auto_fulfill_dry_run
         FROM orders o
         LEFT JOIN listings l ON l.id = o.listing_id
         LEFT JOIN products p ON p.id = l.product_id
         JOIN amazon_accounts a ON a.id = $2
        WHERE o.ebay_order_id = $1`,
      [ebayOrderId, accountId],
    );
    if (!row) throw new AutoFulfillBlockedError('no_asin');
    return {
      userId: row.user_id,
      asin: row.asin,
      quantity: row.quantity,
      ship: (row.shipping_address as Address) ?? ({} as Address),
      capTotal: Number(row.auto_fulfill_cap_total),
      dryRun: row.auto_fulfill_dry_run,
    };
  }

  // onPlaced DB write lives in Task 7 (post-purchase link). Here it just resolves the result.
  private async onPlaced(_ebayOrderId: string, _accountId: string, _placed: PlacedResult): Promise<void> {
    // implemented in Task 7
  }

  private async setStatus(ebayOrderId: string, status: AutoFulfillStatus, reason?: string): Promise<void> {
    await this.db.query(
      `UPDATE orders SET auto_fulfill_status = $1,
          auto_fulfill_blocked_reason = COALESCE($2, auto_fulfill_blocked_reason),
          auto_fulfill_attempted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE ebay_order_id = $3`,
      [status, reason ?? null, ebayOrderId],
    );
  }
  private async block(ebayOrderId: string, reason: AutoFulfillBlockedReason, msg?: string): Promise<void> {
    this.logger.warn(`fulfill blocked ${ebayOrderId}: ${reason} (${msg ?? ''})`);
    await this.setStatus(ebayOrderId, AutoFulfillStatus.BLOCKED, reason);
    // notification (in-app needs-attention list reads blocked status directly) — no email in scope
  }
}
```

> The step-helper method bodies (`ensureLoggedIn`, `selectShipToAddress`, `readReviewGrandTotal`, `parseConfirmation`, etc.) are the DOM-specific parts that must be adapted against live Amazon during implementation/dry-run. Keep all selectors as named constants at the top of the file (same fragility discipline as A1 Task 5). Each throws a typed `AutoFulfillBlockedError` on its specific failure.

- [ ] **Step 3: Provide the service in AmazonModule**

In `apps/api/src/modules/amazon/amazon.module.ts`, add `AmazonCheckoutService` to providers.

- [ ] **Step 4: Typecheck + dry-run manual verification**

Run: `pnpm typecheck`.
Manual (dry-run path — no money): on a test account set `auto_fulfill_dry_run = true`, `auto_fulfill_enabled = true`, a generous `cap`, and ensure proxy env is set. Ingest a new matched eBay order. Confirm: the job reaches the review step, a screenshot lands in `fulfillment-evidence/{ebayOrderId}/dry_run_review-*.png`, and `orders.auto_fulfill_status = 'dry_run'`. Then test each fail-closed path by simulation: set `cap` below the order → expect `blocked` reason `cap`; point the account at a dead ASIN → `out_of_stock`/`no_asin`. Confirm **no Amazon order is ever placed** in any blocked/dry-run path.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/amazon/amazon-checkout.service.ts apps/api/src/modules/amazon/amazon.module.ts
git commit -m "feat(a2): step-structured AmazonCheckoutService with review-step cap, dry-run, evidence"
```

---

## Task 7: Post-purchase link + cost capture + tracking kickoff

**Files:**
- Modify: `apps/api/src/modules/amazon/amazon-checkout.service.ts` (`onPlaced`)
- Modify: `apps/api/src/modules/amazon/amazon.module.ts` (inject `AmazonTrackingQueueService` + `OrderSyncService` — already imported)

**Interfaces:**
- Consumes: `OrderSyncService.recomputeProfit` (A1), `AmazonTrackingQueueService.scheduleOrderTracking` (existing).
- Produces: on `placed`, a transactional UPDATE writing real costs + `amazon_order_id` + `cost_capture_status = 'linked'`, then `recomputeProfit`, then the tracking scheduler auto-starts.

- [ ] **Step 1: Implement `onPlaced`**

Inject `OrderSyncService` and `AmazonTrackingQueueService` into `AmazonCheckoutService`. Replace the stub:

```ts
private async onPlaced(
  ebayOrderId: string,
  amazonAccountId: string,
  placed: PlacedResult,
): Promise<void> {
  await this.db.query(
    `UPDATE orders SET
       amazon_account_id     = $1,
       amazon_order_id       = $2,
       purchase_price        = $3,
       amazon_tax            = $4,
       amazon_shipping       = $5,
       amazon_linked_at      = CURRENT_TIMESTAMP,
       cost_capture_status   = 'linked',
       updated_at            = CURRENT_TIMESTAMP
     WHERE ebay_order_id = $6`,
    [amazonAccountId, placed.amazonOrderId, placed.purchasePrice, placed.tax, placed.shipping, ebayOrderId],
  );
  // A1 trust machinery: trusted net_profit for free.
  await this.orderSync.recomputeProfit(ebayOrderId);
  // Existing tracker keys off amazon_order_id -> shipped/delivered polling starts.
  await this.trackingQueue.scheduleOrderTracking(
    (await this.orderIdFor(ebayOrderId))!, amazonAccountId,
  );
}
```

Add the tiny helper:
```ts
private async orderIdFor(ebayOrderId: string): Promise<string | null> {
  const [r] = await this.db.query<{ id: string }>(`SELECT id FROM orders WHERE ebay_order_id = $1`, [ebayOrderId]);
  return r?.id ?? null;
}
```

- [ ] **Step 2: Typecheck + manual verification**

Run: `pnpm typecheck`.
Manual (only after dry-run passes, on a real low-value order): confirm that a `placed` order gets `amazon_order_id`, real `purchase_price`/`amazon_tax`/`amazon_shipping`, `cost_capture_status = 'linked'`, a recomputed non-null `net_profit`, and that a `track-amazon-<id>` scheduler appears (BullMQ) → on Amazon ship, eBay goes shipped via the converter from Task 3.

- [ ] **Step 3: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/amazon/amazon-checkout.service.ts
git commit -m "feat(a2): link real costs + recomputeProfit + tracking kickoff on placed order"
```

---

## Task 8: Processor that drains the `auto-fulfill` queue

**Files:**
- Create: `apps/api/src/modules/amazon/auto-fulfill-processor.service.ts`
- Modify: `apps/api/src/modules/amazon/amazon.module.ts`

**Interfaces:**
- Consumes: `AmazonCheckoutService.runForOrder` (Task 6); queue name `auto-fulfill` (Task 5).
- Produces: a BullMQ worker on `auto-fulfill`; marks `failed` on final-attempt exhaustion.

- [ ] **Step 1: Implement the processor**

Create `apps/api/src/modules/amazon/auto-fulfill-processor.service.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { AutoFulfillStatus } from '@repo/shared';
import { DatabaseService } from '../../common/database/database.service';
import { AmazonCheckoutService } from './amazon-checkout.service';

// Same queue name as the producer in OrdersModule (Task 5) — one Redis queue, two modules.
export const AUTO_FULFILL_QUEUE = 'auto-fulfill';

@Processor(AUTO_FULFILL_QUEUE, {
  concurrency: Math.max(1, Number(process.env.AUTO_FULFILL_QUEUE_CONCURRENCY) || 1),
})
export class AutoFulfillProcessor extends WorkerHost {
  private readonly logger = new Logger(AutoFulfillProcessor.name);
  constructor(
    private readonly checkout: AmazonCheckoutService,
    private readonly db: DatabaseService,
  ) {
    super();
  }

  async handle(job: Job<{ ebayOrderId: string; amazonAccountId: string }>): Promise<void> {
    const { ebayOrderId, amazonAccountId } = job.data;
    this.logger.log(`processing fulfill ${ebayOrderId} (attempt ${job.attemptsMade + 1})`);
    try {
      await this.checkout.runForOrder(ebayOrderId, amazonAccountId);
    } catch (err) {
      // Transport/infra error — BullMQ retries (attempts: 3). On the final attempt, mark failed.
      const isLast = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
      if (isLast) {
        this.logger.error(`fulfill failed (final) ${ebayOrderId}: ${(err as Error).message}`);
        await this.db.query(
          `UPDATE orders SET auto_fulfill_status = $1, updated_at = CURRENT_TIMESTAMP WHERE ebay_order_id = $2`,
          [AutoFulfillStatus.FAILED, ebayOrderId],
        );
      }
      throw err; // let BullMQ apply backoff/retry
    }
  }
}
```

- [ ] **Step 2: Register the processor in AmazonModule**

In `apps/api/src/modules/amazon/amazon.module.ts`, add `AutoFulfillProcessor` to providers. (No `registerQueue` needed on the consumer side — the queue is registered in OrdersModule; the worker connects by name. Confirm both modules' queue name strings are identical: `'auto-fulfill'`.)

- [ ] **Step 3: Typecheck + manual verification**

Run: `pnpm typecheck`.
Manual: with dry-run on, ingest an order → confirm the processor picks up the job from Task 5, the checkout runs to `dry_run`, and the job completes. Force a transport throw (e.g. stop Redis mid-job / kill browser) → confirm status goes `failed` after retries and the order is **not** double-processed on the retry (idempotency re-check).

- [ ] **Step 4: Lint + commit**

```bash
pnpm lint
git add apps/api/src/modules/amazon/auto-fulfill-processor.service.ts apps/api/src/modules/amazon/amazon.module.ts
git commit -m "feat(a2): auto-fulfill queue processor (fail-closed, idempotent, marks failed on final attempt)"
```

---

## Task 9: Settings backend — store_settings + amazon_accounts persistence + guardrails

**Files:**
- Modify: `packages/shared/src/domain/store-settings/store-settings.dto.ts` + `store-settings.types.ts`
- Modify: `packages/shared/src/domain/amazon/amazon.dto.ts`
- Modify: `apps/api/src/modules/store-settings/dto/save-store-settings.dto.ts`
- Modify: `apps/api/src/modules/store-settings/store-settings.service.ts`
- Modify: `apps/api/src/modules/amazon/amazon-accounts.service.ts`

**Interfaces:**
- Produces: `SaveStoreSettingsRequest` gains `autoFulfillEnabled: boolean`, `trackingConversionProvider: TrackingConversionProvider`; `StoreSettingsResponse` exposes them + `autoFulfillEnabled`. Amazon account DTO/service gains `autoFulfillEnabled`, `autoFulfillCapTotal`, `autoFulfillDryRun` with the **proxy-required + cap-required guardrail**.

- [ ] **Step 1: Extend shared DTOs/types**

In `packages/shared/src/domain/store-settings/store-settings.types.ts` add to `StoreSettings`:
```ts
autoFulfillEnabled: boolean;
trackingConversionProvider: TrackingConversionProvider; // import from ../amazon
```
In `store-settings.dto.ts`, add the same two fields to `SaveStoreSettingsRequest` and `StoreSettingsResponse`.

In `packages/shared/src/domain/amazon/amazon.dto.ts`, add to the account DTO/interface:
```ts
autoFulfillEnabled: boolean;
autoFulfillCapTotal: number | null;
autoFulfillDryRun: boolean;
```
Run `pnpm --filter @repo/shared build`.

- [ ] **Step 2: Backend DTO validation**

In `apps/api/src/modules/store-settings/dto/save-store-settings.dto.ts`, add:
```ts
@ApiPropertyOptional({ default: false })
@IsBoolean()
@IsOptional()
autoFulfillEnabled?: boolean;

@ApiPropertyOptional({ default: 'local', enum: ['local','api'] })
@IsIn(['local','api'])
@IsOptional()
trackingConversionProvider?: 'local' | 'api';
```
In the amazon-accounts DTO (where account updates are validated), add `@IsBoolean() autoFulfillEnabled?`, `@IsNumber() @Min(0) @IsOptional() autoFulfillCapTotal?`, `@IsBoolean() @IsOptional() autoFulfillDryRun?`.

- [ ] **Step 3: Persist in `StoreSettingsService`**

In `store-settings.service.ts`: include `auto_fulfill_enabled` and `tracking_conversion_provider` in the `INSERT … ON CONFLICT DO UPDATE SET …` for **both** the global and store paths (mirror how `amazon_tax_rate` is written — CLAUDE.md warns the upsert must NOT skip the column on UPDATE). Return them in `mapToDto` (coerce `auto_fulfill_enabled` to boolean; `tracking_conversion_provider` as string).

- [ ] **Step 4: Persist + guardrail-enforce in `AmazonAccountsService`**

In `amazon-accounts.service.ts`:
- `create` / `update`: accept and persist the three new columns.
- **Guardrail:** inject `ProxyService`. Before setting `auto_fulfill_enabled = true` (in `create` or `update`), if `!proxyService.isConfigured()` → throw a `BadRequestException('auto_fulfill requires a configured proxy')`. Also require `auto_fulfill_cap_total IS NOT NULL` when enabling. The controller surfaces this to the FE via the standard error → `showMessage` path. Add i18n keys (Task 11) for the message.

- [ ] **Step 5: Typecheck + manual verification**

Run: `pnpm typecheck`.
Manual:
```bash
# toggle on, set provider
curl -X POST localhost:3000/v1/store-settings -H "Authorization: Bearer <t>" -H "Content-Type: application/json" \
  -d '{"isGlobal":true,"country":"US","state":"CA","zipCode":"90001","autoFulfillEnabled":true,"trackingConversionProvider":"local","amazonTaxRate":0}'
# enable account (fails if proxy env unset)
curl -X PATCH localhost:3000/v1/amazon/accounts/<id> ... -d '{"autoFulfillEnabled":true,"autoFulfillCapTotal":50}'
```
Expected: 400 with the proxy message when proxy env is unset; 200 + persisted when set. Confirm `store_settings` and `amazon_accounts` rows carry the new columns.

- [ ] **Step 6: Lint + commit**

```bash
pnpm lint
git add packages/shared apps/api/src/modules/store-settings apps/api/src/modules/amazon/amazon-accounts.service.ts apps/api/src/modules/amazon/dto
git commit -m "feat(a2): persist auto-fulfill settings + proxy/cap guardrail on account enable"
```

---

## Task 10: Frontend — settings drawer + Amazon account edit

**Files:**
- Modify: `apps/web/src/features/settings/drawers/StoreSettingsDrawer/{StoreSettingsDrawer.container.tsx,.component.tsx,.types.ts}`
- Modify: the Amazon-account create/edit form under `apps/web/src/features/amazon/`
- Modify: RTK Query API files that (a) save store settings, (b) create/update amazon accounts — ensure new fields flow through
- Modify: `packages/shared/src/i18n/resources/{en,tr}/translation.json`

**Interfaces:** follow the `amazonTaxRate` field template (A1.1) end-to-end.

- [ ] **Step 1: i18n keys (en + tr)**

Add to both `translation.json` files under `storeSettings.storeSettings`:
```json
"autoFulfillEnabled": "Automatically place Amazon orders after eBay sales",
"autoFulfillEnabledHint": "When on, SellerHill buys the item on Amazon with your linked buyer account. Disable to order manually.",
"trackingConversionProvider": "Tracking-number conversion",
"trackingConversionProviderHint": "Real carrier numbers are forwarded as-is. Amazon Logistics (TBA) passes through unchanged."
```
And an `amazon.autoFulfill.*` group:
```json
"autoFulfillEnabled": "Use this account for auto-fulfillment",
"autoFulfillCapTotal": "Max order total (auto-fulfill cap)",
"autoFulfillDryRun": "Dry-run (run the flow without placing the order)"
```
Plus the guardrail error under `amazon.errors`:
```json
"autoFulfillProxyRequired": "Auto-fulfillment requires a proxy to be configured by the operator.",
"autoFulfillCapRequired": "Set a max order total to enable auto-fulfillment on this account."
```
(TR equivalents in the `tr` file.) Rebuild shared.

- [ ] **Step 2: StoreSettingsDrawer — toggle + provider select**

Following the `amazonTaxRate` template:
- `types.ts`: add `autoFulfillEnabled`, `trackingConversionProvider` (+ `onAutoFulfillEnabledChange`, `onTrackingConversionProviderChange`) to `StoreSettingsDrawerComponentProps`.
- `container.tsx`: `useState<boolean>(config?.autoFulfillEnabled ?? false)`, `useState<TrackingConversionProvider>(config?.trackingConversionProvider ?? 'local')`; reset on open/scope change; include both in the `saveSettings` payload; handlers.
- `component.tsx`: a `ToggleRow` for the master toggle (template: the `validateTitle` row) + a `Select` for the provider (`local` only; `api` disabled with a "coming soon" caption). Presentation-only — no hooks beyond `useTranslation`.

- [ ] **Step 3: Amazon account edit form — enable / cap / dry-run**

In the account create/edit form, add:
- `ToggleRow` for `autoFulfillEnabled`.
- `ModernTextInput` (number, floating label) for `autoFulfillCapTotal`.
- `ToggleRow` for `autoFulfillDryRun`.
Wire into the create/update mutation payload. Surface the guardrail errors via `showMessage` + `getErrorI18nKey` (mapping the backend `autoFulfillProxyRequired` / `autoFulfillCapRequired`).

- [ ] **Step 4: Typecheck + build + manual verification**

Run: `pnpm --filter @repo/ui build` (if any `@repo/ui` atom used changed) then `pnpm typecheck` (web app pre-existing errors allowed; no **new** ones).
Manual: open the drawer, flip the toggle, set provider; open an Amazon account, enable auto-fulfill, set a cap, toggle dry-run; save both; reload and confirm values persist; toggle auto-fulfill with proxy unset → see the guardrail message.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add apps/web/src/features/settings apps/web/src/features/amazon packages/shared/src/i18n
git commit -m "feat(a2): store-settings auto-fulfill toggle + provider; per-account enable/cap/dry-run UI"
```

---

## Task 11: Frontend — orders `auto_fulfill_status` chip + needs-attention filter

**Files:**
- Modify: shared `OrderDto` to expose `autoFulfillStatus` + `autoFulfillBlockedReason` (if not already).
- Modify: orders list + detail (`apps/web/src/features/orders/`) to render the chip and a needs-attention filter.
- Modify: the orders RTK Query API + backend `findOne`/list SELECT to include the two columns.
- Modify: `packages/shared/src/i18n/resources/{en,tr}/translation.json`.

- [ ] **Step 1: Backend exposes the columns**

Add `o.auto_fulfill_status, o.auto_fulfill_blocked_reason` to the orders list/detail SELECTs and map them onto `OrderDto`. Rebuild shared after adding to the DTO type.

- [ ] **Step 2: i18n labels for `AutoFulfillStatus`**

Add an `orders.autoFulfill.status.*` group with a label per enum value (pending/running/placed/blocked/failed/dry_run/skipped) + a short reason map for `blocked_reason` (no_asin/captcha/otp/login/out_of_stock/address/payment/cap/no_confirmation) in both EN and TR. Rebuild shared.

- [ ] **Step 3: Render chip + filter**

- A `Badge`/chip on order rows + detail whose `variant`/color is derived from `autoFulfillStatus` (e.g. `placed`→success, `running`→info, `blocked`/`failed`→error/warning, `dry_run`→neutral, `pending`/`skipped`→muted). Use a `<Badge>` from `@repo/ui` (stateless atom) — no native elements.
- A filter control (existing filter row pattern) to show only `blocked`/`failed` ("needs attention") so the user can fall back to manual linking.
- Component files stay presentation-only; status→variant mapping + filter state live in the container/hooks.

- [ ] **Step 4: Typecheck + manual verification**

`pnpm typecheck` (no new web errors). Manual: ingest orders across the status spectrum and confirm chips render correctly in EN and TR; apply the needs-attention filter and confirm only blocked/failed rows show.

- [ ] **Step 5: Lint + commit**

```bash
pnpm lint
git add apps/web/src/features/orders packages/shared
git commit -m "feat(a2): orders auto_fulfill_status chip + needs-attention filter (EN/TR)"
```

---

## Task 12: CLAUDE.md sync

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md**

Add an "Automated Amazon Fulfillment (A2)" subsection under Order Management covering: the `auto-fulfill` queue (producer in Orders `upsertOrder` `xmax=0` hook, processor in Amazon module), the round-robin account selection (`auto_fulfill_enabled` pool, oldest-`last_used_at`), the step-structured `AmazonCheckoutService` with the review-step hard cap + dry-run + fail-closed `AutoFulfillBlockedReason`, the pluggable real-only `TrackingConverter`, the `ProxyService` + per-user sticky residential proxy + per-account persistent browser profile + `ProxyAssignmentStrategy` seam, the admin-only `fulfillment-evidence/` screenshots, and the A1 reuse (link → `recomputeProfit` → existing tracker). Add migrations `036`/`037`/`038` to the migrations table. Add the new env vars and the `auto-fulfill` queue to the queue list. Note the proxy-required guardrail and that existing scraping falls back to direct when proxy is unset.

- [ ] **Step 2: Lint + commit**

```bash
pnpm lint
git add CLAUDE.md
git commit -m "docs(a2): CLAUDE.md sync for automated Amazon fulfillment"
```

---

## Self-Review (completed)

**Spec coverage:** every spec section maps to a task — §1 anti-ban stack → T4 (proxy/persistent context/fingerprint/strategy seam) + T2 (round-robin/strategy token) + T5 (sequential via per-account rate-limit + producer) + T6 (human-like behavior, tight spacing); §2 data model → T1; §3 trigger & queue lifecycle → T5 + T8; §4 checkout service → T6; §5 post-purchase link + tracking → T7; §6 tracking converter → T3; §7 guardrails → T5 (coarse gate), T6 (review-step cap, dry-run, fail-closed), T9 (proxy/cap-required); §8 settings UI → T10 + T11; §9 env → T4 + T9; §10 testing → T2 + T3 (Jest) + dry-run (T6); §11 risks → addressed via guardrails + strategy seam; open questions (resolved) → T4/T5/T6/T9. No spec section unaddressed.

**Placeholder scan:** the Playwright step-helper bodies in T6 (ensureLoggedIn/selectShipToAddress/readReviewGrandTotal/parseConfirmation, etc.) are intentionally DOM-specific and marked "adapt selectors to live DOM" with the exact blocked-reason each must throw and the dry-run verification that proves correctness — this is the established scraping-task pattern (cf. A1 Task 7's `scrapeAccountOrders` "add if absent"). No "TBD"/"add error handling"/"similar to Task N" steps.

**Type consistency:** `AutoFulfillStatus` values (`pending|running|placed|blocked|failed|dry_run|skipped`) match across enum (T1), helper `shouldSkipFulfillStart` (T2), producer (T5), checkout (T6), processor (T8). `AutoFulfillBlockedReason` union matches across helpers (T2) and checkout (T6). `TrackingConversionProvider` (`local|api`) matches across enum (T1), converter `resolveConverter` (T3), settings (T9/T10). Queue name `'auto-fulfill'` identical in producer (T5) and processor (T8). `recomputeProfit` (A1 name) used uniformly. `AUTO_FULFILL_QUEUE` is defined in both the producer file (T5) and processor file (T8) as the same literal — single source would be cleaner; implementer may hoist to one shared constant.
