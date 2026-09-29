# eBay Messages (inbox + NEW_MESSAGE webhook) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seller reads and answers their eBay messages inside SellerHill (`/:locale/messages`, same folders as eBay: From members / From eBay × All / Unread / Archive), with an unread badge fed by eBay's `NEW_MESSAGE` webhook, and the existing buyer auto-messaging finally sends through the real Message API.

**Architecture:** Two new backend units — `modules/ebay/notifications/` (destination + per-store subscription + signed webhook receiver, inside `EbayModule` because it rides the account lifecycle) and `modules/ebay-messages/` (typed Message API client, ownership-checked controller, unread bookkeeping; `BuyerMessagingModule` reuses its client). Conversations are read live from eBay; only per-store unread counters and the notification inbox are persisted. Web: one new feature `features/messages/` with the standard 4-file split, one nav item with a badge polled from OUR endpoint.

**Tech Stack:** NestJS 10 + `pg` + BullMQ (unchanged), axios via `withEbayRateLimitRetry`, Node `crypto` (ECDSA/SHA1 verify), React 18 + RTK Query + Emotion, `@repo/ui` atoms (`MessageComposer`, `TabNav`, `Dropdown`, `EmptyState`, `Checkbox`, `Badge`), i18next (15 locales).

**Spec:** `docs/superpowers/specs/2026-09-29-ebay-messages-design.md`

## Global Constraints

- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- No `any`; all domain types/enums in `packages/shared/src/domain/`; no string literals for statuses — use the enums defined in Task 1.
- Every Message API call acquires `EbayApiResource.MESSAGE`; every Notification API call acquires `EbayApiResource.NOTIFICATION` (Task 1 adds both). Interactive seller actions use `EbayCallPriority.INTERACTIVE`; webhook/bootstrap use `BACKGROUND`.
- `conversation_type` is REQUIRED on every Message API read; `limit` ≤ 50; `messageText` ≤ 2000 chars; bulk update ≤ 10 ids.
- Nothing about message bodies is written to our DB (spec D2). The webhook stores the payload it received in `ebay_notification_events.payload` for diagnostics only (retention 90 d) — never read back into the UI.
- Web: strict 4-file split (`.component.tsx` may use only `useTranslation`/`useTheme`), no hardcoded colours/spacing/strings, all copy via i18n in ALL 15 locales (`en,tr,ru,hi,ur,ar,az,de,fr,es,it,ro,uk,zh,pt`), Turkish written natively; check the page at a 375 px viewport; RTL (`ur`, `ar`) — no hard-positioned elements without a `/ar` check.
- `@repo/shared` and `@repo/ui` load from `dist/`: run `pnpm --filter @repo/shared build` (and `@repo/ui build` after Task 12's icon change) before the api/web see a change.
- Never edit an applied migration; the new one is `125_ebay_messages.sql`.
- Webhook endpoint: public (no `JwtAuthGuard`), `@SkipThrottle()`, answers the GET challenge with `{ challengeResponse }` + 200 and a verified POST with **204**; signature failure is **412**.
- Backend pure helpers get Jest specs under `apps/api` (`pnpm --filter api test -- <pattern>`); run `pnpm lint` and `pnpm typecheck` before the final commit of every task that touches TS.

## Review Focus

1. A `NEW_MESSAGE` delivery whose `recipientUserName` is the immutable id of a store that is `disconnected` (tokens NULL) → the row must still resolve (status is not a filter), nothing is incremented because status ≠ active, the event is stored with outcome `inactive_account`, and the receiver still answers 204. (Task 5 test `ignores a delivery for a disconnected store but still stores it`.)
2. eBay re-delivers the same `notificationId` (attempt 2/3) after we already counted it → the unread counter must not move twice. (Task 6 test `a redelivered notification does not double-count`.)
3. `X-EBAY-SIGNATURE` present but `kid` unknown to eBay (404 on `public_key`) → 412, nothing stored beyond the raw capture, no crash. (Task 6 test.)
4. A reply of exactly 2000 characters is accepted; 2001 is refused client-side AND server-side with `ebay.errors.messageTooLong`, never sent to eBay. (Task 9 test + Task 13 composer `maxLength`.)
5. The seller opens `/messages` for a store whose `granted_scopes` lacks `commerce.message` → the page shows the reconnect prompt and makes NO conversation call. (Task 13 container test-by-inspection: `skip` on the query when `!messagingEnabled`.)

---

### Task 1: Shared types, enums and budget resources

**Files:**
- Modify: `packages/shared/src/domain/ebay/ebay-call-budget.types.ts` (enum `EbayApiResource`)
- Modify: `packages/shared/src/domain/ebay/ebay.constants.ts` (`DEFAULT_SCOPES`)
- Modify: `packages/shared/src/domain/ebay/ebay.dto.ts` (`EbayAccountPublicDto`)
- Create: `packages/shared/src/domain/ebay-messages/ebay-messages.types.ts`, `ebay-messages.dto.ts`, `index.ts`
- Create: `packages/shared/src/schemas/ebay-messages/ebay-messages.schema.ts`, `index.ts`
- Modify: `packages/shared/src/domain/index.ts`, `packages/shared/src/schemas/index.ts` (re-exports — follow how `buyer-messaging` is exported there)
- Modify: `packages/shared/src/domain/action-center/action-center.types.ts` (`ActionCenterItemKey`)
- Modify: `packages/shared/src/domain/admin/admin.types.ts` (`AdminWarningKind`)
- Modify: `apps/api/src/common/ebay-budget/ebay-rate-limits.ts` (`RESOURCE_SOURCE`)
- Test: `apps/api/src/common/ebay-budget/ebay-rate-limits.spec.ts` (extend the `it.each`)

**Interfaces (Produces):**
```ts
// ebay-call-budget.types.ts
MESSAGE = 'commerce.message',
NOTIFICATION = 'commerce.notification',

// ebay-messages.types.ts
export enum EbayConversationType { FROM_MEMBERS = 'FROM_MEMBERS', FROM_EBAY = 'FROM_EBAY' }
export enum EbayConversationStatus { ACTIVE = 'ACTIVE', ARCHIVE = 'ARCHIVE', DELETE = 'DELETE', READ = 'READ', UNREAD = 'UNREAD' }
/** What a seller may SET through update/bulk-update (READ/UNREAD go through the `read` flag). */
export type EbayConversationMutableStatus = EbayConversationStatus.ACTIVE | EbayConversationStatus.ARCHIVE | EbayConversationStatus.DELETE;
export enum EbayMessageMediaType { IMAGE = 'IMAGE', PDF = 'PDF', DOC = 'DOC', TXT = 'TXT' }
export const EBAY_MESSAGE_MAX_LENGTH = 2000;
export const EBAY_CONVERSATIONS_MAX_LIMIT = 50;
export const EBAY_BULK_CONVERSATIONS_MAX = 10;
export const EBAY_MESSAGING_SCOPES = [
  'https://api.ebay.com/oauth/api_scope/commerce.message',
  'https://api.ebay.com/oauth/api_scope/commerce.notification.subscription',
] as const;
export function hasMessagingScopes(granted: readonly string[] | null | undefined): boolean {
  if (!granted) return false;
  return EBAY_MESSAGING_SCOPES.every((s) => granted.includes(s));
}
export interface EbayMessageMediaDto { mediaName: string; mediaType: EbayMessageMediaType | string; mediaUrl: string }
export interface EbayMessageDto { messageId: string; subject: string | null; body: string; senderUsername: string; recipientUsername: string; read: boolean; createdAt: string; media: EbayMessageMediaDto[] }
export interface EbayConversationDto { conversationId: string; type: EbayConversationType; status: EbayConversationStatus; title: string | null; unreadCount: number; referenceType: string | null; referenceId: string | null; createdAt: string; latestMessage: EbayMessageDto | null; otherPartyUsername: string | null }
export interface PaginatedConversationsDto { items: EbayConversationDto[]; total: number; page: number; limit: number }
export interface EbayConversationThreadDto { conversationId: string; type: EbayConversationType; status: EbayConversationStatus; title: string | null; messages: EbayMessageDto[]; total: number; page: number; limit: number }
export interface EbayUnreadCountDto { total: number; byAccount: Array<{ ebayAccountId: string; unread: number }> }
export interface EbaySendMessageResultDto { messageId: string }

// ebay-messages.schema.ts (zod)
export const ebayConversationsQuerySchema = z.object({ ebayAccountId: z.string().uuid(), type: z.nativeEnum(EbayConversationType), status: z.nativeEnum(EbayConversationStatus).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(EBAY_CONVERSATIONS_MAX_LIMIT).default(25) });
export const ebayReplyMessageSchema = z.object({ ebayAccountId: z.string().uuid(), type: z.nativeEnum(EbayConversationType), text: z.string().trim().min(1).max(EBAY_MESSAGE_MAX_LENGTH) });
export const ebayConversationReadSchema = z.object({ ebayAccountId: z.string().uuid(), type: z.nativeEnum(EbayConversationType), read: z.boolean() });
export const ebayBulkConversationStatusSchema = z.object({ ebayAccountId: z.string().uuid(), type: z.nativeEnum(EbayConversationType), conversationIds: z.array(z.string().min(1)).min(1).max(EBAY_BULK_CONVERSATIONS_MAX), status: z.enum([EbayConversationStatus.ACTIVE, EbayConversationStatus.ARCHIVE, EbayConversationStatus.DELETE]) });
export type EbayConversationsQuery = z.infer<typeof ebayConversationsQuerySchema>; // + the other three inferred types

// EbayAccountPublicDto gains:
messagingEnabled!: boolean;   // granted_scopes ⊇ EBAY_MESSAGING_SCOPES

// ActionCenterItemKey gains:
EBAY_ACCOUNT_MESSAGING_SCOPE_MISSING = 'ebay_account_messaging_scope_missing',
// AdminWarningKind gains:
EBAY_NOTIFICATIONS_DISABLED = 'ebay_notifications_disabled',
```

- [ ] **Step 1: Add the two enum members and `RESOURCE_SOURCE` rows**

```ts
// ebay-call-budget.types.ts — after FEED
  /** eBay Message API (seller inbox, replies, buyer auto-messages). 500,000/day measured 2026-09-29. */
  MESSAGE = 'commerce.message',
  /** eBay Notification API — destination/subscription/public-key management only; inbound deliveries are not metered. 10,000/day. */
  NOTIFICATION = 'commerce.notification',
```
```ts
// ebay-rate-limits.ts RESOURCE_SOURCE
  [EbayApiResource.MESSAGE]: { trading: false, name: 'commerce.message' },
  [EbayApiResource.NOTIFICATION]: { trading: false, name: 'commerce.notification' },
```

- [ ] **Step 2: Extend the rate-limits spec fixture**

In `ebay-rate-limits.spec.ts`, add to the fixture `resources` two entries shaped like the existing non-trading ones: `{ resourceName: 'commerce.message', windows: [{ limit: 500000, timeWindowSeconds: 86400 }] }` and `{ resourceName: 'commerce.notification', windows: [{ limit: 10000, timeWindowSeconds: 86400 }] }` (copy the exact field names the fixture already uses), and two `it.each` rows asserting `byResource[EbayApiResource.MESSAGE]?.daily?.limit === 500000` and `…NOTIFICATION… === 10000`. Run: `pnpm --filter api test -- ebay-rate-limits` → PASS (and the "unmapped" assertion still passes because the names are now mapped).

- [ ] **Step 3: Scopes + DTO**

`DEFAULT_SCOPES` gains the two `EBAY_MESSAGING_SCOPES` URLs (import the constant from the new domain file to keep ONE list). `EbayAccountPublicDto` gains `messagingEnabled!: boolean;` with the comment `/** granted_scopes carries both messaging scopes (migration 125). False for stores connected before 2026-09-29 until they reconnect. */`.

- [ ] **Step 4: Domain + schema files**

Write the files exactly as in Interfaces. Export from `packages/shared/src/domain/index.ts` and `schemas/index.ts` the same way `buyer-messaging` is. Add the two enum members to `ActionCenterItemKey` / `AdminWarningKind`.

- [ ] **Step 5: Build + verify**

Run: `pnpm --filter @repo/shared build && pnpm --filter api test -- ebay-rate-limits ebay-call-budget && pnpm typecheck`
Expected: PASS; typecheck reports NO new errors in `apps/api`/`packages/shared` (the web app carries pre-existing ones — compare counts before/after).

- [ ] **Step 6: Commit** — `feat(shared): eBay Messages domain types, messaging scopes and budget resources`

---

### Task 2: Migration 125

**Files:**
- Create: `apps/api/migrations/125_ebay_messages.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 125: eBay Messages — messaging scopes on the store row, unread counter,
-- NEW_MESSAGE subscription bookkeeping, notification destination + inbox.
-- See docs/superpowers/specs/2026-09-29-ebay-messages-design.md.
BEGIN;

ALTER TABLE ebay_accounts
  ADD COLUMN IF NOT EXISTS granted_scopes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS unread_message_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unread_message_synced_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS message_subscription_id VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS message_subscription_at TIMESTAMPTZ NULL;

-- One row per (environment, endpoint). The destination is APPLICATION-level on
-- eBay's side (one for all sellers); we keep the id eBay minted so a restart
-- never re-creates it.
CREATE TABLE IF NOT EXISTS ebay_notification_destinations (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  environment     VARCHAR(20)  NOT NULL,
  endpoint_url    TEXT         NOT NULL,
  destination_id  VARCHAR(100) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (environment, endpoint_url)
);

-- Every signature-verified delivery, once. notification_id is eBay's own id and
-- is what makes a retried delivery (same id, higher publishAttemptCount) a
-- no-op instead of a second unread increment.
CREATE TABLE IF NOT EXISTS ebay_notification_events (
  id                BIGSERIAL PRIMARY KEY,
  notification_id   VARCHAR(120) NOT NULL UNIQUE,
  topic             VARCHAR(60)  NOT NULL,
  ebay_account_id   UUID NULL REFERENCES ebay_accounts(id) ON DELETE SET NULL,
  conversation_id   VARCHAR(120) NULL,
  conversation_type VARCHAR(20)  NULL,
  outcome           VARCHAR(30)  NOT NULL,
  payload           JSONB        NOT NULL,
  event_at          TIMESTAMPTZ  NULL,
  received_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ebay_notification_events_received ON ebay_notification_events (received_at DESC);
CREATE INDEX IF NOT EXISTS idx_ebay_notification_events_account ON ebay_notification_events (ebay_account_id, received_at DESC);

-- Verbatim capture of every POST that reaches the receiver, before any decision
-- (same role as tracking_webhook_raw_captures, migration 090): a future shape
-- change shows up as parsed_ok = false / signature_ok = false, not as silence.
CREATE TABLE IF NOT EXISTS ebay_notification_raw_captures (
  id            BIGSERIAL PRIMARY KEY,
  headers       JSONB       NOT NULL DEFAULT '{}',
  body          TEXT        NOT NULL,
  signature_ok  BOOLEAN     NOT NULL,
  parsed_ok     BOOLEAN     NOT NULL,
  received_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ebay_notification_raw_captures_received ON ebay_notification_raw_captures (received_at DESC);

COMMIT;
```

- [ ] **Step 2: Verify against a stock Postgres if Docker is available** (`docker run --rm -d --name shtest -e POSTGRES_PASSWORD=x -e POSTGRES_DB=testdb postgres:18-alpine`, `CREATE ROLE sellerhill_user LOGIN;`, pipe every migration in order through `psql -v ON_ERROR_STOP=1`). If Docker is not running, note it in the commit body and rely on the boot-time runner in Task 16.

- [ ] **Step 3: Commit** — `feat(db): migration 125 — eBay messaging scopes, unread counter, notification inbox`

---

### Task 3: Extract the application-token minter

**Files:**
- Create: `apps/api/src/common/ebay-budget/ebay-application-token.service.ts`
- Modify: `apps/api/src/common/ebay-budget/ebay-analytics.service.ts` (use the new service; delete its private `applicationToken` + `token` field)
- Modify: `apps/api/src/common/ebay-budget/ebay-budget.module.ts` (provide + export)
- Test: `apps/api/src/common/ebay-budget/ebay-application-token.service.spec.ts`; keep `ebay-analytics.service.spec.ts` green (it asserts the token body contains `grant_type=client_credentials` — move that assertion to the new spec if it now fails because the fetch is made by the extracted service).

**Interfaces (Produces):**
```ts
@Injectable()
export class EbayApplicationTokenService {
  /** Client-credentials token for `https://api.ebay.com/oauth/api_scope`, cached until 60 s before expiry. Throws on a non-2xx token response. */
  async get(): Promise<string>;
  /** `EBAY_REST_API_URL` without a trailing slash (defaults to https://api.ebay.com). */
  restBase(): string;
  /** `EBAY_ENVIRONMENT` ('sandbox' | 'production'), used as the destinations table key. */
  environment(): string;
}
```

- [ ] **Step 1: Write the failing spec**

```ts
import { ConfigService } from '@nestjs/config';
import { EbayApplicationTokenService } from './ebay-application-token.service';

function config(values: Record<string, string>): ConfigService {
  return { get: (k: string) => values[k] } as unknown as ConfigService;
}

describe('EbayApplicationTokenService', () => {
  const values = { EBAY_CLIENT_ID: 'id', EBAY_CLIENT_SECRET: 'secret', EBAY_TOKEN_URL: 'https://t/x', EBAY_REST_API_URL: 'https://api.sandbox.ebay.com/', EBAY_ENVIRONMENT: 'sandbox' };
  afterEach(() => jest.restoreAllMocks());

  it('mints a client-credentials token and caches it', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ access_token: 'tok', expires_in: 7200 }), { status: 200 }));
    const svc = new EbayApplicationTokenService(config(values));
    expect(await svc.get()).toBe('tok');
    expect(await svc.get()).toBe('tok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = String((fetchMock.mock.calls[0][1] as RequestInit).body);
    expect(body).toContain('grant_type=client_credentials');
    expect(svc.restBase()).toBe('https://api.sandbox.ebay.com');
    expect(svc.environment()).toBe('sandbox');
  });

  it('throws when eBay refuses the token', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('nope', { status: 401 }));
    await expect(new EbayApplicationTokenService(config(values)).get()).rejects.toThrow(/401/);
  });

  it('throws when credentials are missing', async () => {
    await expect(new EbayApplicationTokenService(config({})).get()).rejects.toThrow(/not configured/);
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter api test -- ebay-application-token` → FAIL (module not found).

- [ ] **Step 3: Implement** by moving the body of `EbayAnalyticsService.applicationToken` (see that file lines ~116-140) into `get()`: read `EBAY_CLIENT_ID/SECRET/TOKEN_URL` via `this.config.get<string>(k)?.trim()`; throw `new Error('eBay credentials not configured')` when any is missing; keep `TOKEN_SAFETY_MS = 60_000` and the 10 s `AbortSignal.timeout`. `restBase()` = `(this.config.get<string>('EBAY_REST_API_URL')?.trim() || 'https://api.ebay.com').replace(/\/+$/, '')`. `environment()` = `this.config.get<string>('EBAY_ENVIRONMENT')?.trim() || 'production'`. In `EbayAnalyticsService`, inject it and replace `const token = await this.applicationToken(...)` with `await this.appToken.get()`; delete the private method + `token` field; update its constructor call sites in `ebay-analytics.service.spec.ts`. Register in `ebay-budget.module.ts` `providers` + `exports`.

- [ ] **Step 4: Run** `pnpm --filter api test -- ebay-budget` → all PASS.

- [ ] **Step 5: Commit** — `refactor(ebay): extract EbayApplicationTokenService from the analytics refresher`

---

### Task 4: Notification signature + payload helpers (pure)

**Files:**
- Create: `apps/api/src/modules/ebay/notifications/ebay-notification-signature.ts`
- Create: `apps/api/src/modules/ebay/notifications/ebay-notification.helpers.ts`
- Test: `apps/api/src/modules/ebay/notifications/ebay-notification-signature.spec.ts`, `ebay-notification.helpers.spec.ts`

**Interfaces (Produces):**
```ts
// ebay-notification-signature.ts
export interface EbaySignatureHeader { alg: string; kid: string; signature: string; digest: string }
/** Base64 JSON `{alg,kid,signature,digest}` → object, or null when malformed. Never throws. */
export function parseSignatureHeader(header: string | undefined): EbaySignatureHeader | null;
/** eBay returns the PEM on one line; Node needs the newlines around the markers. */
export function formatPublicKeyPem(key: string): string;
/** Verifies ECDSA over `digest` (SHA1 default; SHA256 accepted). Tries the raw body first, then JSON.stringify(JSON.parse(raw)) — eBay's SDK verifies the re-serialised body. Returns false, never throws. */
export function verifyNotificationSignature(rawBody: string, header: EbaySignatureHeader, publicKeyPem: string): boolean;

// ebay-notification.helpers.ts
export const NEW_MESSAGE_TOPIC = 'NEW_MESSAGE';
export interface ParsedEbayNotification { notificationId: string; topic: string; eventDate: string | null; publishAttemptCount: number; data: Record<string, unknown> }
export interface NewMessageData { messageId: string; conversationId: string; conversationType: EbayConversationType; recipientUserName: string; senderUserName: string | null; readStatus: boolean }
export function parseNotificationEnvelope(body: unknown): ParsedEbayNotification | null;
export function parseNewMessageData(data: Record<string, unknown>): NewMessageData | null;
/** `/commerce/notification/v1/destination/abc` (or absolute, trailing slash, query) → 'abc'; undefined when unreadable. */
export function extractIdFromLocation(location: unknown): string | undefined;
export function isValidNotificationVerificationToken(token: unknown): token is string; // /^[A-Za-z0-9_-]{32,80}$/
```

- [ ] **Step 1: Write the failing signature spec** — generate a real key pair in the test so no fixture bytes are needed:

```ts
import { createSign, generateKeyPairSync } from 'crypto';
import { formatPublicKeyPem, parseSignatureHeader, verifyNotificationSignature } from './ebay-notification-signature';

function sign(body: string, privateKey: string, digest = 'sha1'): string {
  const s = createSign(digest); s.update(body); return s.sign(privateKey, 'base64');
}
function header(kid: string, signature: string, digest = 'SHA1'): string {
  return Buffer.from(JSON.stringify({ alg: 'ecdsa', kid, signature, digest })).toString('base64');
}

describe('eBay notification signature', () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const oneLine = publicKey.replace(/\n/g, ''); // how eBay returns it
  const body = JSON.stringify({ metadata: { topic: 'NEW_MESSAGE' }, notification: { notificationId: 'n1' } });

  it('parses the Base64 JSON header', () => {
    expect(parseSignatureHeader(header('k1', 'sig'))).toEqual({ alg: 'ecdsa', kid: 'k1', signature: 'sig', digest: 'SHA1' });
    expect(parseSignatureHeader(undefined)).toBeNull();
    expect(parseSignatureHeader('not-base64-json')).toBeNull();
    expect(parseSignatureHeader(Buffer.from('{"alg":"ecdsa"}').toString('base64'))).toBeNull(); // no kid
  });

  it('re-inserts PEM newlines', () => {
    expect(formatPublicKeyPem(oneLine)).toBe(publicKey.trim());
    expect(formatPublicKeyPem(publicKey)).toBe(publicKey.trim());
  });

  it('verifies a SHA1 ECDSA signature over the raw body', () => {
    const h = parseSignatureHeader(header('k1', sign(body, privateKey)))!;
    expect(verifyNotificationSignature(body, h, oneLine)).toBe(true);
  });

  it('accepts a signature made over the re-serialised body (eBay SDK convention)', () => {
    const pretty = JSON.stringify(JSON.parse(body), null, 2);
    const h = parseSignatureHeader(header('k1', sign(body, privateKey)))!;
    expect(verifyNotificationSignature(pretty, h, oneLine)).toBe(true);
  });

  it('honours a SHA256 digest and rejects a tampered body', () => {
    const h = parseSignatureHeader(header('k1', sign(body, privateKey, 'sha256'), 'SHA256'))!;
    expect(verifyNotificationSignature(body, h, oneLine)).toBe(true);
    expect(verifyNotificationSignature(body + ' ', h, oneLine)).toBe(false);
  });

  it('returns false on garbage instead of throwing', () => {
    expect(verifyNotificationSignature(body, { alg: 'ecdsa', kid: 'k', signature: '!!', digest: 'SHA1' }, 'not a key')).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing helpers spec**

```ts
import { EbayConversationType } from '@repo/shared';
import { extractIdFromLocation, isValidNotificationVerificationToken, parseNewMessageData, parseNotificationEnvelope } from './ebay-notification.helpers';

describe('parseNotificationEnvelope', () => {
  it('reads the id, topic and attempt count', () => {
    const p = parseNotificationEnvelope({ metadata: { topic: 'NEW_MESSAGE' }, notification: { notificationId: 'a_b', eventDate: '2026-01-01T00:00:00.000Z', publishAttemptCount: 2, data: { x: 1 } } });
    expect(p).toEqual({ notificationId: 'a_b', topic: 'NEW_MESSAGE', eventDate: '2026-01-01T00:00:00.000Z', publishAttemptCount: 2, data: { x: 1 } });
  });
  it('returns null without an id or topic', () => {
    expect(parseNotificationEnvelope({ notification: { data: {} } })).toBeNull();
    expect(parseNotificationEnvelope(null)).toBeNull();
    expect(parseNotificationEnvelope('x')).toBeNull();
  });
});

describe('parseNewMessageData', () => {
  it('maps the documented fields', () => {
    expect(parseNewMessageData({ messageId: 'm', conversationId: 'c', conversationType: 'FROM_MEMBERS', recipientUserName: 'seller1', senderUserName: 'buyer', readStatus: false })).toEqual({ messageId: 'm', conversationId: 'c', conversationType: EbayConversationType.FROM_MEMBERS, recipientUserName: 'seller1', senderUserName: 'buyer', readStatus: false });
  });
  it('rejects an unknown conversation type or missing recipient', () => {
    expect(parseNewMessageData({ messageId: 'm', conversationId: 'c', conversationType: 'FROM_MARS', recipientUserName: 's' })).toBeNull();
    expect(parseNewMessageData({ messageId: 'm', conversationId: 'c', conversationType: 'FROM_EBAY' })).toBeNull();
  });
});

describe('extractIdFromLocation', () => {
  it.each([
    ['/commerce/notification/v1/destination/abc', 'abc'],
    ['https://api.ebay.com/commerce/notification/v1/subscription/s-1/', 's-1'],
    ['/x/y?z=1', 'y'],
  ])('%s → %s', (loc, id) => expect(extractIdFromLocation(loc)).toBe(id));
  it('is undefined for junk', () => { for (const v of ['', '/', undefined, 3, {}]) expect(extractIdFromLocation(v)).toBeUndefined(); });
});

describe('isValidNotificationVerificationToken', () => {
  it('accepts 32–80 of [A-Za-z0-9_-] only', () => {
    expect(isValidNotificationVerificationToken('a'.repeat(32))).toBe(true);
    expect(isValidNotificationVerificationToken('a'.repeat(31))).toBe(false);
    expect(isValidNotificationVerificationToken('a'.repeat(81))).toBe(false);
    expect(isValidNotificationVerificationToken('a'.repeat(31) + '!')).toBe(false);
  });
});
```

- [ ] **Step 3: Run** `pnpm --filter api test -- ebay-notification` → FAIL.

- [ ] **Step 4: Implement**

```ts
// ebay-notification-signature.ts
import { createVerify } from 'crypto';

export interface EbaySignatureHeader { alg: string; kid: string; signature: string; digest: string }

export function parseSignatureHeader(header: string | undefined): EbaySignatureHeader | null {
  if (!header) return null;
  try {
    const parsed = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) as Record<string, unknown>;
    const kid = parsed.kid, signature = parsed.signature;
    if (typeof kid !== 'string' || !kid || typeof signature !== 'string' || !signature) return null;
    return { alg: typeof parsed.alg === 'string' ? parsed.alg : 'ecdsa', kid, signature, digest: typeof parsed.digest === 'string' ? parsed.digest : 'SHA1' };
  } catch { return null; }
}

const BEGIN = '-----BEGIN PUBLIC KEY-----';
const END = '-----END PUBLIC KEY-----';
export function formatPublicKeyPem(key: string): string {
  const inner = key.replace(BEGIN, '').replace(END, '').replace(/\s+/g, '');
  const lines = inner.match(/.{1,64}/g) ?? [];
  return `${BEGIN}\n${lines.join('\n')}\n${END}`;
}

function digestAlgorithm(digest: string): string {
  return digest.toUpperCase() === 'SHA256' ? 'sha256' : 'sha1';
}

export function verifyNotificationSignature(rawBody: string, header: EbaySignatureHeader, publicKeyPem: string): boolean {
  const pem = formatPublicKeyPem(publicKeyPem);
  const algorithm = digestAlgorithm(header.digest);
  const candidates = [rawBody];
  try { candidates.push(JSON.stringify(JSON.parse(rawBody))); } catch { /* not JSON — raw only */ }
  for (const candidate of candidates) {
    try {
      const verifier = createVerify(algorithm);
      verifier.update(candidate);
      if (verifier.verify(pem, header.signature, 'base64')) return true;
    } catch { /* bad key / bad signature encoding → keep trying, then false */ }
  }
  return false;
}
```
```ts
// ebay-notification.helpers.ts
import { EbayConversationType } from '@repo/shared';

export const NEW_MESSAGE_TOPIC = 'NEW_MESSAGE';
export interface ParsedEbayNotification { notificationId: string; topic: string; eventDate: string | null; publishAttemptCount: number; data: Record<string, unknown> }
export interface NewMessageData { messageId: string; conversationId: string; conversationType: EbayConversationType; recipientUserName: string; senderUserName: string | null; readStatus: boolean }

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);

export function parseNotificationEnvelope(body: unknown): ParsedEbayNotification | null {
  if (!isRecord(body) || !isRecord(body.notification)) return null;
  const metadata = isRecord(body.metadata) ? body.metadata : {};
  const notificationId = str(body.notification.notificationId);
  const topic = str(metadata.topic);
  if (!notificationId || !topic) return null;
  const attempt = body.notification.publishAttemptCount;
  return { notificationId, topic, eventDate: str(body.notification.eventDate), publishAttemptCount: typeof attempt === 'number' ? attempt : 1, data: isRecord(body.notification.data) ? body.notification.data : {} };
}

export function parseNewMessageData(data: Record<string, unknown>): NewMessageData | null {
  const messageId = str(data.messageId), conversationId = str(data.conversationId), recipientUserName = str(data.recipientUserName);
  const type = str(data.conversationType);
  if (!messageId || !conversationId || !recipientUserName || !type) return null;
  if (!(Object.values(EbayConversationType) as string[]).includes(type)) return null;
  return { messageId, conversationId, conversationType: type as EbayConversationType, recipientUserName, senderUserName: str(data.senderUserName), readStatus: data.readStatus === true };
}

export function extractIdFromLocation(location: unknown): string | undefined {
  if (typeof location !== 'string') return undefined;
  const path = location.split('?')[0].replace(/\/+$/, '');
  const last = path.split('/').pop();
  return last && last.length > 0 ? last : undefined;
}

export function isValidNotificationVerificationToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{32,80}$/.test(token);
}
```

- [ ] **Step 5: Run** the two specs → PASS. **Commit** — `feat(ebay): pure helpers for eBay notification signatures and NEW_MESSAGE payloads`

---

### Task 5: Notification client + service (destination, subscription, public keys)

**Files:**
- Create: `apps/api/src/modules/ebay/notifications/ebay-notification.client.ts`
- Create: `apps/api/src/modules/ebay/notifications/ebay-notification.service.ts`
- Test: `apps/api/src/modules/ebay/notifications/ebay-notification.client.spec.ts`, `ebay-notification.service.spec.ts`
- Modify: `apps/api/src/modules/ebay/ebay.module.ts` (providers + exports for both; controller comes in Task 6)

**Interfaces (Produces):**
```ts
// ebay-notification.client.ts — every call: withEbayRateLimitRetry + acquire(EbayApiResource.NOTIFICATION, BACKGROUND)
export class EbayNotificationApiError extends Error { constructor(readonly status: number, readonly errorIds: number[], message: string) }
@Injectable() export class EbayNotificationClient {
  constructor(appToken: EbayApplicationTokenService, budget: EbayCallBudgetService) {}
  putConfig(alertEmail: string): Promise<void>;                                   // PUT /config
  createDestination(input: { name: string; endpoint: string; verificationToken: string }): Promise<string>; // → destinationId from Location; 195021 → throws EbayNotificationApiError(409,[195021])
  listDestinations(): Promise<Array<{ destinationId: string; endpoint: string; status: string }>>;
  getTopic(topicId: string): Promise<{ format: string; schemaVersion: string; deliveryProtocol: string }>; // first supportedPayloads entry
  createSubscription(userToken: string, input: { topicId: string; destinationId: string; payload: { format: string; schemaVersion: string; deliveryProtocol: string } }): Promise<string>; // → subscriptionId; 195012 → throws EbayNotificationApiError(409,[195012])
  listSubscriptions(userToken: string): Promise<Array<{ subscriptionId: string; topicId: string; destinationId: string; status: string }>>;
  deleteSubscription(userToken: string, subscriptionId: string): Promise<void>;
  getPublicKey(kid: string): Promise<{ key: string; algorithm: string; digest: string }>;
}

// ebay-notification.service.ts
export interface NotificationDeliveryOutcome { stored: boolean; outcome: 'counted' | 'duplicate' | 'no_account' | 'inactive_account' | 'already_read' | 'ignored' | 'test' }
@Injectable() export class EbayNotificationService implements OnApplicationBootstrap {
  constructor(client: EbayNotificationClient, db: DatabaseService, config: ConfigService, appToken: EbayApplicationTokenService) {}
  /** false when EBAY_NOTIFICATION_VERIFICATION_TOKEN or EBAY_NOTIFICATION_ALERT_EMAIL is missing/invalid. */
  isEnabled(): boolean;
  verificationToken(): string | null;
  endpointUrl(): string;                              // EBAY_NOTIFICATION_ENDPOINT_URL || `${FRONTEND_URL w/o trailing /}/api/v1/ebay/notifications`
  onApplicationBootstrap(): void;                     // setTimeout(20s) → ensureDestination() best-effort, only when isEnabled()
  ensureDestination(): Promise<string | null>;        // cached in memory + ebay_notification_destinations
  subscribeAccount(ebayAccountId: string, userToken: string): Promise<'created' | 'existing' | 'scope_missing' | 'disabled' | 'failed'>;
  unsubscribeAccount(ebayAccountId: string, userToken: string): Promise<void>; // best-effort
  publicKey(kid: string): Promise<string | null>;     // 1h in-memory cache by kid; null on 404/failure
  recordDelivery(parsed: ParsedEbayNotification): Promise<NotificationDeliveryOutcome>;
}
```

- [ ] **Step 1: Write the client spec** (mock `axios` like `ebay-feed.service.spec.ts`-style tests do, or `jest.mock('axios')`):

```ts
import axios from 'axios';
import { EbayApiResource } from '@repo/shared';
import { EbayNotificationApiError, EbayNotificationClient } from './ebay-notification.client';

jest.mock('axios');
const mocked = axios as jest.Mocked<typeof axios>;

describe('EbayNotificationClient', () => {
  const appToken = { get: jest.fn().mockResolvedValue('app-tok'), restBase: () => 'https://api.sandbox.ebay.com', environment: () => 'sandbox' };
  const budget = { acquire: jest.fn().mockResolvedValue(undefined) };
  const client = new EbayNotificationClient(appToken as never, budget as never);
  beforeEach(() => { jest.clearAllMocks(); });

  it('creates a destination and reads the id from Location, charging the NOTIFICATION budget', async () => {
    mocked.post.mockResolvedValue({ status: 201, headers: { location: '/commerce/notification/v1/destination/d1' }, data: {} });
    await expect(client.createDestination({ name: 'SellerHill', endpoint: 'https://x/api/v1/ebay/notifications', verificationToken: 'a'.repeat(40) })).resolves.toBe('d1');
    expect(mocked.post).toHaveBeenCalledWith('https://api.sandbox.ebay.com/commerce/notification/v1/destination',
      { name: 'SellerHill', status: 'ENABLED', deliveryConfig: { endpoint: 'https://x/api/v1/ebay/notifications', verificationToken: 'a'.repeat(40) } },
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer app-tok' }) }));
    expect(budget.acquire).toHaveBeenCalledWith(EbayApiResource.NOTIFICATION, expect.anything());
  });

  it('surfaces eBay error ids on a 409', async () => {
    mocked.post.mockRejectedValue({ isAxiosError: true, response: { status: 409, data: { errors: [{ errorId: 195021, message: 'Destination exists for this endpoint' }] } } });
    await expect(client.createDestination({ name: 'x', endpoint: 'https://x', verificationToken: 'a'.repeat(40) })).rejects.toMatchObject({ status: 409, errorIds: [195021] });
  });

  it('creates a subscription with the USER token', async () => {
    mocked.post.mockResolvedValue({ status: 201, headers: { location: '/commerce/notification/v1/subscription/s1' }, data: {} });
    await expect(client.createSubscription('user-tok', { topicId: 'NEW_MESSAGE', destinationId: 'd1', payload: { format: 'JSON', schemaVersion: '1.0', deliveryProtocol: 'HTTPS' } })).resolves.toBe('s1');
    const [, body, cfg] = mocked.post.mock.calls[0];
    expect(body).toEqual({ topicId: 'NEW_MESSAGE', status: 'ENABLED', destinationId: 'd1', payload: { format: 'JSON', schemaVersion: '1.0', deliveryProtocol: 'HTTPS' } });
    expect((cfg as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer user-tok');
  });

  it('reads the first supported payload of a topic', async () => {
    mocked.get.mockResolvedValue({ status: 200, data: { topicId: 'NEW_MESSAGE', supportedPayloads: [{ format: 'JSON', schemaVersion: '1.0', deliveryProtocol: 'HTTPS' }] } });
    await expect(client.getTopic('NEW_MESSAGE')).resolves.toEqual({ format: 'JSON', schemaVersion: '1.0', deliveryProtocol: 'HTTPS' });
  });

  it('fetches a public key by kid', async () => {
    mocked.get.mockResolvedValue({ status: 200, data: { key: '-----BEGIN PUBLIC KEY-----abc-----END PUBLIC KEY-----', algorithm: 'ECDSA', digest: 'SHA1' } });
    await expect(client.getPublicKey('k1')).resolves.toMatchObject({ digest: 'SHA1' });
    expect(mocked.get).toHaveBeenCalledWith('https://api.sandbox.ebay.com/commerce/notification/v1/public_key/k1', expect.anything());
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Implement the client**: `private base() { return `${this.appToken.restBase()}/commerce/notification/v1`; }`; `private charge() { return () => this.budget.acquire(EbayApiResource.NOTIFICATION, EbayCallPriority.BACKGROUND); }`; a private `request<T>(run: () => Promise<AxiosResponse<T>>)` that wraps `withEbayRateLimitRetry(run, { logger: this.logger, acquireBudget: this.charge() })` and converts an axios error into `EbayNotificationApiError(status, ids, message)` where `ids = (error.response?.data?.errors ?? []).map(e => Number(e.errorId)).filter(Number.isFinite)`. Headers: `{ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' }`, `timeout: 15_000`. `createDestination`/`createSubscription` return `extractIdFromLocation(res.headers.location)` and throw `EbayNotificationApiError(res.status, [], 'no Location header')` when undefined. `listDestinations` → `GET /destination?limit=100` mapping `data.destinations[] → { destinationId, endpoint: d.deliveryConfig?.endpoint, status }`; `listSubscriptions(userToken)` → `GET /subscription?limit=100`; `deleteSubscription` → `DELETE /subscription/{id}`; `putConfig` → `PUT /config { alertEmail }`.

- [ ] **Step 3: Write the service spec** (fake client + fake db `{ query: jest.fn() }`):

```ts
describe('EbayNotificationService', () => {
  const env = { EBAY_NOTIFICATION_VERIFICATION_TOKEN: 'v'.repeat(40), EBAY_NOTIFICATION_ALERT_EMAIL: 'ops@x.com', FRONTEND_URL: 'https://app.x.com/' };
  const config = { get: (k: string) => (env as Record<string, string>)[k] } as never;
  const appToken = { get: jest.fn().mockResolvedValue('app'), restBase: () => 'https://api.ebay.com', environment: () => 'production' } as never;
  let client: Record<string, jest.Mock>; let db: { query: jest.Mock }; let svc: EbayNotificationService;
  beforeEach(() => {
    client = { putConfig: jest.fn(), createDestination: jest.fn(), listDestinations: jest.fn(), getTopic: jest.fn().mockResolvedValue({ format: 'JSON', schemaVersion: '1.0', deliveryProtocol: 'HTTPS' }), createSubscription: jest.fn(), listSubscriptions: jest.fn(), deleteSubscription: jest.fn(), getPublicKey: jest.fn() };
    db = { query: jest.fn().mockResolvedValue([]) };
    svc = new EbayNotificationService(client as never, db as never, config, appToken);
  });

  it('is disabled without a valid token or alert e-mail', () => {
    const bad = new EbayNotificationService(client as never, db as never, { get: () => undefined } as never, appToken);
    expect(bad.isEnabled()).toBe(false);
    expect(svc.isEnabled()).toBe(true);
    expect(svc.endpointUrl()).toBe('https://app.x.com/api/v1/ebay/notifications');
  });

  it('ensureDestination creates once and persists the id', async () => {
    client.createDestination.mockResolvedValue('d1');
    await expect(svc.ensureDestination()).resolves.toBe('d1');
    await expect(svc.ensureDestination()).resolves.toBe('d1');
    expect(client.putConfig).toHaveBeenCalledWith('ops@x.com');
    expect(client.createDestination).toHaveBeenCalledTimes(1);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ebay_notification_destinations'), expect.arrayContaining(['production', 'https://app.x.com/api/v1/ebay/notifications', 'd1']));
  });

  it('ensureDestination adopts an existing destination on 195021', async () => {
    client.createDestination.mockRejectedValue(new EbayNotificationApiError(409, [195021], 'exists'));
    client.listDestinations.mockResolvedValue([{ destinationId: 'd9', endpoint: 'https://app.x.com/api/v1/ebay/notifications', status: 'ENABLED' }]);
    await expect(svc.ensureDestination()).resolves.toBe('d9');
  });

  it('ensureDestination reuses the stored row before calling eBay', async () => {
    db.query.mockResolvedValueOnce([{ destination_id: 'stored' }]);
    await expect(svc.ensureDestination()).resolves.toBe('stored');
    expect(client.createDestination).not.toHaveBeenCalled();
  });

  it('subscribeAccount creates and stamps the row; 195012 adopts; 195011 reports scope_missing', async () => {
    client.createDestination.mockResolvedValue('d1');
    client.createSubscription.mockResolvedValueOnce('s1');
    await expect(svc.subscribeAccount('acc', 'user-tok')).resolves.toBe('created');
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('message_subscription_id = $1'), ['s1', 'acc']);
    client.createSubscription.mockRejectedValueOnce(new EbayNotificationApiError(409, [195012], 'exists'));
    client.listSubscriptions.mockResolvedValue([{ subscriptionId: 's-old', topicId: 'NEW_MESSAGE', destinationId: 'd1', status: 'ENABLED' }]);
    await expect(svc.subscribeAccount('acc', 'user-tok')).resolves.toBe('existing');
    client.createSubscription.mockRejectedValueOnce(new EbayNotificationApiError(403, [195011], 'scope'));
    await expect(svc.subscribeAccount('acc', 'user-tok')).resolves.toBe('scope_missing');
  });

  it('subscribeAccount is a no-op when disabled', async () => {
    const off = new EbayNotificationService(client as never, db as never, { get: () => undefined } as never, appToken);
    await expect(off.subscribeAccount('acc', 't')).resolves.toBe('disabled');
    expect(client.createSubscription).not.toHaveBeenCalled();
  });

  it('caches public keys by kid and returns null on failure', async () => {
    client.getPublicKey.mockResolvedValueOnce({ key: 'PEM', algorithm: 'ECDSA', digest: 'SHA1' });
    expect(await svc.publicKey('k')).toBe('PEM');
    expect(await svc.publicKey('k')).toBe('PEM');
    expect(client.getPublicKey).toHaveBeenCalledTimes(1);
    client.getPublicKey.mockRejectedValueOnce(new EbayNotificationApiError(404, [195001], 'no'));
    expect(await svc.publicKey('other')).toBeNull();
  });

  describe('recordDelivery', () => {
    const parsed = (over: Partial<Record<string, unknown>> = {}) => ({ notificationId: 'n1', topic: 'NEW_MESSAGE', eventDate: null, publishAttemptCount: 1, data: { messageId: 'm', conversationId: 'c', conversationType: 'FROM_MEMBERS', recipientUserName: 'seller-id', senderUserName: 'b', readStatus: false, ...over } });
    it('counts an unread message for the active store and inserts the event once', async () => {
      db.query.mockResolvedValueOnce([{ id: 'acc', status: 'active' }]);       // account lookup
      db.query.mockResolvedValueOnce([{ id: 1 }]);                                // INSERT … RETURNING id
      await expect(svc.recordDelivery(parsed())).resolves.toEqual({ stored: true, outcome: 'counted' });
      expect(db.query).toHaveBeenCalledWith(expect.stringMatching(/seller_id = \$1 OR ebay_username = \$1/), ['seller-id']);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('unread_message_count = unread_message_count + 1'), ['acc']);
    });
    it('a redelivered notification does not double-count', async () => {
      db.query.mockResolvedValueOnce([{ id: 'acc', status: 'active' }]);
      db.query.mockResolvedValueOnce([]);                                         // ON CONFLICT DO NOTHING → no row
      await expect(svc.recordDelivery(parsed({ publishAttemptCount: 2 }))).resolves.toEqual({ stored: false, outcome: 'duplicate' });
      expect(db.query).not.toHaveBeenCalledWith(expect.stringContaining('unread_message_count + 1'), expect.anything());
    });
    it('ignores a delivery for a disconnected store but still stores it', async () => {
      db.query.mockResolvedValueOnce([{ id: 'acc', status: 'disconnected' }]);
      db.query.mockResolvedValueOnce([{ id: 2 }]);
      await expect(svc.recordDelivery(parsed())).resolves.toEqual({ stored: true, outcome: 'inactive_account' });
    });
    it('stores an unknown recipient as no_account and an already-read message without counting', async () => {
      db.query.mockResolvedValueOnce([]); db.query.mockResolvedValueOnce([{ id: 3 }]);
      await expect(svc.recordDelivery(parsed())).resolves.toEqual({ stored: true, outcome: 'no_account' });
      db.query.mockResolvedValueOnce([{ id: 'acc', status: 'active' }]); db.query.mockResolvedValueOnce([{ id: 4 }]);
      await expect(svc.recordDelivery(parsed({ readStatus: true }))).resolves.toEqual({ stored: true, outcome: 'already_read' });
    });
    it('stores an unknown topic as ignored', async () => {
      db.query.mockResolvedValueOnce([{ id: 5 }]);
      await expect(svc.recordDelivery({ ...parsed(), topic: 'SOMETHING_ELSE' })).resolves.toEqual({ stored: true, outcome: 'ignored' });
    });
  });
});
```

- [ ] **Step 4: Implement the service.** Key SQL:

```sql
-- destination lookup
SELECT destination_id FROM ebay_notification_destinations WHERE environment = $1 AND endpoint_url = $2
-- destination upsert
INSERT INTO ebay_notification_destinations (environment, endpoint_url, destination_id) VALUES ($1, $2, $3)
ON CONFLICT (environment, endpoint_url) DO UPDATE SET destination_id = EXCLUDED.destination_id, updated_at = NOW()
-- subscription stamp
UPDATE ebay_accounts SET message_subscription_id = $1, message_subscription_at = NOW(), updated_at = NOW() WHERE id = $2
-- account by recipient (status included on purpose — a disconnected row still resolves)
SELECT id, status FROM ebay_accounts WHERE seller_id = $1 OR ebay_username = $1 ORDER BY (status = 'active') DESC LIMIT 1
-- event insert
INSERT INTO ebay_notification_events (notification_id, topic, ebay_account_id, conversation_id, conversation_type, outcome, payload, event_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (notification_id) DO NOTHING RETURNING id
-- counter
UPDATE ebay_accounts SET unread_message_count = unread_message_count + 1, updated_at = NOW() WHERE id = $1
```
`recordDelivery` order: topic ≠ `NEW_MESSAGE` → insert with outcome `ignored` (account NULL); notificationId starting with the test marker is not special-cased — eBay's `test` payload carries a normal envelope; if `parseNewMessageData` returns null → outcome `ignored`; resolve account; decide outcome (`no_account` / `inactive_account` when `status !== 'active'` / `already_read` when `readStatus` / else `counted`); INSERT; if no row returned → `{ stored: false, outcome: 'duplicate' }`; if outcome is `counted` → increment. `subscribeAccount`: `if (!this.isEnabled()) return 'disabled'`; `destinationId = await this.ensureDestination()` (null → `'failed'`); `payload = await client.getTopic(NEW_MESSAGE_TOPIC)`; try create → stamp → `'created'`; catch 195012 → list with user token, find `topicId === NEW_MESSAGE` → stamp → `'existing'`; 195011 → `'scope_missing'` (warn log); any other → `'failed'` (warn log, never throw). `unsubscribeAccount`: read `message_subscription_id`; if set → `client.deleteSubscription` (swallow errors) → `UPDATE … SET message_subscription_id = NULL`. `onApplicationBootstrap`: `if (this.isEnabled()) setTimeout(() => void this.ensureDestination().catch(e => this.logger.warn(...)), 20_000).unref()`. Public-key cache: `Map<string, { pem: string; expiresAt: number }>` with `PUBLIC_KEY_TTL_MS = 3_600_000`.

- [ ] **Step 5: Register** both in `EbayModule` `providers` + `exports` (the module already imports `EbayBudgetModule` globally, so `EbayApplicationTokenService` resolves). **Run** `pnpm --filter api test -- ebay-notification` → PASS. **Commit** — `feat(ebay): Notification API client + service (destination, NEW_MESSAGE subscription, delivery bookkeeping)`

---

### Task 6: Webhook receiver, retention rules, admin warning

**Files:**
- Create: `apps/api/src/modules/ebay/notifications/ebay-notification-webhook.controller.ts`
- Test: `apps/api/src/modules/ebay/notifications/ebay-notification-webhook.controller.spec.ts`
- Modify: `apps/api/src/modules/ebay/ebay.module.ts` (controllers)
- Modify: `apps/api/src/modules/admin/data-retention.manifest.ts` + `apps/api/src/common/settings/platform-settings.registry.ts` + `packages/shared/src/domain/admin/platform-settings.types.ts` (`PlatformSettingKey.RETENTION_EBAY_NOTIFICATION_EVENTS_DAYS` default 90, `RETENTION_EBAY_NOTIFICATION_RAW_CAPTURES_DAYS` default 30 — copy the exact shape of `RETENTION_LISTING_REVISIONS_DAYS` in the registry, incl. its `admin.settings.keys.*` + `descriptions.*` i18n rows in `en/admin.json` and `tr/admin.json`; `platform-settings-i18n.guard.spec.ts` enforces both)
- Modify: `apps/api/src/modules/admin/admin.service.ts` (`EBAY_NOTIFICATIONS_DISABLED` warning) + `en/tr admin.json` `warnings.ebay_notifications_disabled`
- Modify: `apps/api/src/modules/ebay/notifications` … `DataRetentionTable` gains `EBAY_NOTIFICATION_EVENTS = 'ebay_notification_events'`, `EBAY_NOTIFICATION_RAW_CAPTURES = 'ebay_notification_raw_captures'`

- [ ] **Step 1: Write the controller spec** (unit-level: instantiate with fakes, call the handlers with a fake `Request`):

```ts
import { HttpException } from '@nestjs/common';
import { createSign, generateKeyPairSync } from 'crypto';
import { EbayNotificationWebhookController } from './ebay-notification-webhook.controller';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1', publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const body = JSON.stringify({ metadata: { topic: 'NEW_MESSAGE' }, notification: { notificationId: 'n1', publishAttemptCount: 1, data: { messageId: 'm', conversationId: 'c', conversationType: 'FROM_MEMBERS', recipientUserName: 's', readStatus: false } } });
const sig = (b: string) => Buffer.from(JSON.stringify({ alg: 'ecdsa', kid: 'k1', signature: (() => { const s = createSign('sha1'); s.update(b); return s.sign(privateKey, 'base64'); })(), digest: 'SHA1' })).toString('base64');
const req = (raw: string, signature?: string) => ({ rawBody: Buffer.from(raw), body: JSON.parse(raw), headers: signature ? { 'x-ebay-signature': signature, 'content-type': 'application/json' } : {} }) as never;

describe('EbayNotificationWebhookController', () => {
  let service: Record<string, jest.Mock>; let db: { query: jest.Mock }; let ctl: EbayNotificationWebhookController;
  beforeEach(() => {
    service = { isEnabled: jest.fn().mockReturnValue(true), verificationToken: jest.fn().mockReturnValue('v'.repeat(40)), endpointUrl: jest.fn().mockReturnValue('https://app.x.com/api/v1/ebay/notifications'), publicKey: jest.fn().mockResolvedValue(publicKey), recordDelivery: jest.fn().mockResolvedValue({ stored: true, outcome: 'counted' }) };
    db = { query: jest.fn().mockResolvedValue([]) };
    ctl = new EbayNotificationWebhookController(service as never, db as never);
  });

  it('answers the challenge with sha256(code + token + endpoint)', () => {
    const { challengeResponse } = ctl.handleChallenge('abc');
    const expected = require('crypto').createHash('sha256').update('abc' + 'v'.repeat(40) + 'https://app.x.com/api/v1/ebay/notifications').digest('hex');
    expect(challengeResponse).toBe(expected);
  });
  it('503s the challenge when notifications are disabled', () => {
    service.isEnabled.mockReturnValue(false);
    expect(() => ctl.handleChallenge('abc')).toThrow(HttpException);
  });
  it('verifies, records and answers 204 — and captures the raw body first', async () => {
    await expect(ctl.handleNotification(req(body, sig(body)))).resolves.toBeUndefined();
    expect(service.recordDelivery).toHaveBeenCalledWith(expect.objectContaining({ notificationId: 'n1', topic: 'NEW_MESSAGE' }));
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO ebay_notification_raw_captures'), [expect.any(String), body, true, true]);
  });
  it('412s a bad or missing signature and records nothing', async () => {
    await expect(ctl.handleNotification(req(body))).rejects.toMatchObject({ status: 412 });
    await expect(ctl.handleNotification(req(body + ' ', sig(body)))).rejects.toMatchObject({ status: 412 });
    expect(service.recordDelivery).not.toHaveBeenCalled();
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining('raw_captures'), [expect.any(String), body + ' ', false, true]);
  });
  it('412s when the kid is unknown', async () => {
    service.publicKey.mockResolvedValue(null);
    await expect(ctl.handleNotification(req(body, sig(body)))).rejects.toMatchObject({ status: 412 });
  });
  it('400s a verified body that is not a notification', async () => {
    const junk = JSON.stringify({ hello: 1 });
    await expect(ctl.handleNotification(req(junk, sig(junk)))).rejects.toMatchObject({ status: 400 });
  });
});
```

- [ ] **Step 2: Implement** — mirror `ebay-account-deletion.controller.ts` (public, `@SkipThrottle()`, `@Controller({ path: 'ebay/notifications', version: '1' })`):

```ts
@Get()
handleChallenge(@Query('challenge_code') challengeCode?: string): { challengeResponse: string } {
  if (!challengeCode) throw new HttpException('challenge_code query parameter is required', HttpStatus.BAD_REQUEST);
  const token = this.service.verificationToken();
  if (!this.service.isEnabled() || !token) throw new HttpException('eBay notifications are not configured', HttpStatus.SERVICE_UNAVAILABLE);
  return { challengeResponse: computeChallengeResponse(challengeCode, token, this.service.endpointUrl()) };
}

@Post() @HttpCode(204)
async handleNotification(@Req() req: Request): Promise<void> {
  const rawBody = readRawBody(req);
  const header = parseSignatureHeader(req.headers['x-ebay-signature'] as string | undefined);
  const pem = header ? await this.service.publicKey(header.kid) : null;
  const signatureOk = !!header && !!pem && verifyNotificationSignature(rawBody, header, pem);
  let parsedBody: unknown = null; let parsedOk = false;
  try { parsedBody = JSON.parse(rawBody); parsedOk = true; } catch { parsedOk = false; }
  await this.captureRaw(req, rawBody, signatureOk, parsedOk);
  if (!signatureOk) throw new HttpException('Invalid eBay notification signature', HttpStatus.PRECONDITION_FAILED);
  const parsed = parseNotificationEnvelope(parsedBody);
  if (!parsed) throw new HttpException('Unrecognised notification payload', HttpStatus.BAD_REQUEST);
  const outcome = await this.service.recordDelivery(parsed);
  this.logger.log(`eBay notification ${parsed.topic} ${parsed.notificationId} attempt=${parsed.publishAttemptCount} → ${outcome.outcome}`);
}
```
`computeChallengeResponse` is imported from `../ebay-account-deletion.helpers`. `captureRaw` copies the deletion/tracking pattern with headers `['content-type','x-ebay-signature']`, body `.slice(0, 20_000)`, params `[JSON.stringify(headers), body, signatureOk, parsedOk]`, try/catch → warn. `readRawBody` as in `tracking-webhook.controller.ts`.

- [ ] **Step 3: Retention + warning.** Add the two `DataRetentionTable` members and two `DATA_RETENTION_RULES` entries (`timestampColumn: 'received_at'`, `minDays: 7`, rationale: events — "eBay NEW_MESSAGE inbox; only the notification_id UNIQUE is load-bearing (dedupe of retried deliveries, which eBay stops after 3 attempts), so a week is ample"; captures — "diagnostic only"). Add the two `PlatformSettingKey`s + registry entries (number, default 90 / 30, bounds 7–730 / 7–365, `requiresRestart: false`, group as the other retention keys) + i18n titles/descriptions in `en`/`tr` `admin.json`. In `AdminService` where `warnings` are built (near the scraper block, ~line 510): inject `EbayNotificationService` (via `EbayModule`? NO — `module-cycle.guard.spec.ts` forbids AdminModule importing EbayModule. Instead read the two env values through `ConfigService` directly with the same predicate: `if (!isValidNotificationVerificationToken(cfg.get('EBAY_NOTIFICATION_VERIFICATION_TOKEN')) || !cfg.get('EBAY_NOTIFICATION_ALERT_EMAIL')) warnings.push({ kind: AdminWarningKind.EBAY_NOTIFICATIONS_DISABLED, level: AdminWarningLevel.WARNING, value: 0, threshold: 1 })`, importing the pure predicate from `../ebay/notifications/ebay-notification.helpers` — a pure helper import is not a module import; confirm the guard spec greps `ebay.module`/`EbayTaxonomyService` only). Add `warnings.ebay_notifications_disabled` to `en`/`tr` `admin.json` ("eBay notifications are not configured — message badges rely on a 15-minute fallback" / "eBay bildirimleri yapılandırılmamış — mesaj rozeti 15 dakikalık yedek yenilemeye düşüyor") — check how existing warning strings are keyed (`admin.overview.warnings.<kind>` or similar) and follow it.

- [ ] **Step 4: Run** `pnpm --filter api test -- ebay-notification data-retention platform-settings-i18n admin` → PASS. **Commit** — `feat(ebay): NEW_MESSAGE webhook receiver with signature verification, raw capture and retention`

---

### Task 7: Account lifecycle — scopes recorded, subscribe on connect, unsubscribe on disconnect

**Files:**
- Modify: `apps/api/src/modules/ebay/ebay.service.ts` (`EbayAccountEntity`, `handleCallback` both branches, `disconnectAccount`, `mapToPublicDto`)
- Modify: `apps/api/src/modules/ebay/ebay-oauth.service.ts` (expose `getScopes(): readonly string[]`)
- Create: `apps/api/src/modules/ebay/ebay-messaging-lifecycle.guard.spec.ts` (source-grep guard)
- Modify: `apps/api/src/modules/ebay/ebay.service.spec.ts` if it constructs `EbayService` (add the new constructor arg)

- [ ] **Step 1: Write the guard spec**

```ts
import { readFileSync } from 'fs';
import { join } from 'path';
const src = readFileSync(join(__dirname, 'ebay.service.ts'), 'utf8');

describe('eBay messaging lifecycle invariants', () => {
  it('records granted_scopes on both the INSERT and the reconnect UPDATE', () => {
    expect(src.match(/granted_scopes/g)?.length ?? 0).toBeGreaterThanOrEqual(3); // entity + INSERT + UPDATE
  });
  it('subscribes the store to NEW_MESSAGE after the row is written, on both branches', () => {
    expect(src.match(/subscribeAccount\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
  it('unsubscribes BEFORE the tokens are nulled on disconnect', () => {
    const unsub = src.indexOf('unsubscribeAccount(');
    const nulling = src.indexOf('access_token = NULL');
    expect(unsub).toBeGreaterThan(-1);
    expect(unsub).toBeLessThan(nulling);
  });
  it('exposes messagingEnabled from granted_scopes', () => {
    expect(src).toMatch(/messagingEnabled:\s*hasMessagingScopes\(entity\.granted_scopes\)/);
  });
});
```

- [ ] **Step 2: Run** → FAIL. **Implement:**
  - `EbayAccountEntity` gains `granted_scopes: string[] | null; unread_message_count: number; message_subscription_id: string | null;`.
  - `EbayOAuthService.getScopes()` returns `this.scopes`.
  - Inject `EbayNotificationService` into `EbayService` (same module — no cycle).
  - Reconnect `UPDATE`: add `granted_scopes = $8` (param `this.oauthService.getScopes()` as `string[]`). INSERT: add column `granted_scopes` and `$10`.
  - After each branch resolves `account`, run best-effort:
    ```ts
    await this.subscribeToMessages(account.id, tokenResponse.access_token);
    ```
    with
    ```ts
    /** Best-effort: a subscription failure must never fail a connect. The store's granted_scopes already say whether messaging can work. */
    private async subscribeToMessages(accountId: string, accessToken: string): Promise<void> {
      try {
        const result = await this.notifications.subscribeAccount(accountId, accessToken);
        this.logger.log(`eBay NEW_MESSAGE subscription for ${accountId}: ${result}`);
      } catch (error: unknown) {
        this.logger.warn(`eBay NEW_MESSAGE subscription failed for ${accountId}: ${getErrorMessage(error)}`);
      }
    }
    ```
  - `disconnectAccount`: before the UPDATE, `try { const token = await this.getAccountAccessToken(accountId); await this.notifications.unsubscribeAccount(accountId, token); } catch (e) { this.logger.warn(...) }` — but only after confirming ownership cheaply: `SELECT id FROM ebay_accounts WHERE id = $1 AND user_id = $2 AND status <> 'disconnected'`; if no row, skip straight to the existing UPDATE (which then throws the same `accountNotFound`).
  - `mapToPublicDto`: `messagingEnabled: hasMessagingScopes(entity.granted_scopes)`.
  - `getAccountsByUserId` `SELECT *` already returns the new columns.

- [ ] **Step 3: Run** `pnpm --filter api test -- ebay` (whole ebay folder) → PASS; `pnpm typecheck` → no new api errors. **Commit** — `feat(ebay): record granted scopes and manage the NEW_MESSAGE subscription with the store lifecycle`

---

### Task 8: Message API client + `EbayMessagesModule`

**Files:**
- Create: `apps/api/src/modules/ebay-messages/ebay-message.client.ts`, `ebay-messages.module.ts`
- Test: `apps/api/src/modules/ebay-messages/ebay-message.client.spec.ts`
- Modify: `apps/api/src/app.module.ts` (import `EbayMessagesModule`)

**Interfaces (Produces):**
```ts
export class EbayMessageApiError extends Error { constructor(readonly status: number, readonly errorIds: number[], message: string) }
export interface ConversationListResult { items: EbayConversationDto[]; total: number }
export interface ThreadResult { conversation: Pick<EbayConversationThreadDto, 'conversationId' | 'type' | 'status' | 'title'>; messages: EbayMessageDto[]; total: number }
@Injectable() export class EbayMessageClient {
  constructor(budget: EbayCallBudgetService, config: ConfigService) {}
  getConversations(token: string, q: { type: EbayConversationType; status?: EbayConversationStatus; limit: number; offset: number; referenceId?: string; otherPartyUsername?: string }, priority: EbayCallPriority): Promise<ConversationListResult>;
  getConversation(token: string, id: string, type: EbayConversationType, page: { limit: number; offset: number }, priority: EbayCallPriority): Promise<ThreadResult>;
  sendMessage(token: string, input: { conversationId?: string; otherPartyUsername?: string; text: string; referenceItemId?: string }, priority: EbayCallPriority): Promise<{ messageId: string }>;
  updateRead(token: string, id: string, type: EbayConversationType, read: boolean, priority: EbayCallPriority): Promise<void>;
  bulkUpdateStatus(token: string, type: EbayConversationType, ids: string[], status: EbayConversationMutableStatus, priority: EbayCallPriority): Promise<{ succeeded: string[]; failed: string[] }>;
}
/** pure, exported for the spec */
export function mapConversation(raw: unknown): EbayConversationDto | null;
export function mapMessage(raw: unknown): EbayMessageDto | null;
```

- [ ] **Step 1: Write the spec** (`jest.mock('axios')`): assert (a) `getConversations` GETs `${base}/commerce/message/v1/conversation` with `params` `{ conversation_type: 'FROM_MEMBERS', conversation_status: 'UNREAD', limit: 25, offset: 25 }` and `Authorization: Bearer tok`, and maps a fixture `{ conversations: [{ conversationId: 'c1', conversationTitle: 'Hi', conversationType: 'FROM_MEMBERS', conversationStatus: 'ACTIVE', unreadCount: 2, referenceType: 'LISTING', referenceId: '1234', createdDate: '2026-01-01T00:00:00.000Z', latestMessage: { messageId: 'm1', subject: 'Hi', messageBody: 'hello', senderUsername: 'buyer', recipientUsername: 'seller', readStatus: false, createdDate: '…', messageMedia: [] } }], total: 1 }` to `{ items: [{ conversationId: 'c1', type: FROM_MEMBERS, status: ACTIVE, title: 'Hi', unreadCount: 2, referenceType: 'LISTING', referenceId: '1234', createdAt, latestMessage: { messageId: 'm1', subject: 'Hi', body: 'hello', senderUsername: 'buyer', recipientUsername: 'seller', read: false, createdAt, media: [] }, otherPartyUsername: 'buyer' }], total: 1 }` — `otherPartyUsername` = the latest message's sender when it is not the recipient… simpler rule: `otherPartyUsername = latestMessage ? (latestMessage.senderUsername) : null` is WRONG when the seller sent last; so the client cannot know the seller's name. Rule: `mapConversation` sets `otherPartyUsername: null`; the SERVICE (Task 9) fills it as `sender !== account.ebay_username && sender !== account.seller_id ? sender : recipient`. Assert `null` here. (b) `limit` above 50 is clamped to 50. (c) `sendMessage` POSTs `{ conversationId: 'c1', messageText: 'hi', reference: { referenceType: 'LISTING', referenceId: '1234' } }` and omits `reference` when no item id. (d) `bulkUpdateStatus` POSTs `{ conversations: ids.map(id => ({ conversationId: id, conversationType: type, conversationStatus: status })) }` and splits the response `{ conversations: [{ conversationId, updateStatus: 'SUCCESSFUL' | 'FAILED' }] }`. (e) every method calls `budget.acquire(EbayApiResource.MESSAGE, priority)`. (f) a 403 with `errors[].errorId` becomes `EbayMessageApiError` carrying the ids.

- [ ] **Step 2: Implement** with the same `request()` wrapper shape as Task 5 (axios + `withEbayRateLimitRetry` + `acquireBudget: () => this.budget.acquire(EbayApiResource.MESSAGE, priority)`), base `${(config.get('EBAY_REST_API_URL') || 'https://api.ebay.com').replace(/\/+$/, '')}/commerce/message/v1`, timeout 20 s. `mapConversation`/`mapMessage` are total over unknown input (return null when `conversationId`/`messageId` is not a string). `getConversation` returns `messages` mapped, `total: data.total ?? messages.length`, conversation fields from the response root.

- [ ] **Step 3: Module:**
```ts
@Module({ imports: [ConfigModule, DatabaseModule, EbayModule], controllers: [EbayMessagesController /* Task 9 */], providers: [EbayMessageClient, EbayMessagesService /* Task 9 */], exports: [EbayMessageClient, EbayMessagesService] })
export class EbayMessagesModule {}
```
(Register the controller/service in Task 9; for this task leave `controllers: []` and only the client.) Add to `AppModule` after `EbayModule`.

- [ ] **Step 4: Run** `pnpm --filter api test -- ebay-message` → PASS. **Commit** — `feat(ebay-messages): typed Message API client under the call budget`

---

### Task 9: Messages service + controller (ownership, unread bookkeeping, error mapping)

**Files:**
- Create: `apps/api/src/modules/ebay-messages/ebay-messages.service.ts`, `ebay-messages.controller.ts`, `ebay-messages.dto.ts`
- Test: `apps/api/src/modules/ebay-messages/ebay-messages.service.spec.ts`
- Modify: `apps/api/src/modules/ebay-messages/ebay-messages.module.ts`
- Modify: `packages/shared/src/i18n/resources/<all 15>/ebay.json` — `ebay.errors.messagingScopeMissing`, `messagingReplyNotAllowed`, `messagingUnavailable`, `messageTooLong`

**Interfaces (Produces):**
```ts
@Injectable() export class EbayMessagesService {
  constructor(client: EbayMessageClient, ebayService: EbayService, db: DatabaseService, notifications: EbayNotificationService) {}
  listConversations(userId: string, q: EbayConversationsQuery): Promise<PaginatedConversationsDto>;
  getThread(userId: string, conversationId: string, q: { ebayAccountId: string; type: EbayConversationType; page: number; limit: number }): Promise<EbayConversationThreadDto>;
  reply(userId: string, conversationId: string, input: EbayReplyMessage): Promise<EbaySendMessageResultDto>;   // FROM_EBAY → throws Error('ebay.errors.messagingReplyNotAllowed')
  setRead(userId: string, conversationId: string, input: EbayConversationRead): Promise<void>;                 // read=true → unread_message_count = GREATEST(0, count - 1)
  bulkStatus(userId: string, input: EbayBulkConversationStatus): Promise<{ succeeded: string[]; failed: string[] }>;
  unreadCount(userId: string): Promise<EbayUnreadCountDto>;      // DB; when !notifications.isEnabled() and synced_at older than 15 min → refreshUnread first (per store, best-effort)
  refreshUnread(userId: string, ebayAccountId: string): Promise<number>; // sum of `total` for UNREAD in both types; writes unread_message_count + synced_at
}
```
Error keys thrown as `Error(message = key)`: `ebay.errors.messagingScopeMissing` (account `granted_scopes` lacks the scopes, OR the client threw 403 with errorId in `[1100, 1101, 1102]`-style insufficient-scope — implement as: status 403 → scope missing), `ebay.errors.messagingReplyNotAllowed`, `ebay.errors.messageTooLong` (text > 2000 after trim), `ebay.errors.messagingUnavailable` (any other `EbayMessageApiError` with status ≥ 500 or a transport error), `ebay.errors.accountNotFound`.

- [ ] **Step 1: Write the service spec** with fakes: `client` (jest fns), `ebayService` (`assertAccountOwnership`, `getAccountAccessToken` → `'tok'`), `db.query`, `notifications.isEnabled`. Cases: (1) `listConversations` refuses (throws `ebay.errors.messagingScopeMissing`) when the account row's `granted_scopes` lacks the scopes — the service loads `SELECT granted_scopes, ebay_username, seller_id, unread_message_count, unread_message_synced_at FROM ebay_accounts WHERE id = $1 AND user_id = $2 AND status = 'active'`; (2) happy list: offset = `(page-1)*limit`, `otherPartyUsername` resolved against `ebay_username`/`seller_id`; (3) `reply` on `FROM_EBAY` throws `messagingReplyNotAllowed` and never calls the client; (4) `reply` with 2001 chars throws `messageTooLong` without calling the client; 2000 chars is sent; (5) `setRead(true)` decrements with `GREATEST(0, unread_message_count - 1)`; `setRead(false)` increments; (6) `bulkStatus` splits ids into chunks of ≤10 (the schema caps at 10 already — assert a single call); (7) `unreadCount` returns the DB sums and, when `notifications.isEnabled()` is false and `unread_message_synced_at` is null, calls `refreshUnread` first; when enabled it makes NO client call; (8) `refreshUnread` calls `getConversations` twice (FROM_MEMBERS + FROM_EBAY, `status: UNREAD, limit: 1, offset: 0`) and writes the sum of both `total`s; (9) a client 5xx surfaces as `messagingUnavailable`.

- [ ] **Step 2: Implement** the service and DTO classes (`class-validator` mirrors of the Zod schemas from Task 1, e.g. `EbayConversationsQueryDto { @IsUUID() ebayAccountId; @IsEnum(EbayConversationType) type; @IsOptional() @IsEnum(EbayConversationStatus) status?; @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1; … @Max(50) limit = 25 }`, `EbayReplyMessageDto`, `EbayConversationReadDto`, `EbayBulkConversationStatusDto`, `EbayRefreshUnreadDto`). Controller:

```ts
const MESSAGING_ERROR_STATUS: Record<string, HttpStatus> = {
  'ebay.errors.messagingScopeMissing': HttpStatus.CONFLICT,
  'ebay.errors.messagingReplyNotAllowed': HttpStatus.CONFLICT,
  'ebay.errors.messageTooLong': HttpStatus.BAD_REQUEST,
  'ebay.errors.messagingUnavailable': HttpStatus.BAD_GATEWAY,
  'ebay.errors.accountNotFound': HttpStatus.NOT_FOUND,
};
function rethrowMessagingError(error: unknown): never { const key = error instanceof Error ? error.message : ''; const status = MESSAGING_ERROR_STATUS[key]; if (status) throw new HttpException(key, status); throw error; }

@ApiTags('ebay-messages') @Controller({ path: 'ebay/messages', version: '1' }) @UseGuards(JwtAuthGuard)
export class EbayMessagesController {
  @Get('unread-count') unread(@CurrentUser() user)                       → service.unreadCount(user.id)
  @Get('conversations') list(@CurrentUser() user, @Query() q: EbayConversationsQueryDto)
  @Get('conversations/:id') thread(@CurrentUser() user, @Param('id') id, @Query() q: EbayThreadQueryDto)
  @Post('conversations/:id/reply') @HttpCode(201) reply(...)
  @Post('conversations/:id/read') @HttpCode(200) read(...)
  @Post('conversations/bulk-status') @HttpCode(200) bulk(...)
  @Post('refresh-unread') @HttpCode(200) refresh(...)                    → { unread: number }
}
```
Use the same `@CurrentUser()` decorator and guard import the orders controller uses (check `orders.controller.ts`). Every handler is `try { return await … } catch (e) { rethrowMessagingError(e); }`.

- [ ] **Step 3: i18n** — add the four keys to `ebay.errors` in all 15 `ebay.json` files (EN: "Reconnect your eBay store to enable messages — the current authorization does not include messaging." / "Messages from eBay cannot be replied to here." / "eBay messaging is temporarily unavailable. Please try again." / "A message can be at most 2000 characters."; TR natively: "Mesajlar için eBay mağazanızı yeniden bağlayın — mevcut yetki mesajlaşmayı kapsamıyor." / "eBay'den gelen mesajlar buradan yanıtlanamaz." / "eBay mesajlaşma geçici olarak kullanılamıyor. Lütfen tekrar deneyin." / "Bir mesaj en fazla 2000 karakter olabilir."; the other 13 translated in that language). Check the repo's i18n parity script (grep `package.json` for `check-i18n`) and run it.

- [ ] **Step 4: Run** `pnpm --filter api test -- ebay-messages` → PASS; boot the API (`pnpm --filter api start:dev` or `pnpm dev:api`) and `curl -s http://localhost:3000/api/v1/ebay/messages/unread-count` → 401 (guarded). **Commit** — `feat(ebay-messages): inbox service + controller with ownership checks and unread bookkeeping`

---

### Task 10: Buyer auto-messaging sends through the real client

**Files:**
- Modify: `apps/api/src/modules/buyer-messaging/buyer-message.provider.ts` (rewrite), `buyer-message.processor.ts` (`lineItemId` → `ebayItemId`), `buyer-messaging.module.ts` (import `EbayMessagesModule`)
- Create: `apps/api/src/modules/buyer-messaging/buyer-message.provider.guard.spec.ts`
- Test: `apps/api/src/modules/buyer-messaging/buyer-message.provider.spec.ts`

- [ ] **Step 1: Guard + unit spec**

```ts
// buyer-message.provider.guard.spec.ts
const src = readFileSync(join(__dirname, 'buyer-message.provider.ts'), 'utf8');
it('never targets the invented endpoint or bypasses the client', () => {
  expect(src).not.toContain('apix.ebay.com');
  expect(src).not.toMatch(/\bfetch\(/);
  expect(src).toContain('EbayMessageClient');
});
// buyer-message.provider.spec.ts
it('sends a new conversation to the buyer with the listing reference', async () => {
  const client = { sendMessage: jest.fn().mockResolvedValue({ messageId: 'm1' }) };
  const ebay = { getAccountAccessToken: jest.fn().mockResolvedValue('tok') };
  const provider = new EbayMessageApiProvider(client as never, ebay as never);
  await expect(provider.sendMessage({ ebayAccountId: 'a', orderId: 'o', ebayItemId: '1234', buyerUsername: 'buyer', body: 'hi' })).resolves.toEqual({ providerMessageId: 'm1' });
  expect(client.sendMessage).toHaveBeenCalledWith('tok', { otherPartyUsername: 'buyer', text: 'hi', referenceItemId: '1234' }, EbayCallPriority.BACKGROUND);
});
```

- [ ] **Step 2: Rewrite the provider** (keep `BuyerMessagingProvider`/`BuyerMessageSendInput` shapes, rename `lineItemId?` → `ebayItemId?` and fix the processor's `loadOrderCtx` mapping + comment: `ebayItemId: r.legacy_item_id ?? undefined` — also `COALESCE(l.ebay_item_id, o.ebay_legacy_item_id) AS legacy_item_id` so an adopted/untracked order still carries the listing reference). Body: `const token = await this.ebayService.getAccountAccessToken(input.ebayAccountId); const { messageId } = await this.client.sendMessage(token, { otherPartyUsername: input.buyerUsername, text: input.body.slice(0, EBAY_MESSAGE_MAX_LENGTH), referenceItemId: input.ebayItemId }, EbayCallPriority.BACKGROUND); return { providerMessageId: messageId };`. Errors propagate (the processor already redacts + retries).

- [ ] **Step 3: Run** `pnpm --filter api test -- buyer-message` → PASS. **Commit** — `fix(buyer-messaging): send through the real eBay Message API client (the old endpoint never existed)`

---

### Task 11: Action Center item for missing messaging scopes

**Files:**
- Modify: `apps/api/src/modules/action-center/action-center.service.ts` (`connectionItems`)
- Modify: `packages/shared/src/i18n/resources/<15>/actionCenter.json`
- Test: extend `apps/api/src/modules/action-center/action-center.helpers.spec.ts` only if a helper changes (none expected); add a service-level test if the file has one (`action-center.service.spec.ts` — check).

- [ ] **Step 1:** In `connectionItems`, add a query `SELECT COUNT(*) AS count FROM ebay_accounts WHERE user_id = $1 AND status = $2 AND NOT (granted_scopes @> $3::text[])` with `[userId, EbayAccountStatus.ACTIVE, [...EBAY_MESSAGING_SCOPES]]`, and push `{ key: ActionCenterItemKey.EBAY_ACCOUNT_MESSAGING_SCOPE_MISSING, group: ActionCenterGroup.CONNECTIONS, severity: ActionCenterSeverity.INFO, count, actionPath: '/stores' }`.
- [ ] **Step 2:** i18n block in all 15 `actionCenter.json` (EN title "Reconnect a store to enable eBay messages", description_one "{{count}} store was connected before messaging was added. Reconnect it to read and answer eBay messages here.", description_other "…{{count}} stores…", action "Manage stores"; TR "Mesajlar için bir mağazayı yeniden bağlayın" / "{{count}} mağaza mesajlaşma eklenmeden önce bağlanmış. eBay mesajlarını burada okuyup yanıtlamak için yeniden bağlayın." / … / "Mağazaları yönet"; others translated). Check the web `actionCenterPresentation.ts` map for per-key icons and add `mail`.
- [ ] **Step 3:** `pnpm --filter @repo/shared build && pnpm --filter api test -- action-center` → PASS. **Commit** — `feat(action-center): flag stores that need a reconnect for eBay messaging`

---

### Task 12: Web plumbing — API slice, nav item + badge, route, icons, i18n namespace

**Files:**
- Create: `apps/web/src/features/messages/api/messagesApi.ts`, `apps/web/src/features/messages/index.ts`
- Modify: `apps/web/src/api/baseApi.ts` (tag `'Messages'`)
- Modify: `apps/web/src/layouts/AppLayout/AppLayout.container.tsx`, `.component.tsx`, `.types.ts` (unread badge)
- Modify: `apps/web/src/App.tsx` (lazy route `messages` + locale-less `/messages` redirect), `apps/web/src/app/routeMeta.ts`
- Modify: `packages/ui/src/atoms/Icon/icons/index.tsx` (add `reply` → Lucide `Reply`, `mail-open` → `MailOpen`, `paperclip` → `Paperclip`)
- Create: `packages/shared/src/i18n/resources/<15>/messages.json`; Modify: `packages/shared/src/i18n/index.ts` (15 imports + 15 map entries), `packages/shared/src/i18n/types.ts`; `translation.json` `menu.messages` in all 15
- Modify: `apps/web/src/features/ebay/…` nothing; `apps/web/src/features/action-center/actionCenterPresentation.ts` (icon for the new key, if Task 11 did not)

- [ ] **Step 1: API slice**

```ts
import type { EbayBulkConversationStatus, EbayConversationRead, EbayConversationThreadDto, EbayConversationType, EbayReplyMessage, EbaySendMessageResultDto, EbayUnreadCountDto, PaginatedConversationsDto, EbayConversationStatus } from '@repo/shared';
import { baseApi } from '@/api/baseApi';

/** Same cadence as the Action Center badge: the counter is OUR column, fed by the webhook, so polling it costs eBay nothing. */
export const MESSAGES_UNREAD_POLL_INTERVAL_MS = 120_000;

export interface ConversationsQueryArgs { ebayAccountId: string; type: EbayConversationType; status?: EbayConversationStatus; page: number; limit: number }
export interface ThreadQueryArgs { conversationId: string; ebayAccountId: string; type: EbayConversationType; page: number; limit: number }

export const messagesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getUnreadMessageCount: builder.query<EbayUnreadCountDto, void>({ query: () => ({ url: '/ebay/messages/unread-count' }), providesTags: [{ type: 'Messages', id: 'UNREAD' }] }),
    getConversations: builder.query<PaginatedConversationsDto, ConversationsQueryArgs>({ query: (params) => ({ url: '/ebay/messages/conversations', params }), providesTags: [{ type: 'Messages', id: 'LIST' }] }),
    getConversationThread: builder.query<EbayConversationThreadDto, ThreadQueryArgs>({ query: ({ conversationId, ...params }) => ({ url: `/ebay/messages/conversations/${encodeURIComponent(conversationId)}`, params }), providesTags: (_r, _e, a) => [{ type: 'Messages', id: a.conversationId }] }),
    replyToConversation: builder.mutation<EbaySendMessageResultDto, { conversationId: string } & EbayReplyMessage>({ query: ({ conversationId, ...body }) => ({ url: `/ebay/messages/conversations/${encodeURIComponent(conversationId)}/reply`, method: 'POST', body }), invalidatesTags: (_r, _e, a) => [{ type: 'Messages', id: a.conversationId }, { type: 'Messages', id: 'LIST' }] }),
    setConversationRead: builder.mutation<void, { conversationId: string } & EbayConversationRead>({ query: ({ conversationId, ...body }) => ({ url: `/ebay/messages/conversations/${encodeURIComponent(conversationId)}/read`, method: 'POST', body }), invalidatesTags: [{ type: 'Messages', id: 'LIST' }, { type: 'Messages', id: 'UNREAD' }] }),
    bulkConversationStatus: builder.mutation<{ succeeded: string[]; failed: string[] }, EbayBulkConversationStatus>({ query: (body) => ({ url: '/ebay/messages/conversations/bulk-status', method: 'POST', body }), invalidatesTags: [{ type: 'Messages', id: 'LIST' }, { type: 'Messages', id: 'UNREAD' }] }),
    refreshUnread: builder.mutation<{ unread: number }, { ebayAccountId: string }>({ query: (body) => ({ url: '/ebay/messages/refresh-unread', method: 'POST', body }), invalidatesTags: [{ type: 'Messages', id: 'UNREAD' }] }),
  }),
});
export const { useGetUnreadMessageCountQuery, useGetConversationsQuery, useGetConversationThreadQuery, useReplyToConversationMutation, useSetConversationReadMutation, useBulkConversationStatusMutation, useRefreshUnreadMutation } = messagesApi;
```
`index.ts` exports the hooks + `MESSAGES_UNREAD_POLL_INTERVAL_MS` + (Task 13) `MessagesPageContainer`.

- [ ] **Step 2: Nav badge.** Container: `const { data: unread } = useGetUnreadMessageCountQuery(undefined, { skip: !isAuthenticated || isOperatorRole(user?.role), pollingInterval: MESSAGES_UNREAD_POLL_INTERVAL_MS });` → prop `unreadMessageCount={unread?.total ?? 0}`. Types: `unreadMessageCount: number`. Component: after the Orders item, a `NavTooltip` + `S.NavItem` for `/messages` (active when `pathWithoutLocale === '/messages'`), icon `mail`, label `t('translation:menu.messages')`, badge exactly like the Action Center one with `$urgent={false}` (collapsed → `NavBadgeDot`).

- [ ] **Step 3: Route + meta.** `App.tsx`: `const MessagesPage = lazy(() => import('./features/messages').then((m) => ({ default: m.MessagesPageContainer })));` + `<Route path="messages" element={<Lazy><MessagesPage /></Lazy>} />` under `AppLayout`; locale-less `<Route path="/messages" element={<LocaleRedirect to="messages" preserveQuery />} />`. `routeMeta.ts`: `{ path: '/messages', match: 'exact', section: 'inventory', breadcrumbs: [{ labelKey: 'translation:menu.messages', path: '/messages' }] }`.

- [ ] **Step 4: Icons.** Add the three Lucide imports + map keys; `pnpm --filter @repo/ui build`.

- [ ] **Step 5: i18n namespace `messages`** — file `{ "messages": { "page": { "title", "subtitle" }, "folders": { "members", "ebay", "all", "unread", "archive" }, "list": { "empty", "emptyUnread", "emptyArchive", "loading", "unreadOne", "unreadOther", "listing", "select", "selectAll", "noStores" }, "thread": { "empty", "loading", "reply", "replyPlaceholder", "send", "sent", "noReply", "attachment", "you", "backToList", "chars" }, "actions": { "markRead", "markUnread", "archive", "unarchive", "delete", "refresh", "selected" }, "reconnect": { "title", "description", "action" }, "toast": { "archived", "deleted", "read" } } }` — write EN and native TR first (TR: "Mesajlar", "eBay mesajlarınızı buradan okuyup yanıtlayın", "Üyelerden", "eBay'den", "Tümü", "Okunmamış", "Arşiv", …), then the other 13 as real translations. `menu.messages` = "Messages"/"Mesajlar"/… in every `translation.json`. Register the namespace: 15 imports + 15 map entries in `i18n/index.ts` (follow `enOrders`), add `messages` to `types.ts`. Run the repo's parity check if one exists (`grep -rn "check-i18n" package.json scripts`), else a quick node one-liner comparing key trees of `en/messages.json` against each locale.

- [ ] **Step 6:** `pnpm --filter @repo/shared build && pnpm --filter @repo/ui build && pnpm lint && pnpm typecheck` (web: no NEW errors). **Commit** — `feat(web): messages API slice, sidebar item with unread badge, route and i18n namespace`

---

### Task 13: The Messages page

**Files:**
- Create: `apps/web/src/features/messages/MessagesPage/MessagesPage.container.tsx`, `.component.tsx`, `.style.ts`, `.types.ts`, `index.ts`
- Create: `apps/web/src/features/messages/hooks/useMessagesUrlState.ts`
- Create: `apps/web/src/features/messages/components/ConversationList/` and `components/ConversationThread/` (each 4-file split)
- Modify: `apps/web/src/features/messages/index.ts`

**Design (from spec D7):** three columns on ≥ `lg`: `FolderRail` (14rem) | `ConversationList` (minmax 18rem, 26rem) | `ConversationThread` (1fr). Between `md` and `lg`: rail becomes a `TabNav` row above a two-column list|thread. Below `md`: single column; list shown when no `c` param, thread shown when `c` is set with `PageHeader onBack` (clears `c`).

- [ ] **Step 1: URL state hook**

```ts
export const MESSAGES_PAGE_SIZE = 25;
export interface MessagesUrlState { store: string | null; type: EbayConversationType; folder: MessagesFolder; conversationId: string | null; page: number }
export enum MessagesFolder { ALL = 'all', UNREAD = 'unread', ARCHIVE = 'archive' }   // → put this enum in packages/shared/src/domain/ebay-messages (rule 10)
export function folderToStatus(folder: MessagesFolder): EbayConversationStatus | undefined { return folder === MessagesFolder.UNREAD ? EbayConversationStatus.UNREAD : folder === MessagesFolder.ARCHIVE ? EbayConversationStatus.ARCHIVE : undefined; }
export function useMessagesUrlState() {
  const [params, setParams] = useSearchParams();
  const type = parseEnum(params.get('type'), EbayConversationType, EbayConversationType.FROM_MEMBERS);
  const folder = parseEnum(params.get('folder'), MessagesFolder, MessagesFolder.ALL);
  const page = Math.max(1, Number(params.get('page') ?? '1') || 1);
  const patch = useCallback((changes: Partial<Record<'store'|'type'|'folder'|'c'|'page', string | null>>) => { const next = new URLSearchParams(params); for (const [k, v] of Object.entries(changes)) { if (v === null || v === '' || (k === 'page' && v === '1')) next.delete(k); else next.set(k, v); } setParams(next, { replace: true }); }, [params, setParams]);
  return { state: { store: params.get('store'), type, folder, conversationId: params.get('c'), page }, setStore: (v: string | null) => patch({ store: v, c: null, page: null }), setType: (v: EbayConversationType) => patch({ type: v, c: null, page: null }), setFolder: (v: MessagesFolder) => patch({ folder: v, c: null, page: null }), openConversation: (id: string | null) => patch({ c: id }), setPage: (p: number) => patch({ page: String(p), c: null }) };
}
```
(`parseEnum` — copy the helper from `features/dashboard/hooks/useDashboardUrlState.ts` or import it if exported.)

- [ ] **Step 2: Container** — `useTranslation(['messages','translation'])`; `useGetEbayAccountsQuery()`; resolve `activeAccount` = the `store` param's account or the first `messagingEnabled` one, else the first; `messagingEnabled = activeAccount?.messagingEnabled ?? false`; `useGetConversationsQuery({ ebayAccountId, type, status: folderToStatus(folder), page, limit: MESSAGES_PAGE_SIZE }, { skip: !activeAccount || !messagingEnabled })`; `useGetConversationThreadQuery({ conversationId, ebayAccountId, type, page: 1, limit: 50 }, { skip: !conversationId || !messagingEnabled })`; on mount with a messaging-enabled store call `refreshUnread({ ebayAccountId })` once (`useEffect` keyed on `ebayAccountId`); when a thread with `unreadCount > 0` opens → `setConversationRead({ conversationId, ebayAccountId, type, read: true })`; reply: local `draft` state, `handleSend` → `replyToConversation(...).unwrap()` then clear draft; errors → `showMessage` with `getErrorI18nKey(error)` (same pattern as `StoresPage.container.tsx`); selection: `Set<string>` state + `handleBulk(status)` → `bulkConversationStatus` → clear selection; `useLoading(isReplying || isBulkUpdating)`; `isMobile = useIsMobile()`; connect handler for the reconnect prompt: `useLazyGetEbayConnectUrlQuery` → `window.location.href = url` (the Stores page's own code). Return `<EbayAccountGuard><MessagesPageComponent …/></EbayAccountGuard>`.

- [ ] **Step 3: Component** — `<S.Container><PageHeader title subtitle />` then: if `!messagingEnabled` → `<S.StateCard><EmptyState icon="mail" title={t('messages.reconnect.title')} description={t('messages.reconnect.description')} action={t('messages.reconnect.action')} onAction={onReconnect} isActionLoading={isConnecting} /></S.StateCard>`; else `<S.Toolbar>` (store `Dropdown` as on the dashboard; on `< lg` a `TabNav variant="pill"` for type + `SegmentedControl` for folder) and `<S.Layout $threadOpen={!!conversationId}>` with the three panes. `ConversationList` rows: `Checkbox`, other party (`Text weight="semibold"`), title, latest snippet (`Text variant="body-sm" truncate`), date (`formatDate` from container as a prop), `Badge variant="primary" size="xs" isPill` with `unreadCount`, listing chip (`IdBadge`-style link to the item via `useMarketplaceContext().buildEbayItemUrl`) when `referenceId`; a bulk bar when `selected.size > 0` (`archive`, `delete`, `markRead`, with `t('messages.actions.selected', { count })`); `TablePagination` `detached` variant under the list. `ConversationThread`: header (title + other party + actions `mark unread` / `archive`), message bubbles (`S.Bubble $mine` when `senderUsername` equals the store's `ebayUsername`/`sellerId` — pass `isMine(sender)` from the container), media as `<a href target="_blank" rel="noreferrer">` with `paperclip` icon (images: `<img>` with `max-width:100%`), and `MessageComposer` (`maxLength={EBAY_MESSAGE_MAX_LENGTH}`, `submitMode="explicit"`, `sendAction={{ label: t('messages.thread.send'), isLoading }}`) hidden when `type === FROM_EBAY` (show `t('messages.thread.noReply')` caption instead).

- [ ] **Step 4: Styles** — `Layout = styled.div<{ $threadOpen: boolean }>` grid `grid-template-columns: 14rem minmax(18rem, 26rem) minmax(0, 1fr)` at ≥ `tkn('breakpoints.lg')`, `minmax(18rem, 26rem) minmax(0,1fr)` between `md` and `lg`, single column below `md` where the list is `display:none` when `$threadOpen` and the thread is `display:none` otherwise; panes are `styled(Card)` with `overflow: hidden; display:flex; flex-direction:column; min-height: 60vh`; the message list scrolls (`overflow-y:auto; flex:1`); bubbles use `colors.surface.secondary` / `colors.brand.primary`-tinted (`semanticTint.info` or `colors.table.rowSelected`) — no literals; composer pinned at the bottom with `margin-top:auto`. Check RTL: no absolute positioning.

- [ ] **Step 5: Verify in the browser** — `pnpm dev`, open `/tr/messages` (demo mode from Task 14 works without a real store: `sessionStorage.sellerhill_demo=1`), check 1280 / 768 / 375 px, and `/ar/messages` for mirroring. `pnpm lint && pnpm typecheck` (web: no NEW errors; the PreToolUse hook enforces the split).

- [ ] **Step 6: Commit** — `feat(web): eBay Messages page — folders, conversation list, thread and reply`

---

### Task 14: Demo fixtures

**Files:**
- Modify: `apps/web/src/features/demo/demoData.ts` (`DEMO_CONVERSATIONS`, `demoThread(id)`, `buildDemoUnread()`), `demoBaseQuery.ts` (map `/ebay/messages/unread-count`, `/ebay/messages/conversations`, `/ebay/messages/conversations/:id`), and `DEMO_EBAY_ACCOUNTS` items gain `messagingEnabled: true`

- [ ] **Step 1:** Add 8 fixture conversations (6 `FROM_MEMBERS` — two unread, one archived, two with a `referenceId` pointing at existing demo listings' `ebayItemId`; 2 `FROM_EBAY` — policy/notice style, read), each with 2–5 messages, anchored with `isoDaysAgo`. Buyer names invented, no real brands. `filterConversations(params)` applies `type`, `status` (UNREAD → `unreadCount > 0`; ARCHIVE → status ARCHIVE; otherwise status ACTIVE) and `paginate`.
- [ ] **Step 2:** Map the three GETs; writes already resolve benignly (`demoWrite`) — but `reply` needs a `{ messageId: 'demo-generated' }` shape, which `demoWrite`'s `{ id: 'demo-generated', success: true, count: 0, ...body }` already satisfies loosely; add `messageId: 'demo-generated'` to that generic payload.
- [ ] **Step 3:** Verify `/tr/messages` in demo; **Commit** — `feat(demo): sample eBay conversations for the Messages page`

---

### Task 15: Env, compose, docs

**Files:**
- Modify: `apps/api/.env.example`, `docker-compose.test.yml`, `docker-compose.production.yml` (api service env: `EBAY_NOTIFICATION_VERIFICATION_TOKEN: ${EBAY_NOTIFICATION_VERIFICATION_TOKEN:-}`, `EBAY_NOTIFICATION_ALERT_EMAIL: ${EBAY_NOTIFICATION_ALERT_EMAIL:-}`, `EBAY_NOTIFICATION_ENDPOINT_URL: ${EBAY_NOTIFICATION_ENDPOINT_URL:-}` with a comment block like the deletion token's)
- Modify: `apps/api/src/common/config/env.validation.ts` (three optional strings, same style as `EBAY_RUNAME`)
- Modify: `CLAUDE.md` — new section "### eBay Messages (inbox + NEW_MESSAGE webhook, 2026-09-29)" under Domain/eBay, covering: why Trading was the wrong door and the measured quotas; the two scopes + `granted_scopes` + reconnect requirement; no local copy of messages; the destination/subscription lifecycle and the three env vars; receiver rules (204/412, raw capture, dedupe); the buyer-messaging provider fix (it never worked); migration `125` row in the table; operator steps. Also fix the "Known follow-ups" line in "Buyer Auto-Messaging" (the `TODO(confirm)` is resolved) and add `commerce.message`/`commerce.notification` to the API-limits sentence.

- [ ] **Step 1:** Make the edits. **Step 2:** `pnpm lint`. **Step 3: Commit** — `docs(ebay): document eBay Messages, notification env and the buyer-messaging fix`

---

### Task 16: Full verification

- [ ] `pnpm --filter @repo/shared build && pnpm --filter @repo/ui build`
- [ ] `pnpm --filter api test` — whole suite green (note the count vs. before: was ~1816 before this feature).
- [ ] `pnpm lint` (max-warnings 0) and `pnpm typecheck` — no new errors in `apps/api`, `packages/*`; web count unchanged or lower.
- [ ] Boot the API with Docker services up if available; confirm migration `125` applies and the log shows `eBay notifications disabled` (no token locally) with no crash; `GET /api/v1/ebay/notifications?challenge_code=x` → 503 locally (expected until the env is set).
- [ ] Browser pass of `/tr/messages` (demo) at 375 px and `/ar/messages`.
- [ ] Final commit if anything was fixed; then report to the operator with the three operator steps from the spec.
