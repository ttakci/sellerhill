# eBay API limits: take them from eBay, not from a table someone typed in

Date: 2026-09-25
Status: scope approved by the operator, not yet planned or implemented

## Problem

`EbayCallBudgetService` gates outbound eBay calls against a daily ceiling, and
`GET /v1/admin/ebay/budget` shows an operator how much of it is left. Both
numbers are ours, not eBay's:

- the **ceiling** is read from `platform_settings`, where an operator typed it
  in from eBay's published defaults table;
- the **consumption** is our own Redis token bucket, which counts only calls
  that went through the governor.

So the panel reports a simulation of the quota rather than eBay's accounting,
and it can be wrong in two independent ways.

**The ceiling can be stale.** If an Application Growth Check raises a limit, or
eBay throttles the keyset, nobody finds out. CLAUDE.md already records the gap
that makes this possible: `EbayApiResource.ANALYTICS` exists in the enum but
nothing calls it, so the platform has never asked eBay for its real limits.

**The consumption undercounts.** CLAUDE.md names at least one caller that
bypasses the governor — the shipped-tracking push, `createShippingFulfillment`.
Those calls are invisible to our counter and visible to eBay's, so the panel can
read 30% while eBay reads 80%.

## What the real limits turned out to be

Measured against the production keyset on 2026-09-24 with
`pnpm --filter api ebay:limits-probe` (`apps/api/src/scripts/ebay-limits-probe.ts`).
Re-run it rather than trusting this table if anything here is load-bearing for a
decision — but these were the answers, and two of them change decisions.

### Confirmed as assumed

`sell.inventory` 2,000,000 · `sell.feed` 100,000 · `sell.fulfillment` 100,000 ·
`payoutapi.sell.finances` 15,000 · `sell.account` 25,000 ·
`commerce.taxonomy` 5,000 · `sell.analytics.traffic_report` **100** ·
`buy.browse` 5,000 · `developer.analytics.app_rate_limit` 5,000

The 100/day on `traffic_report` confirms that promising buyers' view counts in
the product remains off the table.

### Finding 1 — Trading is metered PER METHOD, not as one pool

CLAUDE.md states "Trading **5,000**/day" as a single application-wide figure.
It is not one figure:

| Method | Real daily limit |
|---|---|
| `AddItem` | **100,000** |
| `RelistItem` | **50,000** |
| `GetMyeBaySelling` | 5,000 |
| `UploadSiteHostedPictures` | 5,000 |
| `GetItem` | 5,000 |
| ~85 others | 5,000 |

**The decisions this affected were right; the reasoning written down for them
was wrong.** Listing reconciliation went to the Feed API because
`GetMyeBaySelling` is 5,000 — true. Watcher counts were dropped because
`GetItem` is 5,000 — true. `UploadSiteHostedPictures` was dismissed at 5,000 —
true. But the sentence "Trading is 5,000/day for the whole application" is in
CLAUDE.md, and someone reading it would also rule out `AddItem`, which has
twenty times the headroom.

### Finding 2 — disputes and refunds were abandoned against the wrong number

| Resource | Real daily limit |
|---|---|
| `post-order.return` | 5,000 |
| `post-order.casemanagement` | 5,000 |
| `post-order.inquiry` | 5,000 |
| `post-order.cancellation` | 5,000 |
| **`sell.fulfillment.payment_dispute`** | **250,000** |
| **`sell.fulfillment.payment_dispute_summary`** | **250,000** |
| **`sell.fulfillment.refund`** | **100,000** |

Returns and dispute polling were set aside on quota grounds against Post-Order's
5,000. The same ground is available through the Fulfillment API at **fifty times
that**, plus a separate 100,000 bucket for refunds. This is worth reopening on
its own merits; it is not part of the work below.

### Finding 3 — a resource can have several rate windows

`sell.recommendation` reports 5,400 per 60s **and** 5,000 per 86,400s.
`sell.fulfillment.payment_dispute` reports 250,000 per day **and** 5,000 per
300s. Any model that assumes one rate per resource is wrong.

### Also new

`commerce.taxonomy.bulk` 100/day — a bulk endpoint we do not use, with a very
low limit. `commerce.message` 500,000/day — generous headroom for buyer
messaging. `sell.logistics` 2,500,000/day.

The Media API's **`Image (commerce, v1_beta)` resource reports no rate at all**,
before or after a successful upload. See the EPS spec; no daily figure for it
may be invented.

## Decisions

### D1 — The ceiling comes from eBay and from nowhere else

Operator decision, 2026-09-24, stated twice and sharpened the second time: *"asla
tavanı biz belirlemeyelim. panelden girişleri kapat."*

`EBAY_BUDGET_*_DAILY_LIMIT` is removed from `platform-settings.registry.ts`,
from `PlatformSettingKey`, from the admin panel and from the environment. A
migration deletes the orphaned `platform_settings` rows. **There is no
human-settable ceiling anywhere, and no fallback to one.**

An earlier draft of this scope kept `platform_settings` as the fallback when
eBay could not be reached. That was rejected, correctly: keeping the thing being
eliminated as a backstop is not eliminating it.

### D2 — The last value eBay gave always applies

Fetched at boot and refreshed on a slow tick, and **persisted**, so a restart,
a deploy or an Analytics outage does not lose it. A failed refresh changes
nothing; the stored value stands, and the panel shows how old it is.

The only state with no value is a first-ever boot whose first fetch also failed.
There the governor does not gate at all — which is not a fallback ceiling but
the absence of a gate, and is what `EbayCallBudgetService` already does
everywhere else ("Fails open. An unreachable Redis allows the call... Losing the
ability to count calls is not a reason to stop making them"). Failing closed
would stop all listing creation whenever eBay's Analytics API blinked.

### D3 — Our counter stays, for the thing it was actually built for

It exists to answer *which user consumed how much*, which eBay does not report
at all. That is untouched.

The panel shows both, side by side, and this is the most valuable part of the
change: **the gap between the two columns is the only visible signal that a
caller is bypassing the governor.** Today that failure class is invisible.

| Datum | Source |
|---|---|
| Daily ceiling, remaining quota | **eBay** |
| Per-user consumption | **us** |
| Reserve percentage | **us** — policy, not fact; stays panel-editable |

`EBAY_BUDGET_RESERVE_PERCENT` is not a ceiling. It is how much headroom we
choose to keep for interactive calls, which eBay cannot know. It stays.

### D4 — Show every API eBay reports, including ones we do not use

Not only the resources in `EbayApiResource`. Entries that do not map to our enum
are displayed in their own block rather than hidden, so a mapping that stops
matching is visible instead of silently dropping a row, and the governor falls
back to not gating that resource.

### D5 — The model must change before the mapping can be honest

Two of the findings above break assumptions in the current code:

- `EbayApiResource` has one `TRADING` member; eBay reports ~85 Trading methods
  with their own limits.
- The budget model assumes one rate per resource; eBay reports several windows
  for some.

Until that is refactored, `TRADING` maps to the lowest limit among the methods
we actually call (`GetMyeBaySelling`, 5,000). **That is a mapping decision, not
an invented ceiling** — the number still comes from eBay. But it is a
simplification and the panel must not present it as the whole truth about
Trading.

## Scope

1. `EbayAnalyticsService` calling `getRateLimits` with an application token.
2. Panel display cached ~60s; ceiling refresh on a slow tick (hourly is ample —
   ceilings change on a Growth Check approval, which is rare) and persisted.
3. `GET /v1/admin/ebay/budget` returns eBay's ceiling and remaining alongside our
   per-user consumption; unmapped APIs in their own block.
4. Governor ceilings from the persisted eBay value; no registry key, no panel
   entry, no env var, and a migration removing the orphaned rows.
5. Admin panel: three columns, plus the age of the eBay figure.
6. The `EbayApiResource` refactor — per-method Trading and multiple windows per
   resource.

Item 6 may be split into its own piece of work. Items 1-5 are one coherent
change and 6 is a prerequisite only for presenting Trading honestly.

## Why this waits for the EPS work

Both touch `EbayApiResource` and the eBay module's call paths. Doing them
concurrently would produce conflicts in exactly the files each one is
restructuring.
