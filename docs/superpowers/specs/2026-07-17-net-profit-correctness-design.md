# A1 — Net Profit Correctness (Design)

**Date:** 2026-07-17
**Status:** Draft, awaiting user review
**Scope:** Backend only (`apps/api`). No frontend changes required for correctness (dashboard already consumes `net_profit`), but a small DTO/type addition for confidence is included.

---

## Roadmap context

This is the first of four sequenced specs. The user's overarching goal is **accurate true net profit** as a competitive differentiator, plus an automated Amazon dropship-fulfillment system, a shared local-LLM layer, and a support assistant. Sequencing agreed with the user:

| Spec | Title | Status |
|---|---|---|
| **A1** | **Net profit correctness** (this doc) | Design |
| A2 | Automated Amazon fulfillment (auto-order + tracking-number conversion) | Future |
| B | Shared LLM infra (`LlmClient`) + content-AI refactor | Future |
| C | Assistant backend (RAG chatbot + ticket escalation) | Future |

A1 ships the differentiator (trustworthy net profit) at low risk and without the financial/ban risk of A2's auto-ordering. A2 builds on A1's cost-capture foundation.

---

## Problem statement

The net-profit **formula** is correct and matches `CLAUDE.md`:

```
netProfit = ebayEarnings − purchasePrice − amazonTax − amazonShipping
```

(`ebay_earnings` = eBay `totalDueSeller`, already net of eBay commission. `transactionFee`/`adFee` are display-only estimates and correctly excluded — they do not enter `net_profit`.)

The **coverage** is broken. Net profit is only trustworthy for the narrow slice of orders that are (1) matched to a SellerHill listing **and** (2) manually linked to a scraped Amazon order. Everywhere else it silently misleads:

| Case | Current behavior | Effect |
|---|---|---|
| Order not matched to a listing | `recalculateProfit` early-returns; `net_profit` stays `0` | **Understated** (revenue counts fully, profit is zero) |
| Listing-matched, Amazon **not** linked | `amazon_tax`/`amazon_shipping` default `0` | **Overstated** by missing Amazon tax + shipping |
| Amazon scrape fails (DOM changed) | `extractFinancials` returns all-zeros, persisted silently | **Overstated**, no warning |
| eBay re-sync adjusts `totalDueSeller` | `ON CONFLICT DO UPDATE` skips profit fields; `recalculateProfit` not re-run | **Stale** profit |
| Dashboard "recent orders" | Mapper hardcodes financial fields to `0` | Wrong detail cards |

Key references:
- Formula: `apps/api/src/modules/orders/order-sync.service.ts:347-359`
- Tracked-only gate: `order-sync.service.ts:289` (`WHERE … AND o.listing_id IS NOT NULL`), called only when `listingId` truthy (`:144-147`)
- Upsert excludes profit fields on update: `order-sync.service.ts:226-240`
- Amazon scrape persistence: `apps/api/src/modules/amazon/amazon.controller.ts:96-171`
- Amazon scrape parser (regex, returns zeros on miss): `apps/api/src/modules/amazon/amazon-order-parser.service.ts:114-141`
- Dashboard aggregations: `apps/api/src/modules/dashboard/dashboard.service.ts:85-97, 277-287, 332-348, 443-465`
- Dashboard recent-orders mapper (hardcoded zeros): `dashboard.service.ts:600-623`
- Schema: `apps/api/migrations/012_create_orders.sql` (financial columns), extended by `024_create_amazon_accounts.sql:21-25`

---

## Design goals

1. **Never silently fake profit.** Unknown is shown as unknown, never as zero or as an inflated number.
2. **Capture real Amazon costs automatically** for manual-mode users (who order on Amazon themselves but don't click "link"), via the existing Amazon scraper.
3. **Make data quality visible** on the dashboard so the user trusts the number — the actual differentiator.
4. **Keep profit fresh** when eBay adjusts an order.

Explicitly **out of scope for A1** (deferred to A2):
- Automatic order *placement* on Amazon (auto-ordering).
- Tracking-number conversion (TBA → carrier format).
- Any new system setting (auto-order toggle, conversion mode).

---

## Architecture

### 1. Data model — order cost-capture status + nullable profit

**Migration `033_alter_orders_cost_capture_status.sql`:**

```sql
-- net_profit becomes nullable: NULL = "unknown", 0 = "we computed zero profit"
ALTER TABLE orders ALTER COLUMN net_profit DROP NOT NULL;
ALTER TABLE orders ALTER COLUMN net_profit DROP DEFAULT;        -- was DEFAULT 0
ALTER TABLE orders ALTER COLUMN purchase_price DROP DEFAULT;    -- was DEFAULT 0
ALTER TABLE orders ALTER COLUMN amazon_tax DROP DEFAULT;
ALTER TABLE orders ALTER COLUMN amazon_shipping DROP DEFAULT;

-- Confidence/state of the Amazon cost capture for this order
CREATE TYPE order_cost_capture_status AS ENUM
  ('pending', 'linked', 'provisional', 'failed', 'untracked');

ALTER TABLE orders
  ADD COLUMN cost_capture_status order_cost_capture_status NOT NULL DEFAULT 'pending';

-- Backfill existing rows from current data
UPDATE orders SET cost_capture_status = 'linked'
  WHERE amazon_linked_at IS NOT NULL;
UPDATE orders SET cost_capture_status = 'untracked'
  WHERE listing_id IS NULL AND cost_capture_status = 'pending';
UPDATE orders SET cost_capture_status = 'provisional'
  WHERE listing_id IS NOT NULL AND amazon_linked_at IS NULL
    AND cost_capture_status = 'pending';

-- Speeds up the per-period profit aggregates that now FILTER on status
CREATE INDEX idx_orders_cost_capture_status ON orders(cost_capture_status);

-- The enum value lives in shared (rule: no hardcoded constant strings)
```

**Status semantics:**

| Status | Meaning | `net_profit` |
|---|---|---|
| `pending` | eBay order in, nothing captured yet, product cost unknown | NULL |
| `provisional` | Product/purchase cost known, Amazon tax+shipping not yet captured | `ebayEarnings − purchasePrice` (partial, flagged) |
| `linked` | Amazon costs fully captured (scraped from a real Amazon order) | full formula — **trusted** |
| `failed` | Amazon scrape ran but returned no usable data; previous values retained | last known (flagged) |
| `untracked` | No listing match; source cost can never be known | NULL |

`net_profit = NULL` cleanly distinguishes "unknown" from "we computed a real zero." `SUM(net_profit)` ignores NULLs naturally.

Shared enum: add `OrderCostCaptureStatus` to `packages/shared/src/domain/orders/` (follows rule 10 — no hardcoded status strings).

### 2. Profit recomputation (`order-sync.service.ts`)

Rename/refactor `recalculateProfit(ebayOrderId)` → `recomputeProfit(ebayOrderId)` with new rules:

- **Drop the tracked-only gate.** Resolve product/purchase cost by `listing_id` first; if absent, fall back to an **ASIN match** against `products` using the eBay line item's ASIN (the eBay order carries the item identifier). Only if neither resolves do we set status `untracked` and `net_profit = NULL`.
- Compute the best-available `net_profit` and **always set `cost_capture_status`** in the same UPDATE:
  - `amazon_linked_at IS NOT NULL` AND `amazon_tax`/`amazon_shipping` captured (non-null, scraped) → `linked`.
  - purchase cost known but Amazon unlinked → `provisional`.
  - no cost resolvable → `untracked`, `net_profit = NULL`.
- Scrape-failure detection writes `failed` (see §3), not `provisional`.

**Re-sync freshness:** in `upsertOrder` (`ON CONFLICT DO UPDATE`), if the incoming `ebay_earnings` differs from the stored value, enqueue `recomputeProfit(ebayOrderId)` after the upsert (idempotent, cheap). Partial refunds / adjusted shipping then refresh profit. The upsert still does **not** overwrite `purchase_price` / `amazon_*` / `net_profit` directly — only the recomputer writes those.

**Insert path:** `ebay-fulfillment.service.ts:222-225` currently passes `netProfit: 0`. Change the insert to set `net_profit = NULL` and `cost_capture_status = 'pending'`. A brand-new eBay order has not yet been costed — `0` would be indistinguishable from "we computed a real zero." `recomputeProfit` runs immediately after insert (for matched orders) and flips the status accordingly.

### 3. Amazon cost-capture integrity (no silent zeroing)

In `AmazonController.linkAmazonOrder` and the new auto-capture path (§4):

- After `AmazonOrderParserService.extractFinancials`, **validate** the result. If `subtotal`, `shipping`, `tax`, `grandTotal` are **all** zero/NaN (the scraper's failure signature), treat as a scrape failure:
  - **Do NOT overwrite** existing non-null `purchase_price`/`amazon_tax`/`amazon_shipping`.
  - Set `cost_capture_status = 'failed'`.
  - Surface to the user (return a structured result the FE shows via `MessageModal`, e.g. "Amazon order found but cost details couldn't be read — profit kept at last known value").
- Add a hardening test to `extractFinancials`: when the summary selectors aren't found, return a tagged failure object `{ ok: false }` rather than `{0,0,0,0}`. Callers branch on `ok`.

This kills the most dangerous current behavior (stale DOM → zeros written → profit looks better than reality).

### 4. Auto cost-capture for manual orders (new `amazon-order-sync` job)

For users who order on Amazon manually but don't click "link," we still capture real costs by scraping each Amazon account's **order list** and matching.

- **Queue:** `amazon-order-sync` (BullMQ), cron every 30 min, one job per Amazon account, concurrency 2. Reuses `AmazonRateLimiter` / `BrowserStateManager` / stealth stack.
- **Flow:** `AmazonScrapingService.scrapeAccountOrders(accountId, since)` opens the account's "Your Orders" page, lists recent orders (since last sync — `amazon_accounts.last_orders_sync_at`), extracts per-order `{ amazonOrderId, asin/productTitle, quantity, grandTotal, tax, shipping, purchasePrice, orderDate, status }`.
- **Match to eBay order:** for each scraped Amazon order, find the best candidate eBay order (same user, `cost_capture_status IN ('pending','provisional')`) by:
  1. product match: `asin = product.asin` via the eBay order's listing→product, **and**
  2. quantity equality, **and**
  3. `|amazonGrandTotal − ebaySaleTotal|` within tolerance (e.g. ±5% or a few dollars), **and**
  4. date proximity (`amazonOrderDate` within ~7 days of `orders.order_date`).
  Use a scored match; if no confident match, skip (never force-link).
- On match: write `purchase_price`, `amazon_tax`, `amazon_shipping`, `amazon_order_id`, `amazon_account_id`, `amazon_linked_at = NOW()`, `cost_capture_status = 'linked'`, then `recomputeProfit`.
- Idempotent & best-effort: failures never throw out of the job; per-order try/catch.

This is the A1 piece that makes net profit accurate at scale without auto-ordering and without manual linking. It is the largest single piece of A1 but reuses existing scraping infra.

### 5. Dashboard — honest, split aggregates (`dashboard.service.ts`)

Update `periodSelect()` and all aggregations to expose confidence tiers instead of one misleading number:

```sql
-- Headline = TRUSTED only
COALESCE(SUM(net_profit) FILTER (
    WHERE status <> 'CANCELLED' AND cost_capture_status = 'linked'), 0) AS profit_confirmed,

-- Provisional (product cost only, Amazon tax/shipping pending)
COALESCE(SUM(net_profit) FILTER (
    WHERE status <> 'CANCELLED' AND cost_capture_status = 'provisional'), 0) AS profit_provisional,

-- How much revenue is still "uncosted" (pending/failed/untracked) — visibility, not a fake number
COALESCE(SUM(sale_total) FILTER (
    WHERE status <> 'CANCELLED'
      AND cost_capture_status IN ('pending','failed','untracked')), 0) AS revenue_uncosted,

COUNT(*) FILTER (WHERE cost_capture_status = 'pending')  AS orders_pending_capture,
COUNT(*) FILTER (WHERE cost_capture_status = 'failed')   AS orders_capture_failed,
COUNT(*) FILTER (WHERE cost_capture_status = 'untracked') AS orders_untracked
```

- The P&L history matrix (`getHistory`) gains `profitConfirmed` / `profitProvisional` columns alongside the existing component breakdown.
- `getRecentOrders` mapper (`:600-623`) stops hardcoding zeros — returns the real `ebayEarnings`, `purchasePrice`, `transactionFee`, `adFee`, `amazonTax`, `amazonShipping`, plus `costCaptureStatus`.
- Frontend `DashboardDataDto` / shared types gain the tiered fields and `costCaptureStatus` enum. FE dashboard surfaces a small "X orders awaiting Amazon cost capture ($Y revenue)" note — the trust signal. (FE card layout changes are minimal and out of the critical path; backend returns the data first.)

`net_profit` of `NULL` flows through correctly because every aggregate uses `COALESCE(SUM(...) FILTER …, 0)`.

---

## Components & files

**Backend (`apps/api`):**
- `migrations/033_alter_orders_cost_capture_status.sql` — new.
- `src/modules/orders/order-sync.service.ts` — refactor `recalculateProfit` → `recomputeProfit` (drop tracked-only gate, set status), re-sync recompute trigger.
- `src/modules/amazon/amazon-order-parser.service.ts` — tagged failure result instead of zeros.
- `src/modules/amazon/amazon.controller.ts` — `linkAmazonOrder` honors scrape failure (no overwrite, `failed` status, user-facing result).
- `src/modules/amazon/amazon-order-sync.service.ts` (+ `amazon-order-sync.processor.ts`, queue wiring in module) — new auto-capture job.
- `src/modules/dashboard/dashboard.service.ts` — tiered aggregates; fix recent-orders mapper.

**Shared (`packages/shared`):**
- `src/domain/orders/` — `OrderCostCaptureStatus` enum + `DashboardDataDto` tiered fields.

**New env (all optional):**
- `AMAZON_ORDER_SYNC_CRON='*/30 * * * *'`
- `AMAZON_ORDER_SYNC_CONCURRENCY=2`
- `AMAZON_ORDER_SYNC_MATCH_TOLERANCE_PCT=5`
- `AMAZON_ORDER_SYNC_MATCH_WINDOW_DAYS=7`

---

## Error handling

- Auto-capture and recompute are **best-effort and isolated**: per-order `try/catch`; a single bad scrape never fails the batch/job.
- Scrape failure is **detected, not hidden**: `cost_capture_status = 'failed'`, prior values retained, user notified.
- No estimate/fallback is ever invented for Amazon tax/shipping (would re-introduce the over-statement bug). Unknown stays unknown and visible.

---

## Testing

No test framework is wired yet (Jest installed, unused). For A1, the highest-value verification is a focused **SQL + unit** check, but given the repo has no test harness, verification will be:
- Manual: run the migration, run `recomputeProfit` on a mixed order set, confirm statuses + `net_profit` values.
- A small TDD scaffolding for the **match heuristic** (`amazon-order-sync` scoring) is worthwhile since it is pure logic — introduce Jest minimally for `packages/shared`-level pure functions if the user wants. (Decision deferred to the plan.)

---

## Risks & trade-offs

- **Amazon order-list scrape fragility** (same DOM-change risk as today): mitigated by the failure-tagging in §3 and the `failed` status — a broken scraper degrades to "capture pending," never to wrong numbers.
- **Match false-positives** (linking the wrong eBay order to an Amazon order): mitigated by requiring ASIN + quantity + amount-tolerance + date-window simultaneously; no confident match → skip.
- **Nullable `net_profit` migration**: any code reading `net_profit` and assuming a number must handle `null`. Audit all readers (dashboard service already uses `COALESCE`/`SUM`).

---

## Open questions (to resolve in the implementation plan)

1. ASIN availability on eBay orders for the untracked fallback in §2 — confirm `lineItems[].legacyItemId`/ASIN is reliably present on inbound eBay orders (the listing-match path already relies on `legacyItemId`).
2. Whether to introduce a minimal Jest harness for the pure match-scoring function now, or keep A1 harness-free.
3. Exact FE dashboard treatment of the new tiered fields (deferred FE detail; backend returns data first).
