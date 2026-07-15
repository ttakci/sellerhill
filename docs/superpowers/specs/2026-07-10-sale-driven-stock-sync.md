# Sale-Driven Stock Sync

**Date:** 2026-07-10
**Status:** Implemented

## Problem

The platform dropships from Amazon: every eBay listing's quantity is **derived** from
the cached Amazon stock for that ASIN:

```
quantity = min(max(amazonStock − buffer, 0), defaultQuantity)
```

`products.stock` (the ASIN-level Amazon stock cache) is only refreshed by the **12-hour
Keepa sync** (`ProductSyncService.syncPricesAndStock`). Between refreshes it is stale.

When an eBay sale happened, nothing updated listing quantity until the next 12h sync — so:

- A well-stocked listing sat at eBay's post-sale decremented count for up to 12h even
  though Amazon still had plenty.
- There was no fast path reflecting confirmed sales.

A manual per-group "auto-restock" toggle existed in the UI but was a **no-op** — no
backend ever read it. It has been removed (see commit history).

## Design

Treat a confirmed eBay sale as ground truth: we **know** one of our customers sold a
unit, which corresponds to a real Amazon purchase. Deplete the shared `products.stock`
by the sold quantity, then recompute + push the affected listings — without calling
Keepa/scraper APIs per sale.

### Why decrement a shared cache?

`products` is keyed by ASIN and shared across **all customers** (many sellers can list
the same ASIN). Our customers' eBay sales correspond to real Amazon purchases, so
decrementing the shared stock on each confirmed sale is a sound lower-bound estimate of
Amazon depletion. The next 12h Keepa sync resets it to Amazon ground truth.

This is **conservative**: between syncs the cache can only under-count Amazon stock
(if Amazon restocked) or be exact (if Amazon only depleted by our sales). It can never
over-count — so we never oversell, only ever show out-of-stock slightly early.

### Flow

```
eBay sale → order-sync (BullMQ, every 15 min)
  → upsertOrder: RETURNING id, (xmax = 0) AS inserted
       xmax = 0  ⟹  brand-new INSERT (not a re-synced UPDATE)
  → only if inserted && matched listing && quantity > 0:
       products.stock -= order.quantity          (ProductsService.decrementStock, floor 0)
       stock-sync queue ← { productId }
            → StockSyncProcessorService (concurrency 3)
                 → ProductSyncService.syncListingsForProduct(productId)
                      → reuses the 12h-sync fan-out (updateAllListingsForProduct):
                            for each ACTIVE listing sharing the product:
                              quantity = calculateQuantity(stock, group)   // per group!
                              EbayService.updatePriceAndStock(...)          // 429-backoff protected
                              UPDATE listings SET quantity = ...
```

### Per-seller quantities from shared stock

The decrement is global, but the **computed** eBay quantity is per-listing — each
listing's own settings group supplies `buffer` and `defaultQuantity`:

| Seller | Group | Compute (`products.stock = 10`) | eBay push |
|---|---|---|---|
| A | buffer=2, default=5 | `min(max(10−2,0),5)` | **5** |
| B | buffer=5, default=2 | `min(max(10−5,0),2)` | **2** |
| C | buffer=0, default=10 | `min(max(10−0,0),10)` | **10** |

One shared stock value → three different eBay quantities. Each seller's risk appetite
(buffer) and capacity (defaultQuantity) is reflected in their own listing. A sale by
seller A depletes the shared stock, so sellers B and C are also recomputed and pushed.

### Idempotency

- **Order level:** Postgres `xmax = 0` detects genuine inserts vs `ON CONFLICT DO
  UPDATE`. Order-sync re-runs the same order every 15 min while it's in the fetch
  window; without this guard, stock would be decremented repeatedly. `xmax` is read
  atomically inside the same upsert — no extra query, no race.
- **Queue level:** the worker re-reads `products.stock` at execution time and
  recomputes, so a delayed or coalesced job just re-pushes the correct current value.

### Rate-limit hygiene

- **Burst collapse:** BullMQ `jobId` is bucketed per 5s window per product
  (`stock-sync:{productId}:{floor(now/5000)}`). A burst of sales for the same ASIN
  within one order-sync batch collapses into a single job — and since the decrement
  happens synchronously before the job runs, that one job sees the final stock.
- **Retry:** `attempts: 3`, exponential backoff. The processor re-throws on failure so
  BullMQ retries.
- **eBay API:** `EbayService.withRateLimitRetry` wraps every call in
  `updatePriceAndStock` with exponential backoff on 429 / 5xx, honouring the
  `Retry-After` header (delta-seconds) when eBay sends it.

## Files

| Layer | File | Change |
|---|---|---|
| Formula | `listing-strategy.service.ts` | Extract public `calculateQuantity(stock, group)` — single source of truth |
| Stock decrement | `products.service.ts` | `decrementStock(productId, qty)` (atomic, floor 0) |
| eBay resilience | `ebay.service.ts` | `withRateLimitRetry` (Retry-After / exp backoff) wrapping `updatePriceAndStock` |
| Fan-out | `product-sync.service.ts` | Public `syncListingsForProduct(productId)` (resolves ASIN → reuses 12h fan-out) |
| Queue producer | `orders/stock-sync-queue.service.ts` | **new** — `@InjectQueue('stock-sync')`, 5s dedup `jobId`, retry backoff |
| Queue consumer | `listings/stock-sync-processor.service.ts` | **new** — `@Processor('stock-sync', { concurrency: 3 })` |
| Trigger | `order-sync.service.ts` | `xmax` insert-detection in `upsertOrder` + decrement + enqueue on new matched order |
| Wiring | `orders.module.ts`, `listings.module.ts` | Both register `{ name: 'stock-sync' }` + providers |

## What this is NOT

- Not a re-introduction of the `autoRestock` toggle. This is unconditional core
  behaviour (the toggle was a dead no-op and has been removed from schema/DTO/UI).
- Not a per-sale Keepa/scraper call. We never hit external stock APIs on order — only
  the shared cache is adjusted. Ground truth still comes from the 12h Keepa sync.
- Not overselling. The cache only depletes between syncs, so eBay quantity only ever
  stays equal or drops toward 0 — it never inflates beyond what Amazon had.
