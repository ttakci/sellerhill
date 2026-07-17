# Estimated Provisional Profit (A1.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a clearly-labeled **estimated** net profit for provisional orders (matched to a listing but not yet linked to an Amazon order), using the product's last known Amazon price + a user-configured Amazon tax-rate store setting.

**Architecture:** New `amazonTaxRate` store setting (per-user global). A pure `estimateProvisionalNetProfit` helper. `recomputeProfit` injects `StoreSettingsService` and uses the estimate for the provisional branch. New `profitBasis` field signals the FE to label estimates. Confirmed (linked) headline stays pure. Full FE across Settings + order detail + orders list + dashboard.

**Tech Stack:** NestJS 10 (raw `pg`), React 18 + RTK Query + Emotion, Jest (apps/api). Builds on A1 (`cost_capture_status`, nullable `net_profit`, `recomputeProfit`).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-17-estimated-provisional-profit-design.md`.
- **Backend:** no `any`, no `eslint-disable`, no `@ts-ignore`. New constants/enums in `packages/shared` first. Follow the canonical store-settings pattern exactly (edit sites enumerated per task).
- **Frontend:** strict container/component/style/types 4-file split (CLAUDE.md rule 6). Design-system primitives only — numeric input uses `ModernTextInput` (`type="number"`). No inline styles, no hardcoded colors/spacing (`tkn()`). **No hardcoded UI strings** — every new string in BOTH `packages/shared/src/i18n/resources/{en,tr}/` first, via `t()` (rule 12).
- **`packages/*/dist/` gitignored** — after editing shared, run `pnpm --filter @repo/shared build`; do not commit dist.
- **Pre-commit runs `pnpm lint` (max-warnings 0).** Baseline is now CLEAN (`pnpm typecheck` = 0 errors after stabilize). Introduce zero new errors. `pnpm --filter api test` must pass (existing + new).
- **Commit discipline:** stage EXPLICIT paths only (`git add <files>`), never `.`/`-A`. Do NOT run `git stash`/`pop`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `apps/api/migrations/035_alter_store_settings_add_amazon_tax_rate.sql` | add column | Create |
| `apps/api/src/modules/store-settings/store-settings.service.ts` | entity/defaults/both-upserts/mapper | Modify |
| `apps/api/src/modules/store-settings/dto/save-store-settings.dto.ts` | class-validator field | Modify |
| `packages/shared/src/domain/store-settings/store-settings.types.ts` | `StoreSettings.amazonTaxRate` | Modify |
| `packages/shared/src/domain/store-settings/store-settings.dto.ts` | `SaveStoreSettingsRequest.amazonTaxRate` | Modify |
| `packages/shared/src/schemas/store-settings/storeSettings.schema.ts` | zod field | Modify |
| `packages/shared/src/domain/orders/orders.types.ts` | `OrderDto.profitBasis` | Modify |
| `packages/shared/src/domain/dashboard/dashboard.types.ts` | recent-order `profitBasis` if typed | Modify |
| `apps/api/src/modules/orders/profit-calculation.ts` | `estimateProvisionalNetProfit` (+ maybe `deriveProfitBasis`) | Modify |
| `apps/api/src/modules/orders/profit-calculation.spec.ts` | tests | Modify |
| `apps/api/src/modules/orders/orders.module.ts` | import StoreSettingsModule | Modify |
| `apps/api/src/modules/orders/order-sync.service.ts` | inject service, provisional estimate, `user_id` SELECT, `profitBasis` | Modify |
| `apps/api/src/modules/orders/orders.service.ts` | `profitBasis` in `mapRowToDto` | Modify |
| `apps/api/src/modules/dashboard/dashboard.service.ts` | `profitBasis` in recent-orders mapper | Modify |
| `apps/web/src/features/store-settings/StoreSettingsPage.container.tsx` | defaultValues + reset | Modify |
| `apps/web/src/features/store-settings/StoreSettingsPage.component.tsx` | 4th SettingsCard | Modify |
| `apps/web/src/features/orders/details/*` | estimate badge + note | Modify |
| `apps/web/src/features/orders/all/*` | list estimate badge | Modify |
| `apps/web/src/features/dashboard/*` | tier label + tooltip + recent-card badge | Modify |
| `packages/shared/src/i18n/resources/{en,tr}/storeSettings.json` | rate label + desc | Modify |
| `packages/shared/src/i18n/resources/{en,tr}/translation.json` | estimate badges/notes | Modify |

---

## Task 1: Migration + `amazonTaxRate` store setting (backend + shared)

**Files:**
- Create: `apps/api/migrations/035_alter_store_settings_add_amazon_tax_rate.sql`
- Modify: `apps/api/src/modules/store-settings/store-settings.service.ts` (entity ~`:9-22`, defaults ~`:56-68`, destructure ~`:95`, both INSERTs `:105-106` & `:124-125`, both ON CONFLICT SETs `:109-114` & `:130-134`, both param arrays `:118` & `:137`, mapper `:147-166`)
- Modify: `apps/api/src/modules/store-settings/dto/save-store-settings.dto.ts` (after `zipCode` ~`:54`)
- Modify: `packages/shared/src/domain/store-settings/store-settings.types.ts` (`StoreSettings` ~`:13-32`)
- Modify: `packages/shared/src/domain/store-settings/store-settings.dto.ts` (`SaveStoreSettingsRequest` ~`:6-18`)
- Modify: `packages/shared/src/schemas/store-settings/storeSettings.schema.ts` (~`:15-27`)

**Interfaces:**
- Produces: `amazon_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0` column; `StoreSettings.amazonTaxRate: number`; round-trips through save/get/list; shared Zod `amazonTaxRate: z.number().min(0).max(100)`.

- [ ] **Step 1: Migration** — create `apps/api/migrations/035_alter_store_settings_add_amazon_tax_rate.sql`:
```sql
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS amazon_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;
```

- [ ] **Step 2: Backend entity + defaults** — in `store-settings.service.ts` add `amazon_tax_rate: number;` to `StoreSettingsEntity`; add `amazonTaxRate: 0` to the defaults object (~`:56-68`).

- [ ] **Step 3: Backend upsert (ALL sites)** — in `saveSettings`: add `amazonTaxRate` to the destructure (~`:95`); to BOTH INSERT column lists (`:105-106`, `:124-125`); to BOTH `ON CONFLICT DO UPDATE SET` clauses (`:109-114`, `:130-134`); to BOTH params arrays (`:118`, `:137`). Miss any one and save silently drops the field.

- [ ] **Step 4: Backend mapper** — `mapToDto` (~`:147-166`): `amazonTaxRate: Number(entity.amazon_tax_rate) || 0,`.

- [ ] **Step 5: Backend DTO** — `dto/save-store-settings.dto.ts`: `@IsNumber() @Min(0) @Max(100) @ApiProperty({ example: 7 }) amazonTaxRate!: number;` (import `IsNumber, Min, Max`).

- [ ] **Step 6: Shared type + DTO + schema** — `store-settings.types.ts`: `amazonTaxRate: number;` on `StoreSettings`. `store-settings.dto.ts`: `amazonTaxRate: number;` on `SaveStoreSettingsRequest`. `storeSettings.schema.ts`: `amazonTaxRate: z.number().min(0).max(100),`. Build: `pnpm --filter @repo/shared build`.

- [ ] **Step 7: Verify + commit** — `pnpm lint` green; `pnpm typecheck` 0 errors; migration applies on API boot (or note if DB down). Manual: `GET /v1/store-settings` returns `amazonTaxRate: 0`; `POST /v1/store-settings` with `amazonTaxRate: 7` persists. Commit explicit paths.

---

## Task 2: Pure `estimateProvisionalNetProfit` helper (TDD)

**Files:**
- Modify: `apps/api/src/modules/orders/profit-calculation.ts` (add helper; optionally `deriveProfitBasis`)
- Modify: `apps/api/src/modules/orders/profit-calculation.spec.ts` (tests)

**Interfaces:**
- Produces: `estimateProvisionalNetProfit(input: { ebayEarnings: number; purchasePrice: number; amazonTaxRatePct: number }): number | null` (null when `purchasePrice <= 0`); optional `deriveProfitBasis(status: OrderCostCaptureStatus): 'confirmed' | 'estimated' | null`.

- [ ] **Step 1: Failing tests** — append to `profit-calculation.spec.ts`:
```ts
import { estimateProvisionalNetProfit } from './profit-calculation';

describe('estimateProvisionalNetProfit', () => {
  it('returns null when purchase price unknown', () => {
    expect(estimateProvisionalNetProfit({ ebayEarnings: 100, purchasePrice: 0, amazonTaxRatePct: 7 })).toBeNull();
  });
  it('subtracts estimated Amazon tax (on purchase price)', () => {
    // 100 - 60 - (60 * 0.07) = 100 - 60 - 4.2 = 35.8
    expect(estimateProvisionalNetProfit({ ebayEarnings: 100, purchasePrice: 60, amazonTaxRatePct: 7 })).toBe(35.8);
  });
  it('tax rate 0 -> no tax deducted', () => {
    expect(estimateProvisionalNetProfit({ ebayEarnings: 100, purchasePrice: 60, amazonTaxRatePct: 0 })).toBe(40);
  });
  it('rounds to 2 decimals', () => {
    expect(estimateProvisionalNetProfit({ ebayEarnings: 50, purchasePrice: 33.333, amazonTaxRatePct: 7 })).toBe(14.33);
  });
});
```
Run `pnpm --filter api test` → RED (helper missing).

- [ ] **Step 2: Implement** — in `profit-calculation.ts`:
```ts
export interface EstimateInput { ebayEarnings: number; purchasePrice: number; amazonTaxRatePct: number; }
/**
 * Estimated net profit for provisional orders (Amazon order not yet placed).
 * Uses the product's last known Amazon price + a user-configured tax rate.
 * Shipping is NOT estimated (variable; often $0 on Prime) — disclosed in UI.
 * Returns null when purchase price is unknown (<=0).
 */
export function estimateProvisionalNetProfit(input: EstimateInput): number | null {
  const { ebayEarnings, purchasePrice, amazonTaxRatePct } = input;
  if (!purchasePrice || purchasePrice <= 0) return null;
  const estimatedTax = purchasePrice * (Math.max(0, amazonTaxRatePct) / 100);
  return Math.round((ebayEarnings - purchasePrice - estimatedTax) * 100) / 100;
}
```
Optionally add `deriveProfitBasis(status)` returning `'confirmed'` for LINKED, `'estimated'` for PROVISIONAL, else `null` (+ test).

- [ ] **Step 3: GREEN + verify** — `pnpm --filter api test` all pass; `pnpm lint` green; `pnpm typecheck` 0 errors. Commit explicit paths.

---

## Task 3: Backend wiring — estimate in `recomputeProfit` + `profitBasis`

**Files:**
- Modify: `apps/api/src/modules/orders/orders.module.ts` (imports ~`:17-22`)
- Modify: `apps/api/src/modules/orders/order-sync.service.ts` (constructor ~`:35-41`, recompute SELECT ~`:337`, provisional branch ~`:351/385`)
- Modify: `packages/shared/src/domain/orders/orders.types.ts` (`OrderDto.profitBasis`)
- Modify: `apps/api/src/modules/orders/orders.service.ts` (`mapRowToDto` populate `profitBasis`)
- Modify: `apps/api/src/modules/dashboard/dashboard.service.ts` (recent-orders mapper `profitBasis`)

**Interfaces:**
- Consumes: `StoreSettingsService.getResolvedSettings(userId, null)`; `estimateProvisionalNetProfit`; `deriveProfitBasis`.
- Produces: provisional orders persist an estimated `net_profit`; `OrderDto.profitBasis` populated in orders + dashboard.

- [ ] **Step 1: Shared `profitBasis`** — `orders.types.ts`: add `profitBasis?: 'confirmed' | 'estimated' | null;` to `OrderDto`. Rebuild shared.

- [ ] **Step 2: Module import** — `orders.module.ts`: add `StoreSettingsModule` to `imports` (it's already exported by that module).

- [ ] **Step 3: Inject + resolve** — `order-sync.service.ts`: inject `private readonly storeSettingsService: StoreSettingsService`. Add `o.user_id` to the recompute SELECT. Before the provisional computation, resolve `const settings = await this.storeSettingsService.getResolvedSettings(o.user_id, null);` (best-effort; `try/catch` → default `{ amazonTaxRate: 0 }`).

- [ ] **Step 4: Provisional estimate branch** — where status is PROVISIONAL (product resolvable, Amazon not linked), compute net_profit via `estimateProvisionalNetProfit({ ebayEarnings, purchasePrice: resolvedPurchase, amazonTaxRatePct: Number(settings.amazonTaxRate) || 0 })` instead of the plain `ebayEarnings − purchasePrice`. LINKED keeps real `amazon_tax`/`amazon_shipping` (unchanged). Persist `profit_basis` is derived, not stored — see Step 5 (it's derived from `cost_capture_status` at read time, no new column).

- [ ] **Step 5: Derive `profitBasis` at read time** — in `orders.service.ts mapRowToDto` and `dashboard.service.ts getRecentOrders` mapper, set `profitBasis: deriveProfitBasis(row.cost_capture_status as OrderCostCaptureStatus)` (LINKED→'confirmed', PROVISIONAL→'estimated', else null). No DB column needed — pure derivation from the existing status.

- [ ] **Step 6: Verify + commit** — `pnpm --filter api test` green; `pnpm lint` green; `pnpm typecheck` 0 errors; build emits. Manual: set `amazonTaxRate=7` → a provisional order's `net_profit` reflects the estimate + `profitBasis='estimated'`; a linked order stays `profitBasis='confirmed'`. Commit explicit paths.

---

## Task 4: FE — Settings card for Amazon tax rate

**Files:**
- Modify: `apps/web/src/features/store-settings/StoreSettingsPage.container.tsx` (defaultValues `:47-56`, reset `:66-75`)
- Modify: `apps/web/src/features/store-settings/StoreSettingsPage.component.tsx` (new SettingsCard inside `<S.GlobalGrid>` ~`:263`)
- Modify: `packages/shared/src/i18n/resources/{en,tr}/storeSettings.json`

**Constraints:** container/component split; `ModernTextInput type="number"`; no hardcoded strings.

- [ ] **Step 1: i18n** — in `storeSettings.json` (en + tr), inside the `storeSettings` object add:
```json
"amazonTaxRate": "Amazon Purchase Tax Rate (%)",
"amazonTaxRateDesc": "Estimated Amazon sales-tax rate applied to the purchase cost when an order's profit is still provisional (Amazon order not yet placed). Set to your buyer account's state rate (e.g. 7). 0 = no tax estimated."
```
(TR translation in the tr file.) Rebuild shared.

- [ ] **Step 2: Container** — `defaultValues`: `amazonTaxRate: 0`; `reset`: `amazonTaxRate: settings.amazonTaxRate ?? 0` (use `valueAsNumber`/zod coercion so the form value is numeric).

- [ ] **Step 3: Component** — add a 4th `SettingsCard variant="section"` inside `<S.GlobalGrid>` with an icon (e.g. `percent`/`receipt`), title `t('storeSettings:storeSettings.amazonTaxRate')`, description `t('storeSettings:storeSettings.amazonTaxRateDesc')`, and `<ModernTextInput name="amazonTaxRate" control={control} type="number" label={t('storeSettings:storeSettings.amazonTaxRate')} />`. No styled-typography; use `<Text variant>`. (If `percent`/`receipt` icon names don't exist in the icon map, use an existing one like `tag`.)

- [ ] **Step 4: Verify + commit** — `pnpm --filter @repo/ui build` (if any ui change — likely none); `pnpm lint` green; `pnpm typecheck` 0 errors. Manual: Settings page shows the card; entering 7 and saving persists + reloads. Commit explicit paths.

---

## Task 5: FE — estimate labels (order detail + orders list + dashboard)

**Files:**
- Modify: `apps/web/src/features/orders/details/*` (badge + note where `profitBasis === 'estimated'`)
- Modify: `apps/web/src/features/orders/all/*` (list badge on provisional rows)
- Modify: `apps/web/src/features/dashboard/*` (provisional tier "estimated" label + tooltip; recent-order card badge)
- Modify: `packages/shared/src/i18n/resources/{en,tr}/translation.json` (estimate badges/notes)

**Constraints:** container/component split; `<Badge>` / `<Text>` from design system; `tkn()` colors; no hardcoded strings; loading state in containers (rule 5).

- [ ] **Step 1: i18n** — translation.json (en + tr) add keys: `orders.estimateBadge` ("Estimated"), `orders.estimateNote` ("Estimated profit — finalizes when the Amazon order is placed. Based on the last known Amazon price; Amazon shipping not included."), `dashboard.provisionalEstimatedLabel` ("Estimated (pending Amazon fulfillment)"), `dashboard.provisionalEstimatedTooltip` ("Orders awaiting Amazon fulfillment use an estimated cost (Amazon tax @ {rate}%)."). (TR translations.)

- [ ] **Step 2: Order detail** — where net profit is shown, if `order.profitBasis === 'estimated'`, render an `<Badge tone="warning">` "Estimated" + a `<Text variant="caption">` note. (Component file — presentation only; the `profitBasis` value comes from the container/query.)

- [ ] **Step 3: Orders list** — provisional rows show a small "Estimated" badge near the profit cell. (Component file.)

- [ ] **Step 4: Dashboard** — provisional tier labeled "Estimated" + a tooltip with the rate; recent-order cards show the badge when `profitBasis === 'estimated'`. (Component file.)

- [ ] **Step 5: Verify + commit** — `pnpm lint` green; `pnpm typecheck` 0 errors; `pnpm --filter web build` (or dev) renders without errors. Manual: a provisional order shows the badge/note; dashboard tier labeled; setting a rate updates the tooltip. Commit explicit paths.

---

## Task 6: CLAUDE.md + final-verification

- [ ] **Step 1: CLAUDE.md** — document: the `amazonTaxRate` store setting (per-user global, default 0), the provisional-estimate formula, `profitBasis` ('confirmed'|'estimated'|null) derivation, and that the confirmed headline stays pure. Add migration 035 to the migrations table.

- [ ] **Step 2: Final verify** — `pnpm lint` green; `pnpm typecheck` 0 errors; `pnpm --filter api test` all pass (existing 25 + new estimate tests); `pnpm --filter api build` + `pnpm --filter web build` succeed; end-to-end manual: configure rate → provisional estimate appears + labeled → link Amazon order → flips to confirmed.

- [ ] **Step 3: Commit** explicit path (`CLAUDE.md`).

---

## Self-Review (completed)

**Spec coverage:** store setting (T1), estimate helper (T2), backend wiring + profitBasis (T3), FE settings (T4), FE labels (T5), docs (T6). All spec sections mapped.

**Placeholder scan:** icon name fallback noted (`percent`/`receipt` may not exist → `tag`); store-settings upsert "update ALL sites" is emphasized (the easy-to-miss step). No TBDs.

**Type consistency:** `profitBasis: 'confirmed'|'estimated'|null` consistent across shared `OrderDto`, `deriveProfitBasis`, orders/dashboard mappers, and FE consumers. `amazonTaxRate: number` consistent across migration/entity/DTO/shared/schema/FE form.
