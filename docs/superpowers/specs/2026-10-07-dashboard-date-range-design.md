# Dashboard date range + seller timezone — design

Date: 2026-10-07 · Status: approved in conversation, awaiting spec review
Related: the daily summary e-mail (designed in another session) consumes `getDayMetrics` from this work.

## 1. Goal

One date filter, right of the dashboard tab rail, shared by all three tabs (Cards / Chart / P&L) — the Sellerboard pattern. The chart's own 30 days / 12 weeks / 12 months switch is removed; granularity follows the chosen range. Every "day" the dashboard talks about is the **seller's own calendar day**, not UTC and not the browser's.

Success:
- The seller picks a preset or a custom range once; cards, chart, P&L, both carousels and every "view all" link describe the same dates.
- The card a seller clicks and the order list "view all" opens can never disagree (today they can: API uses UTC `CURRENT_DATE`, web uses the browser clock).
- The daily summary e-mail calls the same aggregation the cards use, so its figures equal the panel's.

## 2. Timezone (operator decision, 2026-10-07)

- **`users.timezone TEXT NULL`** (IANA name), new migration (next free number at implementation time — `147` is taken by an uncommitted cancellations migration in the shared tree). NULL = UTC, today's behaviour.
- **Auto-fill once, from the web.** After the session is established (`AuthBootstrap` / login / register / Google), if `user.timezone` is null the web sends `PATCH /profile` with `Intl.DateTimeFormat().resolvedOptions().timeZone`. This covers new and already-logged-in users alike; a set value is never overwritten automatically (a travelling seller's "yesterday" must stay stable). Editable on the profile page (searchable `Select`, `Intl.supportedValuesOf('timeZone')`).
- **Validated against Postgres, not Node** — SQL is what consumes the name, and a name Node accepts but Postgres does not makes every query fail with 22023. `isValidTimezone` checks a set loaded once from `pg_timezone_names` (full names only; abbreviations such as `EST` are refused). Save refuses an unknown name (400 `profile.errors.invalidTimezone`); read-side, `UserTimezoneService.get(userId)` falls back to `UTC` for a stored value that has become invalid.
- **Stays UTC**: eBay quota day, Best Sellers `viewed_on`, subscription/quota windows, retention — system counters, not the seller's day.

### SQL rule (load-bearing)

- **Filter with bounds, never a per-row cast**: `o.order_date >= ($from::date)::timestamp AT TIME ZONE $tz AND o.order_date < ($to::date + 1)::timestamp AT TIME ZONE $tz`. Index-friendly, and DST-correct (a local day of 23 or 25 hours is bounded by its two local midnights). `$to` is inclusive as a date, exclusive as an instant.
- **Bucket with the cast**: `GROUP BY to_char(date_trunc(<unit>, o.order_date AT TIME ZONE $tz), 'YYYY-MM-DD[ HH24]')`.
- **"Today" anchor**: `(now() AT TIME ZONE $tz)::date`, never `CURRENT_DATE`. Week starts Monday (`date_trunc('week')`, unchanged).
- One helper builds the bound fragment (`buildLocalRangeSql(column, fromParam, toParam, tzParam)` in `apps/api/src/common/timezone/`), used by the dashboard, the orders list `dateFrom/dateTo`, the listings `soldFrom/soldTo` filter and the listings CSV export. A guard spec source-greps those four sites for the helper and refuses `order_date >= $n::date` / `CURRENT_DATE` in the dashboard service.

Not in scope: formatting displayed timestamps in the seller's timezone (lists still format with the browser clock). Noted as a follow-up.

## 3. Ranges

### Presets — `DashboardRangePreset` (shared enum)

`today` (**default**) · `yesterday` · `last7Days` · `last30Days` · `thisWeek` · `lastWeek` · `thisMonth` · `lastMonth` · `last3Months` · `thisYear` · `lastYear` · `last12Months`, plus a custom `from`/`to`.

Custom: `from ≤ to ≤ today` (seller-local), length ≤ 731 days; anything else is 400 `dashboard.errors.invalidRange`.

### One pure resolver, shared by API and demo

`resolveDashboardRange(input, todayLocal)` in `packages/shared/src/domain/dashboard/` (pure, Jest-covered from `apps/api`). Input is a preset or `{from, to}`; `todayLocal` is a `YYYY-MM-DD` the caller obtained in the seller's timezone. It returns:

- `range` — R: `{ from, to }`.
- `periods` — the four card periods, newest first: R and the three periods before it **of the same unit**. Calendar presets step by calendar unit (`thisMonth` → this month, last month, 2 months ago, 3 months ago; `today` → today, yesterday, 2 days ago, 3 days ago; `lastWeek` → last week … 4 weeks ago). Rolling presets and custom ranges step by their own length (`last7Days` → the 7 days, the 7 before, …).
- each period's `comparison` — the window its trend is measured against: the period after it in the chain; for a **to-date** period (`today`, `thisWeek`, `thisMonth`, `thisYear`, a rolling window ending today) the same elapsed span of its predecessor, as today's code does. The resolver therefore emits five windows to give the fourth card a trend.
- `label` per period — `{ unit: day|week|month|year|span, offset }` so the web localises "Bugün / Dün / 3 gün önce", "Bu ay / Geçen ay / 2 ay önce"; `span` with offset 0 renders the preset name, otherwise the date range.
- `chartGranularity` and `pnlGranularity` from R's length:

| R length | Chart | P&L columns |
|---|---|---|
| ≤ 2 days | hour | day |
| ≤ 31 days | day | day |
| ≤ 92 days | week | week |
| > 92 days | month | month |

`DashboardChartGranularity` gains `hour`.

## 4. API

`GET /v1/dashboard?range=<preset>` **or** `?from=YYYY-MM-DD&to=YYYY-MM-DD`, plus `ebayAccountId` (unchanged). `chartGranularity` is removed. No `tz` parameter: the server reads `users.timezone`, so the client cannot disagree with it.

Response (`DashboardDataDto`, replaces the fixed `metrics` record):

```ts
{
  range: { preset: DashboardRangePreset | null; from; to; timezone; today;
           chartGranularity; pnlGranularity };
  periods: Array<{ from; to; label: DashboardPeriodLabel; metrics: PeriodMetricsDto }>; // 4, newest first
  chart: { granularity; points; summary };   // R only; summary trend = periods[0] trend
  pnl:   { granularity; columns: Array<{ key; from; to; isCurrent; metrics }> }; // R, newest first; isCurrent = contains today
}
```

`PeriodMetricsDto` is unchanged (orders, units, sales, gross/net profit, confirmed + provisional profit, uncosted revenue, refunds = cancelled orders, untracked count, trends).

### Service methods (the e-mail contract)

- `getRangeMetrics(userId, { from, to }, timezone, ebayAccountId?) → PeriodMetricsDto` — THE period aggregation; the cards call it per period.
- `getDayMetrics(userId, localDate, timezone, ebayAccountId?)` — `getRangeMetrics` with `from = to = localDate`.
- `getRangeMetricsByStore(userId, { from, to }, timezone) → { total, stores: [{ ebayAccountId, metrics }] }` — one query with `GROUPING SETS ((o.ebay_account_id), ())`, for the e-mail's total + per-store rows. Built from the same `periodSelect` fragment, so the three cannot drift.

Exported from `DashboardModule`; the e-mail module imports it (no cycle: dashboard imports nothing from e-mail).

## 5. Web

- **`DateRangePicker` molecule** (`packages/ui/src/molecules/DateRangePicker/`, container/component split): trigger shows `📅 <label> · <dates>`; popover with a preset list on the left and a two-month range calendar on the right (reuses `DatePicker`'s month grid and `Intl` month/weekday names); bottom sheet below 640px (the `Select`/`Dropdown` pattern). Presets and labels are injected (the molecule knows no domain); `@repo/ui` stays free of `@repo/shared`.
- **Dashboard toolbar**: `S.Toolbar` gets the picker on the right of the `TabNav` (the old "store filter pinned right" slot). Wraps below `sm`.
- **URL**: `?range=today` (default, omitted) or `?from&to`; `tab` unchanged; `period` and `granularity` removed. `?card=0..3` keeps today's "click a card to retarget the carousels" behaviour (default 0).
- **Dates come from the response, never computed in the browser.** Card headers, carousel filters (`soldFrom/soldTo`, `dateFrom/dateTo`) and view-all links use `response.periods[card].from/to`. `utils/periodRanges.ts` is deleted.
- **Chart tab**: `SegmentedControl` removed; x-axis formats by `chartGranularity` (hour → `HH:00`).
- **P&L tab**: columns from `pnl.columns`; highlight `isCurrent` (fixes the demo highlighting the oldest month by index); CSV filename uses `range.to`.
- **Profile page**: timezone `Select`. i18n for every new key in all 16 locales (`dashboard.range.*`, `dashboard.periodLabel.*`, `profile.timezone.*`).
- **Demo**: `buildDemoDashboard` takes the range input, uses `resolveDashboardRange` with the browser's today, aggregates demo orders per window. The demo user's `timezone` is the browser's.

## 6. Testing

- Jest: `resolveDashboardRange` matrix (every preset, custom, chain stepping across month/year ends, to-date comparisons, granularity thresholds, invalid ranges); `isValidTimezone`; the bound helper's SQL text.
- Guard spec: the four filter sites use `buildLocalRangeSql`; no `CURRENT_DATE` and no `order_date >= $n::date` in the dashboard/orders/listings services.
- Every new/changed statement `PREPARE`d against local Postgres (parameter types: `$tz` text, dates `::date`).
- DST check: a range spanning the US/EU transition returns 23/25-hour day buckets correctly (local Postgres, `America/Los_Angeles`, 2026-11-01).
- Vitest: URL state round-trip; picker preset → query mapping.
- Manual: `/tr/dashboard` at 375px and desktop, each tab, demo mode.

## 7. Out of scope

Year-over-year comparison choice, granularity override, Sunday-start weeks, seller-timezone formatting of displayed timestamps, the daily e-mail itself.
