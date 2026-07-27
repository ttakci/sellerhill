# Buyer Auto-Messaging — Design Spec

- **Date:** 2026-07-28
- **Status:** Approved (design); pending spec review → implementation plan
- **Owner:** ttakci
- **Scope:** Settings-driven, automated buyer messaging on order lifecycle events. **No manual inbox/reply** (explicitly descoped).

## 1. Context & Goal

Zonds users are dropshipping eBay sellers. Competitors optionally auto-message buyers at lifecycle moments — "thank you for your order" on purchase, "your item shipped" with tracking, "delivered / hope you enjoy it" on delivery. This spec adds that capability to Zonds.

**Goal:** Let a Zonds user (eBay seller) opt into automated, template-driven buyer messages on four order lifecycle events, configured in **Store Settings** (global + per-eBay-store, matching the existing `store_settings` pattern). Per event: independent enable/disable + choose a predefined system template **or** a custom template they author.

**Why it matters:** Reduces seller manual work, improves buyer experience/satisfaction, and brings Zonds to feature-parity with competitors on a standard post-sale touchpoint.

## 2. Non-Goals (explicitly out of scope)

- ❌ **Manual in-app messaging / inbox / reply** — descoped by the user. Buyer-initiated messages are not ingested or surfaced.
- ❌ **Message API → Trading XML fallback implementation** — the provider port seam exists so it can be added later, but v1 implements only the REST Message API.
- ❌ Bulk send, scheduling UI, A/B template testing, delivery analytics UI.
- ❌ Admin read UI for `buyer_message_log` (table is append-only/audit; admin usage projection is a later follow-up).
- ❌ Proactive outreach to buyers with **no order relationship** — eBay forbids this and we never need it (we only ever message buyers of our own orders).

## 3. eBay API Feasibility (research findings, recorded for posterity)

- **New REST Message API** (Commerce namespace, released **Q4 2025**) is the modern replacement for the legacy Trading calls (`AddMemberMessageAAQToPartner`, `AddMemberMessageRTQ`, `GetMyMessages`). It exposes `sendMessage`, conversation retrieval, and conversation-status updates. ([Q4 2025 newsletter](https://developer.ebay.com/updates/newsletter/q4_2025), [Message API reference](https://developer.ebay.com/api-docs/commerce/message/resources/methods), [Sell Communications guide](https://developer.ebay.com/develop/guides-v2/communications/sell-communications-guide))
- `sendMessage` **can start a conversation** ("start a conversation with another user, or send a message in an existing conversation"). The sole constraint is that the recipient must have an **order relationship** with the sender (an `orderId`/`lineItemId` context). We always have one. ([Sell Communications guide](https://developer.ebay.com/develop/guides-v2/communications/sell-communications-guide))
- **Legacy Trading API** (`AddMemberMessageAAQToPartner`) is the proven fallback for the same use case (post-sale buyer follow-up, 90-day window) but is being decommissioned field-by-field through 2025–2026 and requires XML. ([API Deprecation Status](https://developer.ebay.com/develop/get-started/api-deprecation-status))
- **Product caveat — eBay auto-notifies on shipped:** when an order is marked shipped via the Fulfillment API (`createShippingFulfillment`), eBay already sends the buyer a tracking notification. A redundant "shipped" message risks spam/seller-defect perception. **Mitigation:** the `shipped` system template is deliberately distinct in tone/content (warm "on its way" rather than repeating the tracking number), and the FE shows an informational hint. The event remains opt-in per the user's explicit request.
- **Auth:** uses the per-eBay-account user access token Zonds already holds (same token model as the existing Sell API calls).

**Decision:** implement against the **REST Message API** behind a `BuyerMessagingProvider` port. v1 ships a single `EbayMessageApiProvider`; the port lets a Trading fallback be added later without touching call sites.

## 4. Architecture Overview

```
order lifecycle event (4 seams)
   │  (fail-soft try/catch — never breaks host flow)
   ▼
BuyerMessageQueueService.enqueue*()          ──►  BullMQ queue `buyer-message`
   │  jobId = buyer-msg-${ebayOrderId}-${event}  (dedup / burst collapse)      │
   ▼                                                                              │
BuyerMessageProcessor                                                          worker
   ├─ re-check config (StoreSettingsService.getResolvedSettings)  ── skip if disabled
   ├─ idempotency guard: buyer_message_log 'sent' exists?        ── skip if sent
   ├─ resolve template (system constant OR custom DB row)
   ├─ render placeholders (pure helper)
   ├─ BuyerMessagingProvider.sendMessage(token, orderCtx, body)   ── eBay REST Message API
   └─ write buyer_message_log (sent | failed | skipped), redacted error
```

All configuration lives in `store_settings`; system templates are code constants in `packages/shared`; custom templates are a small DB table; the log table provides idempotency + audit.

## 5. Data Model — Migration `054_buyer_messaging.sql`

> FK column types follow the referenced tables' PKs. Confirmed: `users.id` and `ebay_accounts.id` are both **UUID** (migrations `001`/`002`). `ebay_order_id` is `VARCHAR` (eBay order ids are strings). `buyer_message_templates.id` and `buyer_message_log.id` are as shown below.

```sql
BEGIN;

CREATE TYPE buyer_message_event_type AS ENUM (
  'order_received',
  'shipped',
  'delivered',
  'feedback_request'
);

CREATE TYPE buyer_message_status AS ENUM (
  'sent',
  'failed',
  'skipped'
);

-- (a) per-store-settings config (global + per-store rows already exist on store_settings)
ALTER TABLE store_settings
  ADD COLUMN buyer_messaging JSONB;  -- NULL = feature off for that settings row

-- (b) user-authored custom templates
CREATE TABLE buyer_message_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type    buyer_message_event_type NOT NULL,
  name          VARCHAR(120) NOT NULL,
  body          TEXT NOT NULL,
  locale        VARCHAR(5) NOT NULL DEFAULT 'en',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);
CREATE INDEX idx_buyer_msg_templates_user_event
  ON buyer_message_templates(user_id, event_type);

-- (c) idempotency + audit log (append-only)
CREATE TABLE buyer_message_log (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ebay_account_id     UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
  ebay_order_id       VARCHAR(64) NOT NULL,
  event_type          buyer_message_event_type NOT NULL,
  template_kind       VARCHAR(16) NOT NULL,   -- 'system' | 'custom'
  template_ref        VARCHAR(120) NOT NULL,
  status              buyer_message_status NOT NULL,
  error               VARCHAR(500),           -- redacted; never raw provider secrets
  provider_message_id VARCHAR(120),
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- ONE successful send per (order, event), ever; failed/skipped rows do NOT block retries
CREATE UNIQUE INDEX idx_buyer_msg_log_sent
  ON buyer_message_log(ebay_order_id, event_type)
  WHERE status = 'sent';
CREATE INDEX idx_buyer_msg_log_order       ON buyer_message_log(ebay_order_id);
CREATE INDEX idx_buyer_msg_log_user_event  ON buyer_message_log(user_id, event_type, created_at DESC);

COMMIT;
```

### `store_settings.buyer_messaging` JSONB shape

```jsonc
{
  "enabled": true,
  "events": {
    "order_received":   { "enabled": true,  "template": { "kind": "system", "id": "order_received.en.default" } },
    "shipped":          { "enabled": true,  "template": { "kind": "system", "id": "shipped.en.default" } },
    "delivered":        { "enabled": true,  "template": { "kind": "custom", "id": "<uuid>" } },
    "feedback_request": { "enabled": false, "template": { "kind": "system", "id": "feedback_request.en.default" }, "delayDays": 3 }
  }
}
```

- Resolved via `StoreSettingsService.getResolvedSettings(userId, ebayAccountId | null)`: the per-store row's `buyer_messaging` **overrides** the global row when present, else the global row is used. This honors the user's "global OR per-store" requirement — deliberately **unlike** `amazonTaxRate`, which is intentionally flattened across all rows.
- Save handler writes **only the row being edited** (global row when editing global config; the specific store row when editing a per-store override). It must NOT flatten per-store overrides into all rows. Exact JSONB pick/merge strategy is confirmed against `StoreSettingsService` at implementation time.

## 6. Shared Package — `packages/shared/src/domain/buyer-messaging/`

- **Enums** (single source of truth; DB types mirror them): `BuyerMessageEventType`, `BuyerMessageStatus`, `BuyerMessageTemplateKind`.
- **Interfaces:** `BuyerMessageTemplateRef`, `BuyerMessageEventConfig`, `BuyerMessagingConfig`, `BuyerMessageTemplate` (custom DTO), `BuyerMessageContext` (placeholder values).
- **`SYSTEM_BUYER_MESSAGE_TEMPLATES`** constant — one entry per event, EN body, placeholder-rich. Versioned in code (no migration to change copy). The `shipped` body is deliberately distinct from eBay's auto tracking notification.
- **Zod schemas** (`packages/shared/src/schemas/buyer-messaging/`): `buyerMessagingConfigSchema`, `buyerMessageTemplateSchema`, `buyerMessageEventConfigSchema`.

Placeholder set resolved from `orders → listings → products` JOIN + eBay order/account context:

| Placeholder | Source |
|---|---|
| `{{buyer_username}}` | eBay order buyer username |
| `{{item_title}}` | first line item listing/product title |
| `{{order_id}}` | eBay order id |
| `{{tracking_number}}` | tracking (shipped/delivered only) |
| `{{carrier}}` | mapped carrier name (reuse `LocalTrackingConverter` mapping) |
| `{{store_name}}` | eBay account display name |
| `{{estimated_delivery}}` | optional; empty string if unknown |

Render is fail-soft: unknown placeholder → empty string, never raw `{{...}}` left in the body.

## 7. Backend — `apps/api/src/modules/buyer-messaging/`

| File | Responsibility |
|---|---|
| `buyer-messaging.module.ts` | Registers BullMQ `buyer-message` queue + services + controller. Exposes `BuyerMessageQueueService` to `OrdersModule` and `AmazonModule` (trigger call sites). |
| `buyer-message.service.ts` | Config resolution (StoreSettingsService), template resolution (system vs custom), enqueue decisions. |
| `buyer-message.provider.ts` | `BuyerMessagingProvider` interface (port) + `EbayMessageApiProvider` (REST Message API `sendMessage`). **Resolves the per-account eBay user token internally** via the existing token service; reuses `withRateLimitRetry` (Retry-After on 429/5xx). |
| `buyer-message.processor.ts` | BullMQ worker: load order context → idempotency guard → render → provider send → write log. |
| `buyer-message-queue.service.ts` | Producers: `enqueueOrderReceived / Shipped / Delivered / Feedback`. `jobId = buyer-msg-${ebayOrderId}-${event}` (dedup). |
| `buyer-message-template.repository.ts` | Custom-template CRUD (`buyer_message_templates`). |
| `buyer-message.controller.ts` | `GET/PUT /v1/store-settings/buyer-messaging` + `GET/POST/PUT/DELETE /v1/buyer-messaging/templates`. Uses existing `JwtAuthGuard` + RBAC; user-scoped (no cross-user access). |
| `buyer-message-helpers.ts` | Pure: `renderTemplate`, config/event resolution, idempotency-key derivation, template-version hash. + `buyer-message-helpers.spec.ts`. |

### Provider port

```ts
export interface BuyerMessagingProvider {
  sendMessage(input: {
    ebayAccountId: number;     // provider resolves the per-account user token internally
    orderId: string;
    lineItemId?: string;
    buyerUsername: string;
    body: string;
  }): Promise<{ providerMessageId?: string }>;
}
```

v1: `EbayMessageApiProvider` implements it against the REST Message API `sendMessage`. A future `TradingAaqProvider` can satisfy the same interface; call sites never branch on provider.

## 8. Trigger Wiring (surgical, fail-soft)

| Event | Integration point | Notes |
|---|---|---|
| `order_received` | `OrderSyncService.upsertOrder` `xmax = 0` genuine-insert seam | Same seam as A2 + sale-driven stock-sync; fires only on first ingest, never on re-sync |
| `shipped` | `AmazonTrackingProcessorService.handleShipped` (after eBay `createShippingFulfillment`) | |
| `delivered` | `AmazonTrackingProcessorService.handleDelivered` (order → completed) | Also schedules the delayed `feedback_request` job |
| `feedback_request` | Delayed BullMQ job scheduled at `delivered`, fires after `delayDays` | **Re-checks config at fire time** → skips if since-disabled |

Every enqueue is wrapped in try/catch so messaging never breaks order/tracking flows (same invariant as sale-driven stock-sync). Each enqueue first checks `BUYER_MESSAGING_ENABLED` + the resolved per-event enable (cheap short-circuit) before paying BullMQ overhead.

## 9. Idempotency, Failure Handling, Rate-Limiting

- **Producer dedup:** `jobId` per `(ebayOrderId, event)` collapses bursts.
- **Processor guard:** before sending, check `buyer_message_log` for an existing `sent` row for `(order, event)` → skip if present.
- **On success:** insert `sent` (fires the partial unique index → concurrent double-send would violate and be caught).
- **On failure:** insert `failed` + rethrow → BullMQ exponential backoff (`attempts: 3`). Final-failure leaves `failed`; no further auto-retry (no storm). No UI in v1; rows queryable in DB.
- **`skipped`:** recorded when disabled/already-sent/no template resolved (for audit clarity).
- **Rate-limit:** `BUYER_MESSAGING_QUEUE_CONCURRENCY=1`; provider honours `Retry-After` on 429/5xx via the existing `withRateLimitRetry` pattern.
- **Fail-soft:** the entire enqueue + process chain is wrapped; order/tracking flows are unaffected. Provider errors are **redacted** before logging (no raw secrets / tokens).

## 10. Configuration / Env (all optional, safe defaults)

| Var | Default | Purpose |
|---|---|---|
| `BUYER_MESSAGING_ENABLED` | `false` | Master kill-switch (safe off until explicitly enabled) |
| `BUYER_MESSAGING_QUEUE_CONCURRENCY` | `1` | Parallel send jobs (keep 1 — eBay message rate-sensitive) |
| `BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS` | `3` | Default `delayDays` for new `feedback_request` configs |

`ConfigService.get ?? default` pattern, consistent with the rest of the codebase.

## 11. Frontend

- **Store Settings drawer** gains a new section **"Buyer messages"** (i18n key root `storeSettings.messaging.*`):
  - Master enable toggle.
  - Four event rows, each: enable toggle + template-source selector (system predefined dropdown **or** one of the user's custom templates for that event). For `feedback_request`, an additional `delayDays` number input.
  - For `shipped`: an informational hint that eBay already auto-sends a tracking notification on ship.
  - "Manage custom templates" → opens the template manager.
- **Template manager** (list / create / edit / delete custom templates, scoped per event): name + event + **multiline body editor** + placeholder chip-inserter (clicking a chip inserts `{{placeholder}}`) + live preview pane (renders against a sample context).
- **Design-system note:** the body editor requires a **multiline input**. `ModernTextInput` is single-line. → Confirm a `Textarea` atom exists in `packages/ui`; if not, add `Textarea` (atom) to the design system first (Design-System-Only rule). All other controls use existing atoms/molecules.
- **i18n:** seller-facing UI strings in `storeSettings.messaging.*` + `messaging.*` (both `en/translation.json` and `tr/translation.json`). Buyer-facing template bodies are EN code constants (not i18n) — the audience is the eBay buyer.
- **Container/component split** per repo rules (4-file structure); logic hooks extracted under `features/store-settings/hooks/` if the section grows.

## 12. Testing

- **Pure helpers** (Jest, `apps/api` harness): `renderTemplate` (all placeholders + unknown-placeholder fail-soft), config/event resolution (global vs per-store override, per-event enable, missing-event defaults), idempotency-key derivation, template-version hash. Mirrors `profit-calculation.spec.ts` / `auto-fulfill-helpers.spec.ts` precedent.
- **Provider:** mock eBay REST, assert `sendMessage` payload + token passed; assert 429/5xx retried via `withRateLimitRetry`; assert redacted error on failure.
- **No DB / NestJS-layer integration tests** (deliberate, consistent with the codebase); the queue/DB layer is manual-verified.

## 13. Security & Operational Notes

- **No cross-user access:** template CRUD + config endpoints are user-scoped (`req.user.id`); existing guards enforce.
- **Redacted errors:** `buyer_message_log.error` stores a short, sanitized message — never the provider response body, token, or headers.
- **Token handling:** the eBay user token is fetched per-account at send time via the existing token service; never persisted in the log.
- **Rate / spam posture:** concurrency 1 + Retry-After respect; the `shipped` event is opt-in with a FE warning; buyers always have an order relationship (no unsolicited outreach).
- **Multi-store:** config resolution via `getResolvedSettings(userId, ebayAccountId)` keeps per-store overrides consistent with `amazonTaxRate`/`auto_fulfill_enabled`.

## 14. Open Items / Confirmations for Implementation

1. **`Textarea` atom** — confirm existence in `packages/ui`; add if missing (required for the template body editor).
2. **`EbayService` token model** — confirm the exact method to obtain the per-account user token for a Sell-API-style REST call (Message API uses the same user token).
3. **Exact eBay Message API `sendMessage` request shape** — fields/headers/scopes; validate against live docs at implementation. If `sendMessage` cannot send proactively for a given region/scopes, fall back to Trading `AddMemberMessageAAQToPartner` via the same `BuyerMessagingProvider` port.
4. **`ebay_accounts.id` PK type** — **RESOLVED**: UUID (migration `002`); `users.id` is also UUID. FKs in `buyer_message_templates`/`buyer_message_log` are UUID.

## 15. Rollout

- Migration `054` auto-runs on API boot (`MigrationRunner`).
- `BUYER_MESSAGING_ENABLED=false` default → no behavior change until a user opts in via Store Settings.
- No backfill needed (feature is forward-only; existing orders simply had no auto-messages).
- `@repo/shared` + `@repo/ui` builds required after type/i18n/atom changes (per the build-before-apps rule).
