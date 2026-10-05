# Ad Campaigns, ad-aware pricing, real ad fees, and listing rules in the settings group

**Status:** design approved by the operator in conversation (2026-10-03); this document is the written spec for review.
**Supersedes:** the Promoted Listings part of "Listing rules, VeRO protection, clean-up and scheduled listing" (migration `138`) — the auto-promote-on-create behaviour and the "add the ad rate to your eBay fee" note are removed.

Two independently shippable parts:

- **Part A — Listing rules move into the Listing Settings Group.** Small; ships first. **Built 2026-10-04** (migration 141; plan docs/superpowers/plans/2026-10-04-listing-rules-in-group.md).
- **Part B — Ad Campaigns** (its own menu), **ad-aware pricing**, and **real ad fees in profit** via the Finances API.

Each part gets its own implementation plan.

---

## 0. Decisions taken (operator, 2026-10-03)

| # | Decision |
|---|---|
| D1 | Blocked ASINs move to the **Blacklist** drawer ("Kara Listeyi Yönet"), not the listing rules. |
| D2 | Minimum rating is a **number the seller types** (1.0–5.0, one decimal), not a dropdown. |
| D3 | Listing rules leave Store Settings and become **a step of the Listing Settings Group drawer**. |
| D4 | Promoted Listings leave the listing rules entirely and get **their own menu, "Ad Campaigns"**. |
| D5 | A campaign is filled like eBay's own: add/remove listings one by one; **choosing a settings group is a one-time fill shortcut** (only listings in no campaign are added). New listings later added to the group do NOT join automatically. |
| D6 | **Every campaign of the store is shown**, including ones created outside SellerHill (on eBay or by another tool), and listings can be added to / removed from any of them. A listing already in a campaign is not offered for another. |
| D7 | Ad rate: campaign default **plus per-listing override**, **fixed rate only**. Dynamic-rate and Priority (cost-per-click) campaigns are shown read-only and never enter pricing. |
| D8 | **A promoted listing's price includes its ad rate.** No "add it to your eBay fee" instruction. |
| D9 | **Profit must be real**: the ad fee is taken from the Finances API, estimated until eBay reports it. |
| D10 | Campaign sync every 6 hours (not quota-derived — the measured headroom makes that unnecessary), plus an immediate refresh when a campaign page is opened. |

---

## Part A — Listing rules in the Listing Settings Group

### A1. Where each rule goes

| Rule (today in `store_settings.listing_rules`) | New home |
|---|---|
| `veroProtectionEnabled`, `hideBrand`, `minSourcePrice`, `maxSourcePrice`, `amazonShippedOnly`, `minRating`, `minReviewCount`, `outOfStockEndDays`, `coldListingDays`, `coldListingAutoEnd` | `listing_settings_groups.listing_rules` JSONB (new column) |
| `blockedAsins` | `store_settings.blocked_asins` JSONB (new column, NULL = inherit global, Store > Global like the keyword blacklist), edited in the Blacklist drawer |
| `promotedAdRate` | **removed** (Part B replaces it) |

- `ListingRulesConfig` keeps its pure helpers (`normalizeListingRules`, `evaluateListingRules`) but loses `blockedAsins` and `promotedAdRate`. A new `BlockedAsinsConfig` (just `string[]`) is normalized by the existing `parseBlockedAsins`.
- `minRating`: bounds 1.0–5.0, rounded to one decimal; `normalizeListingRules` reads anything else as "no minimum".

### A2. Who reads them

- **Create worker** (`ListingProcessorService.assertListingRules`): reads the rules of the job's settings group (`listing_jobs.listing_settings_group_id`, migration `064`), and the blocked ASINs through `getResolvedSettings(userId, ebayAccountId)`.
- **Clean-up** (`ListingCleanupService`) and the Action Center's `LISTING_NOT_SELLING` / `buildNotSellingSql`: read `outOfStockEndDays` / `coldListingDays` / `coldListingAutoEnd` from **each listing's own group** (`listings.listing_settings_group_id` is `NOT NULL`, migration `010`) instead of the store rows.
- `hideBrand` in `ListingStrategyService.prepareListingData`: from the listing's group.

### A3. Migration

One migration:
1. Adds `listing_settings_groups.listing_rules JSONB` and `store_settings.blocked_asins JSONB`.
2. Copies each user's GLOBAL `store_settings.listing_rules` (minus `blockedAsins` / `promotedAdRate`) into every one of that user's groups.
3. Moves `blockedAsins` into `blocked_asins` of the same row.

Production has exactly one row with listing rules (the global row of one user, read 2026-10-03), so per-store rule rows need no special handling. They are documented as dropped; the column `store_settings.listing_rules` stays, unread.

### A4. UI

- `ListingGroupDrawer` gains a step **Kurallar / Rules** between Pricing and HTML Template (Genel · Kesintiler · Fiyatlandırma · Kurallar · HTML Şablonu). The cards from today's `ListingRulesDrawer` (VeRO, hide brand, source filters, rating as a `ModernTextInput` with decimal validation, review count, clean-up) move there unchanged in behaviour.
- `ListingRulesDrawer` and its hub row are deleted. `?drawer=storeListingRules` redirects to the groups drawer.
- `BlacklistDrawer` gains a second section, **Engelli ASIN'ler / Blocked ASINs** (the textarea + valid-count line), saved with the same scope as the keywords.
- i18n in all 16 locales; the removed keys are pruned.

### A5. Tests

- `listing-rules.spec.ts` follows the new shape (`minRating` decimal bounds).
- A guard spec asserts that the create worker and the clean-up read the GROUP's rules.
- The migration is `PREPARE`d / applied against a stock Postgres.

---

## Part B — Ad Campaigns

### B1. Facts this design rests on (measured / read from eBay, 2026-10-03)

- **Quota** (live `getRateLimits` before/after real calls with the sipastan store's token): campaign and ad calls move `sell.marketing.ads.campaign` (**100,000/day**). `sell.marketing` (10,000/day) did not move. Report calls are listed by eBay under per-USER limits (`sell.marketing.ad_report`), not the shared pool.
- **`GET /ad_campaign/{id}/ad`**: `limit` max 500. **`listing_ids` accepts 500 ids in one call** (tested at 50/200/500). Each ad carries its own `bidPercentage`.
- **`GET /ad_campaign`**: each campaign carries `fundingStrategy { fundingModel, adRateStrategy, bidPercentage }` (`FIXED` observed) and `campaignCriterion` when rule-based.
- **No overlap observed** between two general campaigns (500 listings of one were found 0 times in the other). This is consistent with the one-general-campaign-per-listing rule; a refusal from eBay is handled anyway (B4).
- **Eligibility**: `GET /sell/account/v1/advertising_eligibility`. The budagan store is `INELIGIBLE / NOT_ENOUGH_ACTIVITY`; sipastan runs two campaigns.

### B2. Data

New table `ebay_campaigns`, one row per eBay campaign of a store:

| Column | Meaning |
|---|---|
| `id` UUID PK | |
| `ebay_account_id` UUID FK → `ebay_accounts(id)` ON DELETE CASCADE | |
| `campaign_id` TEXT | eBay's id. UNIQUE `(ebay_account_id, campaign_id)` |
| `name`, `status` | as eBay reports them (`RUNNING`, `PAUSED`, `ENDED`…, stored verbatim) |
| `funding_model`, `ad_rate_strategy`, `bid_percentage` | from `fundingStrategy` |
| `rule_based` BOOLEAN | `campaignCriterion` present: listings cannot be added by id |
| `created_by_sellerhill` BOOLEAN | set when we created it |
| `ad_count` INT | eBay's `total` for the campaign (all its listings, ours or not) |
| `synced_at` | |
| `metrics` JSONB, `metrics_from`, `metrics_to`, `metrics_fetched_at` | B6 |

New columns on `listings`:
- `promoted_campaign_id TEXT NULL` — eBay campaign id the listing's ad is in.
- `promoted_ad_rate NUMERIC` — **exists** (migration `138`); from now on it means "the fixed rate eBay reports for this listing's ad".
- `promoted_ad_strategy TEXT NULL` — `FIXED` / `DYNAMIC`, copied from the campaign.
- `promoted_synced_at`.

New column `ebay_accounts.last_campaign_sync_at` (claim/watermark). `ebay_accounts.promoted_campaign_id` (migration `138`) becomes unused.

### B3. Sync (`ebay-campaign-sync` queue)

- **Tick:** every 10 minutes. It claims up to N stores whose `last_campaign_sync_at` is older than **6 h** (`FOR UPDATE SKIP LOCKED`, stamped in the same statement — the feed-sync claim pattern). Settings: `ebay.campaignSync.enabled` (default true), `.intervalHours` (6), `.maxAccountsPerRun`.
- **Per store:**
  1. `getCampaigns(limit=500)` and upsert `ebay_campaigns`.
  2. For every **non-rule-based COST_PER_SALE** campaign, `getAds` with `listing_ids` = this store's listings that have an `ebay_item_id`, in chunks of 500.
  3. Write `promoted_campaign_id` / `promoted_ad_rate` / `promoted_ad_strategy` for the listings found, and **clear them for listings of the store found in none**.
- **Fail closed:** the clearing step runs only when EVERY campaign read of that store succeeded. A failed or partial read never removes a listing's ad state (it would drop the rate from the price).
- A listing whose ad state changed is queued for repricing (B5).
- **Interactive refresh:** opening a campaign page re-reads that one campaign (cached 60 s). It is charged at `EbayCallPriority.INTERACTIVE`.
- **Budget:** a new `EbayApiResource.MARKETING_ADS`, mapped in `RESOURCE_SOURCE` to `sell.marketing.ads.campaign`. Campaign/ad calls acquire it. `EbayApiResource.MARKETING` (the tighter `sell.marketing`, which the old auto-promote calls were conservatively charged to) is kept in the enum but no campaign call uses it any more; the eligibility read stays on `EbayApiResource.ACCOUNT`.

### B4. Writes (each a documented Marketing call, budget-governed, `withEbayRateLimitRetry`)

| Action | eBay call | Notes |
|---|---|---|
| Create campaign | `POST /ad_campaign` | `fundingModel: COST_PER_SALE`, `bidPercentage` (2.0–100.0, one decimal), name ≤80 unique (35021 → ask for another name), `startDate` now + 2 min, no end date. General + Fixed only. |
| Add listings | `POST …/bulk_create_ads_by_listing_id` | ≤500 per call, each with the campaign's default rate. Per-item result: created → write ad state + reprice; 35036 "ad already exists" → reported "already in a campaign", the next sync settles which. |
| Remove listings | `POST …/bulk_delete_ads_by_listing_id` | Clear ad state, reprice down. |
| Change a listing's rate | `POST …/bulk_update_ads_bid_by_listing_id` | Reprice. |
| Change the campaign default | the same bulk update for **SellerHill's listings in that campaign** | Listings of other tools in the campaign are not touched; the UI says so. |
| Pause / resume / end | `POST …/pause`, `/resume`, `/end` | Pausing or ending clears the ad rate from pricing for its listings (they no longer run an ad): status is re-read and the listings repriced. |

- **Write gates, in order:** the store belongs to the caller → not suspended → eligibility is not `INELIGIBLE` (read stays allowed) → campaign is not rule-based / not CPC / not dynamic (write refused with a reason key).
- Every write records an `audit_logs` row `EBAY_CAMPAIGN_ACTION`.
- The writes are idempotent at eBay (an existing ad answers 35036, a deleted one is gone), so the 429/5xx retry wrapper is safe here, unlike the return refund.
- **Removed:** `ListingPromotionService` (auto-promote after create/publish) and the promoted card of the listing-rules drawer.

### B5. Ad-aware pricing

- `calculateListingPrice(amazonPrice, strategy, fees, amazonTaxRatePct, adRatePct = 0)` (shared, the one formula):
  `price = (netTarget + fixedFee) / (1 − (ebayFee% + adRate%) / 100)`, then the $0.99 floor and the price ending, unchanged.
  - The breakdown gains `adRatePercent` and `adFeeAmount`.
  - The `≥ 100 %` guard covers the sum.
- **Which rate:** `listings.promoted_ad_rate` only when `promoted_ad_strategy = 'FIXED'` and the campaign is COST_PER_SALE and RUNNING. Otherwise 0, and the listing detail shows "price does not follow this campaign's rate" (dynamic) or nothing (no ad).
- **Where:** `ListingStrategyService.calculatePrice` takes the rate; the refresh fan-out (`ProductSyncService.computePendingUpdates`) and the stock-sync path pass each listing's own rate. A listing with `price_override` is never repriced (unchanged rule); the campaign page marks it "fixed price — ad rate not applied".
- **Repricing on change:** an ad-state change enqueues the listing's product on the existing `stock-sync` queue (`syncListingsForProduct`), which recomputes every listing of that product with its own group and rate and pushes through `EbayBulkService.updatePriceQuantity`.
  - Order of operations: add the ad then reprice up; remove the ad then reprice down. The seconds in between are accepted (eBay does not serve a new ad instantly).
- The group drawer's price calculator gains a what-if "ad rate %" field (not saved).

### B6. Metrics

- Once a day per store with at least one campaign, a `CAMPAIGN_PERFORMANCE_REPORT` task for the last 31 days: `POST /ad_report_task` → poll `GET /ad_report_task/{id}` → `GET /ad_report/{id}`.
  - The rows are stored in `ebay_campaigns.metrics`, and the store totals are summed from them: clicks, impressions, sales, ad fees, quantity sold, ROAS = sales / ad fees.
  - The page states eBay's note that figures reconcile within ~72 h.
- **Capture first:** the exact dimension/metric keys and the report format are read from a live `GET /ad_report_metadata/CAMPAIGN_PERFORMANCE_REPORT` and one captured report (plan task 0) before the parser is written. Capture-only setting `ebay.campaignReports.captureOnly` (default true) until then.
- Listing-level performance is out of scope for v1.

### B7. UI

- **Sidebar:** a new flat group **Pazarlama / Marketing** with **Reklam Kampanyaları / Ad Campaigns** (`/:locale/campaigns`), gated by `EbayAccountGuard`, with a `routeMeta` entry and a locale-less redirect.
- **List page:**
  - store selector (required — campaigns are per store);
  - eligibility banner with eBay's reason when `INELIGIBLE`;
  - KPI cards (31 days): clicks, impressions, sales, ad fees, ROAS, quantity sold;
  - campaigns as cards (default) / table: name, status badge, strategy, rate type + default rate, SellerHill listings in it / eBay total, sales, ad fees, ROAS, and an "outside SellerHill" badge when not created here;
  - "Create campaign" drawer.
- **Campaign page** (`/:locale/campaigns/:campaignId`):
  - header facts (status, strategy, rate type, default rate, start date, ad count);
  - metrics;
  - a `DataTable` of the store's SellerHill listings in it: product cell, price, rate (editable inline through a small drawer), remove, bulk select;
  - actions: add listings, change default rate, pause/resume, end (`ConfirmModal`).
  - A rule-based / CPC / dynamic campaign renders read-only with the reason.
- **Add listings drawer:**
  - a settings-group `ModernSelect` that fills the selection with that group's listings in **no** campaign;
  - search;
  - the selection list where rows can be removed;
  - a count of listings skipped because they are already in a campaign;
  - submit → bulk add.
- **Listing detail:** a row "Ad campaign: <name> · <rate>%" linking to the campaign.
- All copy in 16 locales. Cards follow the house card anatomy (`OrderCard`).

---

## Part C — Real ad fee in profit

### C1. Source (from eBay's Finances OpenAPI v1.19.0, local copy)

- **`GET /sell/finances/v1/billing_activity`** (`getBillingActivities`, scope `sell.finances`).
  - Each line carries `feeType`, `feeTypeDescription`, `orderId` ("returned if the fee is associated with an order"), `listingId`, `amount`, `bookingEntry` (`DEBIT` / `CREDIT`), `billingTransactionDate`.
  - Filter by `transactionDate` range, at most 120 days back.
- **Quota:** `payoutapi.sell.finances` **15,000/day** (live `getRateLimits`).
- **Not obtained:** the `feeType` value of a Promoted Listings general fee. The enum page answers 403 from eBay's edge, from this machine and from the production server. It is settled by a captured response (C4) before any parser exists.
- `getOrderEarnings` (which states its expenses include "ad fees") needs `sell.finances.earnings.read` plus an eBay access request and is US-only. It is out of scope.

### C2. Consent

- **Superseded 2026-10-04:** the former `ebay.oauth.financesScopeEnabled` default-off switch was removed. `sell.finances` is included in `DEFAULT_SCOPES`; `ebay_accounts.granted_scopes` records granted scopes at connect/reconnect, and billing capture selects only accounts with that scope. Legacy `state=fin` remains accepted by the OAuth callback.
- Existing stores need one reconnect (same-owner reconnect is an in-place re-consent).
- Action Center item **`EBAY_ACCOUNT_FINANCES_SCOPE_MISSING`** (INFO): a store has at least one promoted listing but lacks the scope.

### C3. Order fields and states

New columns on `orders`:

| Column | Meaning |
|---|---|
| `ad_rate_at_sale` NUMERIC NULL | the listing's applied rate at FIRST ingest (insert only, never in `ON CONFLICT`) |
| `ebay_ad_fee` NUMERIC NULL | estimated or actual fee |
| `ad_fee_status` | enum `none` \| `estimated` \| `actual` \| `zero` |
| `ad_fee_checked_at` | |

How each status is reached:
- **At ingest:** a promoted listing → `estimated`, fee = `sale_total × rate / 100` (eBay's screen: the rate applies to "the item's total sale amount including item price, shipping, taxes"). Otherwise `none`.
- **Billing sweep:** every 4 h per store with the scope (claim pattern, `ebay_accounts.last_billing_sync_at`), window from the watermark minus an overlap. Lines whose `feeType` is the ad fee, matched by `orderId` to our order: sum DEBIT − CREDIT → `actual`.
- **Settled zero:** an `estimated` order with no ad line `ebay.finances.adFeeSettleDays` (default 7) after the sale, while that store's billing sweeps have succeeded over the whole period, → `zero`. The figure is revisited after the capture shows how fast eBay posts the fee.
- **Capture-only first:** `ebay.finances.captureOnly` (default true) writes the raw response to disk (the feed-capture pattern) and nothing to the database.

### C4. Profit

- `recomputeProfit` subtracts `ebay_ad_fee` when the status is `estimated` or `actual`.
- **Dashboard tiers:** the headline (confirmed) profit requires `cost_capture_status = linked` **and** `ad_fee_status IN (none, actual, zero)`. A linked order with an `estimated` fee counts in the "Estimated" tier. The predicate lives in the dashboard's one `periodSelect` fragment.
- Order detail: a row "Ad fee (eBay)" or "Ad fee (estimated)" in the eBay card.
- `profit-calculation.ts` gains the ad fee term, Jest-covered.

---

## Part D — Quota at 500 sellers (measured pools)

Assumptions: 2,000 listings and 2 campaigns per store.

| Work | Calls/day | Pool (per day) | Share |
|---|---:|---|---:|
| Campaign sync, 4×/day: 1 list + 2 × 4 pages | 500 × 9 × 4 = 18,000 | `sell.marketing.ads.campaign` 100,000 | 18 % |
| Campaign page refresh (interactive) | a few hundred | same | <1 % |
| Add / remove / rate writes (500 per call) | user-driven, small | same | <1 % |
| Metric report (create + ~2 polls + download, daily) | 500 × 4 = 2,000 | per-user `sell.marketing.ad_report` | — |
| Billing sweep, every 4 h, ~2 pages | 500 × 6 × 2 = 6,000 | `payoutapi.sell.finances` 15,000 | 40 % |
| Repricing on ad change (25 per call) | small | `sell.inventory` 2,000,000 | ~0 |

---

## Part E — Order of work and verification gates

0. **Read-only verifications** (production, single calls):
   - `GET /ad_report_metadata/CAMPAIGN_PERFORMANCE_REPORT`;
   - after C2 ships and sipastan is reconnected, one `GET /billing_activity` capture.

   No parser is written before its capture exists.
1. **Part A** (independent, ships first).
2. **C2 billing capture-only sweep** — built and deployed 2026-10-04 (migration 142; plan docs/superpowers/plans/2026-10-04-finances-consent-and-billing-capture.md). `sell.finances` is included in the normal OAuth scope set; the former consent switch was removed, and legacy `state=fin` remains accepted.
3. **B2/B3 data + sync, B5 pricing, B4 writes, and B6 capture workflow** — implemented in development (migrations 143/144); **B7 UI and B6 parser remain pending**. The campaign performance report is captured only; parsing waits for an actual `.tsv.gz` file. Migration 144 has been locally verified, not applied in production. No Task 6–9 code has been deployed or merged to UAT/main. Existing legacy margin-override listings still mirror their remote campaign rate; margin-pricing arithmetic excludes that rate from fee/ad calculation.
4. C3/C4 parser and profit remain deferred until real billing captures and report-file evidence support them. Billing aggregation should use an incremental watermark with overlap; the operator measured about 27k billing lines over 30 days for `sipastan`.

**Never exercised live for this implementation:** campaign mutation calls (`createCampaign`, `bulk_create_ads_by_listing_id`, `bulk_delete…`, `bulk_update…`) and the campaign report task flow. Tests use fakes; Task 8's synthetic bytes are not a real captured report. Billing `feeType` parsing is also deferred. No live eBay writes were made.

## Out of scope

- Priority / cost-per-click campaigns (no management, no pricing).
- Dynamic-rate pricing.
- Keywords, offsite ads.
- Listing-level ad reports.
- `getOrderEarnings`.
- Refunding ad fees.
