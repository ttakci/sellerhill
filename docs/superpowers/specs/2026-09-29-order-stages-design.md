# Order stages — one seller-facing status for every order (design, 2026-09-29)

**Problem.** The orders list shows two badges per row: eBay's own status
(`Waiting Shipment` = paid, not shipped) and the Amazon-fulfillment state
(`Action required` / `Bought manually` / …). Neither answers the seller's
question — "which orders need ME, and what is happening to the rest?" — and
the eBay status does not change when the seller buys and links the Amazon
order, so before and after linking the row read the same. (Operator, first
live order, 2026-09-29.)

**Decision.** One `OrderStage` per order, derived from columns that already
exist (no migration), shown as one badge with an icon and a legend, filtered
by counted tabs. The raw eBay status stays visible as a fact inside the eBay
summary card of the detail page.

## Stages (priority order — an order is in exactly one)

| # | `OrderStage` | TR / EN label | Badge | Icon | Rule (evaluated top-down) | Seller's job |
|---|---|---|---|---|---|---|
| 1 | `amazon_cancelled` | Amazon iptal etti / Amazon cancelled | error | `x-circle` | `amazon_cancelled_at IS NOT NULL AND status <> completed` | fulfil another way |
| 2 | `cancelled` | İptal / Cancelled | neutral | `x-circle` | `status = cancelled` | — |
| 3 | `delivered` | Teslim edildi / Delivered | success | `package-check` | `status = completed` | — |
| 4 | `test_run` | Test — satın alma yok / Test run | neutral | `info` | `amazon_order_id LIKE 'SIM-%' OR auto_fulfill_status = dry_run` | — |
| 5 | `shipped` | Kargolandı / Shipped | info | `truck` | `status = shipped OR ebay_tracking_pushed_at IS NOT NULL` | — |
| 6 | `tracking_held` | Takip bekletiliyor / Tracking held | warning → **error after 12 h** (web-side, from `shippedDetectedAt`) | `alert-circle` | `shipped_detected_at IS NOT NULL` | convert tracking / fix cause |
| 7 | `buying` | Amazon'da alınıyor / Buying on Amazon | secondary | `loader` | `auto_fulfill_status IN (pending, running)` | — |
| 8 | `purchased` | Satın alındı · kargo bekleniyor / Purchased, awaiting shipment | primary | `shopping-bag` | `amazon_order_id IS NOT NULL` | — |
| 9 | `purchase_blocked` | Satın alma engellendi / Purchase blocked | error | `alert-triangle` | `auto_fulfill_status IN (blocked, failed)` | fix cause or buy by hand |
| 10 | `awaiting_payment` | Ödeme bekleniyor / Awaiting payment | neutral | `circle-dollar-sign` | `status = pending` | — |
| 11 | `to_purchase` | Satın alınacak / To purchase | warning | `shopping-cart` | everything else (paid, no Amazon order) | buy on Amazon, link |

Decisions taken with the operator: (1) `to_purchase` is amber "work for you"
even when automation is deliberately off — a paid, unbought order is a job;
(2) `tracking_held` shows immediately, amber for the first 12 h (waiting),
red afterwards (a problem), matching the Action Center's grace.

Colours group by meaning — red = money/reputation at risk, amber = your
work, blue/primary/secondary = the system is working, green/grey = done — so
several stages share a hue on purpose; the icon and the legend disambiguate.

## Screens

- **Orders list**: the `Status` and `Amazon fulfillment` columns become ONE
  `Status` column (stage badge with icon; context line under it: blocked
  reason / Amazon order id / "linked by hand" / tracking number). A
  `?` icon next to the column header opens the legend. Counted `TabNav`
  above the table: `All · Needs action (n) · To purchase (n) · In progress (n)
  · Done (n)`; `Needs action` = 1+6+9, `In progress` = 7+8+5, `Done` = 3+2.
  Opens on `Needs action` when its count > 0, else `All`. Rows needing action
  sort first, then by date.
- **Filters**: eBay-status and Amazon-fulfillment selects are removed; a
  `Status` select (all 11 + test run) replaces them; store, listing-linked
  (`tracked`, relabelled "Linked to a listing / Not linked"), search and the
  dashboard date range stay. Tabs and the select both write `?stage=`.
- **Order detail**: the hero shows the stage badge (size md, with icon) and
  its `meaning` sentence; the actionable stages also show the `action`
  sentence. The eBay status moves into the eBay summary card as an info row
  ("eBay status: Waiting Shipment"). Buttons stay where they are (Amazon
  card).
- **Legend** (`OrderStageLegend`, Popover): every stage — badge, meaning,
  what you do. Also the tooltip text on every badge.
- **Dashboard order card** and the **Action Center** links use the same
  stage (`/orders?stage=…`).

## Non-goals

No new columns, no change to what the workers write, no change to the
Action Center signals themselves, no per-order notes field (Easync has one;
not asked for).
