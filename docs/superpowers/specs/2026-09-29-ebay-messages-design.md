# eBay Messages — inbox, replies and the NEW_MESSAGE webhook

**Date:** 2026-09-29 · **Status:** approved for implementation (operator, same day)

## Why now

Seller-facing eBay messaging was dropped once because "it would exhaust the eBay quota". That reasoning
was built on the Trading API (`GetMyMessages` / `AddMemberMessageRTQ`, 5,000/day per method). The REST
**Message API** (`/commerce/message/v1`) is a different resource: the admin eBay Limits tab shows eBay's
own figure for it — **`commerce.message` 500,000 / 86,400 s** — and **`commerce.notification` 10,000 / 86,400 s**
(read off the panel 2026-09-29, both untouched). A per-store inbox read on page open plus one Notification
API call per store connect fits with two orders of magnitude to spare.

Two things block it today, neither of them quota:

1. **Scope.** `DEFAULT_SCOPES` carries neither `commerce.message` nor `commerce.notification.subscription`.
   A token without them cannot read a single conversation, and cannot subscribe to `NEW_MESSAGE`.
   Every connected store must re-consent. (One operator store today; they will disconnect → reconnect.)
2. **The existing auto-messaging provider targets a made-up endpoint.**
   `buyer-message.provider.ts` posts to `apix.ebay.com/ws/commerce/message/v1/message` with
   `recipient/body/context` (marked `TODO(confirm)`), bypasses the call budget and uses its own `fetch`
   retry. The real call is `POST https://api.ebay.com/commerce/message/v1/send_message` with
   `otherPartyUsername | conversationId`, `messageText`, `reference {LISTING, itemId}`. Order-received /
   shipped / delivered / feedback messages have therefore **never reached eBay**. This feature replaces that
   provider with the same client the inbox uses.

## Verified contract (source: eBay OpenAPI JSONs, Notification Topics page, Sell Communications Guide,
eBay `event-notification-nodejs-sdk`; anything else is marked UNVERIFIED)

### Message API — `https://api.ebay.com/commerce/message/v1`, user token, scope `…/api_scope/commerce.message`

| Call | Shape |
|---|---|
| `GET /conversation` | **`conversation_type` REQUIRED** = `FROM_EBAY` \| `FROM_MEMBERS`; `conversation_status` = `ACTIVE\|ARCHIVE\|DELETE\|READ\|UNREAD`; `other_party_username`; `reference_type=LISTING` + `reference_id`; `start_time`/`end_time` (FROM_MEMBERS only); `limit` default 25 **max 50**, `offset` 0-based. Returns `conversations[{conversationId, conversationTitle, conversationType, conversationStatus, unreadCount, referenceType, referenceId, createdDate, latestMessage{…}}]`, `total`, `next`, `prev`. |
| `GET /conversation/{id}?conversation_type=` | `limit` default 25 max 50, `offset`; returns `messages[{messageId, subject, messageBody, senderUsername, recipientUsername, readStatus, createdDate, messageMedia[{mediaName, mediaType, mediaUrl}]}]`, `total`, `conversationTitle`, `conversationStatus`, `conversationType`. |
| `POST /send_message` → 201 | `conversationId` **or** `otherPartyUsername`; `messageText` ≤ 2000; `messageMedia[]` ≤ 5 (`IMAGE\|PDF\|DOC\|TXT`, HTTPS URL); `reference {referenceType: LISTING, referenceId: <item id>}`; `emailCopyToSender`. Returns `messageId`. Errors: 355006 unknown `otherPartyUsername`, 355013 length, 355015 empty, 355018 neither id, 355020 unknown listing. |
| `POST /update_conversation` | `{conversationId, conversationType, read?: boolean}` **or** `{…, conversationStatus: ACTIVE\|ARCHIVE\|DELETE}` — one at a time (`read` wins if both). |
| `POST /bulk_update_conversation` | ≤ 10 `{conversationId, conversationType, conversationStatus}`; returns per-id `updateStatus`. |

UNVERIFIED: whether `FROM_EBAY` conversations accept `sendMessage` (spec says "another user" throughout —
**assume not**; the UI hides reply for `FROM_EBAY`); whether a seller-initiated message to a buyer with no
prior conversation/transaction is refused by policy (expect 355006/403 — the UI offers **reply only**, no
"new message" composer, in this round).

### Notification API — `https://api.ebay.com/commerce/notification/v1`

- `PUT /config {alertEmail}` (app token) — **must exist before any destination/subscription**, else 409 195003.
- `POST /destination` (app token, scope `…/api_scope`) `{name ≤64, status: ENABLED, deliveryConfig{endpoint (HTTPS, no localhost), verificationToken (32–80, [A-Za-z0-9_-])}}` → **201 + `Location`** header carrying the id (body has no fields). During this call eBay **synchronously** GETs `endpoint?challenge_code=…` and expects `200`, `Content-Type: application/json`, `{"challengeResponse": sha256hex(challengeCode + verificationToken + endpoint)}` — byte-identical to the Marketplace Account Deletion challenge (`computeChallengeResponse` is reused). 409 195020 = challenge failed, 195021 = destination already exists for this endpoint (→ list and adopt).
- `GET /topic/NEW_MESSAGE` (app token) → `supportedPayloads[{format: JSON, schemaVersion, deliveryProtocol: HTTPS}]`. **`schemaVersion` is read from here at runtime, never hardcoded.**
- `POST /subscription` — **USER token** carrying `commerce.notification.subscription` **and** the topic's own scope `commerce.message`; `{topicId: "NEW_MESSAGE", status: ENABLED, payload: <from topic>, destinationId}` → 201 + `Location`. 409 195012 = already exists (idempotent success → list subscriptions with the user token and adopt the id), 403 195011 = token lacks the topic scope (→ store needs re-consent), 409 195015 = destination not enabled.
- `DELETE /subscription/{id}` → 204 (user token). `POST /subscription/{id}/test` → 202 (mock delivery).
- **Delivery**: `POST endpoint`, `Content-Type: application/json`, header `X-EBAY-SIGNATURE` = Base64 JSON `{alg: "ecdsa", kid, signature (Base64 DER), digest: "SHA1"}`. Verify: `GET /public_key/{kid}` (app token; **cache ~1 h by kid**) → `{key (one-line PEM), algorithm: ECDSA, digest: SHA1}`; `crypto.createVerify('sha1')` over the body, `verify(pem, signature, 'base64')`. eBay's own SDK verifies over `JSON.stringify(parsedBody)`; third parties verify over the raw bytes — **we try the raw body first, then the re-serialised body**, and treat the header's `digest` as authoritative. Answer **2xx fast** (we answer 204); anything else is a failed delivery, **3 attempts** (intervals UNVERIFIED), then the destination is `MARKED_DOWN` and eBay emails `alertEmail`. Dedupe on `notification.notificationId` (retries carry the same id with a higher `publishAttemptCount`).
- **Payload**: `metadata.topic = "NEW_MESSAGE"`, `notification.data = {messageId, conversationType, conversationId, messageBody, senderUserName, recipientUserName, subject, readStatus, createdDate, messageMedia[]}`. Since 2025-09-26 `recipientUserName` may be the **immutable user id** for US users — which is exactly what `ebay_accounts.seller_id` holds since migration 108, so the store is resolved by `seller_id = recipientUserName OR ebay_username = recipientUserName`.
- Sandbox: both APIs are `sandboxEnabled`; whether a real `NEW_MESSAGE` ever fires in sandbox is UNVERIFIED — the `test` method is the documented way to exercise the receiver.
- Notification API 10,000/day counts only calls **we** make; inbound deliveries do not count (strongly supported, not verbatim).

## Decisions

### D1 — Scopes: add both, record what was granted
`DEFAULT_SCOPES` gains `https://api.ebay.com/oauth/api_scope/commerce.message` and
`…/commerce.notification.subscription`. Migration `125` adds `ebay_accounts.granted_scopes TEXT[]`, written
on every connect/reconnect from the scope list that consent URL carried. `EbayAccountPublicDto.messagingEnabled`
(= granted_scopes ⊇ both) tells the web whether the Messages page can work for that store. A store without it
renders a "reconnect eBay to enable messages" prompt; the Action Center shows an INFO item
`ebay_account_messaging_scope_missing` (one per store, actionPath `/stores`). A live 403 `insufficient
scope` from the Message API is mapped to the same error key (`ebay.errors.messagingScopeMissing` → 409),
so the record cannot lie for long.

### D2 — No local copy of messages
Conversation lists and threads are read live from eBay on every page view. Nothing about message bodies
is written to our database (same reasoning as invoices read live from Stripe: two copies of the same thing
drift, and the first drift on a support conversation is the one that matters). What IS stored per store:
`unread_message_count` (INT) + `unread_message_synced_at`, maintained by (a) the webhook (+1 per
`FROM_MEMBERS`/`FROM_EBAY` delivery whose `readStatus` is false), (b) a full recount from eBay whenever the
seller opens the Messages page (`GET /conversation?conversation_status=UNREAD` per type → sum of `total`),
(c) −1 / set 0 on read/bulk-read actions taken here. The sidebar badge reads **our** column through
`GET /v1/ebay/messages/unread-count` (a DB read), polled at the Action Center's 2-minute cadence, so the
badge costs eBay nothing. When no destination is configured (no verification token) the unread endpoint may
refresh from eBay at most once per 15 min per store — the fallback for a deployment without the webhook.

### D3 — Notification plumbing lives in `EbayModule`, the inbox in a new `EbayMessagesModule`
Subscribing needs the store's user token and the account lifecycle (connect/reconnect/disconnect), all of
which live in `EbayService`; putting the notification service in a separate module that `EbayModule` calls
would create a cycle. So:

- `apps/api/src/modules/ebay/notifications/` — `ebay-notification.client.ts` (typed REST, budget
  `EbayApiResource.NOTIFICATION`), `ebay-notification.service.ts` (`ensureDestination`, `subscribeAccount`,
  `unsubscribeAccount`, `recordDelivery`), `ebay-notification-signature.ts` (pure: decode header, verify,
  PEM re-format), `ebay-notification.helpers.ts` (pure: parse `NEW_MESSAGE`, resolve store key),
  `ebay-notification-webhook.controller.ts` (public, `@SkipThrottle`, GET challenge + POST delivery).
- `apps/api/src/modules/ebay-messages/` — `ebay-message.client.ts` (typed REST, budget
  `EbayApiResource.MESSAGE`, `withEbayRateLimitRetry`), `ebay-messages.service.ts` (ownership, mapping,
  unread bookkeeping), `ebay-messages.controller.ts`, `ebay-messages.module.ts` (imports `EbayModule`,
  exports the client). `BuyerMessagingModule` imports it and `EbayMessageApiProvider` becomes a thin adapter
  over `EbayMessageClient.sendMessage` (`otherPartyUsername` + `messageText` + `reference LISTING` when the
  order carries an item id — the field the processor mislabels `lineItemId` IS the eBay item id; it is
  renamed `ebayItemId`). The guessed endpoint and the private retry loop are deleted; a guard spec greps for
  `apix.ebay.com` and for `fetch(` in the provider.
- The application (client-credentials) token minter is extracted from `EbayAnalyticsService` into
  `EbayApplicationTokenService` (in the `@Global` `EbayBudgetModule`), reused by the notification client.

### D4 — Destination bootstrap is lazy and idempotent, never on the boot path
`createDestination` requires our endpoint to answer the challenge **during** the call, so it cannot run in
`onModuleInit` (the HTTP server is not listening yet). `EbayNotificationService.ensureDestination()` runs
(1) from `onApplicationBootstrap` after a 20 s delay, best-effort, and (2) lazily before any
`subscribeAccount`. It: PUTs `/config` with `EBAY_NOTIFICATION_ALERT_EMAIL`; POSTs the destination with
`EBAY_NOTIFICATION_VERIFICATION_TOKEN` + `EBAY_NOTIFICATION_ENDPOINT_URL` (default
`${FRONTEND_URL}/api/v1/ebay/notifications`); on 195021 lists destinations and adopts the one whose
endpoint matches; stores `{destination_id, endpoint_url, environment}` in `ebay_notification_destinations`
(migration `125`). Missing token/e-mail → the service is **disabled**: nothing is called, the Messages page
still works, the badge uses the 15-minute fallback, and the admin Overview shows warning
`EBAY_NOTIFICATIONS_DISABLED`.

### D5 — Subscription follows the account lifecycle
- Connect / reconnect (both branches of `handleCallback`): after the row is written, `subscribeAccount(id)`
  — best-effort, never fails the connect. 195012 → adopt existing; 195011 → log + leave
  `message_subscription_id` NULL (the store's `granted_scopes` already explains why).
- Disconnect: `unsubscribeAccount(id)` **before** the tokens are NULLed (it needs the user token);
  best-effort.
- `ebay_accounts.message_subscription_id VARCHAR(100)` + `message_subscription_at TIMESTAMPTZ` (migration `125`).
- A nightly reconcile is NOT built now (one store); `ensureSubscriptions` is exposed on the service so a
  later tick can call it.

### D6 — The receiver is fail-safe and write-once
`POST /v1/ebay/notifications`: read `rawBody`; capture verbatim into `ebay_notification_raw_captures`
(headers subset, body ≤ 20 KB, `signature_ok`, `parsed_ok`) BEFORE any decision; decode `X-EBAY-SIGNATURE`;
fetch/cache the public key by `kid`; verify — failure → **412** (eBay's SDK convention), nothing else
happens; parse; `INSERT … ON CONFLICT (notification_id) DO NOTHING` into `ebay_notification_events`
(`notification_id UNIQUE`, `topic`, `ebay_account_id NULL`, `conversation_id`, `conversation_type`,
`payload JSONB`, `outcome`, `received_at`); when inserted and the store resolves and `readStatus` is false →
`UPDATE ebay_accounts SET unread_message_count = unread_message_count + 1`; answer **204**. A test
delivery (`test` method) is stored with outcome `test`. Unknown topic → stored, outcome `ignored`, 204.
Both new tables join the `data-retention` manifest (events 90 d floor 7, raw captures 30 d floor 7).

### D7 — The page mirrors eBay's own menu
`/:locale/messages` (sidebar: Envanter → after Siparişler, icon `mail`, unread badge like the Action
Center's). Layout on desktop: **folder rail** (Üyelerden: Tümü · Okunmamış · Arşiv / eBay'den: Tümü ·
Okunmamış · Arşiv) → **conversation list** (other party, title, latest snippet, date, unread pill, listing
chip when `referenceId`) → **thread pane** (messages, media as links/images, `MessageComposer` for the
reply with a 2000-char cap; hidden for `FROM_EBAY`). Store filter in the toolbar (same `Dropdown` idiom as
the dashboard). Row checkboxes → bulk archive / delete / mark read. URL state: `?store=&type=&folder=&c=`.
Below `md` the list and the thread are a two-step stack with `PageHeader onBack`. Empty/loading states use
`EmptyState`. Demo mode: fixture conversations and a benign write. All copy in a new `messages` namespace
(15 locales), Turkish written natively.

### D8 — Quota governance
`EbayApiResource.MESSAGE = 'commerce.message'` and `EbayApiResource.NOTIFICATION = 'commerce.notification'`
with `RESOURCE_SOURCE` rows of the same names (they appear verbatim in eBay's `getRateLimits`). Inbox
reads/writes acquire at `INTERACTIVE`; the webhook's `getPublicKey` and the boot-time destination calls at
`BACKGROUND`. The admin eBay Limits tab picks both up with no further change.

## API surface (`apps/api`, all under `JwtAuthGuard`, store ownership asserted per call)

| Method | Path | Notes |
|---|---|---|
| GET | `/v1/ebay/messages/unread-count` | `{ total, byAccount: [{ebayAccountId, unread}] }` — DB read (+ 15-min eBay fallback when notifications are disabled) |
| GET | `/v1/ebay/messages/conversations` | query `ebayAccountId` (required), `type`, `status?`, `page`, `limit≤50` → `{ items, total, page, limit }` |
| GET | `/v1/ebay/messages/conversations/:id` | query `ebayAccountId`, `type`, `page`, `limit` → thread; marks nothing |
| POST | `/v1/ebay/messages/conversations/:id/reply` | body `{ ebayAccountId, type, text }` → `{ messageId }`; refused for `FROM_EBAY` (`ebay.errors.messagingReplyNotAllowed`) |
| POST | `/v1/ebay/messages/conversations/:id/read` | body `{ ebayAccountId, type, read }` |
| POST | `/v1/ebay/messages/conversations/bulk-status` | body `{ ebayAccountId, type, conversationIds≤10, status }` |
| POST | `/v1/ebay/messages/refresh-unread` | body `{ ebayAccountId }` — full recount from eBay (called on page open) |
| GET/POST | `/v1/ebay/notifications` | PUBLIC — challenge / delivery (D6) |

Error keys (`ebay.json`, 15 locales): `messagingScopeMissing`, `messagingReplyNotAllowed`,
`messagingUnavailable` (provider 5xx after retries), `messageTooLong`.

## Shared types (`packages/shared/src/domain/ebay-messages/`)
`EbayConversationType`, `EbayConversationStatus`, `EbayMessageMediaType` enums; `EbayConversationDto`,
`EbayMessageDto`, `EbayConversationThreadDto`, `PaginatedConversationsDto`, `UnreadCountDto`; Zod
`replyMessageSchema` (text 1–2000). `EbayApiResource` gains the two members. `ActionCenterItemKey` gains
`EBAY_ACCOUNT_MESSAGING_SCOPE_MISSING`. `AdminWarningKind` gains `EBAY_NOTIFICATIONS_DISABLED`.

## Env / compose
`EBAY_NOTIFICATION_VERIFICATION_TOKEN` (32–80 `[A-Za-z0-9_-]`), `EBAY_NOTIFICATION_ALERT_EMAIL`,
`EBAY_NOTIFICATION_ENDPOINT_URL` (optional). All three optional (`:-`) in both Coolify files and in
`.env.example`; absent → D4's disabled mode. Nothing to register in the eBay developer portal.

## Testing
- Pure: signature decode/verify against a fixture generated with a local EC key (P-256, SHA1);
  challenge reuse; payload parsing (`recipientUserName` → store key); unread arithmetic helpers.
- Client specs with faked `axios`/`fetch`: request shapes (`conversation_type` always present, limit
  clamped to 50, `send_message` body), error-id → key mapping (355006/355013, 195011/195012/195021),
  `Location` id extraction.
- Guard specs: provider no longer contains `apix.ebay.com` or `fetch(`; every Message API call acquires
  `EbayApiResource.MESSAGE`; the webhook controller carries `@SkipThrottle` and no `JwtAuthGuard`;
  `handleCallback` calls `subscribeAccount` on both branches; `disconnectAccount` calls
  `unsubscribeAccount` before nulling tokens; both new tables are in the retention manifest.
- Web: i18n parity check across 15 locales for the new namespace; 375 px viewport check of the page.

## Out of scope (this round)
Sending attachments; starting a new conversation (no `otherPartyUsername` composer); a nightly
subscription reconcile; per-store notification preferences; Trading `GetMyMessages` (never).

## Operator steps after deploy
1. Set `EBAY_NOTIFICATION_VERIFICATION_TOKEN` (generate 40 random `[A-Za-z0-9_-]` chars) and
   `EBAY_NOTIFICATION_ALERT_EMAIL` in Coolify (test + production); redeploy.
2. Stores → disconnect the store → connect again (grants the two new scopes; the subscription is created
   automatically; the log line `eBay NEW_MESSAGE subscription … created` confirms it).
3. Open Messages; send yourself a message from a second eBay account (or use the admin-visible
   `ebay_notification_events` table after a `test` delivery) to see the badge move.
