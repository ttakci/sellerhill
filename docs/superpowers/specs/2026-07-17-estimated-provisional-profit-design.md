# A1.1 — Estimated Provisional Profit (Design)

**Date:** 2026-07-17
**Status:** Draft, awaiting user review
**Scope:** Backend (`apps/api`) + shared + frontend (`apps/web`). Builds on A1.

---

## Context

A1 made net-profit trustworthy by introducing `cost_capture_status` (pending/linked/provisional/failed/untracked) and a nullable `net_profit`. **Confirmed** (linked) profit — scraped real Amazon costs — is the dashboard headline and is trusted.

The remaining UX gap: orders matched to a listing (product's last Amazon price known) but **not yet linked to an Amazon order** are `provisional`. Their `net_profit = ebayEarnings − purchasePrice` currently **ignores Amazon sales tax** → it overstates. And orders where the product price is known but not yet costed show nothing useful.

**A1.1's job:** show a clearly-labeled **estimate** for provisional orders, using the product's last known Amazon price + a user-configured Amazon tax rate. The estimate is honest *because it is labeled* and the assumption behind it (the tax rate) is visible/editable in Settings.

Out of scope: A2 (auto-ordering), B (LLM), C (assistant).

---

## Design

### 1. New store setting: `amazonTaxRate`

- **Per-user global** numeric setting, percent (0–100), default `0`. User-configurable with a label + description in the Settings hub.
- Migration `035_alter_store_settings_add_amazon_tax_rate.sql`: `ALTER TABLE store_settings ADD COLUMN amazon_tax_rate NUMERIC(5,2) NOT NULL DEFAULT 0;` (mirrors `019` precedent).
- Follows the canonical store-settings pattern end-to-end (backend service entity/defaults/both-upserts/mapper/DTO; shared type/DTO/Zod schema; FE container defaultValues+reset; i18n en/tr). Exact edit sites enumerated in the implementation plan.
- **Why global (not per-store):** orders have no `storeId`; the rate is a business assumption tied to the user's Amazon buyer account state. A per-account refinement is a future option (when A2 assigns Amazon accounts to orders), but for now the user's global row is the source.

### 2. Estimate logic (backend)

- `OrderSyncService.recomputeProfit` injects `StoreSettingsService` (orders module imports `StoreSettingsModule`); resolves the user's **global** settings via `getResolvedSettings(userId, null)` (needs `user_id` added to the recompute SELECT).
- For **provisional** orders (real `amazon_tax` not captured — i.e. `cost_capture_status = provisional`), substitute estimated Amazon tax:
  `estimatedAmazonTax = purchasePrice × (amazonTaxRate / 100)`
  and compute `net_profit = ebayEarnings − purchasePrice − estimatedAmazonTax − 0` (shipping not estimated; it is noted as excluded).
- **Linked** orders keep using the real scraped `amazon_tax`/`amazon_shipping` — unchanged. **Pending/failed/untracked** keep NULL/last-known — unchanged.
- Extract the estimate math into a pure helper `estimateProvisionalNetProfit({ ebayEarnings, purchasePrice, amazonTaxRatePct }): number | null` (in `profit-calculation.ts`) with Jest tests. `recomputeProfit` calls it for the provisional branch.

### 3. `profitBasis` field (the label signal)

- Add `profitBasis: 'confirmed' | 'estimated' | null` to `OrderDto` (shared) and to dashboard recent-order rows.
- Derivation: `linked` → `'confirmed'`; `provisional` → `'estimated'`; everything else → `null`.
- Populate in `orders.service.ts mapRowToDto` and `dashboard.service.ts getRecentOrders` mapper (the `cost_capture_status` is already selected in both after A1).

### 4. Dashboard — estimate clearly labeled, headline untouched

- Headline `net_profit`/`profitConfirmed` (linked) stays pure — **no change**.
- `profitProvisional` aggregate now sums the estimates (it already exists from A1; A1.1 changes the per-row provisional value, not the aggregate SQL).
- FE: provisional tier shows an "estimated" label + tooltip "Orders awaiting Amazon fulfillment use an estimated cost (Amazon tax @ X%)."

### 5. Frontend (full)

- **Settings hub:** 4th `SettingsCard variant="section"` inside `<S.GlobalGrid>` ("Amazon Purchase Tax Rate %") with a `ModernTextInput name="amazonTaxRate" type="number"` + description text. Container `defaultValues`/`reset` carry the field; save flows through existing `useSaveStoreSettingsMutation`.
- **Order detail:** when `profitBasis === 'estimated'`, render an "Estimated profit" badge + helper text "Finalizes when the Amazon order is placed. Based on the last known Amazon price; Amazon shipping not included." (Container/Component split per rules.)
- **Orders list:** an "estimate" badge on provisional rows.
- **i18n:** all new strings in `storeSettings.*` (rate label/desc) + `orders.*` / `dashboard.*` (estimate badges/notes) in both en/tr first — no hardcoded UI strings (rule 12).

### 6. Transparency safeguards

- Every estimated number is labeled (badge/note/tooltip). Never mixed into the confirmed headline.
- The tax-rate assumption is visible and editable in Settings (with explanatory copy).
- Note that `productPrice` is the **last known** Amazon price (Keepa refresh); real checkout price may differ — stated in the order-detail note.

---

## Components & files

**Migration:** `apps/api/migrations/035_alter_store_settings_add_amazon_tax_rate.sql`.

**Backend store-settings:** `store-settings.service.ts` (entity/defaults/both-upserts/mapper), `dto/save-store-settings.dto.ts`.

**Backend orders/dashboard:** `order-sync.service.ts` (inject StoreSettingsService, provisional estimate branch, `user_id` in SELECT), `profit-calculation.ts` (`estimateProvisionalNetProfit` + tests), `orders.service.ts` (`profitBasis` in mapper), `dashboard.service.ts` (`profitBasis` in recent-orders mapper), `orders.module.ts` (import StoreSettingsModule).

**Shared:** `store-settings.types.ts`, `store-settings.dto.ts`, `storeSettings.schema.ts` (add `amazonTaxRate`), `orders.types.ts` (`profitBasis` on `OrderDto` + dashboard types).

**Frontend:** `features/store-settings/StoreSettingsPage.{container,component}.tsx` + i18n; `features/orders/details/*` (estimate badge/note); `features/orders/all/*` (list badge); `features/dashboard/*` (tier label + tooltip).

**Env:** none (the rate is a store setting, not env).

---

## Testing

- **Jest:** `estimateProvisionalNetProfit` pure helper (zero/negative purchase → null; rounds to 2dp; applies tax correctly; taxRate 0 → no tax). Add to the existing `apps/api` harness.
- **Manual:** set `amazonTaxRate` in Settings → a provisional order's net_profit reflects the estimate and `profitBasis='estimated'`; link the Amazon order → `profitBasis='confirmed'`, real costs used; dashboard provisional tier labeled. `pnpm lint`/`typecheck`/`build` clean; 25+ jest pass.

---

## Risks & trade-offs

- **Labeled estimate vs "unknown shown as unknown" purity:** A1's strict stance is slightly relaxed, but a labeled estimate (with a visible, editable assumption) is more honest than the current silent tax-omission (which overstates). Net positive; confirmed headline stays pure.
- **`productPrice` staleness:** last known Amazon price may differ from the checkout price — acceptable for an estimate, disclosed in the UI.
- **Shipping not estimated:** conservative (often $0 on Prime); disclosed.

## Decisions (locked)

1. **Tax-rate default = `0`.** No tax is silently applied until the user enters their rate in Settings (honest opt-in; the description copy prompts them to configure it). Confirmed in user review.
2. The orders-list "estimate" badge also applies to dashboard recent-orders cards (same `profitBasis` signal) for consistency.
