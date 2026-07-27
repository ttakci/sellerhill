# Buyer Auto-Messaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Zonds users (eBay dropshipping sellers) opt into automated, template-driven buyer messages on four order lifecycle events, configured per-store in Store Settings.

**Architecture:** Order lifecycle seams enqueue a `buyer-message` BullMQ job; a worker resolves the per-event config + template (system constant or user custom), renders placeholders, and sends via eBay's REST Message API behind a `BuyerMessagingProvider` port. Config lives in `store_settings.buyer_messaging` JSONB (global + per-store, row-level resolve); custom templates in a `buyer_message_templates` table; an append-only `buyer_message_log` provides idempotency + audit. System templates are code constants in `packages/shared`.

**Tech Stack:** NestJS 10 (`apps/api`), raw `pg`, BullMQ (Redis), React 18 + RTK Query + Emotion (`apps/web`), `packages/shared` (types/Zod/i18n), `packages/ui` (atoms/molecules — incl. existing `Textarea` atom). eBay Commerce Message API (REST).

## Global Constraints

Carry these into every task. (From the spec + `CLAUDE.md`.)

- **Type safety:** all domain types/enums in `packages/shared/src/domain/`. No `any`, no duplicates.
- **No string-literal status/constants:** use enums from `packages/shared` everywhere (e.g. `BuyerMessageEventType.ORDER_RECEIVED`, not `'order_received'`).
- **Validation:** Zod schemas in `packages/shared/src/schemas/`. Backend DTOs use `class-validator` implementing shared interfaces.
- **i18n:** every seller-facing UI string via `t()` with keys added to **both** `packages/shared/src/i18n/resources/en/translation.json` and `tr/translation.json`. Buyer-facing template bodies are EN code constants (not i18n). Dot-notation for primary namespace, colon only for cross-namespace `translation:*`.
- **Container/Component split:** every FE feature component = `.component.tsx` (markup only; only `useTranslation`/`useTheme`) + `.container.tsx` (logic) + `.style.ts` (styled) + `.types.ts`. Stateful atoms/molecules split too; stateless stay `.component.tsx`+`.style.ts`+`.types.ts`. Enforced by ESLint + PreToolUse hook.
- **Design system only:** use atoms/molecules from `@repo/ui`. No native `<input>`/`<select>`/`<button>`/`<textarea>` in feature code — `Textarea` atom exists at `packages/ui/src/atoms/Textarea/`.
- **No hardcoded colors/spacing/strings:** theme tokens via `tkn()`; no hex/px literals in FE.
- **Build order:** after editing `packages/shared` (types/i18n/schemas) or `packages/ui`, run `pnpm --filter @repo/shared build` and/or `pnpm --filter @repo/ui build` before apps will pick them up (both load from `dist/`).
- **Pre-commit hook runs full-repo `pnpm lint` (`--max-warnings 0`).** Stage only complete, lint-clean files. Never use `--no-verify`. Never `eslint-disable`.
- **Test posture (matches codebase):** the `apps/api` Jest harness covers **pure helpers only** (`pnpm --filter api test`, CJS + ts-jest). Pure helpers in this plan ARE TDD'd. The DB/queue/NestJS/HTTP layer is **manual-verified** (no integration tests — deliberate, per `CLAUDE.md`). `apps/web` has no test runner — FE is verified by `pnpm typecheck` + lint + manual run.
- **Idempotency & fail-soft:** every enqueue is `try/catch`-wrapped so messaging never breaks order/tracking flows. One `sent` row per `(ebay_order_id, event_type)` (partial unique index). Provider errors redacted before logging.

**Spec:** `docs/superpowers/specs/2026-07-28-buyer-auto-messaging-design.md` (read it; this plan implements it).

---

## File Structure

### `packages/shared/src/` (create)
- `domain/buyer-messaging/buyer-messaging.types.ts` — enums (`BuyerMessageEventType`, `BuyerMessageStatus`, `BuyerMessageTemplateKind`), interfaces (`BuyerMessageTemplateRef`, `BuyerMessageEventConfig`, `BuyerMessagingConfig`, `BuyerMessageTemplate`, `BuyerMessageContext`), `SYSTEM_BUYER_MESSAGE_TEMPLATES` constant, `BUYER_MESSAGE_PLACEHOLDERS` list.
- `schemas/buyer-messaging/buyer-messaging.schema.ts` — Zod: `buyerMessagingConfigSchema`, `buyerMessageEventConfigSchema`, `buyerMessageTemplateSchema`.

### `packages/shared/src/` (modify)
- `domain/index.ts` — re-export `./buyer-messaging/buyer-messaging.types`.
- `schemas/index.ts` — re-export `./buyer-messaging/buyer-messaging.schema`.
- `domain/store-settings/store-settings.types.ts` — add `buyerMessaging?: BuyerMessagingConfig | null` to `StoreSettingsResponse` and `SaveStoreSettingsRequest`.
- `i18n/resources/{en,tr}/translation.json` — add `storeSettings.messaging.*` + `messaging.*` keys.

### `apps/api/migrations/` (create)
- `054_buyer_messaging.sql` — enums + `store_settings.buyer_messaging` JSONB + `buyer_message_templates` + `buyer_message_log`.

### `apps/api/src/modules/buyer-messaging/` (create)
- `buyer-messaging.constants.ts` — `BUYER_MESSAGE_QUEUE = 'buyer-message'`, config defaults.
- `buyer-message-helpers.ts` + `buyer-message-helpers.spec.ts` — pure render/resolve/key/hash (TDD).
- `buyer-message.provider.ts` — `BuyerMessagingProvider` port + `EbayMessageApiProvider`.
- `buyer-message-template.repository.ts` — custom-template CRUD.
- `buyer-message.service.ts` — config + template resolution, enqueue decisions.
- `buyer-message-queue.service.ts` — BullMQ producer.
- `buyer-message.processor.ts` — BullMQ worker.
- `buyer-message.controller.ts` — settings + template endpoints.
- `buyer-message.dto.ts` — class-validator DTOs.
- `buyer-messaging.module.ts` — wires queue + services.

### `apps/api/src/modules/` (modify)
- `ebay/ebay.service.ts` — add public `getAccountAccessToken(accountId)`.
- `store-settings/store-settings.service.ts` — persist/resolve `buyer_messaging` (entity, mapToDto, default block, both upsert SQLs).
- `orders/order-sync.service.ts` — enqueue `order_received` on genuine insert.
- `orders/orders.module.ts` — import `BuyerMessagingModule`.
- `amazon/amazon-tracking-processor.service.ts` — enqueue `shipped`/`delivered`/delayed `feedback_request`.
- `amazon/amazon.module.ts` — import `BuyerMessagingModule`.
- `app.module.ts` — import `BuyerMessagingModule`.
- `admin/admin.service.ts` — add `'buyer-message'` to `ADMIN_QUEUE_NAMES`.
- `admin/queue-events-collector.service.ts` — add `'buyer-message'` to `OBSERVED_QUEUE_NAMES`.
- `admin/admin.module.ts` + `admin/admin.controller.ts` — mirror existing queue wiring for `buyer-message`.

### `apps/web/src/features/store-settings/` (modify/create)
- `api/store-settings.api.ts` (or existing) — inject `getBuyerMessagingConfig` query + `updateBuyerMessagingConfig` mutation.
- `hooks/useBuyerMessaging.ts` — config fetch/save hook.
- New section components: `buyer-messaging/BuyerMessagingSection.{container,component,style,types}.tsx`.
- `buyer-messaging/BuyerMessageTemplateManager.{container,component,style,types}.tsx` — template CRUD UI using the `Textarea` atom.

### `apps/web/src/features/buyer-messaging/` (create)
- `api/buyer-messaging.api.ts` — RTK Query template CRUD endpoints.

---

## Task 1: Shared types, Zod schemas, system templates

**Files:**
- Create: `packages/shared/src/domain/buyer-messaging/buyer-messaging.types.ts`
- Create: `packages/shared/src/schemas/buyer-messaging/buyer-messaging.schema.ts`
- Modify: `packages/shared/src/domain/index.ts`, `packages/shared/src/schemas/index.ts`
- Modify: `packages/shared/src/domain/store-settings/store-settings.types.ts`

**Interfaces:**
- Produces: `BuyerMessageEventType`, `BuyerMessageStatus`, `BuyerMessageTemplateKind`, `BuyerMessageTemplateRef`, `BuyerMessageEventConfig`, `BuyerMessagingConfig`, `BuyerMessageTemplate`, `BuyerMessageContext`, `SYSTEM_BUYER_MESSAGE_TEMPLATES`, `BUYER_MESSAGE_PLACEHOLDERS`, Zod schemas.

- [ ] **Step 1: Create `buyer-messaging.types.ts`**

```ts
// packages/shared/src/domain/buyer-messaging/buyer-messaging.types.ts

export enum BuyerMessageEventType {
  ORDER_RECEIVED = 'order_received',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  FEEDBACK_REQUEST = 'feedback_request',
}

export enum BuyerMessageStatus {
  SENT = 'sent',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export enum BuyerMessageTemplateKind {
  SYSTEM = 'system',
  CUSTOM = 'custom',
}

export interface BuyerMessageTemplateRef {
  kind: BuyerMessageTemplateKind;
  /** System template id (e.g. 'order_received.en.default') OR custom template UUID. */
  id: string;
}

export interface BuyerMessageEventConfig {
  enabled: boolean;
  template: BuyerMessageTemplateRef;
  /** feedback_request only: days after delivered to send. */
  delayDays?: number;
}

export interface BuyerMessagingConfig {
  enabled: boolean;
  events: Partial<Record<BuyerMessageEventType, BuyerMessageEventConfig>>;
}

/** Custom template row DTO. */
export interface BuyerMessageTemplate {
  id: string;
  userId: string;
  eventType: BuyerMessageEventType;
  name: string;
  body: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
}

/** Placeholder values resolved from order/listing/product context. */
export interface BuyerMessageContext {
  buyerUsername: string;
  itemTitle: string;
  orderId: string;
  trackingNumber?: string;
  carrier?: string;
  storeName: string;
  estimatedDelivery?: string;
}

/** Placeholder tokens a user may insert into a custom template. */
export const BUYER_MESSAGE_PLACEHOLDERS = [
  '{{buyer_username}}',
  '{{item_title}}',
  '{{order_id}}',
  '{{tracking_number}}',
  '{{carrier}}',
  '{{store_name}}',
  '{{estimated_delivery}}',
] as const;

/**
 * Predefined system templates (EN buyer-facing). Versioned in code — copy
 * changes need no migration. The `shipped` body is deliberately distinct from
 * eBay's automatic tracking notification (warm tone, does not repeat tracking).
 */
export const SYSTEM_BUYER_MESSAGE_TEMPLATES: Record<
  BuyerMessageEventType,
  { id: string; body: string }
> = {
  [BuyerMessageEventType.ORDER_RECEIVED]: {
    id: 'order_received.en.default',
    body:
      'Hi {{buyer_username}}, thank you for your order of "{{item_title}}"! We’re getting it ready and will let you know once it ships.',
  },
  [BuyerMessageEventType.SHIPPED]: {
    id: 'shipped.en.default',
    body:
      'Hi {{buyer_username}}, great news — "{{item_title}}" is on its way! \u{1F4E6} It’ll arrive with you soon.',
  },
  [BuyerMessageEventType.DELIVERED]: {
    id: 'delivered.en.default',
    body:
      'Hi {{buyer_username}}, your "{{item_title}}" has been delivered. We hope you love it! If you’re happy, a quick feedback would mean a lot.',
  },
  [BuyerMessageEventType.FEEDBACK_REQUEST]: {
    id: 'feedback_request.en.default',
    body:
      'Hi {{buyer_username}}, just checking in — if you’re enjoying "{{item_title}}", a moment of feedback really helps our small business. Thank you!',
  },
};
```

- [ ] **Step 2: Create `buyer-messaging.schema.ts`**

```ts
// packages/shared/src/schemas/buyer-messaging/buyer-messaging.schema.ts
import { z } from 'zod';
import { BuyerMessageEventType, BuyerMessageTemplateKind } from '../../domain/buyer-messaging/buyer-messaging.types';

export const buyerMessageTemplateRefSchema = z.object({
  kind: z.nativeEnum(BuyerMessageTemplateKind),
  id: z.string().min(1).max(160),
});

export const buyerMessageEventConfigSchema = z.object({
  enabled: z.boolean(),
  template: buyerMessageTemplateRefSchema,
  delayDays: z.number().int().min(0).max(90).optional(),
});

export const buyerMessagingConfigSchema = z.object({
  enabled: z.boolean(),
  events: z.record(z.nativeEnum(BuyerMessageEventType), buyerMessageEventConfigSchema).partial(),
});

export const buyerMessageTemplateSchema = z.object({
  eventType: z.nativeEnum(BuyerMessageEventType),
  name: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  locale: z.string().min(2).max(5).default('en'),
});
```

- [ ] **Step 3: Re-export from barrels**

Add to `packages/shared/src/domain/index.ts`:
```ts
export * from './buyer-messaging/buyer-messaging.types';
```
Add to `packages/shared/src/schemas/index.ts`:
```ts
export * from './buyer-messaging/buyer-messaging.schema';
```

- [ ] **Step 4: Extend store-settings types**

In `packages/shared/src/domain/store-settings/store-settings.types.ts`, add to BOTH `StoreSettingsResponse` and `SaveStoreSettingsRequest`:
```ts
import type { BuyerMessagingConfig } from '../buyer-messaging/buyer-messaging.types';
// ...inside each interface:
  buyerMessaging?: BuyerMessagingConfig | null;
```

- [ ] **Step 5: Build shared + typecheck**

Run: `pnpm --filter @repo/shared build && pnpm typecheck`
Expected: shared builds cleanly; no new typecheck errors from these files. (Pre-existing web TS errors are unrelated — see `CLAUDE.md`.)

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/domain/buyer-messaging packages/shared/src/schemas/buyer-messaging \
        packages/shared/src/domain/index.ts packages/shared/src/schemas/index.ts \
        packages/shared/src/domain/store-settings/store-settings.types.ts
git commit -m "feat(shared): add buyer-messaging domain types, schemas, system templates"
```

---

## Task 2: Pure helpers (TDD)

**Files:**
- Create: `apps/api/src/modules/buyer-messaging/buyer-message-helpers.ts`
- Test: `apps/api/src/modules/buyer-messaging/buyer-message-helpers.spec.ts`

**Interfaces:**
- Consumes: `BuyerMessagingConfig`, `BuyerMessageEventType`, `BuyerMessageContext`, `SYSTEM_BUYER_MESSAGE_TEMPLATES` (Task 1).
- Produces: `renderTemplate`, `resolveEventConfig`, `buyerMessageJobId`, `templateVersionHash`.

- [ ] **Step 1: Write failing tests**

```ts
// apps/api/src/modules/buyer-messaging/buyer-message-helpers.spec.ts
import { createHash } from 'crypto';
import {
  BuyerMessageEventType,
  BuyerMessageTemplateKind,
  type BuyerMessageContext,
  type BuyerMessagingConfig,
} from '@repo/shared';
import {
  renderTemplate,
  resolveEventConfig,
  buyerMessageJobId,
  templateVersionHash,
} from './buyer-message-helpers';

const ctx: BuyerMessageContext = {
  buyerUsername: 'jdoe',
  itemTitle: 'Red Widget',
  orderId: '12-0-12345',
  trackingNumber: 'TN123',
  carrier: 'UPS',
  storeName: 'AcmeShop',
};

describe('renderTemplate', () => {
  it('replaces known placeholders', () => {
    const out = renderTemplate('Hi {{buyer_username}}, your {{item_title}} ({{order_id}})', ctx);
    expect(out).toBe('Hi jdoe, your Red Widget (12-0-12345)');
  });
  it('collapses unknown placeholders to empty string', () => {
    expect(renderTemplate('X {{unknown_token}} Y', ctx)).toBe('X  Y');
  });
  it('is case-sensitive on placeholder names', () => {
    expect(renderTemplate('{{buyer_username}} vs {{Buyer_Username}}', ctx)).toBe('jdoe vs ');
  });
});

describe('resolveEventConfig', () => {
  const config: BuyerMessagingConfig = {
    enabled: true,
    events: {
      [BuyerMessageEventType.ORDER_RECEIVED]: {
        enabled: true,
        template: { kind: BuyerMessageTemplateKind.SYSTEM, id: 'order_received.en.default' },
      },
      [BuyerMessageEventType.SHIPPED]: { enabled: false, template: { kind: BuyerMessageTemplateKind.SYSTEM, id: 'x' } },
    },
  };
  it('returns the event config when feature + event enabled', () => {
    expect(resolveEventConfig(config, BuyerMessageEventType.ORDER_RECEIVED)?.enabled).toBe(true);
  });
  it('returns null when feature master toggle is off', () => {
    expect(resolveEventConfig({ ...config, enabled: false }, BuyerMessageEventType.ORDER_RECEIVED)).toBeNull();
  });
  it('returns null when the event is disabled', () => {
    expect(resolveEventConfig(config, BuyerMessageEventType.SHIPPED)).toBeNull();
  });
  it('returns null when the event is absent', () => {
    expect(resolveEventConfig(config, BuyerMessageEventType.DELIVERED)).toBeNull();
  });
  it('returns null when config is null', () => {
    expect(resolveEventConfig(null, BuyerMessageEventType.ORDER_RECEIVED)).toBeNull();
  });
});

describe('buyerMessageJobId', () => {
  it('is stable per order+event', () => {
    expect(buyerMessageJobId('12-0-1', BuyerMessageEventType.SHIPPED)).toBe('buyer-msg-12-0-1-shipped');
  });
});

describe('templateVersionHash', () => {
  it('returns a short stable hex hash of the body', () => {
    const h = templateVersionHash('hello');
    expect(h).toBe(createHash('sha256').update('hello').digest('hex').slice(0, 12));
    expect(templateVersionHash('hello')).toBe(h);
    expect(templateVersionHash('hellox')).not.toBe(h);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- buyer-message-helpers.spec`
Expected: FAIL (module not found / exports undefined).

- [ ] **Step 3: Implement the helpers**

```ts
// apps/api/src/modules/buyer-messaging/buyer-message-helpers.ts
import { createHash } from 'crypto';
import {
  BuyerMessageEventType,
  type BuyerMessageContext,
  type BuyerMessagingConfig,
  type BuyerMessageEventConfig,
} from '@repo/shared';

const PLACEHOLDER = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

/** Replace {{token}} with context values; unknown tokens become empty string. */
export function renderTemplate(body: string, ctx: BuyerMessageContext): string {
  return body.replace(PLACEHOLDER, (full, name: string) => {
    switch (name) {
      case 'buyer_username': return ctx.buyerUsername ?? '';
      case 'item_title': return ctx.itemTitle ?? '';
      case 'order_id': return ctx.orderId ?? '';
      case 'tracking_number': return ctx.trackingNumber ?? '';
      case 'carrier': return ctx.carrier ?? '';
      case 'store_name': return ctx.storeName ?? '';
      case 'estimated_delivery': return ctx.estimatedDelivery ?? '';
      default: return '';
    }
  });
}

/** Returns the event config iff the feature is enabled AND the event is enabled; else null. */
export function resolveEventConfig(
  config: BuyerMessagingConfig | null,
  event: BuyerMessageEventType,
): BuyerMessageEventConfig | null {
  if (!config || !config.enabled) return null;
  const ev = config.events?.[event];
  if (!ev || !ev.enabled) return null;
  return ev;
}

/** Stable BullMQ jobId for dedup. */
export function buyerMessageJobId(ebayOrderId: string, event: BuyerMessageEventType): string {
  return `buyer-msg-${ebayOrderId}-${event}`;
}

/** Short hash of a template body, stored on the log for audit/versioning. */
export function templateVersionHash(body: string): string {
  return createHash('sha256').update(body).digest('hex').slice(0, 12);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter api test -- buyer-message-helpers.spec`
Expected: PASS (all green).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/buyer-messaging/buyer-message-helpers.ts apps/api/src/modules/buyer-messaging/buyer-message-helpers.spec.ts
git commit -m "feat(buyer-messaging): add pure render/resolve/hash helpers with tests"
```

---

## Task 3: Migration 054

**Files:**
- Create: `apps/api/migrations/054_buyer_messaging.sql`

**Interfaces:** none (DDL). The migration runner auto-runs pending SQL on API boot (`DatabaseService.onModuleInit`).

- [ ] **Step 1: Write the migration**

```sql
-- apps/api/migrations/054_buyer_messaging.sql
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

-- per-store-settings config (global + per-store rows already exist on store_settings)
ALTER TABLE store_settings
  ADD COLUMN IF NOT EXISTS buyer_messaging JSONB;

CREATE TABLE IF NOT EXISTS buyer_message_templates (
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
CREATE INDEX IF NOT EXISTS idx_buyer_msg_templates_user_event
  ON buyer_message_templates(user_id, event_type);

CREATE TABLE IF NOT EXISTS buyer_message_log (
  id                  BIGSERIAL PRIMARY KEY,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ebay_account_id     UUID NOT NULL REFERENCES ebay_accounts(id) ON DELETE CASCADE,
  ebay_order_id       VARCHAR(64) NOT NULL,
  event_type          buyer_message_event_type NOT NULL,
  template_kind       VARCHAR(16) NOT NULL,
  template_ref        VARCHAR(160) NOT NULL,
  status              buyer_message_status NOT NULL,
  error               VARCHAR(500),
  provider_message_id VARCHAR(160),
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_buyer_msg_log_sent
  ON buyer_message_log(ebay_order_id, event_type)
  WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_buyer_msg_log_order
  ON buyer_message_log(ebay_order_id);
CREATE INDEX IF NOT EXISTS idx_buyer_msg_log_user_event
  ON buyer_message_log(user_id, event_type, created_at DESC);

COMMIT;
```

- [ ] **Step 2: Verify it applies**

With Postgres up (`pnpm docker:up`), restart the API so `MigrationRunner` applies it, then confirm:
Run: `pnpm --filter api migrate` (or boot the API and watch logs for `Applied migration 054`)
Then query (via pgAdmin or `psql`):
```sql
SELECT to_regclass('buyer_message_templates'), to_regclass('buyer_message_log'),
       column_name FROM information_schema.columns WHERE table_name='store_settings' AND column_name='buyer_messaging';
```
Expected: two non-null regclasses + one `buyer_messaging` row.

- [ ] **Step 3: Commit**

```bash
git add apps/api/migrations/054_buyer_messaging.sql
git commit -m "feat(buyer-messaging): migration 054 — config column, templates, log"
```

---

## Task 4: EbayService per-account token accessor

**Files:**
- Modify: `apps/api/src/modules/ebay/ebay.service.ts` (add a public method near the existing `getActiveAccountAccessToken` at ~line 938)

**Interfaces:**
- Produces: `EbayService.getAccountAccessToken(accountId: string): Promise<string>` — used by `EbayMessageApiProvider` (Task 5).

- [ ] **Step 1: Add the public accessor**

Insert immediately after the existing `getActiveAccountAccessToken` method:

```ts
  /**
   * Get a valid access token for a SPECIFIC eBay account (by id).
   * Used by BuyerMessagingProvider and other per-account callers.
   * Refreshes if expiring within 5 minutes (delegates to getAccessToken).
   */
  async getAccountAccessToken(accountId: string): Promise<string> {
    const accounts = await this.databaseService.query<EbayAccountEntity>(
      `SELECT * FROM ebay_accounts WHERE id = $1`,
      [accountId],
    );
    if (!accounts[0]) {
      throw new NotFoundException(`eBay account ${accountId} not found`);
    }
    return this.getAccessToken(accounts[0]);
  }
```

Ensure `NotFoundException` is imported (it already is in most services; if not, add `import { NotFoundException } from '@nestjs/common';`). `EbayAccountEntity` and `getAccessToken` are already in this file.

- [ ] **Step 2: Verify (typecheck + lint)**

Run: `pnpm typecheck` and `pnpm lint`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/ebay/ebay.service.ts
git commit -m "feat(ebay): expose getAccountAccessToken for per-account callers"
```

---

## Task 5: BuyerMessagingProvider port + eBay REST impl

**Files:**
- Create: `apps/api/src/modules/buyer-messaging/buyer-message.provider.ts`

**Interfaces:**
- Consumes: `EbayService.getAccountAccessToken` (Task 4), `EbayService.withRateLimitRetry` (existing, private — see note).
- Produces: `BuyerMessagingProvider` (interface), `EbayMessageApiProvider` (class).

> **Note on `withRateLimitRetry`:** it is currently `private` on `EbayService`. Rather than widen it, the provider implements its own minimal retry honoring `Retry-After` on 429/5xx (small, focused). Keep it inside this file.

> **eBay Message API shape:** the Commerce Message API `sendMessage` (released Q4 2025) takes order context + recipient + body. The implementer MUST confirm the exact endpoint path, required scopes, and JSON field names against the live docs (https://developer.ebay.com/api-docs/commerce/message/resources/methods) during this task. The port isolates this — if the field shape differs, only `EbayMessageApiProvider.sendMessage` changes. If `sendMessage` cannot send a proactive message for the account's region/scopes, swap the impl to a `TradingAaqProvider` against `AddMemberMessageAAQToPartner` (XML) satisfying the same interface — no call-site change.

- [ ] **Step 1: Write the port + implementation**

```ts
// apps/api/src/modules/buyer-messaging/buyer-message.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { EbayService } from '../ebay/ebay.service';

export interface BuyerMessageSendInput {
  ebayAccountId: string;
  orderId: string;
  lineItemId?: string;
  buyerUsername: string;
  body: string;
}

export interface BuyerMessageSendResult {
  providerMessageId?: string;
}

export interface BuyerMessagingProvider {
  sendMessage(input: BuyerMessageSendInput): Promise<BuyerMessageSendResult>;
}

/**
 * eBay Commerce Message API (REST) provider. Resolves the per-account user
 * token internally via EbayService.getAccountAccessToken. Honours Retry-After
 * on 429/5xx. Errors are thrown to the caller (the processor logs them redacted).
 */
@Injectable()
export class EbayMessageApiProvider implements BuyerMessagingProvider {
  private readonly logger = new Logger(EbayMessageApiProvider.name);
  // TODO(confirm): exact path/scopes per live Message API docs — see task note.
  private readonly endpoint = 'https://apix.ebay.com/ws/commerce/message/v1/message';

  constructor(private readonly ebayService: EbayService) {}

  async sendMessage(input: BuyerMessageSendInput): Promise<BuyerMessageSendResult> {
    const token = await this.ebayService.getAccountAccessToken(input.ebayAccountId);
    const payload = {
      // Field names per live docs; order context + recipient + body.
      recipient: { username: input.buyerUsername },
      body: input.body,
      context: { orderId: input.orderId, ...(input.lineItemId ? { lineItemId: input.lineItemId } : {}) },
    };
    const res = await this.doWithRetry(() =>
      fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          // some eBay Commerce APIs require a marketplace header; add if docs say so.
        },
        body: JSON.stringify(payload),
      }),
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`eBay Message API ${res.status}: ${this.redact(text)}`);
    }
    const json = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { providerMessageId: json.messageId };
  }

  private async doWithRetry<T>(run: () => Promise<Response>, maxAttempts = 3): Promise<Response> {
    let attempt = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await run();
      if (res.status === 429 || res.status >= 500) {
        attempt += 1;
        if (attempt >= maxAttempts) return res;
        const retryAfter = Number(res.headers.get('retry-after')) || 2 * attempt;
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      return res;
    }
  }

  /** Strip anything token-like before logging. */
  private redact(text: string): string {
    return text.replace(/(Bearer\s+[\w.-]+|token["']?\s*[:=]\s*["']?[\w.-]+)/gi, '[redacted]').slice(0, 400);
  }
}
```

> ⚠️ The single `eslint-disable` above is a placeholder for retry-loop structure only — **do NOT keep it**. Replace the `while (true)` with a bounded `for (let attempt = 0; attempt < maxAttempts; attempt++)` loop that returns/throws without needing `no-constant-condition`. Repo rule: no `eslint-disable`. Final code must lint clean with no disables.

- [ ] **Step 2: Rewrite the retry loop without `eslint-disable`**

Replace `doWithRetry` with a bounded `for` loop (no `while (true)`, no disable comment) that throws on final failure:

```ts
  private async doWithRetry(run: () => Promise<Response>, maxAttempts = 3): Promise<Response> {
    let last: Response | undefined;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await run();
      if (res.status !== 429 && res.status < 500) return res;
      last = res;
      const retryAfter = Number(res.headers.get('retry-after')) || 2 * (attempt + 1);
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
    }
    return last as Response;
  }
```

- [ ] **Step 3: Verify (typecheck + lint)**

Run: `pnpm typecheck && pnpm lint`
Expected: clean, zero disables.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/buyer-messaging/buyer-message.provider.ts
git commit -m "feat(buyer-messaging): add BuyerMessagingProvider port + eBay REST impl"
```

---

## Task 6: Custom-template repository

**Files:**
- Create: `apps/api/src/modules/buyer-messaging/buyer-message-template.repository.ts`

**Interfaces:**
- Consumes: `DatabaseService` (`../../common/database/database.service`), `BuyerMessageTemplate`/`BuyerMessageEventType` from `@repo/shared`.
- Produces: `BuyerMessageTemplateRepository.{list,get,create,update,delete}`.

- [ ] **Step 1: Implement CRUD**

```ts
// apps/api/src/modules/buyer-messaging/buyer-message-template.repository.ts
import { Injectable } from '@nestjs/common';
import { BuyerMessageEventType, type BuyerMessageTemplate } from '@repo/shared';
import { DatabaseService } from '../../common/database/database.service';

interface TemplateRow {
  id: string; user_id: string; event_type: BuyerMessageEventType;
  name: string; body: string; locale: string;
  created_at: Date; updated_at: Date;
}

@Injectable()
export class BuyerMessageTemplateRepository {
  constructor(private readonly db: DatabaseService) {}

  async list(userId: string, eventType?: BuyerMessageEventType): Promise<BuyerMessageTemplate[]> {
    const rows = eventType
      ? await this.db.query<TemplateRow>(
          `SELECT * FROM buyer_message_templates WHERE user_id=$1 AND event_type=$2 ORDER BY created_at DESC`,
          [userId, eventType],
        )
      : await this.db.query<TemplateRow>(
          `SELECT * FROM buyer_message_templates WHERE user_id=$1 ORDER BY created_at DESC`,
          [userId],
        );
    return rows.map((r) => this.map(r));
  }

  async get(userId: string, id: string): Promise<BuyerMessageTemplate | null> {
    const rows = await this.db.query<TemplateRow>(
      `SELECT * FROM buyer_message_templates WHERE id=$1 AND user_id=$2`, [id, userId]);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async create(userId: string, input: { eventType: BuyerMessageEventType; name: string; body: string; locale: string }): Promise<BuyerMessageTemplate> {
    const rows = await this.db.query<TemplateRow>(
      `INSERT INTO buyer_message_templates (user_id,event_type,name,body,locale)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, input.eventType, input.name, input.body, input.locale]);
    return this.map(rows[0]);
  }

  async update(userId: string, id: string, input: { name?: string; body?: string; locale?: string }): Promise<BuyerMessageTemplate | null> {
    const rows = await this.db.query<TemplateRow>(
      `UPDATE buyer_message_templates SET name=COALESCE($3,name), body=COALESCE($4,body), locale=COALESCE($5,locale), updated_at=NOW()
       WHERE id=$1 AND user_id=$2 RETURNING *`,
      [id, userId, input.name ?? null, input.body ?? null, input.locale ?? null]);
    return rows[0] ? this.map(rows[0]) : null;
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const rows = await this.db.query<{ id: string }>(
      `DELETE FROM buyer_message_templates WHERE id=$1 AND user_id=$2 RETURNING id`, [id, userId]);
    return rows.length > 0;
  }

  private map(r: TemplateRow): BuyerMessageTemplate {
    return {
      id: r.id, userId: r.user_id, eventType: r.event_type, name: r.name,
      body: r.body, locale: r.locale,
      createdAt: r.created_at.toISOString(), updatedAt: r.updated_at.toISOString(),
    };
  }
}
```

- [ ] **Step 2: Verify (typecheck + lint)**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/buyer-messaging/buyer-message-template.repository.ts
git commit -m "feat(buyer-messaging): custom template repository (CRUD)"
```

---

## Task 7: Persist + resolve `buyer_messaging` in StoreSettingsService

**Files:**
- Modify: `apps/api/src/modules/store-settings/store-settings.service.ts`

**Interfaces:**
- Consumes: `BuyerMessagingConfig` from `@repo/shared` (Task 1), `StoreSettingsResponse`/`SaveStoreSettingsRequest` (now carry `buyerMessaging`).
- Produces: `store_settings.buyer_messaging` read on `getResolvedSettings`/`getSettings`; written on `saveSettings`.

Follow the exact pattern of `amazonTaxRate`/`autoFulfillEnabled` already in this file (entity iface → mapToDto → default-return block → both upsert SQLs + param).

- [ ] **Step 1: Extend the entity interface**

In `StoreSettingsEntity` (top of file), add:
```ts
  buyer_messaging: unknown; // JSONB — parsed in mapToDto
```
Add the import: `import { type BuyerMessagingConfig } from '@repo/shared';` (extend the existing `@repo/shared` import block).

- [ ] **Step 2: Parse in `mapToDto`**

In `mapToDto`'s return object add:
```ts
      buyerMessaging: this.parseBuyerMessaging(entity.buyer_messaging),
```
And add the private helper near `mapToDto`:
```ts
  private parseBuyerMessaging(raw: unknown): BuyerMessagingConfig | null {
    if (!raw || typeof raw !== 'object') return null;
    try {
      return raw as BuyerMessagingConfig;
    } catch {
      return null;
    }
  }
```
(Keep the existing `parsedBlacklist` logic intact.)

- [ ] **Step 3: Add to the default-return block**

In `getSettings`'s "no row found" default return (the object with `id: ''`), add:
```ts
        buyerMessaging: null,
```

- [ ] **Step 4: Destructure `buyerMessaging` in `saveSettings`**

In the destructure block of `saveSettings`, add:
```ts
      buyerMessaging,
```
Then compute a JSON string (null-safe) before the `if (isGlobal)`:
```ts
    const buyerMessagingJson = buyerMessaging ? JSON.stringify(buyerMessaging) : null;
```

- [ ] **Step 5: Add the column to BOTH upsert SQLs**

In the **global** upsert (INSERT column list add `buyer_messaging`; VALUES add `$11`; add `ON CONFLICT ... DO UPDATE SET buyer_messaging = EXCLUDED.buyer_messaging,`; add `buyerMessagingJson` to the params array as the 11th). Repeat for the **per-store** upsert (it becomes `$12` since storeId is `$2`).

For the per-store branch the column list becomes:
```sql
INSERT INTO store_settings (user_id, store_id, is_global, country, state, zip_code, validate_title, validate_description, blacklist, amazon_tax_rate, auto_fulfill_enabled, tracking_conversion_provider, buyer_messaging)
VALUES ($1, $2, FALSE, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT (user_id, store_id) WHERE store_id IS NOT NULL
DO UPDATE SET
    country = EXCLUDED.country, state = EXCLUDED.state, zip_code = EXCLUDED.zip_code,
    validate_title = EXCLUDED.validate_title, validate_description = EXCLUDED.validate_description,
    blacklist = EXCLUDED.blacklist, amazon_tax_rate = EXCLUDED.amazon_tax_rate,
    auto_fulfill_enabled = EXCLUDED.auto_fulfill_enabled,
    tracking_conversion_provider = EXCLUDED.tracking_conversion_provider,
    buyer_messaging = EXCLUDED.buyer_messaging, updated_at = CURRENT_TIMESTAMP
RETURNING *
```
with params `[..., buyerMessagingJson]` appended. Mirror for the global branch (`$11`).

- [ ] **Step 6: Verify (typecheck + lint)**

Run: `pnpm typecheck && pnpm lint`
Expected: clean. Manual smoke (optional): `PUT /v1/store-settings` with `buyerMessaging` and re-GET to confirm round-trip.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/store-settings/store-settings.service.ts
git commit -m "feat(store-settings): persist + resolve buyer_messaging JSONB"
```

---

## Task 8: BuyerMessageService (config + template resolution)

**Files:**
- Create: `apps/api/src/modules/buyer-messaging/buyer-message.service.ts`

**Interfaces:**
- Consumes: `StoreSettingsService.getResolvedSettings`, `BuyerMessageTemplateRepository`, `SYSTEM_BUYER_MESSAGE_TEMPLATES`, `resolveEventConfig`, `templateVersionHash`.
- Produces: `BuyerMessageService.getResolvedTemplate(userId, storeId, event)` → `{ body, kind, ref, versionHash } | null` (used by the processor in Task 9).

- [ ] **Step 1: Implement the service**

```ts
// apps/api/src/modules/buyer-messaging/buyer-message.service.ts
import { Injectable } from '@nestjs/common';
import {
  BuyerMessageEventType, BuyerMessageTemplateKind, SYSTEM_BUYER_MESSAGE_TEMPLATES,
} from '@repo/shared';
import { StoreSettingsService } from '../store-settings/store-settings.service';
import { BuyerMessageTemplateRepository } from './buyer-message-template.repository';
import { resolveEventConfig, templateVersionHash } from './buyer-message-helpers';

export interface ResolvedTemplate {
  body: string;
  kind: BuyerMessageTemplateKind;
  ref: string;
  versionHash: string;
}

@Injectable()
export class BuyerMessageService {
  constructor(
    private readonly settings: StoreSettingsService,
    private readonly templates: BuyerMessageTemplateRepository,
  ) {}

  /** Resolve the effective template for an event, or null if disabled/unconfigured. */
  async resolveTemplate(
    userId: string,
    storeId: string | null,
    event: BuyerMessageEventType,
  ): Promise<ResolvedTemplate | null> {
    const settings = await this.settings.getResolvedSettings(userId, storeId);
    const ev = resolveEventConfig(settings.buyerMessaging ?? null, event);
    if (!ev) return null;

    if (ev.template.kind === BuyerMessageTemplateKind.SYSTEM) {
      const sys = SYSTEM_BUYER_MESSAGE_TEMPLATES[event];
      const body = sys?.body ?? '';
      return { body, kind: BuyerMessageTemplateKind.SYSTEM, ref: ev.template.id, versionHash: templateVersionHash(body) };
    }
    // custom
    const custom = await this.templates.get(userId, ev.template.id);
    if (!custom) return null;
    return {
      body: custom.body,
      kind: BuyerMessageTemplateKind.CUSTOM,
      ref: custom.id,
      versionHash: templateVersionHash(custom.body),
    };
  }

  /** feedback_request delay (days), with config fallback. */
  feedbackDelayDays(settings: { buyerMessaging?: { events?: Partial<Record<BuyerMessageEventType, { delayDays?: number }>> } } | null | undefined, fallback: number): number {
    const d = settings?.buyerMessaging?.events?.[BuyerMessageEventType.FEEDBACK_REQUEST]?.delayDays;
    return typeof d === 'number' && d >= 0 ? d : fallback;
  }
}
```

- [ ] **Step 2: Verify (typecheck + lint)**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/buyer-messaging/buyer-message.service.ts
git commit -m "feat(buyer-messaging): config + template resolution service"
```

---

## Task 9: Queue producer + worker (idempotent, fail-soft)

**Files:**
- Create: `apps/api/src/modules/buyer-messaging/buyer-messaging.constants.ts`
- Create: `apps/api/src/modules/buyer-messaging/buyer-message-queue.service.ts`
- Create: `apps/api/src/modules/buyer-messaging/buyer-message.processor.ts`

**Interfaces:**
- Consumes: `BUYER_MESSAGE_QUEUE`, `buyerMessageJobId` (Task 2), `BuyerMessageService.resolveTemplate` (Task 8), `BuyerMessagingProvider` (Task 5), `renderTemplate` (Task 2).
- Produces: `BuyerMessageQueueService.enqueue(ebayOrderId, userId, ebayAccountId, event, opts?)`; the processor processes `{ ebayOrderId, userId, ebayAccountId, storeId, event, feedbackDelayDays? }`.

- [ ] **Step 1: Constants**

```ts
// apps/api/src/modules/buyer-messaging/buyer-messaging.constants.ts
import { BuyerMessageEventType } from '@repo/shared';

export const BUYER_MESSAGE_QUEUE = 'buyer-message';

export const BUYER_MESSAGING_DEFAULTS = {
  ENABLED: false,
  QUEUE_CONCURRENCY: 1,
  FEEDBACK_DELAY_DAYS: 3,
  ATTEMPTS: 3,
} as const;

export const ALL_BUYER_MESSAGE_EVENTS = Object.values(BuyerMessageEventType);
```

- [ ] **Step 2: Producer**

```ts
// apps/api/src/modules/buyer-messaging/buyer-message-queue.service.ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { BuyerMessageEventType } from '@repo/shared';
import { BUYER_MESSAGE_QUEUE, BUYER_MESSAGING_DEFAULTS } from './buyer-messaging.constants';
import { buyerMessageJobId } from './buyer-message-helpers';

export interface BuyerMessageJobData {
  ebayOrderId: string;
  userId: string;
  ebayAccountId: string;
  storeId: string | null;
  event: BuyerMessageEventType;
  feedbackDelayDays?: number;
}

@Injectable()
export class BuyerMessageQueueService {
  private readonly logger = new Logger(BuyerMessageQueueService.name);

  constructor(@InjectQueue(BUYER_MESSAGE_QUEUE) private readonly queue: Queue) {}

  /** Fail-soft: never throws to the caller (order/tracking flows must not break). */
  async enqueue(data: BuyerMessageJobData, opts: { delayMs?: number } = {}): Promise<void> {
    try {
      await this.queue.add(data.event, data, {
        jobId: buyerMessageJobId(data.ebayOrderId, data.event),
        attempts: BUYER_MESSAGING_DEFAULTS.ATTEMPTS,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 200,
        removeOnFail: 500,
        ...(opts.delayMs ? { delay: opts.delayMs } : {}),
      });
    } catch (err) {
      this.logger.warn(`Failed to enqueue buyer message ${data.event} for order ${data.ebayOrderId}: ${(err as Error).message}`);
    }
  }
}
```

- [ ] **Step 3: Worker**

```ts
// apps/api/src/modules/buyer-messaging/buyer-message.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { DatabaseService } from '../../common/database/database.service';
import { BUYER_MESSAGE_QUEUE, BUYER_MESSAGING_DEFAULTS } from './buyer-messaging.constants';
import { BuyerMessageQueueService, type BuyerMessageJobData } from './buyer-message-queue.service';
import { BuyerMessageService } from './buyer-message.service';
import { BuyerMessagingProvider } from './buyer-message.provider';
import { renderTemplate } from './buyer-message-helpers';
import { LocalTrackingConverter } from '../amazon/tracking-converter'; // reuse carrier mapping
import { BUYER_MESSAGE_TOKEN } from './buyer-messaging.module'; // DI token, see Task 11

interface OrderCtx {
  buyerUsername: string; itemTitle: string; orderId: string;
  trackingNumber?: string; carrier?: string; storeName: string;
  lineItemId?: string;
}

@Processor(BUYER_MESSAGE_QUEUE, { concurrency: BUYER_MESSAGING_DEFAULTS.QUEUE_CONCURRENCY })
@Injectable()
export class BuyerMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(BuyerMessageProcessor.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly messageService: BuyerMessageService,
    @Inject(BUYER_MESSAGE_TOKEN) private readonly provider: BuyerMessagingProvider,
    private readonly queue: BuyerMessageQueueService,
  ) {
    super();
  }

  async process(job: Job<BuyerMessageJobData>): Promise<void> {
    const { ebayOrderId, userId, ebayAccountId, storeId, event } = job.data;

    // 1. idempotency guard — already sent?
    const already = await this.db.query<{ id: string }>(
      `SELECT id FROM buyer_message_log WHERE ebay_order_id=$1 AND event_type=$2 AND status='sent' LIMIT 1`,
      [ebayOrderId, event]);
    if (already.length) return;

    // 2. resolve template (null => disabled/unconfigured) — re-checks config at fire time
    const tpl = await this.messageService.resolveTemplate(userId, storeId, event);
    if (!tpl) {
      await this.recordLog({ ebayOrderId, userId, ebayAccountId, event, status: 'skipped', templateKind: 'system', templateRef: 'none' });
      return;
    }

    // 3. feedback_request scheduling: if a delay was requested but this job is the delivered-time
    //    scheduling trigger, handled by the producer's delay. Here we just send when fired.
    const ctx = await this.loadOrderCtx(ebayOrderId, ebayAccountId);
    if (!ctx) {
      await this.recordLog({ ebayOrderId, userId, ebayAccountId, event, status: 'skipped', templateKind: tpl.kind, templateRef: tpl.ref });
      return;
    }
    const body = renderTemplate(tpl.body, ctx);

    // 4. send
    try {
      const result = await this.provider.sendMessage({
        ebayAccountId, orderId: ctx.orderId, lineItemId: ctx.lineItemId,
        buyerUsername: ctx.buyerUsername, body,
      });
      await this.recordLog({ ebayOrderId, userId, ebayAccountId, event, status: 'sent', templateKind: tpl.kind, templateRef: tpl.ref, versionHash: tpl.versionHash, providerMessageId: result.providerMessageId });
    } catch (err) {
      const redacted = String((err as Error).message).replace(/Bearer\s+[\w.-]+/gi, '[redacted]').slice(0, 400);
      await this.recordLog({ ebayOrderId, userId, ebayAccountId, event, status: 'failed', templateKind: tpl.kind, templateRef: tpl.ref, versionHash: tpl.versionHash, error: redacted });
      throw err; // BullMQ backoff retries; final failure leaves 'failed'.
    }
  }

  /** Load buyer/item/tracking context via orders→listings→products join. */
  private async loadOrderCtx(ebayOrderId: string, ebayAccountId: string): Promise<OrderCtx | null> {
    const rows = await this.db.query<{
      buyer_username: string; item_title: string; order_id: string;
      tracking_number: string | null; carrier: string | null; store_name: string;
      legacy_item_id: string | null;
    }>(
      `SELECT o.buyer_username, COALESCE(p.title, o.order_id) AS item_title,
              o.ebay_order_id AS order_id, o.tracking_number, o.carrier,
              ea.seller_id AS store_name, li.legacy_item_id
         FROM orders o
         LEFT JOIN listings l ON l.id = o.listing_id
         LEFT JOIN products p ON p.id = l.product_id
         LEFT JOIN ebay_accounts ea ON ea.id = o.ebay_account_id
         LEFT JOIN LATERAL (SELECT jsonb_array_elements(o.line_items)->>'legacyItemId' AS legacy_item_id LIMIT 1) li ON true
        WHERE o.ebay_order_id = $1 AND o.ebay_account_id = $2
        LIMIT 1`,
      [ebayOrderId, ebayAccountId]);
    if (!rows[0]) return null;
    const r = rows[0];
    // Map carrier via the existing converter (best-effort; passthrough on miss).
    const mapped = r.carrier ? LocalTrackingConverter.mapCarrier(r.carrier) : undefined;
    return {
      buyerUsername: r.buyer_username || 'there',
      itemTitle: r.item_title,
      orderId: r.order_id,
      trackingNumber: r.tracking_number ?? undefined,
      carrier: mapped ?? r.carrier ?? undefined,
      storeName: r.store_name || 'our store',
      lineItemId: r.legacy_item_id ?? undefined,
    };
  }

  private async recordLog(args: {
    ebayOrderId: string; userId: string; ebayAccountId: string; event: string;
    status: 'sent' | 'failed' | 'skipped'; templateKind: string; templateRef: string;
    versionHash?: string; providerMessageId?: string; error?: string;
  }): Promise<void> {
    const ref = args.versionHash ? `${args.templateRef}@${args.versionHash}` : args.templateRef;
    try {
      await this.db.query(
        `INSERT INTO buyer_message_log
           (user_id, ebay_account_id, ebay_order_id, event_type, template_kind, template_ref, status, error, provider_message_id, sent_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, CASE WHEN $7='sent' THEN NOW() ELSE NULL END)`,
        [args.userId, args.ebayAccountId, args.ebayOrderId, args.event,
         args.templateKind, ref, args.status, args.error ?? null, args.providerMessageId ?? null]);
    } catch (err) {
      // logging is best-effort; partial-unique violation on a concurrent sent row is fine.
      this.logger.debug(`log write skipped: ${(err as Error).message}`);
    }
  }
}
```

> If `LocalTrackingConverter.mapCarrier` is not a static method, use whatever the existing carrier-mapping entry point is in `tracking-converter.ts` (it exists per the spec's Tracking Converter section). Confirm the exact export name in Task 11 when wiring; the signature is `(raw: string) => string | undefined`.

- [ ] **Step 4: Verify (typecheck + lint)**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/buyer-messaging/buyer-messaging.constants.ts \
        apps/api/src/modules/buyer-messaging/buyer-message-queue.service.ts \
        apps/api/src/modules/buyer-messaging/buyer-message.processor.ts
git commit -m "feat(buyer-messaging): queue producer + idempotent fail-soft worker"
```

---

## Task 10: Controller + DTOs

**Files:**
- Create: `apps/api/src/modules/buyer-messaging/buyer-message.dto.ts`
- Create: `apps/api/src/modules/buyer-messaging/buyer-message.controller.ts`

**Interfaces:**
- Consumes: `BuyerMessageTemplateRepository`, `StoreSettingsService.saveSettings/getResolvedSettings`, Zod schemas.
- Produces: REST endpoints (see steps).

- [ ] **Step 1: DTOs**

```ts
// apps/api/src/modules/buyer-messaging/buyer-message.dto.ts
import { IsBoolean, IsInt, IsObject, IsString, IsEnum, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { BuyerMessageEventType } from '@repo/shared';

export class SaveBuyerMessagingDto {
  @IsBoolean() enabled!: boolean;
  @IsObject() events!: Record<string, unknown>;
}

export class CreateTemplateDto {
  @IsEnum(BuyerMessageEventType) eventType!: BuyerMessageEventType;
  @IsString() @MaxLength(120) name!: string;
  @IsString() @MaxLength(2000) body!: string;
  @IsString() @MaxLength(5) locale: string = 'en';
}

export class UpdateTemplateDto {
  @IsString() @MaxLength(120) name?: string;
  @IsString() @MaxLength(2000) body?: string;
  @IsString() @MaxLength(5) locale?: string;
}

export class FeedbackDelayDto {
  @IsInt() @Min(0) @Max(90) delayDays!: number;
}
```

- [ ] **Step 2: Controller**

```ts
// apps/api/src/modules/buyer-messaging/buyer-message.controller.ts
import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Put, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { BuyerMessageTemplateRepository } from './buyer-message-template.repository';
import { StoreSettingsService } from '../store-settings/store-settings.service';
import { CreateTemplateDto, SaveBuyerMessagingDto, UpdateTemplateDto } from './buyer-message.dto';
import { buyerMessagingConfigSchema, buyerMessageTemplateSchema } from '@repo/shared';
import type { AuthenticatedRequest } from '../auth/auth.types'; // confirm exact path in Task 11

@Controller('v1')
@UseGuards(JwtAuthGuard)
export class BuyerMessageController {
  constructor(
    private readonly templates: BuyerMessageTemplateRepository,
    private readonly settings: StoreSettingsService,
  ) {}

  @Get('store-settings/buyer-messaging')
  async getConfig(@Req() req: AuthenticatedRequest, @Query('storeId') storeId?: string) {
    return (await this.settings.getResolvedSettings(req.user.id, storeId ?? null)).buyerMessaging;
  }

  @Put('store-settings/buyer-messaging')
  async saveConfig(@Req() req: AuthenticatedRequest, @Body() dto: SaveBuyerMessagingDto) {
    const parsed = buyerMessagingConfigSchema.parse({ enabled: dto.enabled, events: dto.events });
    // Merge into existing settings row (global or per-store) without blowing away other fields:
    const existing = await this.settings.getResolvedSettings(req.user.id, null);
    await this.settings.saveSettings(req.user.id, {
      isGlobal: true,
      country: existing.country, state: existing.state, zipCode: existing.zipCode,
      validateTitle: existing.validateTitle, validateDescription: existing.validateDescription,
      blacklist: existing.blacklist, amazonTaxRate: existing.amazonTaxRate,
      autoFulfillEnabled: existing.autoFulfillEnabled,
      trackingConversionProvider: existing.trackingConversionProvider as 'local' | 'api',
      buyerMessaging: parsed,
    });
    return { ok: true };
  }

  @Get('buyer-messaging/templates')
  async listTemplates(@Req() req: AuthenticatedRequest, @Query('eventType') eventType?: BuyerMessageEventType) {
    return this.templates.list(req.user.id, eventType);
  }

  @Post('buyer-messaging/templates')
  async createTemplate(@Req() req: AuthenticatedRequest, @Body() dto: CreateTemplateDto) {
    const parsed = buyerMessageTemplateSchema.parse(dto);
    return this.templates.create(req.user.id, parsed);
  }

  @Put('buyer-messaging/templates/:id')
  async updateTemplate(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTemplateDto) {
    const out = await this.templates.update(req.user.id, id, dto);
    return out ?? { ok: false };
  }

  @Delete('buyer-messaging/templates/:id')
  async deleteTemplate(@Req() req: AuthenticatedRequest, @Param('id', ParseUUIDPipe) id: string) {
    return { ok: await this.templates.delete(req.user.id, id) };
  }
}
```

> `saveConfig` currently writes the GLOBAL row only (isGlobal:true). Per-store config writes are a follow-up (the FE Settings hub already lets the user pick global vs store; mirror the existing `saveSettings` storeId path when the FE needs per-store). The resolution (`getResolvedSettings`) already supports per-store reads.

- [ ] **Step 3: Verify (typecheck + lint)**

Run: `pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/buyer-messaging/buyer-message.dto.ts apps/api/src/modules/buyer-messaging/buyer-message.controller.ts
git commit -m "feat(buyer-messaging): REST endpoints for config + template CRUD"
```

---

## Task 11: Module + DI token + trigger wiring + admin registry

**Files:**
- Create: `apps/api/src/modules/buyer-messaging/buyer-messaging.module.ts`
- Modify: `apps/api/src/modules/orders/orders.module.ts`, `apps/api/src/modules/orders/order-sync.service.ts`
- Modify: `apps/api/src/modules/amazon/amazon.module.ts`, `apps/api/src/modules/amazon/amazon-tracking-processor.service.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/modules/admin/admin.service.ts`, `admin/queue-events-collector.service.ts`, `admin/admin.module.ts`, `admin/admin.controller.ts`

**Interfaces:**
- Produces: `BuyerMessagingModule` (exports `BuyerMessageQueueService`), DI token `BUYER_MESSAGE_TOKEN` bound to `BuyerMessagingProvider`.

- [ ] **Step 1: The module**

```ts
// apps/api/src/modules/buyer-messaging/buyer-messaging.module.ts
import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/common/config';
import { BUYER_MESSAGE_QUEUE, BUYER_MESSAGING_DEFAULTS } from './buyer-messaging.constants';
import { BuyerMessageController } from './buyer-message.controller';
import { BuyerMessageProcessor } from './buyer-message.processor';
import { BuyerMessageQueueService } from './buyer-message-queue.service';
import { BuyerMessageService } from './buyer-message.service';
import { BuyerMessageTemplateRepository } from './buyer-message-template.repository';
import { BuyerMessagingProvider, EbayMessageApiProvider } from './buyer-message.provider';

export const BUYER_MESSAGE_TOKEN = Symbol('BUYER_MESSAGING_PROVIDER');

@Module({
  imports: [
    ConfigModule,
    BullModule.registerQueue({ name: BUYER_MESSAGE_QUEUE }),
  ],
  controllers: [BuyerMessageController],
  providers: [
    BuyerMessageTemplateRepository,
    BuyerMessageService,
    BuyerMessageQueueService,
    BuyerMessageProcessor,
    { provide: BUYER_MESSAGE_TOKEN, useClass: EbayMessageApiProvider },
    // EbayMessageApiProvider is injectable itself (so it can be @Inject'ed if ever needed directly):
    EbayMessageApiProvider,
  ],
  exports: [BuyerMessageQueueService, BuyerMessageService],
})
export class BuyerMessagingModule {
  static isMessagingEnabled(config: ConfigService): boolean {
    return config.get<string>('BUYER_MESSAGING_ENABLED') !== 'false' ? true : false;
  }
  // NOTE: above returns true unless explicitly 'false' — adjust to default OFF:
}
```

> Fix the default: `BUYER_MESSAGING_ENABLED` must default to **OFF**. Replace the helper with:
> `return config.get<string>('BUYER_MESSAGING_ENABLED') === 'true';` (opt-in). Keep this; the processor's per-user config check is the real gate, but the env master switch must default off.

- [ ] **Step 2: Default-OFF master switch + concurrency/feedback env**

Replace the `isMessagingEnabled` body in the module with the opt-in version above, and in `buyer-messaging.constants.ts` read the env-backed values where used (the processor concurrency already uses `BUYER_MESSAGING_DEFAULTS.QUEUE_CONCURRENCY`; leave as constant for v1). Add to `apps/api/.env.example`:
```
BUYER_MESSAGING_ENABLED=false
BUYER_MESSAGING_QUEUE_CONCURRENCY=1
BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS=3
```

- [ ] **Step 3: Wire AppModule + cross-module imports**

- `app.module.ts`: add `BuyerMessagingModule` to `imports`.
- `orders.module.ts`: add `BuyerMessagingModule` to `imports`.
- `amazon.module.ts`: add `BuyerMessagingModule` to `imports`.

- [ ] **Step 4: Trigger — order_received (OrderSyncService)**

In `apps/api/src/modules/orders/order-sync.service.ts`, inject the queue in the constructor:
```ts
import { BuyerMessageQueueService } from '../buyer-messaging/buyer-message-queue.service';
// constructor(..., private readonly buyerMessages: BuyerMessageQueueService) {}
```
At the genuine-insert seam (the `xmax = 0` / `inserted === true` branch where A2 + stock-sync are enqueued — find the existing `maybeEnqueueAutoFulfill` call site), add immediately after, inside the same try/catch guard:
```ts
      if (process.env.BUYER_MESSAGING_ENABLED === 'true') {
        await this.buyerMessages.enqueue({
          ebayOrderId, userId, ebayAccountId,
          storeId: null, // resolved per-account at send; storeId optional
          event: BuyerMessageEventType.ORDER_RECEIVED,
        }).catch(() => { /* fail-soft */ });
      }
```
Import `BuyerMessageEventType` from `@repo/shared`. Mirror whatever variable names hold `userId`/`ebayAccountId` at that seam (they exist there already for A2/stock-sync).

- [ ] **Step 5: Trigger — shipped / delivered / feedback (AmazonTrackingProcessorService)**

In `amazon-tracking-processor.service.ts`, inject `BuyerMessageQueueService`. In `handleShipped(...)` (after the existing eBay `createShippingFulfillment` call), add:
```ts
      if (process.env.BUYER_MESSAGING_ENABLED === 'true') {
        await this.buyerMessages.enqueue({ ebayOrderId, userId, ebayAccountId, storeId: null, event: BuyerMessageEventType.SHIPPED }).catch(() => {});
      }
```
In `handleDelivered(...)` (order → completed), add the delivered enqueue PLUS schedule the delayed feedback job:
```ts
      if (process.env.BUYER_MESSAGING_ENABLED === 'true') {
        await this.buyerMessages.enqueue({ ebayOrderId, userId, ebayAccountId, storeId: null, event: BuyerMessageEventType.DELIVERED }).catch(() => {});
        const delayDays = Number(process.env.BUYER_MESSAGING_FEEDBACK_DEFAULT_DELAY_DAYS ?? 3);
        await this.buyerMessages.enqueue(
          { ebayOrderId, userId, ebayAccountId, storeId: null, event: BuyerMessageEventType.FEEDBACK_REQUEST },
          { delayMs: delayDays * 86_400_000 },
        ).catch(() => {});
      }
```
Use the real `userId`/`ebayAccountId`/`ebayOrderId` variables already in scope at those handlers (confirm exact names; they're present for the tracking/eBay calls).

- [ ] **Step 6: Admin queue registry**

- `admin/admin.service.ts`: add `'buyer-message'` to the `ADMIN_QUEUE_NAMES` array.
- `admin/queue-events-collector.service.ts`: add `'buyer-message'` to `OBSERVED_QUEUE_NAMES`.
- `admin/admin.module.ts`: add `{ name: 'buyer-message' }` to the `BullModule.registerQueue([...])` list (mirror `order-sync`).
- `admin/admin.controller.ts`: add `@InjectQueue('buyer-message') private readonly buyerMessageQueue: Queue` to the constructor and `{ name: 'buyer-message', queue: this.buyerMessageQueue }` to the queues list (mirror the existing entries).

- [ ] **Step 7: Confirm exact imported names**

While wiring, confirm the real export names for: `AuthenticatedRequest` (auth types), `LocalTrackingConverter.mapCarrier` (tracking-converter.ts), and the genuine-insert variables in `order-sync.service.ts`. Adjust imports to match — do not invent names.

- [ ] **Step 8: Verify (typecheck + lint + boot)**

Run: `pnpm typecheck && pnpm lint`
Then boot the API: `pnpm dev:api` — confirm it starts with no DI errors and `buyer-message` queue registers. Tail logs for the BullMQ queue registration.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/buyer-messaging/buyer-messaging.module.ts \
        apps/api/src/modules/orders orders.module.ts order-sync.service.ts \
        apps/api/src/modules/amazon amazon.module.ts amazon-tracking-processor.service.ts \
        apps/api/src/app.module.ts apps/api/src/modules/admin \
        apps/api/.env.example
git commit -m "feat(buyer-messaging): module, triggers (received/shipped/delivered/feedback), admin registry"
```
(Stage the specific files actually changed; the paths above are illustrative — `git add` the real modified paths.)

---

## Task 12: i18n keys (seller-facing UI)

**Files:**
- Modify: `packages/shared/src/i18n/resources/en/translation.json`
- Modify: `packages/shared/src/i18n/resources/tr/translation.json`

- [ ] **Step 1: Add EN keys under `storeSettings.messaging` + `messaging`**

```json
"storeSettings": { "messaging": {
  "title": "Buyer messages",
  "subtitle": "Automatically message buyers at key order moments. Optional and per event.",
  "masterEnable": "Enable automated buyer messages",
  "shippedWarning": "eBay already sends a tracking notification when you mark an order shipped. Sending another is optional.",
  "delayDays": "Delay (days)",
  "events": {
    "order_received": "Order received",
    "shipped": "Shipped",
    "delivered": "Delivered",
    "feedback_request": "Feedback request"
  },
  "templateSource": "Template",
  "systemTemplate": "Default",
  "customTemplate": "Custom",
  "manageTemplates": "Manage custom templates"
}},
"messaging": {
  "templates": {
    "new": "New template", "name": "Name", "body": "Message body", "event": "Event",
    "placeholders": "Insert placeholder", "preview": "Preview", "save": "Save",
    "delete": "Delete", "deleteConfirm": "Delete this template?", "empty": "No custom templates yet."
  }
}
```

- [ ] **Step 2: Add TR equivalents** (mirror the same keys in `tr/translation.json`, translated). Example:
```json
"storeSettings": { "messaging": {
  "title": "Alıcı mesajları",
  "subtitle": "Önemli sipariş anlarında alıcıya otomatik mesaj gönderin. Opsiyonel, olay bazlı.",
  "masterEnable": "Otomatik alıcı mesajlarını etkinleştir",
  "shippedWarning": "Siparişi shipped olarak işaretlediğinizde eBay zaten tracking bildirimi gönderir. Ek mesaj opsiyoneldir.",
  "delayDays": "Gecikme (gün)",
  "events": { "order_received": "Sipariş alındı", "shipped": "Kargolandı", "delivered": "Teslim edildi", "feedback_request": "Geri bildirim isteği" },
  "templateSource": "Şablon", "systemTemplate": "Varsayılan", "customTemplate": "Özel",
  "manageTemplates": "Özel şablonları yönet"
}},
"messaging": {
  "templates": {
    "new": "Yeni şablon", "name": "Ad", "body": "Mesaj içeriği", "event": "Olay",
    "placeholders": "Yer tutucu ekle", "preview": "Önizleme", "save": "Kaydet",
    "delete": "Sil", "deleteConfirm": "Bu şablon silinsin mi?", "empty": "Henüz özel şablon yok."
  }
}
```

- [ ] **Step 3: Rebuild shared**

Run: `pnpm --filter @repo/shared build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/i18n/resources/en/translation.json packages/shared/src/i18n/resources/tr/translation.json
git commit -m "i18n(buyer-messaging): add EN+TR seller-facing strings"
```

---

## Task 13: FE — RTK Query API slice

**Files:**
- Create: `apps/web/src/features/buyer-messaging/api/buyer-messaging.api.ts`
- Modify: `apps/web/src/features/store-settings/api/store-settings.api.ts` (or the existing settings api file)

**Interfaces:**
- Produces: `useGetBuyerMessagingConfigQuery`, `useUpdateBuyerMessagingConfigMutation`, `useGetBuyerMessageTemplatesQuery`, `useCreateBuyerMessageTemplateMutation`, `useUpdateBuyerMessageTemplateMutation`, `useDeleteBuyerMessageTemplateMutation`.

- [ ] **Step 1: Template CRUD endpoints**

```ts
// apps/web/src/features/buyer-messaging/api/buyer-messaging.api.ts
import { baseApi } from '../../../app/store';
import {
  BuyerMessageEventType, BuyerMessageTemplate, BuyerMessagingConfig,
} from '@repo/shared';

export const buyerMessagingApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getTemplates: b.query<BuyerMessageTemplate[], { eventType?: BuyerMessageEventType } | void>({
      query: (args) => ({ url: '/v1/buyer-messaging/templates', params: args?.eventType ? { eventType: args.eventType } : undefined }),
      providesTags: ['BuyerMessageTemplates'],
    }),
    createTemplate: b.mutation<BuyerMessageTemplate, Partial<BuyerMessageTemplate> & { eventType: BuyerMessageEventType; name: string; body: string }>({
      query: (body) => ({ url: '/v1/buyer-messaging/templates', method: 'POST', body }),
      invalidatesTags: ['BuyerMessageTemplates'],
    }),
    updateTemplate: b.mutation<BuyerMessageTemplate, { id: string; body: Partial<BuyerMessageTemplate> }>({
      query: ({ id, body }) => ({ url: `/v1/buyer-messaging/templates/${id}`, method: 'PUT', body }),
      invalidatesTags: ['BuyerMessageTemplates'],
    }),
    deleteTemplate: b.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/v1/buyer-messaging/templates/${id}`, method: 'DELETE' }),
      invalidatesTags: ['BuyerMessageTemplates'],
    }),
  }),
});

export const {
  useGetTemplatesQuery: useGetBuyerMessageTemplatesQuery,
  useCreateTemplateMutation: useCreateBuyerMessageTemplateMutation,
  useUpdateTemplateMutation: useUpdateBuyerMessageTemplateMutation,
  useDeleteTemplateMutation: useDeleteBuyerMessageTemplateMutation,
} = buyerMessagingApi;
```

Add `'BuyerMessageTemplates'` to the app's `tagTypes` array in `apps/web/src/app/store.ts` (where `baseApi` is created).

- [ ] **Step 2: Config endpoints** (in the store-settings api file, `injectEndpoints`)

```ts
getBuyerMessagingConfig: builder.query<BuyerMessagingConfig | null, string | undefined>({
  query: (storeId) => ({ url: '/v1/store-settings/buyer-messaging', params: storeId ? { storeId } : undefined }),
  providesTags: ['BuyerMessagingConfig'],
}),
updateBuyerMessagingConfig: builder.mutation<{ ok: boolean }, BuyerMessagingConfig>({
  query: (body) => ({ url: '/v1/store-settings/buyer-messaging', method: 'PUT', body }),
  invalidatesTags: ['BuyerMessagingConfig'],
}),
```
with hooks `useGetBuyerMessagingConfigQuery` / `useUpdateBuyerMessagingConfigMutation`, and add `'BuyerMessagingConfig'` to `tagTypes`.

- [ ] **Step 3: Verify (typecheck + lint)**

Run: `pnpm --filter @repo/shared build && pnpm typecheck && pnpm lint`
Expected: clean (pre-existing web errors aside).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/buyer-messaging/api/buyer-messaging.api.ts apps/web/src/features/store-settings/api apps/web/src/app/store.ts
git commit -m "feat(buyer-messaging): RTK Query endpoints for config + templates"
```

---

## Task 14: FE — StoreSettings "Buyer messages" section

**Files:**
- Create: `apps/web/src/features/store-settings/buyer-messaging/BuyerMessagingSection.{container,component,style,types}.tsx`
- Modify: the StoreSettings drawer/page to render `<BuyerMessagingSection />` inside the settings hub (mirror where `amazonTaxRate`/`autoFulfill` rows render).

**Constraints:** `.component.tsx` = markup only (`useTranslation`/`useTheme` only); `.container.tsx` = all logic; `.style.ts` = styled; `.types.ts` = types. Use atoms/molecules from `@repo/ui` (Toggle, Select, Text, etc.). No hardcoded colors/strings.

- [ ] **Step 1: `types.ts`**

```ts
// BuyerMessagingSection.types.ts
import { BuyerMessageEventType, BuyerMessagingConfig, BuyerMessageTemplate } from '@repo/shared';
export interface BuyerMessagingSectionProps {
  config: BuyerMessagingConfig | null;
  templates: BuyerMessageTemplate[];
  onToggleMaster: (enabled: boolean) => void;
  onToggleEvent: (event: BuyerMessageEventType, enabled: boolean) => void;
  onPickTemplate: (event: BuyerMessageEventType, kind: 'system' | 'custom', templateId: string) => void;
  onChangeDelayDays: (event: BuyerMessageEventType, delayDays: number) => void;
  onOpenTemplates: () => void;
  saving: boolean;
}
```

- [ ] **Step 2: `component.tsx`** (markup only) — renders master Toggle, four event rows (Toggle + template Select + delayDays input for feedback_request), the shipped warning Text, and the "Manage templates" Button. Wire every string through `t('storeSettings.messaging.*')`. No hooks beyond `useTranslation`.

- [ ] **Step 3: `container.tsx`** — `useGetBuyerMessagingConfigQuery`, `useUpdateBuyerMessagingConfigMutation`, `useGetBuyerMessageTemplatesQuery`, local draft state, `onSave`, `useLoading(saving)`; returns `<BuyerMessagingSection ...props />`. Builds the PATCHed `BuyerMessagingConfig` from the draft on each change and debounces/mutations on save.

- [ ] **Step 4: `style.ts`** — Emotion styled wrappers using `tkn()` tokens only.

- [ ] **Step 5: Mount it** in the StoreSettings drawer/section list (mirror where existing toggles like `autoFulfillEnabled` appear).

- [ ] **Step 6: Verify (typecheck + lint)**

Run: `pnpm --filter @repo/ui build && pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/store-settings/buyer-messaging apps/web/src/features/store-settings
git commit -m "feat(buyer-messaging): StoreSettings buyer-messages section"
```

---

## Task 15: FE — Custom template manager

**Files:**
- Create: `apps/web/src/features/store-settings/buyer-messaging/BuyerMessageTemplateManager.{container,component,style,types}.tsx`

**Constraints:** use the existing `Textarea` atom (`@repo/ui`) for the body editor. Placeholder chips insert `{{token}}` into the body via the container's draft state. Live preview calls `renderTemplate` — but that helper lives in the API (Node); re-implement a tiny FE-only render in the container (or export `renderTemplate` from `@repo/shared` if pure — it IS pure, so move it to `packages/shared` and share). Prefer: **move `renderTemplate` to `packages/shared/src/domain/buyer-messaging/buyer-messaging.helpers.ts`** and have both the API helper and FE import it (DRY).

- [ ] **Step 1: Move `renderTemplate` to shared**

Move the `renderTemplate` function (Task 2) into `packages/shared/src/domain/buyer-messaging/buyer-messaging.helpers.ts`, re-export from the domain barrel, and have the API's `buyer-message-helpers.ts` re-export it (`export { renderTemplate } from '@repo/shared'`). Keep the API-side tests pointing at the shared export. Rebuild shared.

- [ ] **Step 2: `types.ts` / `component.tsx` / `container.tsx` / `style.ts`**

- Container: `useGetBuyerMessageTemplatesQuery`, `useCreate/Update/Delete` mutations; draft for the editing template; preview via `renderTemplate(draft.body, sampleContext)`.
- Component: a list of templates (Select to pick one to edit or "New"), name input (`ModernTextInput`), event Select, body `Textarea`, placeholder chip row (clicking inserts at end / appends), preview pane (`Text`), Save + Delete buttons.
- All strings via `t('messaging.templates.*')`. Atoms only. No hardcoded tokens.

- [ ] **Step 3: Verify (typecheck + lint)**

Run: `pnpm --filter @repo/shared build && pnpm --filter @repo/ui build && pnpm typecheck && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/domain/buyer-messaging/buyer-messaging.helpers.ts packages/shared/src/domain/index.ts \
        apps/api/src/modules/buyer-messaging/buyer-message-helpers.ts \
        apps/web/src/features/store-settings/buyer-messaging/BuyerMessageTemplateManager.*
git commit -m "feat(buyer-messaging): custom template manager UI + shared renderTemplate"
```

---

## Task 16: Build, manual verify, finalize

- [ ] **Step 1: Full build + quality**

Run: `pnpm build && pnpm validate`
Expected: build succeeds; `pnpm validate` (lint + typecheck) clean (excluding known pre-existing web TS errors).

- [ ] **Step 2: Run the pure-helper tests**

Run: `pnpm --filter api test`
Expected: all green (incl. the moved `renderTemplate` tests).

- [ ] **Step 3: Manual end-to-end (requires `BUYER_MESSAGING_ENABLED=true` + a real eBay account token)**

1. Boot API + web + docker. Set `BUYER_MESSAGING_ENABLED=true`.
2. In Store Settings → Buyer messages: enable master + `order_received`; pick system template; Save. Confirm `store_settings.buyer_messaging` row via DB.
3. Create a custom template for `delivered`; assign it; Save.
4. Ingest a test order (or wait for order-sync). Confirm a `buyer-message` job enqueued and `buyer_message_log` gets a `sent` row (or `failed` with redacted error if eBay rejects — investigate provider shape, per Task 5 note).
5. Re-run the same order sync → confirm NO duplicate (idempotency guard).
6. Disable an event in settings → re-trigger → confirm `skipped` log row and no eBay send.

- [ ] **Step 4: Update CLAUDE.md**

Add a concise "Buyer Auto-Messaging" subsection under Domain Concepts: trigger events, config location (`store_settings.buyer_messaging`), provider port + Message API, idempotency log, env switches (`BUYER_MESSAGING_ENABLED` default false), and the `Textarea`/`MessageComposer` reuse. Add migration `054` to the migrations table. Note it as implemented.

- [ ] **Step 5: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs(buyer-messaging): document feature in CLAUDE.md"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** every spec section maps to a task — data model (T3), shared types (T1), helpers (T2), provider (T5), template repo (T6), store-settings integration (T7), service (T8), queue/processor/idempotency (T9), controller (T10), module+triggers+admin (T11), i18n (T12), FE api (T13), FE settings (T14), FE template manager (T15), verify+docs (T16). Open items §14 resolved: Textarea exists (no creation), token accessor added (T4), ebay_accounts.id=UUID (T3 DDL), sendMessage shape confirm-deferred to T5 with port isolation.
- **Type consistency:** `BuyerMessageQueueService.enqueue` data shape matches the processor's `BuyerMessageJobData`. `resolveTemplate` return matches processor usage. `BUYER_MESSAGE_TOKEN` DI matches `@Inject`. FK types UUID throughout.
- **Placeholder scan:** no TBD/TODO left except the explicitly-scoped "confirm exact eBay Message API field shape" in T5 (genuine external unknown, isolated by the port) and the "confirm exact imported names" in T11 Step 7 (names that exist in the codebase — the implementer copies the real ones). Both are verification steps, not undefined design.
- **One known follow-up (not a blocker):** `saveConfig` writes the GLOBAL row only; per-store config writes via the existing `saveSettings(storeId)` path are wired when the FE needs per-store editing (resolution already supports per-store reads).
