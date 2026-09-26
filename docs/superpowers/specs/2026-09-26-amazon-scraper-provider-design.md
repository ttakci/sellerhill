# Amazon product data from our own scraper, with Keepa behind a switch

Date: 2026-09-26
Status: design approved by the operator in conversation; written spec awaiting review. Not yet planned or implemented.

This is sub-project 1 of 3. The other two are deliberately out of scope here:
- **2. Content-change sync**: detect title/description/image changes on Amazon and revise the eBay listing. The codebase has no eBay revise path yet.
- **3. Product discovery**: best-seller and category browsing in the seller UI.

## Problem

All Amazon product data comes from Keepa: metadata at listing creation, and Buy Box price and stock on the refresh cycle. The operator wants to stop depending on it, for three reasons.

**Cost and speed.** Keepa is metered in tokens. Our plan refills 20 tokens a minute, which is about 3 ASINs a minute. A 500-product listing job that misses the cache takes hours.

**Keepa's stock number is often not stock.** The operator checked with the 999-in-cart method. Where Keepa reported 4 or 10, those numbers were the seller's **per-order purchase limit**; the real inventory was higher. On 12 low-stock products, Keepa's figure equalled the product page's quantity-dropdown maximum in 9 cases.

**Keepa misses products that are gone.** `B00AM1Z670` returns HTTP 404 on Amazon. Keepa still reported it with stock 12, while our live eBay listing kept selling a product that cannot be bought.

## What was measured before this design

These tests ran in a throwaway scratchpad on 2026-09-26 against the open-source [omkarcloud/amazon-scraper](https://github.com/omkarcloud/amazon-scraper) (MIT, pushed 2026-09-24). It uses `curl_cffi` with browser TLS impersonation and no browser. Everything below is from the operator's residential IP with no proxy.

| Measurement | Result |
|---|---|
| Sequential run, ~2.5s pause between requests | 777/777 succeeded, 0 blocks or captchas, 79 minutes, median 3.6s per request, no slowdown over time |
| Burst, 8 threads | 120/120 succeeded, 0 blocks, **3.5 ASIN/s** (208/min) |
| Time per request | network ≈ 1.9s; full parse ≈ 1.0s of CPU; a lean regex extraction of price and availability ≈ 2ms |
| Price vs Keepa (50 ASINs) | 47/50 exact. The other 3 were Prime-exclusive prices, which the scraper reports. **This is intended**: every buyer account is Prime (operator decision). |
| Bullets | same count as Keepa (5.2 average) |
| Classic description | 22/50 for both sources |
| Specs | 20.1 fields vs 17.4 from our Keepa extractor. Key names differ. |
| Barcode (UPC/EAN/GTIN) | Keepa 33/50, scraper 28/50. The scraper never had one Keepa lacked. |
| Images, upstream parser | **broken**: empty on 29% of pages, and on pages with variations it mixed in images of other variants (up to 309) |
| Images, fixed extractor (ImageBlock `initial` payload) | **exact set match with Keepa on 50/50 plain products and 40/40 products with 43–452 variations** |

### How Amazon exposes stock

This was established from 777 + 150 + 400 product pages. It is not documented by Amazon anywhere we could find.
- The availability line shows `Only N left in stock` for **N ≤ 20**. We never observed an N above 20.
- Above 20 it shows `In Stock` with no number.
- **A seller order limit suppresses the "Only N left" message while stock is above the limit.** Among 66 pages showing "Only N left", none had a dropdown maximum below N. Meanwhile 81 of 400 "In Stock" pages had a dropdown maximum below 20.
- So on a limited listing, "In Stock" only guarantees stock ≥ the limit.
- The dropdown maximum is **not** an upper bound on stock. In 34 cases it exceeded the "Only N left" value. With "In Stock", though, it is a safe lower bound.
- `Currently unavailable` means stock 0. A 404 means the product no longer exists.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | A separate Python service owns fetching and parsing. It is a fork of omkarcloud in `services/amazon-scraper/`. | `curl_cffi` TLS impersonation is what keeps us unblocked, and it is Python-only. |
| D2 | Python extracts **signals**. TypeScript decides what they mean (stock status, floor, limit, removed). | Same split as `keepa-normalizer.ts`. The business rules stay pure and Jest-tested. |
| D3 | One provider port. `KeepaProvider` and `ScraperProvider` both return `SourceProduct`. | Create, import and refresh stop knowing which source they talk to. |
| D4 | The setting `product.dataProvider` is `keepa` or `scraper`, **default `scraper`**. There is no mixing and **no fallback to Keepa**, not even for a missing barcode. | Operator decision. Keepa exists only as a rollback. |
| D5 | **Never scrape from the VPS IP.** No proxies means no requests. The one exception is local development via an env flag that no compose file sets. | Auto-fulfill checkouts leave from the VPS IP. Flagging it would break real purchases. |
| D6 | Keep the listing-create cache rule unchanged: a cached row with a valid title and at least one image is not re-fetched. | Operator decision. Capacity is reserved for refresh. |
| D7 | Refresh interval default drops from 720 to **360 minutes** (4×/day), and is lowered by hand as the catalogue grows. | Operator decision, driven by capacity. |
| D8 | Refresh uses **commerce mode** (lean extraction). Create uses **full mode**. | A full parse at 400k refreshes a day would hold about 5 cores permanently. |
| D9 | Do not use A+ text in this phase. Store it raw. | It contains "Add to Cart", other products' prices and pagination text. |
| D10 | Spec keys are translated into the canonical names our aspect matcher already uses. There is **no** second, scraper-specific matcher. | One matcher, and one set of learned defaults per category. |
| D11 | Stock floor for "In Stock" is **20**, displayed as **"20+"**. A limited listing shows "D+", where D is the dropdown maximum. | Evidence above. |
| D12 | Products that return 404 get stock 0, and the Action Center shows "**Amazon'da erişilemiyor**". The listing is **not** ended automatically. | Ending a listing is irreversible, and a product can come back. |

## Architecture

```
NestJS (apps/api)                                    services/amazon-scraper (Python)
┌───────────────────────────────┐   POST /v1/products   ┌──────────────────────────────┐
│ ListingProcessor / Import     │──────────────────────▶│ lanes: interactive > background│
│ RefreshProcessor              │   internal network    │ proxy pool, sticky per proxy  │
│   └─ ProductDataProvider port │   + shared secret     │ per-IP rate limit + cooldown  │
│        ├─ KeepaProvider       │◀──────────────────────│ full / commerce extraction    │
│        └─ ScraperProvider     │   signals per ASIN    │ N worker processes            │
│ source-product-normalizer.ts  │                       └──────────────────────────────┘
│ (pure: stock, limit, removed) │
└───────────────────────────────┘
```

### The Python service (`services/amazon-scraper/`)

- The omkarcloud code is vendored. The upstream commit it came from is recorded in `UPSTREAM.md`. Our changes live in separate modules wherever possible, so upstream anti-bot fixes can be merged.
- **Endpoint:** `POST /v1/products`. It requires the header `X-Scraper-Secret` and is reachable only on the internal Docker network, never through Coolify's proxy.
  - Request body:
    ```
    { marketplace: "US", asins: [...≤100], mode: "full" | "commerce",
      lane: "interactive" | "background", proxies: ["http://user:pass@host:port", ...] }
    ```
  - Response: one result per ASIN:
    ```
    { asin, outcome, fetchedAt, signals, content? }
    ```
  - `outcome` is `FOUND | NOT_FOUND | BLOCKED | PARSE_FAILED | NO_PROXY`.
  - `signals` holds the price, currency, availability text, `isInStock`, `onlyLeft`, `quantityMax` (maximum of the Buy Box quantity select) and the Buy Box seller.
  - `content` is returned only in full mode. It carries the title, brand, manufacturer, bullets, description, raw A+ text, images, the category breadcrumb, specs (overview + details) and identifiers.
- **Other endpoints:**
  - `GET /v1/stats`: rolling 1h and 24h counters per outcome and per proxy, plus mean latency.
  - `GET /health`.
- **Proxies arrive with every request.** The service holds no configuration, and a restart loses nothing.
  - Sessions are keyed by proxy URL. A thread's session never changes IP during its lifetime.
  - A proxy that keeps getting blocked is put into cooldown.
  - If every proxy is cooling down, the result is `BLOCKED`.
- **The upstream direct-egress fallback is removed.** Upstream falls back to a direct connection when no proxy is set (`_proxy_for` → `None`, `amazon_fallback_proxy`); both paths are cut. An empty proxy list yields `NO_PROXY` without making any request. `SCRAPER_ALLOW_DIRECT=1` re-enables direct egress for local development only.
- **Lanes.** Interactive requests (create, import) are served before background ones (refresh).
- **Pacing.** Rate is limited per proxy by `perIpRequestsPerSecond`, which Nest sends. The service runs several processes because the full parse is CPU-bound and one Python process uses one core.
- **Parser fixes:**
  1. **Images:** read only the current ASIN's gallery from the ImageBlock `'initial': A.$.parseJSON('[…]')` payload.
  2. **`quantityMax`:** read from the Buy Box quantity select. Pages can carry more than one select, so it must be the Buy Box one.
  3. **Commerce mode:** extract price, availability and dropdown only, without the full DOM parse.
  4. **Price:** the Prime price is kept as it is (see "What was measured").

### The provider port (`apps/api`)

- `ProductDataProvider` has two methods:
  - `fetchForCreate(asins, marketplace): Promise<SourceProductResult[]>`
  - `fetchForRefresh(asins, marketplace): Promise<SourceProductResult[]>`
- It replaces the thin `IProductDataProvider` in `packages/shared/src/domain/products/product-data.types.ts`.
- `SourceProduct` lives in `packages/shared` and has three parts:
  - **commerce:** `price`, `currency`, `stockStatus`, `stock`, `maxOrderQuantity`, Buy Box seller
  - **content:** `title`, `brand`, `manufacturer`, `features`, `description`, `images`, `categoryPath`, `category`, `specs`, `identifiers`
  - **meta:** `outcome`, `raw`
- **`KeepaProvider`** wraps the existing `KeepaService` unchanged:
  - `KeepaStockStatus.KNOWN` becomes `EXACT`, and `UNKNOWN` stays `UNKNOWN`;
  - `maxOrderQuantity` is `null`;
  - token and balance logging stay where they are.
- **`ScraperProvider`** calls the service, then runs `source-product-normalizer.ts`. That function is pure and Jest-tested, and turns the signals into stock status (see below).
- The active provider is resolved per call from `product.dataProvider`, so a panel change takes effect without a restart.
- **Call sites switched to the port:**
  - `ListingProcessorService.resolveProductData` (create, `listing-processor.service.ts:589`)
  - `ListingImportService` (`listing-import.service.ts:150`)
  - `RefreshProcessorService.refreshBatch` (`refresh-processor.service.ts:277`)

## Stock, order limit, removed products

### Stock status (`source-product-normalizer.ts`)

| Page signal | `stockStatus` | `products.stock` | UI |
|---|---|---|---|
| `Only N left` | `EXACT` | N | `N` |
| `In Stock` (or "Usually ships…"), with `quantityMax` ≥ 20 or absent | `AT_LEAST` | 20 (`scraper.inStockFloor`) | `20+` |
| `In Stock`, with `quantityMax` D < 20 | `AT_LEAST` | D | `D+` |
| `Currently unavailable` | `OUT_OF_STOCK` | 0 | `0` |
| HTTP 404 | `OUT_OF_STOCK`, and `source_removed_at` is set | 0 | `0` plus "Amazon'da erişilemiyor" |
| Page loaded but price or availability unreadable (`PARSE_FAILED`) | `UNKNOWN` | previous value kept | previous |

A later `FOUND` result clears `source_removed_at`.

### Order limit

`products.max_order_quantity` is the dropdown maximum. It is `null` when there is no dropdown, and always `null` for Keepa rows.

### Schema

One new migration, at the next free number:
- `products.stock_status VARCHAR(16) NOT NULL DEFAULT 'exact'`. Existing Keepa rows hold exact numbers.
- `products.max_order_quantity INT NULL`
- `products.source_removed_at TIMESTAMPTZ NULL`, with a partial index `WHERE source_removed_at IS NOT NULL`

The `SourceStockStatus` enum (`exact | at_least | out_of_stock | unknown`) lives in `packages/shared`. `unknown` is never persisted: it means "keep the previous row".

### Quantity formula (`ListingStrategyService.calculateQuantity`)

```
quantity = min( max(stock − stockBuffer, 0), defaultQuantity, maxOrderQuantity ?? ∞ )
```

- **Limited "In Stock" listings are conservative, by design.** Example: limit 4, buffer 5, "In Stock". Stock is 4, so the quantity is 0 and the product does not list. We only know that at least 4 exist, and the seller asked for 5 in reserve.
- **Failure message.** When buffer drives a create to 0, the `ZERO_STOCK` failure carries `{ amazonStock, stockStatus, stockBuffer }`. The seller-facing text says, for example, "Amazon stoğu (en az 4) güvenlik payından (5) az".

### Other stock rules

- **After a sale, `decrementStock` is unchanged.** It lowers stock until the next refresh, which then overwrites it with the Amazon value. `stock_status` is not changed by a decrement.
- **Create with `UNKNOWN`.** It fails as today, as `ZERO_STOCK`. This was 6 of 777 pages (0.8%).
- **`stockStatus` from both providers.** It feeds the existing refresh logic: `UNKNOWN` preserves the previous price and stock, as it does today.

### Display

- The listing detail "Amazon Stok" row (`ListingDetailPage.component.tsx:394`), the listings table column (`useListingsColumns.tsx:193`) and the CSV export render `AT_LEAST` as `N+`.
- The API exposes `sourceStockStatus` next to `sourceStock`.
- The listings "Amazon stok" range filter compares the stored number, so `20+` counts as 20. The filter field gets a note: "20 üstü stok bilinmez; 20+ ürünler 20 sayılır".
- Demo fixtures gain some `N+` rows.

### Action Center

New item `SOURCE_UNAVAILABLE_ON_AMAZON` ("Amazon'da erişilemiyor"), severity WARNING. It counts ACTIVE listings whose product has `source_removed_at` set.

## Refresh, capacity, fairness

- **Unchanged:** the claim, lease, entitlement filter, backoff, quarantine, compare and fan-out.
- **Outcomes in the refresh worker:**
  - `BLOCKED` or `NO_PROXY`: transport-like. The batch is retried, and `consecutive_failures` does not grow, because it is not the product's fault.
  - `PARSE_FAILED`: the existing data-failure path.
  - `NOT_FOUND`: definitive. Stock 0, and the normal interval continues.
- **The metadata-change branch does not run in commerce mode.** Title, description and image updates belong to sub-project 2.
- **Batch size (per 1-minute tick) under the scraper:**
  ```
  floor(perIpRequestsPerSecond × proxyCount × 60 × (1 − reservePercent/100))
  ```
  The reserve (default 20%) is headroom for interactive creates. Under Keepa, `resolveRefreshBatchSize` is unchanged.
- **Capacity at 1 request/s per IP ≈ 86k requests/day per IP.** The operator starts at 4×/day and lowers the cadence as the unique-ASIN count grows.

  | Unique ASINs | 4×/day | 3×/day | 2×/day |
  |---|---|---|---|
  | 50k | 3 IPs | 2 IPs | 2 IPs |
  | 200k | 10 IPs | 7 IPs | 5 IPs |
  | 400k | 19 IPs | 14 IPs | 10 IPs |

- **Visibility (admin):**
  - **Refresh lag:** age of the most overdue claimable product. A warning fires when it exceeds the target interval.
  - **Capacity:** "syncs/day achievable with current proxies" for the current unique-ASIN count.
  - Both apply to either provider.
- **Fairness between sellers.** `ListingQueueService` already splits a job into 25-ASIN batches (`chunkForBulk` + `addBulk`). Each batch now gets a BullMQ `priority` equal to 1 + the number of that user's batches already waiting, and the import path does the same. One seller's 20th batch therefore runs after another seller's first. The priority helper is pure and Jest-tested.
- **Deduplication.** Two sellers creating the same uncached ASIN at the same time may fetch it twice. That is harmless, because `findOrCreateProduct` upserts, so the Keepa-era advisory lock is not needed on the scraper path.

## Data mapping (full mode → `products`)

| Column | Source | Note |
|---|---|---|
| `title`, `brand`, `manufacturer`, `features` | page | |
| `description` | classic description only | Otherwise the existing bullet-based fallback applies (D9). |
| `image_urls` | fixed gallery | Then EPS upload as today. |
| `category_path`, `category` | breadcrumb joined with `" > "`, leaf | **Must equal Keepa's `categoryTree` path byte-for-byte.** `ebay_category_map`'s `AMAZON_CATEGORY` scope is keyed on it, and every miss spends a call from the 5,000/day Taxonomy quota. Verified before switching (see Testing). |
| `specs` | overview + details, translated (D10) | Keys that duplicate identifiers or are noise are dropped: ASIN, customer reviews, best sellers rank, date first available. Unknown keys become Title Case and still reach eBay as custom item specifics. |
| `identifiers` | UPC, GTIN (→ EAN when 13 digits), part number → MPN, model | Existing GS1 check applies. A missing barcode is accepted: the eBay payload omits it, and the aspect fallback supplies "Does not apply". |
| `price`, `currency`, `stock`, `stock_status`, `max_order_quantity` | normalizer | |
| `raw_provider_data` | scraper payload, including raw A+ | `raw_keepa_data` stays Keepa-only. `resolveCachedAttributes` keeps re-deriving only from it. |

## What happens to Keepa-specific parts while the scraper is active

- `keepa_usage_log`, `keepa_balance` and the Keepa `usage_events` projection are not written.
- The admin `KEEPA_LOW_TOKENS` warning and the Keepa balance card show only while `product.dataProvider = keepa`.
- **Setting keys and queue name stay the same.** The `keepa.refresh.*` keys and the `keepa-refresh` queue are not renamed, because renaming would orphan stored overrides and Redis entries. Only their panel labels become "Ürün yenileme".
- The interval code default becomes 360.
- `classifyListingFailure` gains scraper cases:
  - `NOT_FOUND` → `ASIN_NOT_FOUND`
  - `BLOCKED` / `NO_PROXY` / `PARSE_FAILED` → `PRODUCT_DATA_UNAVAILABLE`, where `BLOCKED` and `NO_PROXY` are retryable
- `KEEPA_API_KEY` stays configured, and the Keepa subscription stays active until the operator is confident. The rollback is one panel change.

## Configuration

**Env only** (`SCRAPER_SERVICE_URL`, `SCRAPER_SERVICE_SECRET`). The rule in CLAUDE.md is that a secret's destination stays out of the panel.

**Panel, via the registry.** Every key gets titles and descriptions in both locales, as `platform-settings-i18n.guard.spec.ts` requires.

| Key | Type | Default |
|---|---|---|
| `product.dataProvider` | `keepa` \| `scraper` | `scraper` |
| `scraper.proxies` | secret, write-only list | empty |
| `scraper.perIpRequestsPerSecond` | number | 1 |
| `scraper.inStockFloor` | number | 20 |
| `scraper.blockRateWarnPercent` | number | 10 |

**Admin warnings:**
- `SCRAPER_NO_PROXIES`: critical
- `SCRAPER_UNREACHABLE`: critical
- `SCRAPER_BLOCK_RATE_HIGH`
- `REFRESH_LAG`

**Deployment.** A `scraper` service is added to `docker-compose.test.yml` and `docker-compose.production.yml`. It has its own Dockerfile, is internal-network only, and has a memory limit. It must be healthy before the API starts. If it is unreachable, results are transport failures: refresh rows stay claimed and are retried, and creates fail as retryable.

## Testing

- **Python (pytest).** Reuses the repo's gzipped-fixture pattern, with fixtures captured on 2026-09-26:
  - variation gallery;
  - `Only N left`;
  - `In Stock` with a limited dropdown;
  - `Currently unavailable`;
  - 404;
  - a page with several quantity selects;
  - `NO_PROXY` returning without a network call.
- **Jest:**
  - the normalizer: every row of the stock table, plus the limit rule;
  - a provider contract test: both adapters produce a valid `SourceProduct`;
  - `calculateQuantity` with `maxOrderQuantity`;
  - the fairness priority helper;
  - the scraper batch-size formula;
  - a **guard spec** that source-greps the service's egress code, so a request can never be made without a proxy outside the dev flag.
- **`pnpm --filter api provider:compare -- --asins …` (read-only).** Fetches the same ASINs through both providers and prints the differences: price, stock status, images, description, specs, identifiers and category path. It becomes the regression check for Amazon layout changes. It spends Keepa tokens, so it is run by hand.
- **Before relying on the scraper in production:**
  - `provider:compare` on about 50 ASINs, with category paths identical;
  - `ebay:aspect-probe` on the same ASINs from scraper-fed rows: required aspects filled from product data must be ≥ Keepa's.

## Rollout

1. Merge and push. Deployment is automatic, and the default provider is `scraper`.
2. **Enter the proxies in the panel immediately.** Until proxies exist, no listing can be created and refresh is paused. Prices and stock are preserved, and `SCRAPER_NO_PROXIES` is shown.
3. Check the admin scraper stats, run `provider:compare`, and create a few test listings.
4. Watch refresh lag and capacity for a few days.

**Rollback:** set `product.dataProvider = keepa`.

## Known limitations and unverified assumptions

- **About 10% of products will have no barcode** (Keepa 33/50 vs scraper 28/50). The operator accepted this, with no Keepa fallback.
- **The stock rules rest on 1,300+ observed pages, not on Amazon documentation.** If Amazon changes the "Only N left" threshold, `scraper.inStockFloor` can be adjusted.
- **Sustained load is untested.** Every test ran from one residential IP: a 79-minute run at 0.16/s and a 35-second burst at 3.5/s. ISP proxy reputation and multi-hour load at 1/s per IP are unverified. The admin block-rate warning is the detector.
- **Proxy bandwidth.** Pages are 1–2.5 MB of HTML. Bytes on the wire (compressed) were not measured, and "unlimited" proxy plans can carry a fair-use cap.
- **Fork maintenance.** Amazon layout changes will break parsers. Three parser defects surfaced in the first 50 pages. With Keepa, that maintenance was theirs; with the scraper it is ours. `provider:compare` is the tool for catching it.
- Merchandise variations (size, colour) are not listed separately. Each ASIN is fetched on its own, exactly as today.

## Out of scope

- Content-change detection and eBay revise (sub-project 2)
- Product discovery (sub-project 3)
- Cleaning or AI-rewriting A+ text
- Any Keepa fallback
- Renaming the `keepa-*` settings or queue
- Per-user proxy configuration (the Amazon buyer-account proxies are unrelated and untouched)

## Documentation

CLAUDE.md changes:
- "Product Refresh Pipeline" becomes provider-neutral, with a new "Scraper provider" section covering the stock model, the no-VPS-egress rule, capacity and rollback.
- The migrations table gains the new migration.
- "Keepa is the sole provider" statements are corrected.
