# Order flow hardening — auto and manual Amazon purchasing, v2 (design, 2026-10-01)

**Problem.** An external review of the order flow (24 points) asked for an
explicit "purchase outcome unknown" state, line-item idempotency, stricter
reconciliation and an audit trail. Read against the code, about a third of
it already exists, a third is a real gap, and the rest is either a larger
project or something this design rejects. Reading the code also turned up
six defects the review did not list.

**Decision.** Keep the existing flow. Make the Place Order click a durable,
exactly-once boundary in the database; give the unknown outcome its own
seller-facing stage; close the reconciliation and ingest defects; add the
missing guards. No rewrite, no new state machine: `auto_fulfill_status`
keeps its seven values.

The principle the whole design serves:

```
before the click            retry-safe, automatically
the click                   exactly once, claimed in the database
after the click, proven     placed
after the click, unproven   purchase_unknown: never re-clicked, reconciled,
                            re-armed only by a scan AND the seller
```

Buying an item twice is worse than leaving an order waiting for the seller.

## Operator decisions (2026-10-01)

1. The unknown outcome is a **durable stamp plus a new stage**, not a new
   `auto_fulfill_status` value.
2. Multi-item eBay orders get a **guard now**; the line-item data model is a
   separate project.
3. An order whose listing is no longer ACTIVE is still **matched and
   auto-purchased**.
4. A **per-store loss limit** is added, off by default.

## Defects found in the code (not in the review)

| # | Defect | Where | Fix |
|---|---|---|---|
| F1 | One Amazon order can be linked to two eBay orders: cost capture never checks whether a scraped Amazon order id is already held, and the index is not unique. A repeat buyer's second order then reads as purchased and is never bought | `amazon-order-sync.service.ts` | §5 |
| F2 | An Amazon order placed BEFORE the eBay sale can match (the date gate is an absolute difference) | `order-matcher.ts` | §5 |
| F3 | With quantity > 1, a failed quantity selection plus an unreadable cart quantity proceeds; the cap stops over-buying, nothing stops under-buying | `amazon-checkout.service.ts` `verifyCartContents` | §7 |
| F4 | A multi-item eBay order buys only `lineItems[0]` and then reads as complete | `ebay-fulfillment.service.ts` `mapEbayOrderToEntity` | §3 |
| F5 | The buyer-account pool ignores the account's status; a `needs_reauth` or `locked` account is picked and the order blocks on `login` | `order-sync.service.ts` | §6 |
| F6 | The provisional `purchase_price` is the UNIT price and is never multiplied by the quantity, so estimated profit is overstated for quantity > 1 and the matcher compares Amazon's total with a unit price | `order-sync.service.ts` ingest + `recomputeProfit` | §6 |

## 1. The click boundary (`auto_fulfill_submitted_at`)

Today's safety rests on "no error escapes the checkout after the click" and
on reading a RUNNING row at job start as interrupted. Both hold, but only by
code reading: one added `await` after the click silently breaks the first,
and the second blocks every job killed by a deploy even though almost all of
them die long before the click.

`orders.auto_fulfill_submitted_at TIMESTAMPTZ NULL` (migration `132`) is
written immediately before the click, as a compare-and-set:

```sql
UPDATE orders SET auto_fulfill_submitted_at = CURRENT_TIMESTAMP
 WHERE ebay_order_id = $1
   AND auto_fulfill_submitted_at IS NULL
   AND auto_fulfill_status = 'running'
RETURNING id
```

- The write throws → nothing was clicked → the error propagates and BullMQ
  retries as today.
- Zero rows → this run does not click. Which way it settles depends on why
  the claim was lost: a stamp already exists (another run clicked) → unknown
  outcome; the order now carries a real Amazon order id (linked by hand
  mid-checkout) → SKIPPED; neither (the stale-run sweep took the row) → a
  plain error and a retry, since nothing was clicked.
- One row → click. From here the order is either PLACED or unknown; no code
  path may return it to PENDING or FAILED.

Every reader of "may this order be bought?" then asks the stamp, not a
convention:

| Reader | Rule |
|---|---|
| `decideFulfillStart(status, submittedAt)` | stamp set and not PLACED → `UNKNOWN_OUTCOME` (no checkout; ensure the row is BLOCKED with `interrupted` unless it already carries `no_confirmation`). RUNNING with NO stamp → `PROCEED`: the previous process died before the click, so re-entering is safe |
| `AutoFulfillProcessor` catch | reset to PENDING / mark FAILED only `WHERE auto_fulfill_submitted_at IS NULL`; with a stamp it blocks as unknown instead |
| `canStartAutoFulfillManually` | false while the stamp is set |
| `resumeSuspendedAutoFulfill`, `selectResumableOrders` | exclude stamped rows |

A stale-RUNNING sweep runs inside the order-sync tick (per user, one UPDATE):
a row RUNNING for more than 60 minutes is settled — with a stamp as BLOCKED /
`interrupted`, without one as FAILED (which the seller can restart). Nothing
does this today; such a row reads "buying" for ever.

The sweep measures from `auto_fulfill_attempted_at`, which the RUNNING write
already stamps.

A source-grep guard, `click-boundary.guard.spec.ts`, asserts that the stamp
write precedes the click, that the processor's two status writes carry the
`IS NULL` predicate, and that no `setStatus(PENDING|FAILED)` exists after the
click in `checkout()`.

## 2. The `purchase_unknown` stage

A new `OrderStage.PURCHASE_UNKNOWN`, derived, not stored:

```
auto_fulfill_submitted_at IS NOT NULL
AND amazon_order_id IS NULL
AND auto_fulfill_status NOT IN ('placed', 'pending', 'running')
```

It sits in the stage order after `purchased` and before `purchase_blocked`
(a row mid-checkout still reads `buying`; a proven placement still reads
`purchased`). It joins `ACTIONABLE_ORDER_STAGES` and the "Needs action" tab.
`deriveOrderStage` and `buildOrderStageSql` gain one boolean input; the guard
spec's combination count doubles. `OrderFulfillmentState` is untouched (an
unknown order is already `action_required`).

Seller copy (`orders.stage.purchase_unknown.*`, all 15 locales):
label "Purchase not confirmed", meaning "The order button was pressed on
Amazon but no confirmation came back. The order may exist.", action "Check
Amazon first. Do not buy it again until you have."

How it resolves — three exits, no others:

| Exit | Trigger | Result |
|---|---|---|
| Reconciled | The cost-capture sync finds the Amazon order (§5). Enqueued for that account 5 minutes after the order becomes unknown, then on every 3-hourly tick | `amazon_order_id` + costs written, `auto_fulfill_status = placed` (it was bought by automation), tracking scheduled → `purchased` |
| Linked by hand | The seller finds the order on Amazon and links it | existing manual link → `purchased` |
| Confirmed not purchased | `POST /v1/amazon/orders/:orderId/confirm-not-purchased` | stamp cleared, row becomes FAILED with no reason (why the click produced no order is not known, so none is claimed) → `purchase_blocked`, and "Start automatic order" is offered again |

The third exit is the only thing that ever clears a stamp, and it needs two
independent facts: the account's "Your Orders" was scanned AFTER the click
(`amazon_accounts.last_orders_sync_at > auto_fulfill_submitted_at`, where the
watermark is the moment the scan STARTED) and linked nothing, AND the seller
confirms in a dialog that says what they are asserting. Before a scan has run
the endpoint answers 409 `orders.errors.purchaseNotYetChecked` and queues the
scan. "Not found" alone never re-arms an order; neither does the seller alone.

"Linked nothing" must not be confused with "saw nothing". A scan that sees an
Amazon order for the same product, dated around the click, on the account the
click was made on, but cannot match it with certainty (an unreadable ship-to,
a tie) records it as a SUSPECT on the eBay order
(`orders.auto_fulfill_suspect_amazon_order_id`). While a suspect stands — it
is not yet linked to any sale — the endpoint answers 409
`orders.errors.purchaseFoundOnAmazon` and the seller links by hand. A row
stamped by migration `132` has no click account, so every one of the seller's
accounts must have been scanned.

Action Center: `ORDER_PURCHASE_UNKNOWN`, CRITICAL, linking
`/orders?stage=purchase_unknown`.

## 3. Multi-item orders: guard now

`orders.ebay_line_item_count INT NULL` (migration `132`, written at ingest,
COALESCE-filled on re-sync). When it is greater than 1:

- auto-fulfill writes SKIPPED with the new reason `multi_item_order`. The
  order reads `to_purchase` ("your work") with the reason shown under the
  badge. The reason is NOT in `MANUALLY_RETRYABLE_BLOCKED_REASONS`, so the
  button is not offered: the checkout would buy one item of several.
- the order detail page shows a notice: the order holds N items, SellerHill
  tracks only the first, buy and ship the others yourself.
- everything else (linking, cost, tracking push for the first line) behaves
  as today.

The line-item model (one row per line: ASIN, purchase, cost, tracking,
fulfillment) is deliberately not built here. It touches ingest, profit, the
dashboard, tracking, conversion and every list, and deserves its own spec.

## 4. Ingest: a sale is matched to its listing whatever the listing's status

The ingest query drops `AND status = ACTIVE`. `listings.ebay_item_id` is
UNIQUE and a draft has none, so the match is still at most one row. A buyer
who paid for an item whose listing ended a minute later is owed the item:
the order is tracked, counted and, when it is a fresh sale, auto-purchased.

Unchanged: `ON CONFLICT` never backfills `listing_id`, adoption on import
never purchases, the fresh-sale gate, the over-plan-limit flag.
`order-tracking-invariant.guard.spec.ts` is updated to assert the new query
and keeps its other two assertions.

## 5. Reconciliation (cost capture) hardening

Candidate rule changes in `order-matcher.ts` / `amazon-order-sync.service.ts`:

| Rule | Today | v2 |
|---|---|---|
| Amazon order id already on another order | not checked (F1) | skipped before matching (one `= ANY($1)` query per run) |
| Amazon order date vs eBay order date | within 7 days either side (F2) | from 2 days before the eBay order to 7 days after. The 2 days are slack only: Amazon prints a DATE in the account's timezone, eBay carries an instant |
| Order with a click stamp | same as any | Amazon order dated within 2 days of the stamp, and scraped from the account the click was made on |
| Amount | tie-break bonus only | still not an equality gate, but a sanity bound: an Amazon total above 3× or below ⅓ of the expected cost refuses the automatic link. NOT applied to an order with a click stamp — refusing the genuine order over a price move would make it look "not found" |
| Scan cutoff | `card date < since instant` — which dropped every order placed on the same calendar day as the previous scan | the start of the `since` day (UTC) less one day (`scanCutoffMs`) |
| Unknown-outcome orders | scanned once, like any other | the days around the click are re-read on every scan while the order is unknown |
| Tie between two eBay orders | refused | unchanged |

A refused link changes nothing: the order stays where it was and the seller
links it by hand. There is still no force-link.

Scan only when there is something to find: the candidate query moves ahead of
the scrape. No pending or provisional order for the user in the last 60 days
→ no browser is opened and the watermark is left alone. With candidates, the
scrape starts from `max(watermark, oldest candidate's order date − 2 days)`,
and reaches back to its own sale for a candidate that already names an Amazon
order or that the automatic checkout clicked for.
`enqueueAccount` gains an optional delay for the 5-minute post-click run.

## 6. Enqueue-time fixes

- **Coarse cap on the Amazon estimate, not the eBay sale.**
  `estimateAmazonOrderCost({ unitPrice, quantity, taxRatePct })`; the gate
  refuses only when the estimate is known and above the cap. An unknown price
  passes through to the review-step hard cap, which stays the real guard.
- **Account pool prefers healthy accounts (F5).** Enabled accounts with
  `status = active` first (LRU among them); only if none is active does the
  pick fall back to today's LRU over all enabled accounts.
- **Provisional cost is unit price × quantity (F6)**, at ingest and in
  `recomputeProfit`'s fallback. Existing rows are not backfilled.
- **Re-armed purchases are queued with BullMQ `deduplication`, not a fixed
  `jobId`.** An order blocked at execution and later re-armed by the
  suspension-resume or unpaid-recheck sweep reused the id of its kept
  completed job, so the add was silently dropped and the order sat at PENDING
  for ever (the same defect the cost-capture queue had).

The cancel-request hold is NOT applied at enqueue. `getOrders` never lists the
requests and the stored `cancelState` cannot tell a rejected request from an
open one, so the one authoritative check is the live re-read in §7.

## 7. Checkout-time guards (all before the click)

- **Live eBay re-read.** `runForOrder` reads the order with `getOrder` (one
  Fulfillment call per automatic purchase, budget-governed) before setting
  RUNNING: cancelled → SKIPPED `order_cancelled`; a cancel request
  (`cancelState` not `NONE_REQUESTED`, or a non-empty `cancelRequests`, which
  `getOrder` does populate) → BLOCKED `cancel_requested`; no longer
  paid-and-unshipped → SKIPPED `order_already_fulfilled`. A failed read
  throws: BullMQ retries, and exhaustion is FAILED (restartable), never a
  purchase on stale data. A MANUAL start skips the cancel-request hold and
  nothing else: no documented field tells a request the seller rejected from
  an open one, so without the override such an order could never be bought
  automatically again. The seller sees the reason before clicking.
- **Already bought.** An order that carries a real Amazon order id (linked by
  hand, or by cost capture, while the job waited) is not bought: `runForOrder`
  settles it as SKIPPED, and the click claim carries the same condition in
  SQL for a link that lands mid-checkout.
- **Quantity (F3).** For quantity > 1 the cart quantity must be readable and
  equal, else `cart`. Quantity 1 keeps today's rule.
- **Loss limit.** `store_settings.auto_fulfill_max_loss NUMERIC(10,2) NULL`
  (NULL = off; Store > Global > Default). At the review step, after the cap:
  `grandTotal − ebay_earnings > maxLoss` → BLOCKED with the new reason
  `loss_limit` (manually retryable). It applies to a manual start too; the
  override is the setting. `StoreSettingsDrawer` gets a toggle and an amount
  beside the auto-fulfill switch.
- **Cart ownership.** `AmazonAccountDrawer` states, beside the auto-fulfill
  toggle, that the cart is emptied before every automatic order and the
  account must not be used for personal shopping. Copy only.

## 8. eBay shipping fulfillment is read before it is written

`handleShipped` calls `GET /order/{orderId}/shipping_fulfillment` before the
tracking conversion. A fulfillment that already names our line item (or lists
no line items at all) means eBay has it: record its `shipmentTrackingNumber` as
`ebay_tracking_pushed_number`, stamp `ebay_tracking_pushed_at`, do not
convert and do not POST. This covers a POST that timed out after eBay
accepted it, a DB write that failed after a successful POST, and a seller who
marked the order shipped on eBay by hand. One extra read per shipped
transition, on the 100,000/day Fulfillment pool. A read that fails throws; a
404 on the collection is read as "none", so an unexpected answer cannot hold
every push for ever.

## 9. Ship-by deadline

`orders.ebay_ship_by_date TIMESTAMPTZ NULL` from
`lineItems[0].lineItemFulfillmentInstructions.shipByDate` (documented in the
local Fulfillment OpenAPI). `OrderDto.shipByDate`; the order detail shows it
on the eBay card, and the hero shows "ship by <date>" — red once it is less
than 24 hours away — for the stages where the seller still has to act
(`to_purchase`, `purchase_blocked`, `purchase_unknown`, `amazon_cancelled`).
An Amazon cancellation therefore states how long the seller has.

## 10. Audit trail (`auto_fulfill_events`)

Append-only, one row per step of an automatic purchase:

```
id, order_id, ebay_order_id, user_id, amazon_account_id,
event VARCHAR(40), detail JSONB, correlation_id, created_at
```

`AutoFulfillEvent` (shared enum): `attempt_started`, `account_selected`,
`ebay_recheck_passed`, `cart_verified`, `address_verified`,
`payment_selected`, `review_total_read`, `cap_check_passed`,
`loss_check_passed`, `submit_claimed`, `place_order_clicked`,
`confirmation_detected`, `order_id_detected`, `placed`, `purchase_unknown`,
`blocked`, `failed`, `reconciliation_linked`, `confirmed_not_purchased`,
`manual_start`.

`detail` carries figures and codes only (totals, cap, reason, attempt
number) — never a name, an address or page content, so the eBay
account-deletion erasure does not need to reach it. The writer is fail-soft:
a failed insert logs and never changes the outcome of a run. Retention 400
days (floor 90) through the `data-retention` manifest. Read with SQL for now;
no screen.

## Loss limit resolution

Store > Global, with one difference from the other store settings: a store
row that carries NO limit inherits the global one. A per-store row can be
created by a focused drawer (blacklist, buyer messaging) that never mentions
the field, and its NULL must not switch off a guard the seller set globally.
A store therefore cannot opt out of a global limit.

## State reference

`auto_fulfill_status` (stored) — unchanged values, sharper rules:

| Status | Enters when | Leaves when | Retried? | Seller sees | Owner |
|---|---|---|---|---|---|
| `pending` | new fresh sale enqueued; a transport error before the click; a manual start | job starts | by BullMQ | Buying on Amazon | `auto-fulfill` queue |
| `running` | job passed its gates | placed, blocked, error, or the 60-minute sweep | re-entered only with no stamp | Buying on Amazon | `AutoFulfillProcessor` |
| `placed` | confirmation proven, or reconciliation linked a stamped order | never | no | Purchased | tracking scheduler; cost capture if the id is missing |
| `blocked` | a typed obstacle before the click, or an unknown outcome after it | manual start (no stamp, allowlisted reason); suspension resume; confirm-not-purchased | never automatically, except `subscription_suspended` | Purchase blocked, or Purchase not confirmed when stamped | seller |
| `failed` | transport retries exhausted with no stamp; the 60-minute sweep on an unstamped row; confirm-not-purchased | manual start | no | Purchase blocked | seller |
| `dry_run` | account in dry-run reached the review step | manual start | no | Test run | operator |
| `skipped` | automation off, no account, eBay state, plan limit, multi-item | manual start when it carries no reason | no | To purchase (reason shown) | seller |

New reasons: `multi_item_order` (SKIPPED, not retryable), `cancel_requested`
(BLOCKED, retryable), `loss_limit` (BLOCKED, retryable).

## What stays as it is

Already present and kept: per-account serialisation of every browser action
with the whole checkout in one slot; cart emptied then verified as exactly
one line of our ASIN; street + zip + unit address match with USPS
normalisation and a final recipient read; review-step hard cap; fail-closed
typed blocks with no retry; transport retry with backoff; modified-date order
sync with a start-time watermark and overlap; manual linking that never
refuses on unreadable costs.

Kept by operator decision: suspension stops tracking and purchasing for all
of the account's orders (2026-08-21, no grace).

## Rejected or deferred, with reasons

| Review point | Verdict | Reason |
|---|---|---|
| Distributed account lock | rejected for now | one API process; the in-process limiter is the lock. A second replica makes it mandatory (Bottleneck's Redis mode) |
| City / state / country address comparison | rejected | the zip determines them, and Amazon standardises city names, so it would add false blocks and no safety |
| Stock reservation ledger | rejected | `products.stock` is a shared ASIN cache reset by every refresh; a second ledger would drift |
| Seller / offer / condition verification | deferred | no captured page shows where the checkout prints them; selectors are never written against a guessed DOM. The loss limit bounds the price side |
| Line-item model | deferred | own spec (see §3) |
| Amazon order → packages | deferred | eBay receives one tracking number per line item today; own spec with the line-item model |
| eBay Finances reconciliation, separate cost and profit status | deferred | needs the `sell.finances` scope no store has granted; a refund already flows into earnings through order sync |
| New `auto_fulfill_status` values (`retryable_error`, `manual_required`, `purchase_unknown`) | rejected | the stamp and the stage express them without touching two SQL twins, their guard specs and every status reader |

## Build order

1. **Money safety**: migration `132`, click boundary, stage, sweep,
   confirm-not-purchased, reconciliation hardening (F1, F2), quantity (F3),
   multi-item guard (F4), live eBay re-read.
2. **Correctness**: listing match, coarse cap, account pool (F5), provisional
   cost (F6), scan-when-needed, fulfillment read-before-write.
3. **Visibility and settings**: loss limit, audit trail, ship-by deadline,
   cart-ownership copy.

Each phase ships on its own and leaves the flow working.

## Testing

Pure rules get Jest cases (`decideFulfillStart` with the stamp, the stage
twin on every combination, the matcher's new gates, `estimateAmazonOrderCost`,
the loss rule, `canStartAutoFulfillManually`). The checkout's stamp ordering
and the processor's predicates get the source-grep guard in §1. The
fulfillment read-before-write and confirm-not-purchased are driven against
fakes. Every new SQL statement is `PREPARE`d against a local Postgres before
it is called done.

Unverifiable before production, and to be said so: the live `getOrder`
cancel-request shape (only `NONE_REQUESTED` and `CANCELED` have been observed)
and the fulfillment list on a real shipped order. Both fail towards not
buying / not pushing twice.

Checked read-only on production after the deploy (2026-10-01): `getOrder`
returns `cancelStatus: { cancelState: "NONE_REQUESTED", cancelRequests: [] }`
and a `shipByDate`; `getShippingFulfillments` answers HTTP 200 with an empty
list for an unshipped order and one entry naming the order line item for a
shipped one. An open cancel request, and a full shipped transition behind the
new read, are still to be seen.

## Review findings folded in (2026-10-01)

An independent review of the implementation found, and this design now
includes: the day-granular scan cutoff and the suspect rule (§2, §5) — without
them the "not on Amazon" confirmation could unlock an order that existed; the
already-bought guard (§7); the amount bound not applying to clicked orders
(§5); a consumed candidate leaving the matcher's pool; status writes that
never move a row out of PLACED; the loss-limit inheritance above; and the
re-arm queue ids (§6).

Deliberately not done: a unique index on `orders.amazon_order_id`. The cost
capture never links an id twice, but a seller may legitimately link one
Amazon order to two sales of the same buyer by hand.
