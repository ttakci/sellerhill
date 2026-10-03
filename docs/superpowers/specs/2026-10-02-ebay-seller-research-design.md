# eBay seller research → Amazon matches — design

**Date:** 2026-10-02 · **Status:** PARKED 2026-10-03 — deferred to phase 2 by the operator · **Route:** `/:locale/seller-research`

## 0. Where this stopped (2026-10-03) — read before resuming

Nothing of this feature is built; no code, migration or setting exists for it. The body below is the design as it stood on the evening of 2026-10-02; the operator's decisions of the morning of 2026-10-03 **supersede** §4–§6.6 and §9 as follows, and the spec is to be rewritten from them before any plan is written:

- **Exact "sold in the last X days" is mandatory → the purchase-history page must be read, and it is behind sign-in → an eBay buyer-account pool is required** (option "daily counter sampling, exact after 7 days" was rejected: "will they wait 7 days?"). The pool is platform-owned (operator-created throwaway buyer accounts, never a seller's store account), managed at `/admin`, each account bound for life to one proxy IP and one persistent browser profile, TOTP mandatory, a per-account daily page budget (start 300/day, pace 8–15 s) that is raised only against measured challenge rates; a challenge or sign-in redirect cools the account for 24 h, three in a row → `needs_attention`. **No ban threshold is known; it is measured, never assumed.** Capacity sketch: ~200 pages per scan → ~1.5 scans/account/day → ~22 accounts + 22 IPs for 500 sellers at ~2 scans/month.
- **Proposed (not yet approved) architecture change:** instead of a Python `services/ebay-scraper`, a Node "ebay-research worker" container built from the api image with its own small Nest bootstrap (only the research module, no schedulers), reusing `BrowserStateManager` (persistent profiles), the TOTP/encryption helpers and the per-account rate limiter from the Amazon buyer-account code. The operator rules stand: separate network, separate IPs, the api container never fetches eBay pages, the eBay keyset is never involved.
- **Transport facts (spike 2026-10-02/03):** headless Chromium (shell and `--headless=new`) is denied flat by eBay's Akamai; headful passes; curl with the browser's cookies does not; the purchase-history page redirects to sign-in. Headful under Xvfb is the server shape — its image is built and verified offline (`scratchpad/ebay-spike/xvfb/`, Xvfb started by hand because `xvfb-run` hangs); the live Xvfb run and the logged-in run have NOT happened (IP cooling; no test account yet). The one eBay-only ISP IP is in `apps/api/.env` as `EBAY_PROBE_PROXY`; it must never join `scraper.proxies`.
- **Billing (operator, 2026-10-03):** **2 free scans per account for LIFETIME** (trial included, never refills — a small per-user counter, not a plan limit); then packs **50 scans / $4.99 · 100 scans / $9.99**, sold exactly like the conversion top-ups (one-time, credits on the current billing window, validity shown before purchase; the operator's "use within 1 month" is this "until period end" rule — flagged, accepted pending confirmation); a re-scan of the same username inside 24 h is free; another user scanning the same seller is served from the cached result. §9's monthly allowance table and the 500 pack are void.
- **Still open when resuming:** the worker-container architecture (yes/no), the "until period end" rule for scan packs (yes/no), a throwaway eBay test account (email / password / TOTP secret → `EBAY_PROBE_ACCOUNT_*`) for the logged-in probe, whose login selectors are to be written interactively with it — never guessed.
- Everything in §2 (decisions), §3 (non-goals, minus the "no login" line), §4.2 (Amazon `/v1/search`), §6.1–6.5 (gate, caps, matching), §7–§8 (data model, API — minus the monthly allowance), §10–§12 (web, tests, ops) remains the starting point.

## 1. What it is, in one paragraph

A seller types another eBay seller's username (or pastes their store URL), picks a window (7 / 30 / 90 days) and the Amazon filters they care about (results per item, minimum rating, minimum review count, Prime only). SellerHill reads that seller's **active listings** and each listing's **sold counter** from eBay's public pages, ranks them by what sells, finds Amazon candidates for each one (by barcode when the listing carries one, by keywords otherwise), and shows the result as a table of eBay best-sellers with their Amazon matches. The seller ticks the ASINs they want and lands in the Add Listings drawer with them pre-filled — exactly the Best Sellers hand-off. Each run is a **scan**; scans are metered like Best Sellers products, with a small free allowance and top-up packs.

## 2. Decisions already taken with the operator (2026-10-02)

| Decision | Why |
|---|---|
| **Scrape eBay's public HTML; never the eBay APIs for this.** | The API License Agreement forbids deriving "data relating to the performance of sellers" and "information relating to specific eBay Users" without written permission, and every API call is signed with OUR keyset — the one order sync, listing and tracking depend on. HTML scraping is a User Agreement §3 exposure, but it is not traceable to the keyset. The Browse API (`filter=sellers:{…}`, `estimatedSoldQuantity`) is **not** used anywhere in this feature; a guard spec enforces it. |
| **Active listings + sold counter, NOT the sold/completed search.** | The sold filter (`LH_Sold=1`) redirected to sign-in in the 2026-10-02 probe; active listings and the per-item sold counter are what every buyer sees and are what AslScout serves ("30-day and 7-day sold quantities — per individual product"). No eBay account, no account pool. |
| **A separate egress for eBay — separate service, separate proxy list, separate IPs.** | Operator rule: eBay traffic never shares an IP with the Amazon pool, and the api container never fetches eBay pages. |
| **Matching depth = plan (2): open the eBay item page and read UPC/EAN/ISBN/MPN + brand; barcode search on Amazon first, keywords second.** | A wrong ASIN costs the seller trust; the extra page costs ~1 s on a flat-rate proxy. |
| **Hand-off = Best Sellers': tick → `/listings?drawer=add&asins=…`.** | One place to create listings. |
| **Metered as scans, with a free allowance and top-up packs; prices are the operator's call** (§9). | Same billing machinery as Best Sellers; no new table for credits. |

## 3. Non-goals (V1)

- No eBay account, no login, no cookies that identify a person.
- No sold/completed-item search, no Terapeak, no Marketplace Insights, no Browse API.
- No seller-level revenue estimate, sell-through rate or "store health" score — only per-listing figures the page actually shows. (AslScout's revenue figure is price × sold; we show both numbers and let the seller multiply.)
- No scheduled re-scans, no tracking a competitor over time, no alerts. A scan is a snapshot.
- No image matching, no LLM in the matching path. (`LLM_CONTENT` is create-only by rule; this feature adds no LLM call at all.)
- No store-name fuzzy search. Input is a username or a URL (§6.1); a bare name that is not a username fails with a clear message.
- No cancel button on a running scan — runtime is bounded by caps (§6.4).

## 4. Architecture

```
web /seller-research  ──POST scan──▶  api  SellerResearchModule
                                        │  (gate: enabled · entitled · allowance · daily brake)
                                        │  INSERT seller_research_scans (queued)
                                        ▼
                                 BullMQ queue  seller-research   (concurrency 2)
                                        │
                              SellerResearchProcessor
                      ┌─────────────────┴──────────────────┐
             phase 1: eBay                         phase 2: Amazon
   EbayResearchClient ──▶ services/ebay-scraper     ScraperClient ──▶ services/amazon-scraper
   (own proxies, own net)   /v1/seller/listings       (existing pool)   /v1/search  (new route,
                            /v1/item                                     upstream amazon/search.py)
                                        │
                                        ▼
                     seller_research_items (one row per eBay listing,
                     Amazon candidates inline as JSONB)
                                        │
web polls GET scan ◀────────────────────┘  ──▶ items table ──▶ tick ──▶ Add Listings drawer
```

### 4.1 `services/ebay-scraper/` — a new Python service, sibling of `amazon-scraper`

Why a second service rather than a second `ProxyPool` inside the Amazon service:
- the operator's separation rule becomes physical — its own compose service on its own private network (`ebay_research_net`), its own `EBAY_SCRAPER_PROXIES`-style secret, its own `/v1/stats`, so the SCRAPER_* admin warnings are never diluted by eBay numbers;
- if the spike shows a browser is needed (§5), Chromium and its ~400 MB go into this image, not the Amazon one;
- the Amazon fetcher (`amazon/fetch.py`) is bound to `amazon/sites.py` (host, fingerprint, cookies) and cannot serve another host.

What it reuses, by copy, from `services/amazon-scraper/sellerhill/`: `egress.py` (bind / require_proxy / redact / remote_dns / `NoProxyError`), `pool.py` (lanes, per-proxy token bucket, cooldown after 3 blocks, 150 s deadline, stats), `verify.py` + the `/v1/proxies/verify` route, the `X-Scraper-Secret` auth and the 503-until-secret rule. These two files are small, pure and already fixture-tested; a shared package between the two services is more machinery than the duplication costs. The copy is literal, and a guard test in each service diff-checks `egress.py` and `pool.py` against the other (`tests/test_shared_parity.py`), so a fix in one cannot silently miss the other.

Routes (all `POST`, JSON, authenticated, 400 on bad body, same no-proxy rule: **an empty or all-invalid proxy list makes no HTTP call** and answers `no_proxy`; `SCRAPER_ALLOW_DIRECT=1` is the developer exception and the compose guard spec forbids it in the Coolify files):

| Route | Body | Answer |
|---|---|---|
| `/v1/seller/resolve` | `{ input, proxies, perIpRequestsPerSecond }` | `{ outcome, username, storeName?, feedbackScore? }` — resolves a store URL/slug to the username (§6.1) |
| `/v1/seller/listings` | `{ username, page, proxies, perIpRequestsPerSecond }` | `{ outcome, fetchedAt, total, hasNext, items: [{ itemId, title, priceText, price, currency, imageUrl, soldHint, condition, listingType }] }` — one `_ssn` search page, 240 per page, newest first |
| `/v1/item` | `{ itemId, proxies, perIpRequestsPerSecond }` | `{ outcome, fetchedAt, item: { itemId, title, price, currency, imageUrl, soldTotal, soldLast24h?, listedAt?, quantityAvailable?, specifics: { upc?, ean?, isbn?, mpn?, brand?, model? } } }` — the purchase-history page is NOT read (it redirects to sign-in, spike 2026-10-02) |
| `/v1/proxies/verify` | as the Amazon service | as the Amazon service |
| `/health`, `/v1/stats` | — | as the Amazon service (+ `transport: "curl" \| "browser"`) |

Outcomes are the existing `SourceFetchOutcome` vocabulary (`found` · `not_found` · `blocked` · `parse_failed` · `no_proxy`); `expired`/`proxy_error` map to `blocked` on the wire exactly as the pool does today. `not_found` on `/v1/seller/listings` means "eBay rendered the page and it says no items for this seller"; a challenge or sign-in page is `blocked`, never `not_found` (an unusable answer is not evidence of an empty store — the feed-sync rule).

Parsing is ours and fixture-locked: the spike's captured pages (`tests/fixtures/*.html.gz` + `expected.json`) are the first fixtures. Selectors are kept in one module (`sellerhill/selectors.py`) because eBay rotates two card markups (`li.s-item` and the newer `li.s-card`); both are parsed.

### 4.2 `POST /v1/search` on the existing Amazon service

Upstream `amazon/search.py` `search(query, country, page, sort, min_price, max_price, brand, is_prime, four_stars_and_up, …)` is vendored but unmounted. Mount it the way `bestsellers.py` mounts `rankings.py`: `sellerhill/search.py` with `fetch_search(country, query, page, filters)` run through `pool.submit_call(fn, lane, expired_result)` on the **`browse` lane** (behind interactive creates, ahead of background refresh — the Best Sellers precedent), the same `usable_proxies` / `pool.ensure` / `no_proxy` dance, `to_wire` renaming snake_case to camelCase and dropping cards without an `asin`. Cards carry `asin, title, brand, imageUrl, price{amount,currency}, rating{average,count}, isPrime, isSponsored, boughtPastMonth, position`. **Sponsored cards are dropped server-side** (`lookup()`'s rule) so a paid placement never reads as a match. Note: `is_prime` and `four_stars_and_up` cost a second request (the refinement-id page); the API therefore asks for an **unfiltered** page and filters rating / reviews / Prime itself from the card fields — one request per query, and the seller's thresholds (e.g. 4.3 stars, 200 reviews) are finer than Amazon's refinements anyway.

### 4.3 NestJS: `apps/api/src/modules/seller-research/`

Files: `seller-research.module.ts` (imports `AuthModule`, `BillingModule`, `ProductSourceModule`; registers the `seller-research` queue), `.controller.ts`, `.dto.ts`, `.service.ts` (gate + CRUD + allowance), `seller-research.processor.ts` (the worker), `ebay-research.client.ts` (HTTP client for the new service; same shape as `ScraperClient.fetchBestSellers`: 180 s timeout, never logs a body or a proxy, any error → `EbayResearchUnavailableError`), `ebay-research.settings.ts` (reads the eBay proxy list + rps), pure helpers each with a spec: `amazon-query.ts` (`buildAmazonQuery(title, specifics)`), `candidate-filter.ts` (`filterCandidates`, `rankCandidates`), `scan-plan.ts` (`selectItemsToOpen`, `resolveScanCaps`), `seller-input.ts` (`parseSellerInput`), `scan-allowance.ts` (`decideScanAllowed`), and `seller-research-egress.guard.spec.ts` + `seller-research-no-ebay-api.guard.spec.ts` (§11).

### 4.4 Web: `apps/web/src/features/seller-research/`

`SellerResearchPage/` (scan list + "new scan" form), `ScanDetailPage/` (the items table), both 4-file splits; `components/NewScanForm/`, `components/CandidateList/`; `hooks/useScanDetailUrlState.ts` (`?page=&sort=&match=`), `hooks/useScanSelection.ts` (the Best Sellers selection hook, keyed on ASIN); `api/sellerResearchApi.ts` (`injectEndpoints`, tag `SellerResearch`); `utils/scanPresentation.ts`. Nav item in the **Discover** group after Best Sellers (`routeMeta` entry, locale-less `/seller-research` redirect, demo fixtures). i18n namespace `sellerResearch` in all 16 locales.

## 5. The eBay transport — what the spike found (2026-10-02, one fresh ISP IP: AS402236 Patriot Broadband, Los Angeles, never used for Amazon)

eBay sits behind Akamai Bot Manager. Measured, same IP, same minute:

| Client | Result |
|---|---|
| `curl_cffi` chrome136 / safari18 (no cookies) | flat 403 "Error Page \| eBay" |
| `curl_cffi` firefox135 | 200, JS challenge page |
| Playwright **headless shell** + stealth | flat 403, even on the home page |
| Playwright **`--headless=new`** (full Chromium, `channel: chromium`) + stealth, with and without window/GPU flags | flat 403 |
| Playwright **headful** Chrome + stealth, first run | **passed**: seller search rendered 242 cards, "4,100,000+ results", seller header with feedback % and items sold |
| `curl_cffi` chrome136 **with the headful session's cookies** | JS challenge on request 1 (the session held `bm_*` but no `_abck`) |
| Playwright headful, second run 3 minutes later (6th session on that IP) | JS challenge |
| `/bin/purchaseHistory?item=` in the passing headful session | redirect to sign-in (`sgfl=sm`) |

Conclusions, each one a design input:

1. **T1 ("browser warms, curl works") is dead.** The browser never earns a cookie curl can reuse. Deleted from this design.
2. **Transport is T2, browser-only, and it must be a HEADFUL Chromium** — both headless flavours are denied before any challenge. On a server that means Chromium under **Xvfb** (`xvfb-run`), one browser per proxy IP, pages fetched sequentially per IP through `pool.submit_call`, `page.goto` + `content()`. **Still unverified: whether Chromium under Xvfb with SwiftShader (no real GPU, no real window manager) scores like the desktop Chrome that passed.** That is the one remaining spike, run inside a Docker image on the dev machine before any service code is written (step 3 of §13). If it fails, the service is not built and the operator chooses between a commercial unblocker (per-request money, incompatible with a 500-scan pack) and the Marketplace Insights application.
3. **Pace is the second guard, not an optimisation.** Six sessions in four minutes moved a clean residential IP from "pass" to "challenge". Production pace is one page every 8–12 s per IP (`ebayScraper.perIpRequestsPerSecond` default **0.1**), one long-lived browser per IP (a fresh profile per request is itself a signal), and a challenge counts as `blocked` toward the pool's cooldown. Throughput: ~300–400 pages/hour/IP → a 100-item scan ≈ 15–20 min on one IP, 5–7 min on three; acceptable for a queued job, and the reason the scan page shows progress.
4. **The exact "sold in the last X days" is not obtainable anonymously** (purchase history needs sign-in). The honest figures are the lifetime counter, the 24-hour counter when printed, the estimate from listing age, and the exact delta between two scans (§6.6).
5. **Single-quantity sellers show no sales data at all.** eBay prints `N sold` only on multi-quantity listings; ThriftBooks (each book one unit) had no counter on any card. The sellers this feature exists for — Amazon→eBay arbitrage stores — list multi-quantity, so this is the right trade, but the UI says so on a scan whose items all lack a counter (`sellerResearch.states.noSalesCounters`).

`/v1/stats` reports `transport: "browser"` and the admin Overview shows it beside the counts.

## 6. The scan, step by step

### 6.1 Input → username (`parseSellerInput`, pure)

Accepted: a bare username (`^[A-Za-z0-9._*-]{1,64}$`), `https://www.ebay.com/usr/<username>`, `https://www.ebay.com/str/<store-slug>`, `https://www.ebay.com/sch/<username>/m.html`, with or without query string. A `/usr/` or `/sch/…/m.html` form yields the username directly. A `/str/` slug and a bare input that returns zero listings go through `/v1/seller/resolve`: the store page is fetched once and the username read from it; failing that the scan ends `failed` with `errorKey = sellerResearch.errors.sellerNotFound` and the UI says "enter the seller's username or paste their store URL". The username is stored normalised (lowercase) on the scan; the raw input is kept for display.

### 6.2 Gate (synchronous, in `POST /scans`) — in this order

1. `sellerResearch.enabled` off → 404 `sellerResearch.errors.disabled`.
2. Suspended (`QuotaEnforcementService.isSuspended`) → 409 `sellerResearch.errors.subscriptionSuspended`.
3. **Allowance** (§9): `used ≥ effective limit` → 409 `sellerResearch.errors.allowanceExhausted` with `{ used, limit }` in the body; the billing summary's `quotaAddons` then carries the packs, exactly as for conversions.
4. **Daily brake** (hidden, anti-abuse, like `bestSellers.dailyFetchLimit`): `sellerResearch.dailyScanLimit` (default 20 per seller per UTC day, 0 = nobody scans) counted in Redis, fail-open → 429 `sellerResearch.errors.dailyLimitReached`.
5. **Duplicate guard**: a `queued`/`running` scan of the same username for the same user → 409 `sellerResearch.errors.scanAlreadyRunning` (returns the existing scan id so the UI can open it).
6. **No eBay proxy configured** → 503 `sellerResearch.errors.unavailable` *before* the row is written (the operator sees `EBAY_SCRAPER_NO_PROXIES`; a seller must not be told "queued" for a scan that cannot start).

Then `INSERT seller_research_scans (status = queued)` and `queue.add('scan', { scanId }, { jobId: 'scan-' + scanId, attempts: 2, backoff: { type: 'exponential', delay: 30_000 } })`. The job id is unique per scan row, so BullMQ's kept-completed-job trap (cost-capture queue, 2026-10-01) cannot bite.

### 6.3 Phase 1 — eBay (`running`, `phase = ebay`)

1. Resolve username (§6.1) if the input needs it.
2. `/v1/seller/listings` pages 1..`maxSearchPages` (default 2 → up to 480 listings), newest first (`_sop=10`). Stop early on `hasNext = false`. A `blocked` page: retry once after 20 s through the pool (a different IP if the list has several), then **fail the scan** with `errorKey = sellerResearch.errors.ebayBlocked` — never a partial result presented as the whole store (the feed-sync rule again). A `not_found` on page 1 → `sellerNotFound`.
3. **Snapshot cache**: the raw listing pages of one username are cached in Redis for `sellerResearch.ebayCacheTtlMinutes` (default 360) keyed `seller-research:listings:{username}:{page}`; two SellerHill sellers scanning the same competitor within six hours cost eBay one read. Item pages are cached 24 h keyed by item id (`soldTotal` moves slowly; the cache stamps `fetchedAt`, shown as "as of").
4. `selectItemsToOpen(listings, caps)` (pure): drop auction-format listings when `listingType = auction` (a sold counter does not exist for them), order by `soldHint` desc → newest first, take `maxItemsPerScan` (default 200). A listing whose card says `0 sold` (eBay prints the counter on multi-quantity listings) is never opened — its answer is already known. Listings with no counter on the card are opened because the item page may still print one.
5. `/v1/item` for each selected listing through the pool at the eBay service's own pace (`ebayScraper.perIpRequestsPerSecond`, default 0.1 — §5). Per-item `blocked` → that item is kept with what the card said and `detail = unavailable`; a streak of 5 consecutive `blocked` fails the scan as `ebayBlocked`.
6. Write `seller_research_items` rows (one bulk insert): title, price, currency, image, `sold_total`, `sold_last_24h`, `listed_at` (when the page prints it), `specifics` JSONB, `sold_since_previous_scan` when `previous_scan_id` resolves (§6.6), `ebay_detail_status` (`found` / `unavailable` / `skipped`). The dummy card eBay prepends to every search page (item id `123456`, "Shop on eBay") is dropped by the parser.
7. **The scan is counted now** (`counted_at = NOW()`, §9): the seller got the eBay answer; whatever Amazon does next, the value was delivered. A scan that fails before this point costs nothing.

### 6.4 Caps (platform settings, Scraper category, all panel-tunable)

| Key | Default | Bounds | Meaning |
|---|---|---|---|
| `sellerResearch.enabled` | true | — | 404 when off |
| `sellerResearch.maxSearchPages` | 2 | 1–5 | eBay search pages per scan (240 listings each) |
| `sellerResearch.maxItemsPerScan` | 100 | 10–500 | item pages opened per scan (browser-only transport, §5) |
| `sellerResearch.amazonResultsMax` | 10 | 1–20 | upper bound on the seller's "results per item" |
| `sellerResearch.dailyScanLimit` | 20 | 0–500 | hidden per-seller daily brake |
| `sellerResearch.ebayCacheTtlMinutes` | 360 | 30–1440 | listing-page snapshot reuse |
| `sellerResearch.rescanFreeHours` | 24 | 0–168 | a re-scan of the same username inside this window is not counted again |
| `ebayScraper.proxies` | — (secret, write-only) | — | the eBay-only proxy list; **must be disjoint from `scraper.proxies`** — the save refuses an overlap (`admin.errors.setting.proxyOverlap`, pure `findProxyOverlap` by `host:port`) |
| `ebayScraper.perIpRequestsPerSecond` | 0.1 | 0.05–1 | per-IP pace on the eBay service — one page every ~10 s; six sessions in four minutes already drew a challenge (§5) |
| `retention.sellerResearchDays` | 90 | 7 floor | manifest entry; items cascade from scans |

Worst case per scan at the defaults: 2 + 100 eBay pages + ≤ 100 Amazon searches; on 3 eBay IPs at 0.1 page/s ≈ 6 min eBay + Amazon on its own pool. The scan page shows progress (`itemsPlanned` / `itemsDone`, `candidatesDone`).

### 6.5 Phase 2 — Amazon (`phase = amazon`)

For every item in `sold_total` desc order:

1. **Query**: `buildAmazonQuery(title, specifics)` (pure): if `upc`/`ean`/`isbn` passes the GS1 check digit (`common/utils/gtin.ts`), the query is the barcode and `matchKind = barcode`; else keywords — the eBay title lowercased, eBay noise stripped (`new`, `free shipping`, `fast ship`, `lot of`, `oem`, `genuine`, `brand new`, `sealed`, `us seller`, trailing `-`/`|` segments, emoji, bracketed sizes-of-lots), brand prepended when the title lacks it, capped at 8 tokens; `matchKind = keyword`. The noise list is data (`amazon-query.ts` `EBAY_TITLE_NOISE`), extended from real titles the spike returns.
2. **Search**: `ScraperClient.searchProducts({ marketplace, query, page: 1, lane: BROWSE, proxies, perIpRequestsPerSecond })` — one request. Redis cache 24 h keyed `seller-research:amazon:{query-hash}`.
3. **Filter + rank** (`filterCandidates`, `rankCandidates`, pure): drop sponsored (already dropped server-side; re-checked), drop `rating.average < minRating`, `rating.count < minReviews`, `!isPrime` when `primeOnly`; a barcode query's first surviving card is `isExact = true`; keep the first `resultsPerItem` by Amazon position. A candidate with no price is kept (the Add Listings path fetches the product properly — `asUsableCache` treats it as a miss).
4. Write `candidates` JSONB on the item row: `[{ asin, title, imageUrl, price, currency, rating, ratingCount, isPrime, boughtPastMonth, position, isExact }]`, plus `match_kind`, `candidate_count`.
5. A `blocked`/`no_proxy` Amazon answer leaves `candidates = null` + `amazon_status = unavailable`; the scan still completes. Nothing here spends the seller's Best Sellers allowance — that meter counts list pages viewed, not searches; this feature has its own meter.

The scan ends `completed` (`finished_at`), or `failed` with an `errorKey` when phase 1 could not deliver. **A failed scan leaves its rows** (the seller sees what was read) but is not counted.

### 6.6 What "sold in the last X days" means, honestly

The item page prints a lifetime `N sold` counter and sometimes `M sold in the last 24 hours`. The purchase-history page is behind sign-in (spike), so no page gives us dated sales. The data model carries these fields and the UI labels each for what it is:

| Field | Source | Shown as |
|---|---|---|
| `sold_total` | item page counter | "N sold" |
| `sold_last_24h` | item page, when printed | "M in the last 24 h" |
| `sold_per_day` | `sold_total / max(1, days since listed_at)` when `listed_at` is known | "≈ N/day (estimated)" |
| `sold_since_previous_scan` | `sold_total` now − `sold_total` on this user's previous scan of the same username (`previous_scan_id`), with that scan's date | "N since <date>" — **exact** |

The window the seller picked filters on `sold_since_previous_scan` when a previous scan inside the window exists, otherwise on `sold_per_day × days ≥ 1`; the result table says which rule applied (`sellerResearch.items.windowRuleExact` / `…Estimated`). Copy never claims an exact sale count the page did not print. A second scan a week later is therefore how a seller gets a true 7-day figure — the page says so on a first scan ("Scan again in 7 days for exact weekly sales"). No sampling job of ours runs on its own.

## 7. Data model — migration `139_seller_research.sql`

```sql
CREATE TYPE seller_research_scan_status AS ENUM ('queued','running','completed','failed');
CREATE TYPE seller_research_scan_phase  AS ENUM ('ebay','amazon');

CREATE TABLE seller_research_scans (
  id UUID PK, user_id UUID NOT NULL REFERENCES users ON DELETE CASCADE,
  seller_input VARCHAR(200) NOT NULL, seller_username VARCHAR(64),          -- NULL until resolved
  window_days SMALLINT NOT NULL,                                               -- 7 | 30 | 90
  filters JSONB NOT NULL,              -- { resultsPerItem, minRating, minReviews, primeOnly }
  status seller_research_scan_status NOT NULL DEFAULT 'queued',
  phase  seller_research_scan_phase,
  error_key VARCHAR(120),
  listings_seen INT NOT NULL DEFAULT 0, items_planned INT NOT NULL DEFAULT 0,
  items_done INT NOT NULL DEFAULT 0, candidates_done INT NOT NULL DEFAULT 0,
  ebay_transport VARCHAR(16),          -- 'curl' | 'browser', from /v1/stats at run time
  previous_scan_id UUID REFERENCES seller_research_scans ON DELETE SET NULL,
  counted_at TIMESTAMPTZ,              -- NULL = not charged against the allowance
  started_at TIMESTAMPTZ, finished_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON seller_research_scans (user_id, created_at DESC);
CREATE INDEX ON seller_research_scans (user_id, counted_at) WHERE counted_at IS NOT NULL;   -- the meter
CREATE INDEX ON seller_research_scans (user_id, seller_username, status);                   -- dup guard, rescan

CREATE TABLE seller_research_items (
  id UUID PK, scan_id UUID NOT NULL REFERENCES seller_research_scans ON DELETE CASCADE,
  ebay_item_id VARCHAR(30) NOT NULL, title TEXT NOT NULL, price NUMERIC(12,2), currency CHAR(3),
  image_url TEXT, listing_type VARCHAR(16), condition VARCHAR(40),
  sold_total INT, sold_last_24h INT, sold_per_day NUMERIC(10,3),
  sold_since_previous_scan INT, listed_at TIMESTAMPTZ,
  specifics JSONB NOT NULL DEFAULT '{}',
  ebay_detail_status VARCHAR(16) NOT NULL,       -- found | unavailable | skipped
  match_kind VARCHAR(16),                         -- barcode | keyword | NULL
  amazon_query TEXT, amazon_status VARCHAR(16),   -- found | empty | unavailable
  candidates JSONB, candidate_count INT NOT NULL DEFAULT 0,
  UNIQUE (scan_id, ebay_item_id)
);
CREATE INDEX ON seller_research_items (scan_id, sold_total DESC NULLS LAST);

-- allowance per plan + packs (values are the operator's, see §9)
INSERT INTO billing_plan_limits (plan_id, limit_key, limit_value, unit) … 'seller_scans_per_month' … 'scans' …;
INSERT INTO billing_quota_addons (slug, limit_key, quantity, amount_micros, display_order) VALUES
  ('seller-scans-50',  'seller_scans_per_month',  50,  4990000, 200),
  ('seller-scans-150', 'seller_scans_per_month', 150,  9990000, 210),
  ('seller-scans-500', 'seller_scans_per_month', 500, 14990000, 220)
ON CONFLICT (slug) DO UPDATE …;
```

Candidates live inline as JSONB: nothing joins on them, they are read only with their item, and a separate table would be a second thing to purge. The data-retention manifest gets `SELLER_RESEARCH_SCANS` (`created_at`, default 90 d, floor 7 d); items go with the cascade. **The retention floor must stay above one billing period plus the webhook grace** so the meter (§9) never loses rows it still counts — the Best Sellers rule.

## 8. API (`/v1/seller-research`, `JwtAuthGuard`, customer surface, behind `EbayAccountGuard` on the web like every data page)

| Method | Path | Body / query | Answer |
|---|---|---|---|
| POST | `/scans` | `{ sellerInput, windowDays: 7\|30\|90, resultsPerItem: 1..amazonResultsMax, minRating: 0..5 step .1, minReviews: ≥0, primeOnly }` | `201 ScanDto` or the §6.2 refusals |
| GET | `/scans?page&limit` | — | `{ items: ScanDto[], total, page, limit, allowance: { used, limit, remaining, creditValue } }` |
| GET | `/scans/:id` | — | `ScanDto` (status, phase, counters, errorKey, sellerUsername, windowRule) — polled every 3 s while `queued`/`running` |
| GET | `/scans/:id/items?page&limit&sort=soldTotal\|soldSincePrevious\|soldPerDay\|price&match=all\|matched\|unmatched` | — | `{ items: ScanItemDto[], total, page, limit }` |
| DELETE | `/scans/:id` | — | 204; a running scan cannot be deleted (409) |

DTO shapes live in `packages/shared/src/domain/seller-research/seller-research.types.ts` (enums `SellerResearchScanStatus`, `SellerResearchScanPhase`, `SellerResearchMatchKind`, `SellerResearchErrorKey`, `SellerResearchWindowDays`, constants `SELLER_RESEARCH_WINDOWS = [7, 30, 90]`), Zod in `packages/shared/src/schemas/seller-research/`; the scraper wire contracts (`EbayResearchListingsRequest/Response`, `EbayResearchItemRequest/Response`, `ScraperSearchRequest/Response`) sit beside them — one place, as `best-sellers.types.ts` is for its service.

## 9. Billing — `BillingLimitKey.SELLER_SCANS_PER_MONTH = 'seller_scans_per_month'` (unit `scans`)

- **Counted as** `COUNT(*) FROM seller_research_scans WHERE user_id = $1 AND counted_at >= window.start AND counted_at < window.end` — a per-window **flow** like conversions and Best Sellers, no reservation table. The flag is stamped once, at the end of phase 1 (§6.3.7); a re-scan of the same username inside `rescanFreeHours` is not stamped.
- **Effective limit** = plan limit + window-scoped credits through the existing `resolveEffectiveLimit`; packs are granted by the existing `checkout.session.completed` handler; `describeAddonProduct` gets a `SELLER_SCANS_PER_MONTH` case ("N extra competitor scans"); `LOCK_DISCRIMINATOR` gets `5`; `billing.service.ts`'s `dimensions` array gets the new row; `usageRows.ts`'s `USAGE_LIMIT_KEYS` gets the key; `billing.json` gets `limits.seller_scans_per_month.{label,unit,description}` and `addons.subtitleByLimit.seller_scans_per_month` in all 16 locales.
- **Exhaustion blocks** (unlike Best Sellers, which truncates): a scan is all-or-nothing work, there is no "partial scan" worth showing. The refusal is a 409 and the page renders the packs from `GET /billing/summary` (`quotaAddons` is returned only once the limit is reached — existing rule).
- Enforcement off or no subscription → unmetered (fail open, like every gate). Suspended → refused.

**Operator decisions still open — the numbers below are placeholders in the operator's own proposal, written so the migration has values; change them before the migration is written:**

| Item | Proposal (2026-10-02) | Note |
|---|---|---|
| Free allowance | **3 scans / month on every plan, trial included** | AslScout trial: 5 scans once. A per-tier ladder (Mini 3 … Enterprise 50) is the other option; it matches the other meters but is more rows to explain |
| Packs | 50 / $4.99 · 150 / $9.99 · **500** / $14.99 | AslScout: 40 / $9.99 · 120 / $16.99 · unlimited / $24.99 (subscriptions). **"Unlimited" cannot be a top-up**: credits are a quantity on one billing window. An unlimited tier would be a recurring add-on — a different Stripe object and a different local model, not in V1. With our own browsers on flat-rate IPs the unit cost is time, so a 500 pack is safe; under an unblocker it is not. |
| Rescan | free inside 24 h | AslScout charges a rescan half price |

## 10. Web

**`/seller-research`** — `PageHeader` (title, subtitle, the allowance meter on the right as Best Sellers shows it), a `Card` with the **new-scan form** (seller input `ModernTextInput` with floating label; window `SegmentedControl` 7 / 30 / 90; results per item `Select` 1–10; min rating `Select` any / 3.5 / 4 / 4.5; min reviews `ModernTextInput` numeric; Prime `Toggle`; one primary **Scan** button — `submitAttempted` validation, never a disabled button), then the **scan list** as a `DataTable` opening on cards (`ScanCard`: seller, status badge — queued amber · running sky · completed green · failed red —, window, counts, date; a running card shows a progress line; the whole card opens the detail). Empty state explains the feature in two lines. Allowance exhausted → the form stays, the Scan button's refusal opens the packs (`EmptyState` with the packs under it, the Best Sellers upsell card).

**`/seller-research/:id`** — title = the seller's username, subtitle = scanned at · window · rule applied (exact / estimated). While running: the `DataTable` skeleton with the progress counters above it. Done: the items `DataTable` (cards default, table a toggle): eBay side — photo, title (one line, tooltip), price, `N sold`, `in window`, `listed since`; Amazon side — up to `resultsPerItem` candidate rows (`CandidateList`): thumbnail, title, price, rating + count, Prime badge, `isExact` badge for barcode matches, a checkbox per candidate. Filters row: match `Select` (all / matched / unmatched), sort `Select`. **Selection bar** = Best Sellers': "N selected · List selected · Clear" → `localeNavigate('/listings?drawer=add&asins=…')`. A failed scan renders `EmptyState` with the error copy and a **Scan again** action that re-posts the same inputs. Below `md`: the eBay block stacks over its candidates; the form's six controls go to one column.

**Copy rules**: "competitor" / "rakip" is fine; never "dropshipping"; never a claim of exact sales where the field is estimated; the Amazon side says "candidates", not "matches", unless `isExact`. `sellerResearch` namespace: `menu`, `title`, `subtitle`, `form.*`, `list.*`, `status.*`, `detail.*`, `items.*`, `candidates.*`, `selection.*`, `states.*`, `errors.*` (one key per `SellerResearchErrorKey`), `allowance.*`. Demo mode: two fixture scans (one completed, one failed) built in `demoData.ts`, answered by `demoBaseQuery` for `/seller-research/*`; POST answers with the completed fixture.

## 11. Invariants locked by tests

| Spec | Locks |
|---|---|
| `seller-research-egress.guard.spec.ts` | exactly one `ebayResearchClient.fetchListings(` / `.fetchItem(` call site each, both preceded by the empty-proxy early return; no proxy value in any log line; the api never constructs an eBay URL for fetching |
| `seller-research-no-ebay-api.guard.spec.ts` | nothing under `modules/seller-research/` imports `EbayService`, `EbayFulfillmentService`, `EbayBulkService`, `EbayFeedService`, `EbayAnalyticsService` or mentions `api.ebay.com` / `apiz.ebay.com` / `/buy/browse/` |
| `proxy-overlap.spec.ts` (+ a case in `platform-settings.helpers.spec.ts`) | saving `ebayScraper.proxies` with a `host:port` present in `scraper.proxies` is refused, and vice versa |
| `scan-allowance.spec.ts`, `amazon-query.spec.ts`, `candidate-filter.spec.ts`, `scan-plan.spec.ts`, `seller-input.spec.ts` | the pure layer: counting window, rescan-free rule, GS1 → barcode query, noise stripping, 8-token cap, rating/review/Prime filters, sponsored dropped, `isExact` only on barcode, auction skipped, `0 sold` never opened, URL forms |
| `seller-research.processor.spec.ts` (fakes) | blocked page 1 → `failed`/`ebayBlocked` with no rows; 5-block streak → failed; counted only after phase 1; Amazon unavailable → still `completed`; `previous_scan_id` + `sold_since_previous_scan` on a rescan; the `123456` dummy card never becomes an item |
| `billing` exhaustive maps | `LOCK_DISCRIMINATOR`, `describeAddonProduct`, `dimensions`, `USAGE_LIMIT_KEYS` each carry the new key (TypeScript forces the first; a spec asserts the rest) |
| `scraper-egress.guard.spec.ts` (extended) | `SCRAPER_ALLOW_DIRECT` absent from both Coolify compose files for the new service too |
| Python `tests/` in `services/ebay-scraper` | fixture parity for the two card markups, item page (sold counter, specifics, listed-at), resolve page; `blocked` vs `not_found` classification (challenge/sign-in pages are never `not_found`); the dummy card dropped; no-proxy → no browser launch; `test_shared_parity.py` |
| Python `tests/test_search.py` in `services/amazon-scraper` | `fetch_search` to_wire, sponsored dropped, no_proxy, blocked |

## 12. Operations

- **Compose**: `ebay-scraper` service in all three compose files, on `ebay_research_net` (private, no published port, not on `coolify`), image = `python:3.12-slim` + `playwright` + Chromium + **Xvfb** (`xvfb-run` wraps the server process; the browser is launched headful, §5), memory limit `EBAY_SCRAPER_MEMORY_LIMIT` 2 G (one resident Chromium per proxy IP), `shm_size: 1g` (Chromium's shared memory), non-root user, `depends_on: service_started` from `api` (same reasoning as the Amazon service: the api must boot without it). Env: `EBAY_SCRAPER_SERVICE_URL`, `EBAY_SCRAPER_SERVICE_SECRET` (a different secret from `SCRAPER_SERVICE_SECRET`).
- **Admin**: `AdminWarningKind.EBAY_SCRAPER_NO_PROXIES` (critical while `sellerResearch.enabled`), `EBAY_SCRAPER_UNREACHABLE`, `EBAY_SCRAPER_BLOCK_RATE_HIGH` (same `scraper.blockRateWarnPercent` knob), `EBAY_SCRAPER_PROXY_OVERLAP` (critical — a list saved before the overlap check existed, or edited by hand). The Scraper settings category gets an **"eBay research"** block: proxies editor (the existing `ScraperProxiesEditor` with a `target` prop → `POST /v1/admin/settings/ebay-scraper/proxies/verify`), rps, the caps. The admin Overview card shows the eBay service's last-hour counts and `transport`.
- **Queue**: `seller-research` in `ADMIN_QUEUE_NAMES`, `OBSERVED_QUEUE_NAMES`, the admin `BullModule.registerQueue` list and `admin.controller`'s `queues()` (the coverage guard spec fails otherwise). Concurrency `SELLER_RESEARCH_WORKER_CONCURRENCY` env, default 1 — the eBay service's per-IP pace is the real limit, and two scans would only queue behind each other there.
- **Action Center**: none. A failed scan is on its own page; nothing here waits on the seller.
- **Legal posture, written down once**: this feature reads public listing pages the way a browser does, through infrastructure that shares nothing with the eBay API integration. It is a User Agreement §3 exposure the operator accepted on 2026-10-02 with the keyset kept out of it; it must stay out — see the no-ebay-api guard. Seller-facing copy says "publicly available listing data" (the competitor's wording) and nothing about eBay's permission.

## 13. Build order (for the plan)

1. Shared types + Zod + i18n skeleton (en/tr first, 14 agents for the rest at the end).
2. `services/amazon-scraper`: `sellerhill/search.py` + `POST /v1/search` + tests. (Independent of eBay; unblocks phase 2.)
3. **Xvfb spike** (a throwaway Docker image: python + playwright + Chromium + Xvfb, the same probe through the eBay IP, run once the IP has cooled for a day) → only on a pass: `services/ebay-scraper` (egress/pool copies, headful browser worker, selectors, three routes, fixtures from the spike's evidence, Dockerfile, compose). On a fail: stop, report, operator chooses unblocker vs Marketplace Insights.
4. Migration 139 + billing wiring (limit key, maps, catalog sync, summary dimension, retention manifest).
5. API module: client, settings, pure helpers (TDD), service + gate, processor, controller, guard specs.
6. Web: API slice, pages, hooks, demo fixtures, nav/route, i18n.
7. Admin: settings block, proxies editor target, warnings, overview card.
8. CLAUDE.md section + the 14-locale i18n pass + a `PREPARE` of every new SQL statement against local Postgres.

## 14. Open questions for the operator (answers change numbers, not structure)

1. Free allowance: flat 3 on every plan, or a per-tier ladder? (§9)
2. Packs: 50 / 150 / 500 at $4.99 / $9.99 / $14.99 — confirm, or give other figures; "unlimited" is not a top-up (§9).
3. Rescan of the same seller free for 24 h — confirm.
4. Should the scan list be visible in demo mode (two fixtures) — proposed yes.
