# Keepa Integration — Technical Reference

> Canonical reference for how Zonds consumes the Keepa API. The short operational
> summary lives in `CLAUDE.md` ("Product Refresh Pipeline"); this document holds
> the full contract, the verified ground truth behind it, and the reasoning, so
> future sessions/models do not re-derive (or re-break) these decisions.
>
> Last verified against live Keepa responses: **2026-07-28** (20 tokens/min plan).

## 1. Why Keepa, and what we ask it for

Keepa is the **sole** Amazon product-data provider (ScraperAPI removed — its
per-request credit model was 10–100× more expensive under bulk-add/churn).
Zonds needs, per ASIN: metadata (title/images/brand/description/features/category),
the **Buy Box price**, and the **Buy Box seller's stock quantity** — the two
values that drive eBay repricing and quantity sync.

**Single query shape, used by BOTH the create path and the refresh pipeline
(every ASIN is treated identically — there is deliberately NO per-product
"fast seller" tiering; see §7):**

```text
GET https://api.keepa.com/product
  ?key=…&domain=1
  &asin=<comma-separated, ≤100 per request>
  &history=0            # payload shrink only — NOT a token saver
  &stats=90             # Statistics object incl. Buy Box fields — free
  &offers=20            # live marketplace offers — REQUIRED for real stock
  &only-live-offers=1   # drop historical offers from payload — free
  &stock=1              # per-offer stockCSV — +2 tokens only when fresh
  [&update=<KEEPA_UPDATE_HOURS>]  # optional Keepa-side cache tolerance, §4
```

Key insight from the official docs (https://keepa.com/#!discuss/t/products/110):
`stock=1` **without** `offers` does not return usable per-seller stock. The
pre-2026-07 implementation made exactly that mistake and additionally used
`totalOfferCount` (number of sellers!) as a stock quantity — both are now
forbidden (§3).

## 2. Token cost model (verified live — do not "simplify" this)

Keepa bills from a continuously-refilling token bucket (plan tier = tokens/min;
each token expires after 60 min, so max banked ≈ rate × 60). Costs are
**conditional**:

| Component | Cost | Condition |
|---|---|---|
| Base product request | 1/ASIN | when `offers` is NOT used |
| `offers` | **6 per FOUND page of 10 live offers** | replaces the base 1-token charge |
| `offers` served from Keepa's own cache | **0** | Keepa's offer data younger than the `update` threshold (~1h default) |
| `stock=1` | +2/ASIN | only when the stock observation is fresh (<7 days) |
| `stats`, `history=0`, `only-live-offers`, `days` | 0 | payload/CPU only |

Live probe results (same query, different ASINs, same minute):
`tokensConsumed = 0` (popular ASIN, Keepa cache fresh), `1`, `3`, and `6`
(offer refresh). **Conclusion: per-ASIN cost cannot be estimated locally.**
`KeepaApiMeta.tokensConsumed` always comes from the response; the old
"fallback to ASIN count" estimate was removed and must not return.

Budgeting rule of thumb: sustainable ASIN/min ≈ `refill_rate / avg_tokens_per_asin`.
At 20 tpm and ~8 tokens/ASIN worst-case ≈ 2.5 ASIN/min ≈ 3.6k ASIN/day; real
averages are far better because of Keepa-cache hits — measure via
`keepa_usage_log` before buying a bigger plan. `keepa_balance` rows record
`tokens_left`, `refill_in_ms`, `refill_rate` (migration `055`) from every
response, refresh **and** create paths alike.

## 3. Response ground truth (live-verified) and normalization rules

All parsing lives in the pure module
`apps/api/src/modules/listings/keepa-normalizer.ts` (fixture-tested in
`keepa-normalizer.spec.ts`; fixtures modeled 1:1 on captured live responses).

Verified facts the normalizer encodes:

- **Price sentinels:** Keepa prices are integer cents; `-1` = no data,
  `-2` = no Buy Box / suppressed. A usable price is strictly `> 0`. Buy Box
  price = `stats.buyBoxPrice + max(stats.buyBoxShipping, 0)`; fallback order is
  `stats.current[18]` (Buy Box) → `current[1]` (NEW) → `current[0]` (AMAZON).
- **Offers:** `liveOffersOrder` (array of indices into `offers`, ranked like
  Amazon's offer page; `null` when no live-offer data) selects live offers.
  The Buy Box offer is matched **by `sellerId === stats.buyBoxSellerId`** —
  never "first offer". Amazon itself is sellerId `ATVPDKIKX0DER`.
- **Stock:** each live offer may carry `stockCSV = [keepaTime, qty, …]`; the
  **last pair** is the latest observation. Fallbacks: `stats.stockBuyBox`, then
  `stats.stockAmazon` (only when Amazon holds the Buy Box). Amazon caps
  reported stock at **1000** (means "≥1000"). `offersSuccessful` reports
  whether live-offer retrieval worked.
- **Images:** modern responses carry an `images` **array of objects**
  (`{l, m, …}` filenames); legacy `imagesCSV` can be `null` on the same
  product. The normalizer prefers `images[].l`, falls back to CSV. (Products
  ingested by the old CSV-only code may lack images until their next refresh.)

**Three-state stock (`KeepaStockStatus` in `packages/shared`):**

| State | Meaning | Writer behavior |
|---|---|---|
| `known` | Buy Box offer matched with a stock observation (or stats-level stock) | write the observed quantity |
| `out_of_stock` | live-offer retrieval **succeeded**, zero live offers, no price | write 0 |
| `unknown` | anything ambiguous (retrieval failed, no observation, seller unmatched) | **preserve the previous value** — never fabricate 0 |

This mirrors the `net_profit` NULL-vs-0 principle: an unobserved value is not a
zero. The old code collapsed unknown → 0, which could wrongly zero out every
eBay listing sharing an ASIN. `totalOfferCount` as quantity produced the
opposite failure (overselling). Both are regression-tested.

Create-path exception: `ProductData.stock` is non-nullable, and a brand-new
product has no previous value to preserve, so `unknown` → 0 there. Safe because
live publish blocks at quantity 0 (drafts allowed).

## 4. Two caches — who decides what

**(a) Zonds' shared product cache (`products` table).** ASIN-keyed, shared by
all users. Decision (in `ListingProcessorService.resolveProductData`): row
exists + real title + ≥1 image → cache hit, **0 tokens**. Freshness is
guaranteed by the refresh pipeline, not by the create path. Concurrent creates
of one uncached ASIN are serialized by a pg advisory lock
(`pg_advisory_xact_lock(hashtext('keepa-create'), hashtext(asin))`) with a
recheck-after-lock, so N parallel jobs → exactly 1 Keepa call.

**(b) Keepa's server-side cache**, steered by the `update` parameter
(`KEEPA_UPDATE_HOURS`, unset → Keepa's ~1h default): data younger than the
threshold is served without a live scrape (≈0 tokens — another Keepa customer
already paid for it); older data triggers the 6-token/page live refresh.
Popular ASINs are constantly refreshed by other Keepa customers, so a small
threshold (e.g. 2h against our 12h refresh interval) cuts spend materially
with bounded staleness. **`update=-1` (never refresh) is deliberately
unsupported** — niche ASINs nobody else queries would go permanently stale and
silently break the price/stock promise.

## 5. Refresh pipeline invariants

Files: `refresh-scheduler.service.ts`, `refresh-processor.service.ts`,
`refresh-backoff.ts`, `keepa-usage.service.ts`.

1. **Atomic claim.** The scheduler tick claims due products with a
   `FOR UPDATE SKIP LOCKED` CTE that advances `next_refresh_at` by a lease
   (`KEEPA_REFRESH_CLAIM_LEASE_MINUTES`, default 15) **in the same statement**,
   then enqueues one `refresh-batch` job. Overlapping ticks / parallel workers
   cannot double-claim (the old timestamp-jobId scheme did NOT prevent this —
   a slow batch caused the same rows to be re-selected and re-billed). A
   crashed batch's rows simply become due again at lease expiry.
2. **Scope = products with ≥1 ACTIVE listing.** Draft/ended-only products have
   no eBay surface to update; drafts get fresh data on publish. This is a
   scope rule, not sales-velocity tiering (§7).
3. **Chunking, not truncation.** `KeepaService.getProducts` dedupes and chunks
   any input size at Keepa's 100-ASIN/request limit, summing `tokensConsumed`.
   The old `slice(0, 100)` silently dropped ASINs past 100 — with a batch size
   >100 those rows were then wrongly counted as data failures and quarantined.
4. **Fair-split over REQUESTED ASINs.** `tokensConsumed / requestedCount`,
   logged for **every** requested ASIN (missing ones included) — a dead ASIN's
   spend must not be redistributed onto users of returned ASINs. `user_ids` =
   active listers of that ASIN; FinOps projection divides per user
   (`keepa-projection.ts`).
5. **Unknown-preserve writes.** `price = COALESCE(new, old)` semantics; stock
   only written for `known`/`out_of_stock`. `commerceChanged` (price/stock)
   triggers eBay fan-out via `ProductSyncService.updateAllListingsForProduct`;
   `metadataChanged` (title/brand/description/images) persists without fan-out.
6. **Failure taxonomy.** Transport (429/5xx/network) → throw → BullMQ
   exponential backoff retries the whole batch (rows stay leased). Data failure
   (ASIN absent from a successful response) → escalating `next_refresh_at`
   backoff **5m → 15m → 60m → 240m** (`refresh-backoff.ts`), quarantine at
   `KEEPA_REFRESH_MAX_FAILURES` — a dead ASIN cannot burn tokens every tick
   (the old code retried every minute until the threshold).
7. **Usage/balance recording is unconditional.** Both paths log usage and
   capture balance from response meta **before** validating product data —
   tokens Keepa charged for an empty/invalid response are real spend.

## 6. Environment variables

All optional; defaults in `env.validation.ts`.

| Var | Default | Meaning |
|---|---|---|
| `KEEPA_API_KEY` | — | required for any Keepa call |
| `KEEPA_REFRESH_ENABLED` | `true` | `false` removes the repeatable tick (background spend = 0; create path unaffected). Use during token-budget testing |
| `KEEPA_REFRESH_INTERVAL_MINUTES` | `720` | per-product refresh cadence |
| `KEEPA_REFRESH_BATCH_SIZE` | `50` | products claimed per tick (>100 is safe — chunked) |
| `KEEPA_REFRESH_CLAIM_LEASE_MINUTES` | `15` | claim lease; must exceed worst-case batch runtime incl. BullMQ retries |
| `KEEPA_REFRESH_SCHEDULER_CRON` | `* * * * *` | tick cadence |
| `KEEPA_REFRESH_WORKER_CONCURRENCY` | `1` | parallel refresh jobs |
| `KEEPA_REFRESH_QUARANTINE_MINUTES` | `1440` | quarantine duration |
| `KEEPA_REFRESH_MAX_FAILURES` | `5` | data failures before quarantine |
| `KEEPA_UPDATE_HOURS` | unset (~1h Keepa default) | Keepa-side cache tolerance (§4); e.g. `2` |

## 7. Deliberate decisions (do not re-litigate without new data)

- **No sales-velocity tiering.** Every refreshed ASIN gets the same
  offers+stock query. A product's first-ever sale can coincide with Amazon
  going out of stock; cheap "binary" checks for slow sellers were explicitly
  rejected by the product owner (2026-07-28).
- **No `offers=2`.** Keepa's valid range is 20–100; cost is per FOUND page,
  so `offers=20` on a 1-offer product costs one page (6), not two.
- **`tokensConsumed` is authoritative.** Never estimate; never fall back to
  ASIN count.
- **`totalOfferCount` is never stock.** It is the number of sellers.
- **Unknown ≠ zero** for both price and stock on refresh.
- **Token-balance-driven admission control is deferred** until ≥1 week of real
  `keepa_usage_log`/`keepa_balance` data exists. `refill_rate` is already
  captured to enable it later.

## 8. Verifying against live Keepa (smoke test)

When Keepa behavior is in doubt, probe with a controlled script (spends real
tokens — a handful per run): call `/product` with the §1 query for 2–3 ASINs
(one popular, one niche, one dead) and inspect only redacted structure:
`tokensConsumed/tokensLeft/refillRate`, `offersSuccessful`, `liveOffersOrder`,
Buy Box sellerId match, last `stockCSV` pair, price sentinels. Never commit the
key, seller IDs, or raw payloads. Update the fixtures in
`keepa-normalizer.spec.ts` if the response shape drifts, and bump the
"Last verified" date at the top of this file.
