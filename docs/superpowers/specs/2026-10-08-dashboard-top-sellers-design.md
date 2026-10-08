# Dashboard "Top sellers" tab — design

Date: 2026-10-08 · Status: approved in conversation, awaiting spec review
Builds on: `docs/superpowers/specs/2026-10-07-dashboard-date-range-design.md` (shared date filter, seller time zone).

## 1. Goal

A fourth dashboard tab, **En çok satanlar / Top sellers**, next to Kartlar · Çizelge · K/Z. It lists the listings that sold in the range chosen in the shared date filter, ranked (default) by revenue — the Sellerboard "Trends" idea in SellerHill's own list format.

Success:
- Picking "Bu ay" shows this month's best sellers; switching store shows that store's.
- The list looks like the eBay Listings page: the same `DataTable` (cards by default, table one toggle away), the same `ListingCard` anatomy, result count, "Sırala:" picker, pagination.
- A listing's period figures add up with the dashboard cards for the same window (same tracked scope, same local-day bounds, same store filter).

## 2. Decisions (operator, 2026-10-08)

- Placement: a fourth tab sharing the date filter (option A).
- Ranking: default revenue, switchable (revenue · units · orders · net profit · change %).
- Trend: a small sparkline per row in card and table (option A). No per-bucket heat-map columns.

## 3. What is listed

- Listings with at least one **tracked, non-cancelled** order in range R (`orders.listing_id = l.id`), for the active store. A listing that sold and was later ended is included and shows its status badge.
- Server-side pagination (`page`, `limit`, default 20, max 100) — every list endpoint is paginated.
- Untracked sales are not attributable to a listing and are not listed (the dashboard's tracked rule).

## 4. API

`GET /v1/dashboard/top-listings?range=<preset>|from=&to=&ebayAccountId=&sortBy=&page=&limit=`

- Range parsing, seller time zone and validation are exactly the dashboard's (`parseRangeInput`, `TimezoneService`, `resolveDashboardRange`); an invalid range is 400 `dashboard.errors.invalidRange`.
- `sortBy`: `TopListingSortKey` = `sales` (default) · `units` · `orders` · `netProfit` · `change`. Unknown → 400. Ties break on `listing_id` so pages are stable.
- `change` ranks by the sales % change vs the comparison window; listings with no comparison sales (`null`) sort last.

Response (`TopListingsPageDto`, shared types):

```ts
{
  range: DashboardRangeDto;            // same object the dashboard returns
  sortBy: TopListingSortKey;
  granularity: DashboardChartGranularity; // the chart granularity of R
  seriesKeys: string[];                // bucket keys, oldest → newest (dashboardBucketKeys)
  items: TopListingDto[];
  total: number; page: number; limit: number;
}

interface TopListingDto {
  listing: ListingDto;                 // the Listings page DTO, same mapper
  metrics: { sales: number; units: number; orders: number;
             netProfit: number;        // confirmed (linked) only — the cards' rule
             profitProvisional: number; ordersPendingCapture: number };
  changes: { sales: number | null; units: number | null; orders: number | null; netProfit: number | null };
  series: number[];                    // the sort metric per bucket (change → sales), aligned to seriesKeys
}
```

### Queries (DashboardService)

1. **Ranking** — one statement: `cur` = tracked orders in R grouped by `listing_id` with the shared `periodSelect` fragment; `prev` = the same over `periods[0].comparison`; LEFT JOIN, `ORDER BY <sort expr> DESC NULLS LAST, listing_id`, `LIMIT/OFFSET`, `COUNT(*) OVER ()` for `total`. Bounds through `buildLocalRangeSql`; the sort expression comes from an enum-keyed map, never user text.
2. **Series** — for the page's listing ids only: `GROUP BY listing_id, to_char(date_trunc(unit, order_date AT TIME ZONE $tz), fmt)` (same `BUCKET_SQL` as the chart), zero-filled to `seriesKeys`.
3. **Listings** — `ListingsService.getListingsByIds(userId, ids)` (new, public), built on the existing `mapListingRow` so the card shows exactly what the Listings page shows. The hydration lives in `TopListingsController` inside `ListingsModule`, which imports `DashboardModule` (not the reverse), so there is no module cycle.

`changes` use `calcChange` (null when the previous value is 0), the same function the cards use.

## 5. Web

- `DashboardTab.TOP_SELLERS = 'topSellers'` (URL `?tab=topSellers`); tab label `dashboard.tabs.topSellers`, icon `trending-up` (or the closest existing icon).
- `TopSellersPanel` (`features/dashboard/components/TopSellersPanel/`, 4-file split) renders the Listings page's `DataTable` pattern: `defaultViewMode` grid, `gridMinItemWidth="27rem"`, `gridMaxColumns={2}`, `resultLabel` ("N listings sold" with bold count), `sortOptions` + `sortValue` + `onSortChange` + `sortLabel`, pagination, `loading` skeleton, `EmptyState` when nothing sold. URL state: `?tsort=` (default `sales`, omitted) and `?tpage=` (reset on range/store/sort change).
- **Card**: `toListingCardProps` for the listing, then the figures row is replaced with period figures — Ciro (secondary: % change, toned), Adet, Sipariş, Net kâr (toned; an "Tahmini" note when `profitProvisional ≠ 0`). Meta rows stay as on the Listings page. The sparkline sits in a new optional `ListingCard` slot (`trend?: ReactNode`) above the figures row.
- **Table** columns: product (`ProductTableCell`), trend (sparkline), ciro (+ % change), adet, sipariş, net kâr, fiyat, stok (eBay / Amazon) — money right-aligned, two decimals, the listing's currency.
- Row/card click opens the listing detail.
- **`Sparkline` atom** (`packages/ui/src/atoms/Sparkline/`): pure SVG polyline (+ optional faint area), props `values: number[]`, `tone?: 'positive' | 'negative' | 'neutral'`, `width`/`height` in rem tokens, `ariaLabel`. No chart library, no `@repo/shared` import, colours from theme tokens. All-zero or single-point series render a flat baseline.
- i18n: `dashboard.tabs.topSellers`, `dashboard.topSellers.*` (title, result label with plural, sort labels, column headers, empty state, estimated note) in all 16 locales.
- Demo: `/dashboard/top-listings` answered from the demo orders grouped by listing, through the same resolver and sort keys.

## 6. Testing

- Jest: service spec with a fake DB (SQL markers) — ranking query receives R and the comparison window, sort map per key, total from the window count, series zero-filled to `seriesKeys`, store filter, invalid sort → 400 in the controller; guard: the ranking SQL uses `periodSelect` and `buildLocalRangeSql` (no `CURRENT_DATE`).
- `PREPARE` the ranking and series statements against local Postgres.
- Vitest: URL state (`tsort`, `tpage` reset), card mapping (figures, tones, estimated note), `Sparkline` geometry (points scaled into the box, flat line for zeros).
- Manual: demo mode at 1440 and 375 px, each sort, card and table view, a range with one bucket and one with many.

## 7. Out of scope

Per-bucket heat-map columns, product CSV export, untracked sales attribution, an Amazon-side (ASIN-level) roll-up across stores.
