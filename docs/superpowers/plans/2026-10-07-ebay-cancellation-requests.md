# eBay buyer cancellation requests — managed from SellerHill (2026-10-07)

Operator ask: a live buyer cancel request arrived; Pending Actions only says
"Buyer asked to cancel — answer on eBay". Handle it in the app, the way the
in-app return actions (approve / mark received / issue refund) already work.

Style: ponytail (laziest working solution, reuse the returns module) + the
repo rules (CLAUDE.md: shared DTOs, 4-file split, i18n in all 16 locales,
tokens only, no `any`, never re-derive eBay facts — every field below is
quoted from `docs/ebay-reference/post-order/post-order_v2_cancellation_*.txt`).

## Quota (eBay's own figures)

- `post-order.cancellation` = **5,000 calls/day for the whole application**
  (production `getRateLimits`, 2026-09-30, `docs/ebay-reference/README.md`
  "Shared daily quotas"). Separate pool from `post-order.return` (also 5,000).
- Sandbox keyset reports NO post-order resource at all (probe 2026-10-07:
  only Negotiation / listingapi / logistics) — Post-Order has no Sandbox.
- Cost model = the return sweep's: ONE `GET /cancellation/search?role=BUYER`
  per store per sweep, interval derived from store count × this ceiling
  (`resolveReturnSweepInterval`, reused). At 500 stores, 95% background
  ceiling (4,750) × 50% share → `ceil(500×24/2375)` = **6 h**, ≈2,000
  calls/day, leaving ~3,000 for the interactive reads/writes (3 calls per
  seller action: live get + write + re-read). Fits.

## Documented facts used (nothing inferred)

`GET /post-order/v2/cancellation/search`: query `creation_date_range_from`
(≤18 months back; without `_to` "searches forward 90 days"), `limit`
(default 10, **max 500**), `offset` (documented as "number of entries to
skip", default 0), **`role`** (`BUYER` | `SELLER`, case-sensitive,
**default SELLER** — we MUST send `role=BUYER`), `sort`
(`+CANCEL_ID`/`-CANCEL_ID`/`+CANCEL_REQUEST_DATE`/`-CANCEL_REQUEST_DATE`),
`legacy_order_id`. Response `cancellations[]` (`CancelSummary`):
`cancelId` (Always), `legacyOrderId` (Always), `marketplaceId` (Always),
`cancelState` (Always, `CancelStateEnum` — page NOT in local reference),
`cancelStatus` (Always, `CancelStatusEnum` — NOT in reference),
`cancelReason` (`CancelReasonEnum` — NOT in reference), `cancelCloseReason`,
`requestorType` (`BUYER`/`SELLER`), `buyerLoginName`, `sellerLoginName`,
`cancelRequestDate.value`, `cancelCloseDate.value`, `sellerResponseDueDate.value`,
`buyerResponseDueDate.value`, `requestRefundAmount{value,currency}`,
`paymentStatus`, `partialOrderType` (only `FULL_ORDER` today), `shipmentDate`,
`paginationOutput{limit,offset,totalEntries,totalPages}`, `total`.
Values seen in the reference's own samples (store as strings, never switch
on them): cancelState `CLOSED`, `REFUND_PENDING`; cancelStatus
`CANCEL_PENDING`, `CANCEL_REJECTED`, `CANCEL_CLOSED_WITH_REFUND`,
`CANCEL_CLOSED_FOR_COMMITMENT`, `CANCEL_CLOSED_UNKNOWN_REFUND`; cancelReason
`BUYER_ASKED_CANCEL`, `BUYER_CANCEL_OR_ADDRESS_ISSUE`, `OUT_OF_STOCK_OR_CANNOT_FULFILL`;
cancelCloseReason `SELLER_DECLINE`, `FULL_REFUNDED`, `SELLER_APPROVE_TIMEOUT_UNPAID`,
`BUYER_CONFIRM_TIMEOUT_NON_PAYPAL_PAID`.

`GET /post-order/v2/cancellation/{cancelId}` → `cancelDetail` with the same
fields plus `activityHistories[]{actionDate,activityParty,activityType,stateFrom,stateTo}`,
`refundInfo`, `moneyMovementInfo[]`.

`POST /post-order/v2/cancellation/{cancelId}/approve` — no request/response
payload, HTTP 200 on success. "Sellers must approve all buyer-initiated
cancellation requests before an order is actually cancelled." Not in Sandbox.
EU/UK Digital Signatures note (same as returns; ignored like the returns do).

`POST /post-order/v2/cancellation/{cancelId}/reject` — body `{}` or
`{ shipmentDate: { value: ISO }, trackingNumber }` ("If you do not include
either of these fields, you must submit a payload consisting of just the
opening and closing braces"). No response payload. Not in Sandbox.

## Bucket (enum-free, like `deriveReturnBucket`)

```
CLOSED        cancel_close_date IS NOT NULL OR state = 'CLOSED'
UNCONFIRMED   last_synced_at older than freshness horizon (2 × sweep interval, ≥24h)
ACTION_OVERDUE requestor_type = 'BUYER' AND seller_respond_by IS NOT NULL AND seller_respond_by < now
ACTION_DUE    requestor_type = 'BUYER' AND seller_respond_by IS NOT NULL
IN_PROGRESS   otherwise (open)
```
TS + SQL twins in `packages/shared/src/domain/cancellations/cancellation-bucket.ts`,
compared by a spec (copy `return-bucket.spec.ts`).

## Order link — UNVERIFIED, recorded

`legacyOrderId` is matched to `orders.ebay_order_id` for the same user AND
store (same assumption `upsertReturn` makes with the return's `orderId`).
The Fulfillment OpenAPI documents `orderId` only as "The unique identifier
of the order"; whether both ids are the same string is settled by the first
live request. An unlinked row (`order_id NULL`) is still counted in Pending
Actions and listed with its `legacy_order_id` so it is never invisible.

## Changes

### Shared (`packages/shared`)
- `EbayApiResource.POST_ORDER_CANCELLATION = 'post-order.cancellation'`.
- `PlatformSettingKey.EBAY_CANCELLATION_SYNC_ENABLED = 'ebay.cancellationSync.enabled'`
  (default `true`) and `EBAY_CANCELLATIONS_ACTIONS_ENABLED = 'ebay.cancellations.actionsEnabled'`
  (default `false`, like returns). The sweep reuses the return sweep's cron,
  `maxAccountsPerRun`, `intervalAuto`, `quotaPercent`, `intervalHours`
  settings — same knobs, different pool.
- `domain/cancellations/`: `cancellations.types.ts` (`CancellationBucket`
  enum, `EbayCancellationDto`, `EbayCancellationAction { APPROVE='approve', REJECT='reject' }`,
  `EbayCancellationActionResultDto`, `CANCELLATION_ACTION_ERROR_KEY`
  mirroring `RETURN_ACTION_ERROR_KEY` under `cancellations.errors.*`,
  `isEbayCancellationAction`), `cancellation-bucket.ts` (+ freshness reuse
  `resolveReturnFreshnessHours`), `index.ts`, exported from the domain index.
- `ActionCenterItemKey.CANCEL_REQUEST_SELLER_ACTION_DUE = 'cancel_request_seller_action_due'`.
- `OrderDto.cancellation: EbayCancellationDto | null` (the newest BUYER
  request row linked to the order, or null) and `OrderFiltersDto.cancelRequested?: boolean`.

```ts
export interface EbayCancellationDto {
  id: string;            // ebay_cancellations.id (uuid)
  cancelId: string;
  ebayAccountId: string;
  legacyOrderId: string | null;
  orderId: string | null;          // SellerHill order uuid when linked
  bucket: CancellationBucket;      // 'action_overdue'|'action_due'|'in_progress'|'closed'|'unconfirmed'
  state: string | null;            // eBay CancelStateEnum, as sent
  status: string | null;           // eBay CancelStatusEnum, as sent
  reason: string | null;           // eBay CancelReasonEnum, as sent
  closeReason: string | null;
  requestorType: string | null;    // 'BUYER' | 'SELLER'
  buyerLoginName: string | null;
  requestedAt: string | null;
  sellerRespondBy: string | null;
  closedAt: string | null;
  requestedRefundAmount: number | null;
  currency: string | null;
  lastSyncedAt: string;
  /** operator switch `ebay.cancellations.actionsEnabled` — the card hides the buttons when false */
  actionsEnabled: boolean;
  /** empty unless bucket is action_due/action_overdue and actionsEnabled */
  availableActions: EbayCancellationAction[];
}
```

### API (`apps/api`), all inside `src/modules/ebay-returns/` (the Post-Order module)
- Migration `145_ebay_cancellations.sql`: table `ebay_cancellations`
  (id, user_id, ebay_account_id, cancel_id VARCHAR(40), legacy_order_id
  VARCHAR(60), order_id UUID NULL REFERENCES orders ON DELETE SET NULL,
  marketplace_id VARCHAR(20), requestor_type VARCHAR(20), state, status,
  reason, close_reason VARCHAR(60), buyer_login_name VARCHAR(120),
  requested_at, seller_respond_by, buyer_respond_by, closed_at TIMESTAMPTZ,
  requested_refund_amount NUMERIC(10,2), currency VARCHAR(3), payment_status
  VARCHAR(40), buyer_data_erased_at TIMESTAMPTZ NULL, first_seen_at,
  last_synced_at, updated_at; UNIQUE(ebay_account_id, cancel_id); index on
  (user_id, requested_at DESC) and (order_id) WHERE NOT NULL) and
  `ebay_accounts.last_cancellation_sync_at` (+ partial index like 128).
- `ebay-rate-limits.ts` `RESOURCE_SOURCE[POST_ORDER_CANCELLATION] = { trading:false, name:'post-order.cancellation' }`; spec table.
- `post-order.client.ts`: `searchCancellations(token, marketplaceId, { creationDateFrom })`
  (`role=BUYER`, `limit=500`, `sort=-CANCEL_REQUEST_DATE`, BACKGROUND, inside
  `withEbayRateLimitRetry`), `getCancellation` (INTERACTIVE), `approveCancellation`
  (POST, no body), `rejectCancellation(body)` — writes charged first to
  `POST_ORDER_CANCELLATION` at INTERACTIVE, sent ONCE outside the retry
  wrapper. Generalise the private `write()` to take the full path under
  `/post-order/v2/` (keep one `axios.post` call). `isReturnSearchSupported`
  covers cancellations too (same Sandbox rule).
- `post-order.types.ts`: `PostOrderCancellationSummary`, `...SearchResponse`,
  `PostOrderCancellationDetail`, `PostOrderRejectCancelRequest`.
- `cancellation-mapper.ts` (+spec): summary/detail → `EbayCancellationRow`, total, never throws; no `cancelId` → null.
- `ebay-cancellations-sync.service.ts` (+spec): copy of the returns sweep
  (claim with `last_cancellation_sync_at`, interval from
  `ReturnSweepScheduleService.resolveCancellations()` — add that method:
  same settings, ceiling `backgroundDailyCeiling(POST_ORDER_CANCELLATION)`),
  window 90 days, upsert with COALESCE order link, buyer_login_name kept
  NULL on erased rows, `first_seen_at` never touched. Express lane in the
  claim: a store is also due now when it has an order with
  `ebay_cancel_state NOT IN ('NONE_REQUESTED','CANCELED')` whose
  `updated_at > COALESCE(last_cancellation_sync_at, 'epoch')`.
- `ebay-returns-sync.processor.ts`: `process()` runs the return sweep then
  the cancellation sweep (one tick, concurrency 1).
- `ebay-cancellations-actions.service.ts` (+spec): `act(userId, id, action)`
  in the returns order: row → switch → suspended → sandbox → marketplace →
  LIVE `getCancellation` → assert `requestorType === 'BUYER'`, no
  `cancelCloseDate`, `sellerResponseDueDate` present (else 409
  `cancellations.errors.actionNotAvailable`) → ONE write → audit row
  (`EBAY_CANCELLATION_ACTION`, resource_type `ebay_cancellation`) → re-read
  + upsert. Reject body: `{ shipmentDate: { value }, trackingNumber }` from
  the order's `ebay_tracking_pushed_number` + `ebay_tracking_pushed_at`
  when both exist, else `{}`.
- `ebay-cancellations.controller.ts`: `@Controller({ path: 'cancellations', version: '1' })`,
  `GET /` (list, `?orderId=` / `?tab=action`, user-scoped, for the unlinked
  fallback), `POST /:id/actions/:action`. Error mapping like `rethrowReturnAction`.
- `orders.service.ts`: `OrderDto.cancellation` from a LATERAL newest
  `ebay_cancellations` row where `requestor_type='BUYER'` (bucket via
  the SQL twin + store scope, `actionsEnabled` read once per request);
  `cancelRequested` filter = EXISTS open BUYER row in an action bucket.
  Controller `@Query('cancelRequested')`, forwarding guard spec entry.
- `action-center.service.ts`: item `CANCEL_REQUEST_SELLER_ACTION_DUE`
  (group ORDERS, CRITICAL when any overdue, `context: { overdue, unlinked }`,
  `actionPath: /orders?cancelRequested=true`), counting rows in
  ACTION_DUE/ACTION_OVERDUE with the freshness horizon from
  `resolveCancellations()`.
- `ebay-account-deletion.service.ts`: third UPDATE nulling
  `ebay_cancellations.buyer_login_name` + stamping `buyer_data_erased_at`.
- `ebay-returns.guard.spec.ts`: nine documented paths; the four cancellation
  write/read invariants; writes reachable only through the two actions
  services. `ebay-returns.di.spec.ts` providers.
- Registry: the two settings (+ en/tr `admin.settings.keys/descriptions`).
- Docs: CLAUDE.md "eBay cancellation requests" subsection beside "eBay
  Returns", migration table row 145, README "Order, cancellation…" facts
  (role default SELLER, limit 500, no Sandbox, enum pages missing).

### Web (`apps/web`) + i18n (16 locales)
- `features/orders/api/orders.api.ts`: `cancelRequested` param; new
  `actOnCancellation` mutation `POST /cancellations/{id}/actions/{action}`
  invalidating `Orders` tags; `features/orders/details/OrderDetailsPage`:
  a "Cancellation request" card (reason, requested at, respond-by,
  state/status as neutral chips, buyer login) with **Approve** / **Reject**
  buttons shown only when `availableActions` lists them; confirm dialog
  (approve: "the order is cancelled and the buyer refunded by eBay";
  reject: mentions the tracking that will be sent when present); success
  toast; errors through the standard error modal with the API's key.
- Orders list: `orderFlagBadges` adds a chip `orders.flags.cancelRequested`
  when `order.cancellation` bucket is action_due/overdue; `useOrdersFilters`
  flag option `cancel_requested` ↔ `?cancelRequested=true` (the Pending
  Actions link).
- Pending Actions: `actionCenter.json` `cancel_request_seller_action_due`
  { title, description_one, description_other, action } in all 16 locales;
  `orders.json` keys for the card and the two confirms; `cancellations`
  error keys under `orders.cancellation.errors.*` (keep one namespace).
  Change `orders.autoFulfill.reason.cancel_requested` wording to
  "Buyer asked to cancel — answer below" only in the detail context? NO —
  leave that label alone (it is still true on the list).

## Verification
`pnpm --filter shared build && pnpm --filter api test -- ebay-returns cancellation ebay-rate-limits action-center orders-filter` ·
`pnpm lint` · `pnpm typecheck`. Commit to `development` only (no UAT/main merge until told).
