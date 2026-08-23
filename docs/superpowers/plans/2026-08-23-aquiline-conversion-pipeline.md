# Aquiline Conversion Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the guessed v3 Aquiline client with the real Integration API so an Amazon tracking number is converted into an `AQUA…YQ` number before it is pushed to eBay.

**Architecture:** `AquilineClient` is a pure HTTP port over the Integration API. `AquilineProfileService` maps `(user, marketplace)` to a deterministic, non-deletable provider profile. `AmazonScrapingService` gains one method that returns the order status **and** the ship-track page HTML from a single rate-limiter slot. `TrackingConversionService` keeps its existing guard chain unchanged and swaps only the branch after it, from one call to the four-step sequence profile → upsert → tracking-html → assign. `AmazonTrackingProcessorService` gains a bounded deferral so a first-attempt conversion failure does not permanently cost the buyer their AQUA number.

**Tech Stack:** NestJS 10, raw `pg`, BullMQ, Playwright, Jest (`apps/api/jest.config.js`), React 18 + RTK Query + Emotion for the one settings surface.

**Spec:** [docs/superpowers/specs/2026-08-23-aquiline-integration-api-design.md](../specs/2026-08-23-aquiline-integration-api-design.md)

**Out of scope — a second plan:** the webhook receiver rewrite. The payload body is undocumented (the provider's OpenAPI is 3.0.3, which has no `webhooks:` section) and support has been asked for samples. Conversion works without it; only problem reporting is lost. Do not guess the payload shape here.

## Global Constraints

- **Every external failure degrades to `LocalTrackingConverter` pass-through.** A provider outage, an exhausted plan, a revoked token, a missing address or a full profile ceiling must never stop a shipment being marked shipped on eBay.
- **Base URL:** `https://aquiline-tracking.com/app/api/integration`. Auth header: `Authorization: Bearer {tokenId}.{tokenSecret}`, read from the existing `tracking.aquiline.apiKey` platform setting (already `isSecret: true`).
- **Profiles cannot be deleted.** `/v1/profiles/{id}` has only `GET` and `PATCH`. Starter includes 10. Creation is lazy, ceiling-guarded, and prefixed per environment.
- **One Amazon path, all carriers.** Amazon assign uses the ship-track URL and `retailer: amazon-us`; never send `carrier` on an Amazon assign.
- **Aquiline's quota window is the subscription anniversary**, not a calendar month. Never infer remaining allowance from our own counters — read the provider's.
- **No `any`.** Domain types live in `packages/shared/src/domain/`, Zod schemas in `packages/shared/src/schemas/`.
- **`@repo/shared` and `@repo/ui` load from `dist/`** — run `pnpm --filter @repo/shared build` after changing shared types.
- Tests: `pnpm --filter api test`. Lint: `pnpm lint` (`--max-warnings 0`).

---

### Task 1: Shared vocabulary for the Integration API

**Files:**
- Rewrite: `packages/shared/src/domain/amazon/tracking-provider.types.ts`
- Test: `apps/api/src/modules/amazon/aquiline-vocabulary.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `AquilineProblemCode`, `AquilineWebhookEvent`, `AquilineHtmlOutcome`, `AquilineAccountOrigin`, `AquilineStoreAddress`, `AquilineMarketplaceOrder`, `AquilineAssignResult`, `AquilinePlanUsage`, `isAquilineProblemCode`. Keeps the existing `AQUILINE_EBAY_CARRIER_CODE`, `AQUILINE_TRACKING_NUMBER_PATTERN` and `TrackingConversionResult` exports unchanged.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/amazon/aquiline-vocabulary.spec.ts
import {
  AQUILINE_TRACKING_NUMBER_PATTERN,
  AquilineProblemCode,
  isAquilineProblemCode,
} from '@repo/shared';

describe('Aquiline vocabulary', () => {
  it('accepts the AQUA number shapes attested by the provider', () => {
    expect(AQUILINE_TRACKING_NUMBER_PATTERN.test('AQUAA6435850826YQ')).toBe(true);
    expect(AQUILINE_TRACKING_NUMBER_PATTERN.test('AQUA0000000000YQ')).toBe(true);
    expect(AQUILINE_TRACKING_NUMBER_PATTERN.test('TBA303940404000')).toBe(false);
  });

  it('carries every public problem code from the API document', () => {
    expect(Object.values(AquilineProblemCode).sort()).toEqual(
      [
        'amazon_session_expired',
        'assign_validation',
        'needs_tracking_upload',
        'shipment_exception',
        'tracking_update_unavailable',
        'tracking_url_mismatch',
        'update_not_applied',
        'wrong_page_type',
      ].sort(),
    );
  });

  it('narrows an unknown provider string safely', () => {
    expect(isAquilineProblemCode('wrong_page_type')).toBe(true);
    expect(isAquilineProblemCode('something_new_they_added')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- aquiline-vocabulary`
Expected: FAIL — `AquilineProblemCode` is not exported.

- [ ] **Step 3: Rewrite the shared types**

Replace the body of `packages/shared/src/domain/amazon/tracking-provider.types.ts`, keeping `AQUILINE_EBAY_CARRIER_CODE`, `AQUILINE_TRACKING_NUMBER_PATTERN` and `TrackingConversionResult` verbatim, and adding:

```ts
/**
 * Public problem codes. The document is explicit that payloads use these and
 * never internal parser names, so this enum is the whole vocabulary a seller
 * or an operator can ever be shown.
 */
export enum AquilineProblemCode {
  WRONG_PAGE_TYPE = 'wrong_page_type',
  AMAZON_SESSION_EXPIRED = 'amazon_session_expired',
  TRACKING_URL_MISMATCH = 'tracking_url_mismatch',
  NEEDS_TRACKING_UPLOAD = 'needs_tracking_upload',
  UPDATE_NOT_APPLIED = 'update_not_applied',
  ASSIGN_VALIDATION = 'assign_validation',
  SHIPMENT_EXCEPTION = 'shipment_exception',
  TRACKING_UPDATE_UNAVAILABLE = 'tracking_update_unavailable',
}

/**
 * Narrow an arbitrary provider string. The provider may add codes; an unknown
 * one must degrade to "some problem" rather than be cast into the enum, which
 * would let it masquerade as a known code everywhere downstream.
 */
export function isAquilineProblemCode(value: string): value is AquilineProblemCode {
  return (Object.values(AquilineProblemCode) as string[]).includes(value);
}

export enum AquilineWebhookEvent {
  HTML_ACCEPTED = 'tracking.html.accepted',
  HTML_APPLIED = 'tracking.html.applied',
  HTML_REJECTED = 'tracking.html.rejected',
  PROBLEM_OPENED = 'tracking.problem.opened',
  PROBLEM_CLEARED = 'tracking.problem.cleared',
}

/**
 * `accepted` means stored and validated, NOT applied. The API document warns
 * against treating success alone as applied, which is why the deferral in
 * Task 7 exists.
 */
export enum AquilineHtmlOutcome {
  ACCEPTED = 'accepted',
  APPLIED = 'applied',
}

export enum AquilineAccountOrigin {
  AMAZON = 'amazon',
  ALIEXPRESS = 'aliexpress',
  WALMART = 'walmart',
}

/** Provider address shape — snake_case on the wire, unlike the rest of the API. */
export interface AquilineStoreAddress {
  first_name?: string;
  last_name?: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state?: string;
  zip_code?: string;
  country: string;
  phone_number?: string;
}

export interface AquilineMarketplaceOrder {
  marketplaceOrderId: string;
  orderPlacedAt?: string;
  shipToName?: string;
  shippingAddress?: AquilineStoreAddress;
  productTitle?: string;
  productId?: string;
  productUrl?: string;
  orderUrl?: string;
  trackingUrl?: string;
  sourceTracking?: string;
  status?: string;
}

export interface AquilineAssignResult {
  aquiline: string;
  chargedCents: number | null;
  planLimit: number | null;
  planUsed: number | null;
  planRemaining: number | null;
  /** Undocumented, reported by support for a repeated assign. Read defensively. */
  reused: boolean;
}

/** `GET /v1/me` billing block. Observed live 2026-08-23. */
export interface AquilinePlanUsage {
  planCode: string | null;
  /** Window key equals `currentPeriodStart` — the SUBSCRIPTION period, not a month. */
  windowKey: string | null;
  used: number | null;
  limit: number | null;
  remaining: number | null;
}
```

Delete `TrackingProviderStatus`, `TrackingWebhookEvent`, `TrackingWebhookChangeType`, `TrackingProviderEvent`, `TrackingProviderStatusDto` and `TrackingWebhookPayload` — they describe the v3 surface. The webhook receiver still imports the last two, so leave that file uncompiled for now by keeping the old names re-exported as deprecated aliases:

```ts
/** @deprecated v3 vocabulary. Removed when the webhook receiver is rewritten (plan 2). */
export interface TrackingWebhookPayload {
  type: string;
  occurredAt: string;
  data: {
    trackingNumber: string;
    status?: string | null;
    statusCode?: string | null;
    changeType?: string | null;
    newEvents?: unknown[];
  };
}
```

- [ ] **Step 4: Build shared and run the test**

Run: `pnpm --filter @repo/shared build && pnpm --filter api test -- aquiline-vocabulary`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/domain/amazon/tracking-provider.types.ts apps/api/src/modules/amazon/aquiline-vocabulary.spec.ts
git commit -m "feat(shared): Aquiline Integration API vocabulary"
```

---

### Task 2: `AquilineClient` — the HTTP port

**Files:**
- Rewrite: `apps/api/src/modules/amazon/aquiline.client.ts`
- Test: `apps/api/src/modules/amazon/aquiline.client.spec.ts`

**Interfaces:**
- Consumes: Task 1's vocabulary.
- Produces: `AquilineClient` with `getMe`, `listProfiles`, `getProfile`, `createProfile`, `patchProfile`, `upsertOrders`, `uploadTrackingHtml`, `assign`, `getOrder`; `AquilineConfig { baseUrl, token, profilePrefix, maxProfiles, timeoutMs }`; `AquilineError { kind, code, status }`; `AquilineErrorKind`; exported pure `classifyAquilineFailure(status, body)`.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/amazon/aquiline.client.spec.ts
import { AquilineErrorKind, classifyAquilineFailure } from './aquiline.client';

describe('classifyAquilineFailure', () => {
  it('reads the provider code rather than grepping the message', () => {
    // Observed live 2026-08-23.
    const err = classifyAquilineFailure(404, {
      success: false,
      code: 'not-found',
      message: 'Profile not found.',
    });
    expect(err.kind).toBe(AquilineErrorKind.NOT_FOUND);
    expect(err.code).toBe('not-found');
  });

  it('does NOT read a quota wall out of an unrelated message', () => {
    // The shipped implementation grepped for /quota|exceeded/ and would have
    // called this a quota failure, silently stopping every later conversion.
    const err = classifyAquilineFailure(400, {
      success: false,
      code: 'validation',
      message: 'The tracking URL exceeded the allowed length.',
    });
    expect(err.kind).toBe(AquilineErrorKind.BAD_REQUEST);
  });

  it('treats 402 as a plan wall, not something to retry', () => {
    expect(classifyAquilineFailure(402, { success: false }).kind).toBe(
      AquilineErrorKind.QUOTA_EXCEEDED,
    );
  });

  it('treats 429 and 5xx as retryable transport', () => {
    expect(classifyAquilineFailure(429, {}).kind).toBe(AquilineErrorKind.TRANSPORT);
    expect(classifyAquilineFailure(503, {}).kind).toBe(AquilineErrorKind.TRANSPORT);
  });

  it('maps 413 to payload-too-large so an oversized HTML upload is diagnosable', () => {
    expect(classifyAquilineFailure(413, {}).kind).toBe(AquilineErrorKind.PAYLOAD_TOO_LARGE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- aquiline.client`
Expected: FAIL — `classifyAquilineFailure` is not exported.

- [ ] **Step 3: Rewrite the client**

Key points, all load-bearing:

```ts
export enum AquilineErrorKind {
  NOT_CONFIGURED = 'not_configured',
  UNAUTHORIZED = 'unauthorized',
  NOT_FOUND = 'not_found',
  BAD_REQUEST = 'bad_request',
  QUOTA_EXCEEDED = 'quota_exceeded',
  PROFILE_CEILING = 'profile_ceiling',
  PAYLOAD_TOO_LARGE = 'payload_too_large',
  TRANSPORT = 'transport',
  MALFORMED_RESPONSE = 'malformed_response',
}

interface AquilineErrorBody {
  success?: boolean;
  code?: string;
  message?: string;
}

/**
 * Classify a failure from the response's own `code`, falling back to status.
 *
 * The shipped v3 client grepped the message for /quota|limit reached|exceeded/,
 * which mistakes any message merely containing those words for a plan wall —
 * and a false quota verdict silently stops every later conversion. A probe on
 * 2026-08-23 confirmed the provider does send a machine-readable `code`.
 */
export function classifyAquilineFailure(status: number, body: unknown): AquilineError {
  const parsed = (typeof body === 'object' && body !== null ? body : {}) as AquilineErrorBody;
  const code = typeof parsed.code === 'string' ? parsed.code : null;
  const message = parsed.message ?? `HTTP ${status}`;

  if (status === 401 || status === 403) {
    return new AquilineError(AquilineErrorKind.UNAUTHORIZED, message, status, code);
  }
  if (status === 402) {
    return new AquilineError(AquilineErrorKind.QUOTA_EXCEEDED, message, status, code);
  }
  if (status === 404) {
    return new AquilineError(AquilineErrorKind.NOT_FOUND, message, status, code);
  }
  if (status === 413) {
    return new AquilineError(AquilineErrorKind.PAYLOAD_TOO_LARGE, message, status, code);
  }
  if (status === 429 || status >= 500) {
    return new AquilineError(AquilineErrorKind.TRANSPORT, message, status, code);
  }
  return new AquilineError(AquilineErrorKind.BAD_REQUEST, message, status, code);
}
```

Request rules: `Authorization: Bearer ${config.token}`; retry only `TRANSPORT`, 3 attempts, 500ms doubling; **never retry a 4xx** — on the conversion path a blind retry risks paying twice. `assign` parses `reused` defensively (`json.reused === true`) since it is undocumented, and rejects a tracking number failing `AQUILINE_TRACKING_NUMBER_PATTERN` as `MALFORMED_RESPONSE`.

- [ ] **Step 4: Run the test**

Run: `pnpm --filter api test -- aquiline.client`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/amazon/aquiline.client.ts apps/api/src/modules/amazon/aquiline.client.spec.ts
git commit -m "feat(api): rewrite AquilineClient against the Integration API"
```

---

### Task 3: Migration 089 and platform settings

**Files:**
- Create: `apps/api/migrations/089_aquiline_integration.sql`
- Modify: `apps/api/src/common/settings/platform-settings.registry.ts:434-438` (base URL default), plus new keys
- Modify: `packages/shared/src/domain/admin/platform-settings.types.ts`
- Modify: `apps/api/.env.example`

**Interfaces:**
- Produces: tables/columns per the spec's §4; `PlatformSettingKey.AQUILINE_PROFILE_PREFIX`, `PlatformSettingKey.AQUILINE_MAX_PROFILES`.

- [ ] **Step 1: Write the migration**

```sql
-- 089_aquiline_integration.sql
--
-- The Aquiline Integration API replaces the v3 partner API the previous client
-- targeted. See docs/superpowers/specs/2026-08-23-aquiline-integration-api-design.md.

BEGIN;

-- Profile identity. (user, marketplace) rather than per Amazon account, because
-- profiles are a paid, plan-limited resource that CANNOT be deleted
-- (/v1/profiles/{id} has only GET and PATCH), and amazon_accounts.id churns
-- when a seller removes and re-adds a buyer account.
--
-- Deliberately NO foreign key to users, the same reasoning as ebay_trial_ledger:
-- the remote profile keeps consuming a plan slot whether or not the SellerHill
-- account still exists, so the row that accounts for it must outlive a cascade.
CREATE TABLE IF NOT EXISTS aquiline_profiles (
    user_id     UUID         NOT NULL,
    marketplace VARCHAR(20)  NOT NULL DEFAULT 'AMAZON_US',
    profile_id  VARCHAR(128) NOT NULL,
    fingerprint VARCHAR(64),
    synced_at   TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, marketplace)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aquiline_profiles_profile_id
    ON aquiline_profiles (profile_id);

-- Ship-from / return address sent as the profile's storeAddress. country/state/
-- zip_code already exist on store_settings; street, city, name and phone do not.
ALTER TABLE store_settings
    ADD COLUMN IF NOT EXISTS ship_from_name          VARCHAR(120),
    ADD COLUMN IF NOT EXISTS ship_from_phone         VARCHAR(40),
    ADD COLUMN IF NOT EXISTS ship_from_address_line1 VARCHAR(200),
    ADD COLUMN IF NOT EXISTS ship_from_address_line2 VARCHAR(200),
    ADD COLUMN IF NOT EXISTS ship_from_city          VARCHAR(120);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS aquiline_order_synced_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tracking_html_uploaded_at    TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tracking_problem_code        VARCHAR(64),
    -- Start of the deferral window: the first time we observed SHIPPED.
    ADD COLUMN IF NOT EXISTS shipped_detected_at          TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tracking_conversion_attempts INT NOT NULL DEFAULT 0,
    -- What eBay actually received. eBay's Fulfillment API has no update
    -- endpoint, so once this is set the buyer's number can never be corrected
    -- and a later conversion would be spend with no visible effect.
    ADD COLUMN IF NOT EXISTS ebay_tracking_pushed_number  VARCHAR(64),
    ADD COLUMN IF NOT EXISTS ebay_tracking_pushed_at      TIMESTAMPTZ;

-- Provider plan counters, mirroring keepa_balance. profiles_used is recorded
-- because profiles are as metered as shipments and, unlike shipments, never
-- reset. Note the provider's window is the SUBSCRIPTION period, not a month.
CREATE TABLE IF NOT EXISTS aquiline_plan_snapshot (
    id             BIGSERIAL PRIMARY KEY,
    plan_code      VARCHAR(40),
    window_key     VARCHAR(32),
    plan_limit     INT,
    plan_used      INT,
    plan_remaining INT,
    profiles_used  INT,
    captured_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aquiline_plan_snapshot_captured
    ON aquiline_plan_snapshot (captured_at DESC);

COMMIT;
```

- [ ] **Step 2: Verify it applies to a stock Postgres**

Per CLAUDE.md, verify against a plain image, not the local pgvector one:

```bash
docker run -d --name aqtest -e POSTGRES_PASSWORD=x -e POSTGRES_DB=testdb postgres:18-alpine
sleep 5
docker exec -i aqtest psql -U postgres -d testdb -c "CREATE ROLE sellerhill_user LOGIN;"
for f in apps/api/migrations/*.sql; do docker exec -i aqtest psql -U postgres -d testdb -v ON_ERROR_STOP=1 < "$f" || echo "FAILED: $f"; done
docker rm -f aqtest
```

Expected: no `FAILED` lines.

- [ ] **Step 3: Register the two new settings**

Add to `PlatformSettingKey`:

```ts
AQUILINE_PROFILE_PREFIX = 'tracking.aquiline.profilePrefix',
AQUILINE_MAX_PROFILES = 'tracking.aquiline.maxProfiles',
```

In the registry, **fix the wrong base URL default** and add the two keys:

```ts
def({
  key: PlatformSettingKey.AQUILINE_BASE_URL,
  category: PlatformSettingCategory.AMAZON,
  type: PlatformSettingType.STRING,
  envVar: 'AQUILINE_BASE_URL',
  // Was https://api.aquiline-tracking.com/v3 — the partner/courier API, which
  // has no Amazon TBA conversion at all.
  defaultValue: 'https://aquiline-tracking.com/app/api/integration',
}),
def({
  // One Aquiline account serves every environment and there is no test tenant,
  // so a profile created in development burns a production slot permanently.
  // The prefix keeps those distinguishable and stops a dev order being upserted
  // into a real seller's profile.
  key: PlatformSettingKey.AQUILINE_PROFILE_PREFIX,
  category: PlatformSettingCategory.AMAZON,
  type: PlatformSettingType.STRING,
  envVar: 'AQUILINE_PROFILE_PREFIX',
  defaultValue: 'sh',
}),
def({
  key: PlatformSettingKey.AQUILINE_MAX_PROFILES,
  category: PlatformSettingCategory.AMAZON,
  type: PlatformSettingType.NUMBER,
  envVar: 'AQUILINE_MAX_PROFILES',
  defaultValue: '10', // Starter. 25 / 50 / 100 / 250 up the ladder.
  min: 1,
  max: 1000,
}),
```

Mark `AQUILINE_PARTNER_ID` as dormant with a comment — the Integration API has no `X-Partner-Id`. Do not delete it; existing rows may carry a value.

- [ ] **Step 4: Update `.env.example`**

Replace the Aquiline block's `AQUILINE_BASE_URL` line and document the token format:

```
# Token from Dashboard -> Integration API. Format: <tokenId>.<tokenSecret>
# AQUILINE_API_KEY=
# AQUILINE_BASE_URL=https://aquiline-tracking.com/app/api/integration
# Environment marker for profile ids. Profiles cannot be deleted and one
# account serves every environment, so keep dev/test distinct from production.
# AQUILINE_PROFILE_PREFIX=sh
# AQUILINE_MAX_PROFILES=10
```

- [ ] **Step 5: Build shared, lint, commit**

```bash
pnpm --filter @repo/shared build && pnpm lint
git add apps/api/migrations/089_aquiline_integration.sql apps/api/src/common/settings/platform-settings.registry.ts packages/shared/src/domain/admin/platform-settings.types.ts apps/api/.env.example
git commit -m "feat(api): migration 089 and Aquiline Integration API settings"
```

---

### Task 4: `AquilineProfileService`

**Files:**
- Create: `apps/api/src/modules/amazon/aquiline-profile.service.ts`
- Create: `apps/api/src/modules/amazon/aquiline-profile.helpers.ts`
- Test: `apps/api/src/modules/amazon/aquiline-profile.helpers.spec.ts`
- Modify: `apps/api/src/modules/amazon/amazon.module.ts` (provider registration)

**Interfaces:**
- Consumes: `AquilineClient` (Task 2), `AquilineStoreAddress` (Task 1).
- Produces: `buildAquilineProfileId(prefix, userId, marketplace): string`; `fingerprintProfile(label, address): string`; `AquilineProfileService.ensureProfile(userId, marketplace, hintEmail): Promise<string | null>` — returns the profile id, or `null` when the caller must fall back to pass-through.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/amazon/aquiline-profile.helpers.spec.ts
import { buildAquilineProfileId, fingerprintProfile } from './aquiline-profile.helpers';

const ADDRESS = {
  address_line1: '100 Example St',
  city: 'Example City',
  country: 'US',
};

describe('buildAquilineProfileId', () => {
  it('is deterministic, so a crashed creation is recoverable', () => {
    const a = buildAquilineProfileId('sh', 'u-1', 'AMAZON_US');
    const b = buildAquilineProfileId('sh', 'u-1', 'AMAZON_US');
    expect(a).toBe(b);
    expect(a).toBe('sh-u-1-AMAZON_US');
  });

  it('separates environments, because one account serves them all', () => {
    expect(buildAquilineProfileId('sh-dev', 'u-1', 'AMAZON_US')).not.toBe(
      buildAquilineProfileId('sh', 'u-1', 'AMAZON_US'),
    );
  });
});

describe('fingerprintProfile', () => {
  it('changes when the address changes, so the profile is PATCHed', () => {
    const before = fingerprintProfile('Store', ADDRESS);
    const after = fingerprintProfile('Store', { ...ADDRESS, city: 'Other City' });
    expect(before).not.toBe(after);
  });

  it('is stable for identical input, so no needless PATCH is issued', () => {
    expect(fingerprintProfile('Store', ADDRESS)).toBe(fingerprintProfile('Store', { ...ADDRESS }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- aquiline-profile.helpers`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helpers**

```ts
// apps/api/src/modules/amazon/aquiline-profile.helpers.ts
import { createHash } from 'crypto';

import type { AquilineStoreAddress } from '@repo/shared';

/**
 * Deterministic profile id.
 *
 * The provider lets the client choose the id, and choosing it is what makes a
 * crashed creation recoverable: profiles cannot be deleted, so if Aquiline
 * created one but our row write failed, a server-generated id would leave a
 * permanently consumed slot with nothing pointing at it. With a derived id the
 * next attempt asks for the same one and adopts it.
 */
export function buildAquilineProfileId(
  prefix: string,
  userId: string,
  marketplace: string,
): string {
  return `${prefix}-${userId}-${marketplace}`;
}

/**
 * Hash of everything a PATCH would change. Comparing this is what stops every
 * conversion re-PATCHing the profile.
 *
 * `amazonAccountEmail` is deliberately excluded: it is documented as an
 * optional hint, it is immutable after creation (PATCH accepts only label,
 * marketplaceHost and storeAddress), and including it would make a seller's
 * second Amazon account churn the profile for no gain.
 */
export function fingerprintProfile(label: string, address: AquilineStoreAddress): string {
  const canonical = JSON.stringify([
    label,
    address.first_name ?? '',
    address.last_name ?? '',
    address.address_line1,
    address.address_line2 ?? '',
    address.city,
    address.state ?? '',
    address.zip_code ?? '',
    address.country,
    address.phone_number ?? '',
  ]);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 64);
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm --filter api test -- aquiline-profile.helpers`
Expected: PASS.

- [ ] **Step 5: Write the service**

`ensureProfile(userId, marketplace, hintEmail)`:

1. Read `aquiline_profiles` for `(userId, marketplace)`.
2. Resolve the ship-from address from `store_settings` (global row). **Incomplete address → return `null`** (caller passes through). Required: `address_line1`, `city`, `country`.
3. Compute the id and fingerprint.
4. Row exists and fingerprint matches → return the id, no provider call.
5. Row exists, fingerprint differs → `patchProfile`, update the row, return the id.
6. No row → take a **pg advisory lock keyed on the user** (`pg_advisory_xact_lock(hashtext($1))`), re-read inside the lock, then:
   - **Ceiling guard:** `listProfiles()` and compare against `AQUILINE_MAX_PROFILES`. At or over → log at `error` and return `null`. This is checked before creation because the resource cannot be reclaimed.
   - `createProfile({ accountOrigin: AquilineAccountOrigin.AMAZON, profileId, label, marketplaceHost: 'www.amazon.com', amazonAccountEmail: hintEmail, storeAddress })`.
   - Treat an "already exists" answer as success (adopt it) — that is the crash-recovery path.
   - Insert the row with `ON CONFLICT (user_id, marketplace) DO UPDATE`.

Every provider failure returns `null` rather than throwing.

- [ ] **Step 6: Register and commit**

```bash
pnpm lint && pnpm --filter api test
git add apps/api/src/modules/amazon/aquiline-profile.*.ts apps/api/src/modules/amazon/amazon.module.ts
git commit -m "feat(api): AquilineProfileService with deterministic ids and a ceiling guard"
```

---

### Task 5: Ship-track HTML in one scraping slot, and the carrier fix

**Files:**
- Modify: `apps/api/src/modules/amazon/amazon-scraping.service.ts:255-292`
- Modify: `apps/api/src/modules/amazon/amazon-order-parser.service.ts:38-44,165-211`
- Test: `apps/api/src/modules/amazon/amazon-order-parser.spec.ts` (extend)

**Interfaces:**
- Consumes: nothing new.
- Produces: `AmazonScrapingService.scrapeOrderStatusWithTrackingHtml(userId, accountId, amazonOrderId): Promise<{ status: string; trackingNumber?: string; trackingCarrier?: string; trackingUrl?: string; trackingHtml?: string }>`; `resolveTrackingCarrier(trackingNumber, pageText): string | undefined` exported from the parser.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/amazon/amazon-order-parser.spec.ts (append)
import { resolveTrackingCarrier } from './amazon-order-parser.service';

describe('resolveTrackingCarrier', () => {
  it('reads the carrier from the tracking number before the page text', () => {
    // The shipped implementation scanned the whole page with /ups/i and tested
    // "amazon logistics" LAST, so any page containing a word like "groups"
    // labelled an Amazon Logistics shipment as UPS — which then silently failed
    // the default amazon_logistics_only conversion scope.
    expect(resolveTrackingCarrier('TBA303940404000', 'Join our groups for updates')).toBe(
      'Amazon Logistics',
    );
  });

  it('still recognises a real UPS number', () => {
    expect(resolveTrackingCarrier('1Z999AA10123456784', '')).toBe('UPS');
  });

  it('falls back to the page text when the number is unrecognised', () => {
    expect(resolveTrackingCarrier('X123', 'Shipped with USPS')).toBe('USPS');
  });

  it('never matches a carrier inside an unrelated word', () => {
    expect(resolveTrackingCarrier('X123', 'backups completed')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- amazon-order-parser`
Expected: FAIL — `resolveTrackingCarrier` is not exported.

- [ ] **Step 3: Implement the carrier resolver**

```ts
/**
 * Carrier for a tracking number.
 *
 * The number is checked FIRST because it is unambiguous, and Amazon Logistics
 * is checked before every other carrier. The previous implementation scanned
 * the page body with bare substrings (`/ups/i` matches "groups", "backups")
 * and tested Amazon Logistics last, so a TB* shipment on a page mentioning any
 * such word was labelled UPS. That is the worst possible direction: the
 * default conversion scope is amazon_logistics_only, so the shipment most in
 * need of hiding the supplier was the one skipped.
 */
export function resolveTrackingCarrier(
  trackingNumber: string | undefined,
  pageText: string,
): string | undefined {
  const num = (trackingNumber || '').trim().toUpperCase();
  if (/^TB[A-Z]/.test(num)) { return 'Amazon Logistics'; }
  if (/^1Z[0-9A-Z]{16}$/.test(num)) { return 'UPS'; }
  if (/^9[2-5]\d{18,24}$/.test(num)) { return 'USPS'; }

  // Word-bounded so a carrier name inside another word cannot match.
  if (/amazon\s*logistics/i.test(pageText)) { return 'Amazon Logistics'; }
  if (/\bUSPS\b|\bUnited States Postal\b/i.test(pageText)) { return 'USPS'; }
  if (/\bUPS\b/.test(pageText)) { return 'UPS'; }
  if (/\bFedEx\b/i.test(pageText)) { return 'FedEx'; }
  if (/\bDHL\b/i.test(pageText)) { return 'DHL'; }
  return undefined;
}
```

Widen `parseOrderStatus`'s return type to include `trackingUrl` — `extractTracking` already produces it (`amazon-order-parser.service.ts:176`) and the narrow type has been silently discarding it.

- [ ] **Step 4: Add the combined scrape method**

In `amazon-scraping.service.ts`, alongside `doScrapeOrderStatus`, add a variant that after `parseOrderStatus` navigates to the tracking link **on the same page** and captures `page.content()`:

```ts
/**
 * Order status AND the ship-track page HTML, in ONE rate-limiter slot.
 *
 * Aquiline wants the ship-track page (never order-details) roughly daily for an
 * in-flight order. Doing it in a second slot would cost a second Chromium page,
 * a second session check and a 3s per-account wait, and would double the slots
 * an in-flight order consumes against a platform ceiling of
 * AMAZON_GLOBAL_CONCURRENCY x 86,400 browser-seconds/day.
 *
 * The decisive reason is correctness, though: an Amazon order can ship as
 * several packages and the real tracking URL carries a package index. Reading
 * the link Amazon itself renders — while still on order-details — is what
 * avoids the provider's own `tracking_url_mismatch` / `wrong_page_type`
 * problems. A constructed URL cannot know the index.
 */
async scrapeOrderStatusWithTrackingHtml(
  userId: string,
  amazonAccountId: string,
  amazonOrderId: string,
): Promise<{
  status: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
  trackingHtml?: string;
}> {
  return this.rateLimiter.schedule(amazonAccountId, () =>
    this.doScrapeOrderStatusWithTrackingHtml(userId, amazonAccountId, amazonOrderId),
  );
}
```

In the private implementation: after `parseOrderStatus(page)`, if `parsed.trackingUrl` is present, resolve it against the marketplace origin, `page.goto(...)`, `await page.waitForTimeout(1500)`, then `trackingHtml = await page.content()`. Wrap that second navigation in its own try/catch — **a failure to capture HTML must not lose the status we already parsed.**

- [ ] **Step 5: Run tests, lint, commit**

```bash
pnpm --filter api test -- amazon-order-parser && pnpm lint
git add apps/api/src/modules/amazon/amazon-scraping.service.ts apps/api/src/modules/amazon/amazon-order-parser.service.ts apps/api/src/modules/amazon/amazon-order-parser.spec.ts
git commit -m "feat(api): capture ship-track HTML in the status scrape; fix carrier detection"
```

---

### Task 6: The four-step conversion in `TrackingConversionService`

**Files:**
- Modify: `apps/api/src/modules/amazon/tracking-conversion.service.ts`
- Modify: `apps/api/src/modules/amazon/tracking-converter.ts` (`ConversionRequest` gains `trackingUrl`, `trackingHtml`)
- Test: `apps/api/src/modules/amazon/tracking-conversion.spec.ts`

**Interfaces:**
- Consumes: `AquilineClient` (Task 2), `AquilineProfileService.ensureProfile` (Task 4).
- Produces: `TrackingConversionService.resolveForOrder(request)` unchanged in signature; new `ConversionOutcome` distinguishing `converted | passthrough_terminal | passthrough_retryable` for Task 7.

- [ ] **Step 1: Write the failing test**

```ts
// apps/api/src/modules/amazon/tracking-conversion.spec.ts
import { isRetryableConversionFailure } from './tracking-conversion.service';
import { AquilineErrorKind } from './aquiline.client';
import { AquilineProblemCode } from '@repo/shared';

describe('isRetryableConversionFailure', () => {
  it('retries a transport blip', () => {
    expect(isRetryableConversionFailure(AquilineErrorKind.TRANSPORT, null)).toBe(true);
  });

  it('retries "the HTML has not been parsed yet"', () => {
    // The whole reason the deferral exists: assign may refuse until the upload
    // is applied, and that would be a systematic first-attempt failure.
    expect(
      isRetryableConversionFailure(
        AquilineErrorKind.BAD_REQUEST,
        AquilineProblemCode.NEEDS_TRACKING_UPLOAD,
      ),
    ).toBe(true);
    expect(
      isRetryableConversionFailure(
        AquilineErrorKind.BAD_REQUEST,
        AquilineProblemCode.UPDATE_NOT_APPLIED,
      ),
    ).toBe(true);
  });

  it('does NOT retry a plan wall or a revoked token', () => {
    expect(isRetryableConversionFailure(AquilineErrorKind.QUOTA_EXCEEDED, null)).toBe(false);
    expect(isRetryableConversionFailure(AquilineErrorKind.UNAUTHORIZED, null)).toBe(false);
    expect(isRetryableConversionFailure(AquilineErrorKind.PROFILE_CEILING, null)).toBe(false);
  });

  it('does NOT retry a rejected page — the same page gets the same answer', () => {
    expect(
      isRetryableConversionFailure(
        AquilineErrorKind.BAD_REQUEST,
        AquilineProblemCode.WRONG_PAGE_TYPE,
      ),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- tracking-conversion`
Expected: FAIL — `isRetryableConversionFailure` is not exported.

- [ ] **Step 3: Implement the classifier and the sequence**

```ts
/**
 * Whether a failed conversion is worth deferring the eBay push for.
 *
 * Retryable means "the same request may succeed shortly". A plan wall, a
 * revoked token, a full profile ceiling and a rejected page all give the same
 * answer next time, so deferring only delays the seller's fulfilment.
 */
export function isRetryableConversionFailure(
  kind: AquilineErrorKind,
  problem: AquilineProblemCode | null,
): boolean {
  if (problem === AquilineProblemCode.NEEDS_TRACKING_UPLOAD) { return true; }
  if (problem === AquilineProblemCode.UPDATE_NOT_APPLIED) { return true; }
  if (problem !== null) { return false; }
  return kind === AquilineErrorKind.TRANSPORT;
}
```

Replace the `this.aquiline.createConversion(...)` block with, in order: `ensureProfile` (null → terminal pass-through), `upsertOrders` with the order's marketplace id and buyer address, `uploadTrackingHtml` when `request.trackingHtml` is present, then `assign` with the schema's Amazon body (`trackingUrl`, `retailer: 'amazon-us'`, `marketplaceHost`, `sourceTracking: 'Amazon'`, `shippingAddress`) — **never `carrier`**. Persist the result, then record the plan snapshot from the assign response.

The guard chain above this block is unchanged.

- [ ] **Step 4: Add the plan-exhaustion short-circuit**

```ts
// tracking-conversion.spec.ts (append)
import { isPlanExhausted } from './tracking-conversion.service';

describe('isPlanExhausted', () => {
  it('short-circuits once the provider says nothing is left', () => {
    // Spending a call on a guaranteed 402 wastes a request and logs noise.
    expect(isPlanExhausted({ planRemaining: 0, capturedAt: new Date() }, new Date())).toBe(true);
  });

  it('clears once the snapshot is older than the provider window could be', () => {
    // Aquiline resets on the SUBSCRIPTION anniversary, not the 1st, so we
    // cannot compute the reset date from a calendar month. Expiring the
    // snapshot after 24h means at worst one wasted call per day re-learns the
    // real state, and a reset is never missed.
    const old = new Date('2026-08-01T00:00:00Z');
    expect(isPlanExhausted({ planRemaining: 0, capturedAt: old }, new Date('2026-08-03T00:00:00Z'))).toBe(false);
  });

  it('does not short-circuit on an unknown remaining count', () => {
    expect(isPlanExhausted({ planRemaining: null, capturedAt: new Date() }, new Date())).toBe(false);
  });
});
```

```ts
/** Snapshot staleness. See the test for why it is not derived from a month. */
export const PLAN_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;

export function isPlanExhausted(
  snapshot: { planRemaining: number | null; capturedAt: Date } | null,
  now: Date,
): boolean {
  if (!snapshot || snapshot.planRemaining === null) { return false; }
  if (now.getTime() - snapshot.capturedAt.getTime() > PLAN_SNAPSHOT_TTL_MS) { return false; }
  return snapshot.planRemaining <= 0;
}
```

Consult it immediately before `assign`; when exhausted, log at `error` (it silently un-hides the supplier for every order) and return the terminal pass-through. Write a snapshot row from every `assign` response.

- [ ] **Step 5: Run tests, commit**

```bash
pnpm --filter api test -- tracking-conversion && pnpm lint
git add apps/api/src/modules/amazon/tracking-conversion.service.ts apps/api/src/modules/amazon/tracking-converter.ts apps/api/src/modules/amazon/tracking-conversion.spec.ts
git commit -m "feat(api): four-step Aquiline conversion sequence"
```

---

### Task 7: Bounded deferral, and removing the delivery-webhook assumption

**Files:**
- Modify: `apps/api/src/modules/amazon/amazon-tracking-processor.service.ts`
- Create: `apps/api/src/modules/amazon/tracking-deferral.ts`
- Test: `apps/api/src/modules/amazon/tracking-deferral.spec.ts`
- Test: `apps/api/src/modules/amazon/tracking-webhook-coverage.guard.spec.ts`

**Interfaces:**
- Consumes: `isRetryableConversionFailure` (Task 6).
- Produces: `shouldDeferEbayPush({ retryable, shippedDetectedAt, now, windowHours }): boolean`; `DEFERRAL_WINDOW_HOURS = 12`; `DEFERRAL_RETRY_INTERVAL_HOURS = 1`.

- [ ] **Step 1: Write the failing tests**

```ts
// apps/api/src/modules/amazon/tracking-deferral.spec.ts
import { DEFERRAL_WINDOW_HOURS, shouldDeferEbayPush } from './tracking-deferral';

const START = new Date('2026-08-23T00:00:00Z');
const hours = (n: number) => new Date(START.getTime() + n * 3_600_000);

describe('shouldDeferEbayPush', () => {
  it('defers a retryable failure inside the window', () => {
    expect(
      shouldDeferEbayPush({ retryable: true, shippedDetectedAt: START, now: hours(3), windowHours: DEFERRAL_WINDOW_HOURS }),
    ).toBe(true);
  });

  it('stops deferring once the window expires, so eBay still gets a number', () => {
    // eBay has no fulfillment update endpoint, but a shipment with NO tracking
    // is worse than one with the raw Amazon number.
    expect(
      shouldDeferEbayPush({ retryable: true, shippedDetectedAt: START, now: hours(13), windowHours: DEFERRAL_WINDOW_HOURS }),
    ).toBe(false);
  });

  it('never defers a terminal failure', () => {
    expect(
      shouldDeferEbayPush({ retryable: false, shippedDetectedAt: START, now: hours(1), windowHours: DEFERRAL_WINDOW_HOURS }),
    ).toBe(false);
  });

  it('does not defer when the shipped time is unknown', () => {
    expect(
      shouldDeferEbayPush({ retryable: true, shippedDetectedAt: null, now: hours(1), windowHours: DEFERRAL_WINDOW_HOURS }),
    ).toBe(false);
  });
});
```

```ts
// apps/api/src/modules/amazon/tracking-webhook-coverage.guard.spec.ts
import { readFileSync } from 'fs';
import { join } from 'path';

const PROCESSOR = readFileSync(
  join(__dirname, 'amazon-tracking-processor.service.ts'),
  'utf8',
);

describe('delivery detection', () => {
  it('never stops Amazon polling on the strength of a converted number', () => {
    // The Integration API has NO delivery webhook — the events are
    // tracking.html.* and tracking.problem.*. The removed
    // `hasWebhookDeliveryCoverage` stopped polling once a conversion existed,
    // which would strand every converted order in SHIPPED forever.
    expect(PROCESSOR).not.toMatch(/hasWebhookDeliveryCoverage/);
  });

  it('keeps feeding the provider by continuing to scrape after SHIPPED', () => {
    expect(PROCESSOR).toMatch(/scrapeOrderStatusWithTrackingHtml/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter api test -- tracking-deferral tracking-webhook-coverage`
Expected: FAIL — module missing, and `hasWebhookDeliveryCoverage` still present.

- [ ] **Step 3: Implement the deferral helper**

```ts
// apps/api/src/modules/amazon/tracking-deferral.ts

/** eBay's handling-time expectation is about one business day; 12h leaves room. */
export const DEFERRAL_WINDOW_HOURS = 12;
export const DEFERRAL_RETRY_INTERVAL_HOURS = 1;

export function shouldDeferEbayPush(input: {
  retryable: boolean;
  shippedDetectedAt: Date | null;
  now: Date;
  windowHours: number;
}): boolean {
  if (!input.retryable || !input.shippedDetectedAt) { return false; }
  const elapsedHours = (input.now.getTime() - input.shippedDetectedAt.getTime()) / 3_600_000;
  return elapsedHours < input.windowHours;
}
```

- [ ] **Step 4: Rework the processor**

- Call `scrapeOrderStatusWithTrackingHtml` instead of `scrapeOrderStatus`.
- On the first SHIPPED observation, stamp `orders.shipped_detected_at` with `COALESCE`.
- `handleShipped` returns `{ pushed: boolean; retryAt?: Date }` instead of `void`. On a deferral it skips the eBay call, skips the status write, re-arms the scheduler at `DEFERRAL_RETRY_INTERVAL_HOURS`, and returns normally — **not** by throwing, which would fail the BullMQ job for a normal, expected wait.
- On a real push, write `ebay_tracking_pushed_number` / `ebay_tracking_pushed_at` in the same statement that records success.
- The SHIPPED buyer message stays inside the `pushed: true` branch.
- **Delete `hasWebhookDeliveryCoverage` and its call site.** After SHIPPED, always re-schedule at the shipped interval.

- [ ] **Step 5: Run tests, lint, commit**

```bash
pnpm --filter api test && pnpm lint
git add apps/api/src/modules/amazon/tracking-deferral.ts apps/api/src/modules/amazon/tracking-deferral.spec.ts apps/api/src/modules/amazon/tracking-webhook-coverage.guard.spec.ts apps/api/src/modules/amazon/amazon-tracking-processor.service.ts
git commit -m "feat(api): defer the eBay push for a retryable conversion failure"
```

---

### Task 8: Ship-from address in Store Settings

**Files:**
- Modify: `apps/api/src/modules/store-settings/dto/save-store-settings.dto.ts`
- Modify: `packages/shared/src/domain/store-settings/` (DTO interface) and `packages/shared/src/schemas/store-settings/`
- Modify: `apps/api/src/modules/store-settings/store-settings.service.ts` (select + upsert the five columns)
- Modify: `apps/web/src/features/settings/components/StoreSettingsDrawer/StoreSettingsDrawer.{container,component,style}.tsx`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/storeSettings.json`

**Interfaces:**
- Consumes: migration 089 columns (Task 3).
- Produces: `StoreSettingsDto.shipFrom{Name,Phone,AddressLine1,AddressLine2,City}` — all optional strings.

- [ ] **Step 1: Extend the shared type and Zod schema**

Add the five optional string fields. Keep them optional: a seller on the local provider never needs them, and requiring them would block saving unrelated settings.

- [ ] **Step 2: Thread them through the service**

The upsert must write the columns on **both** the INSERT and the UPDATE branch. CLAUDE.md records this exact bug for `amazonTaxRate`: "the upsert path must NOT skip the column on the `UPDATE` branch."

- [ ] **Step 3: Add the drawer section**

A "Ship-from address" section using `ModernTextInput` with floating labels (never an external `<Text>` label). Add an `InfoMessage` explaining that the address is the return address shown on converted tracking, and that conversion falls back to the raw Amazon number while it is incomplete — so the seller learns the consequence at the point of entry rather than from a silent pass-through.

- [ ] **Step 4: Add i18n keys to BOTH locales**

`storeSettings.shipFrom.{title,description,name,phone,addressLine1,addressLine2,city,incompleteHint}` in `en` and `tr`.

- [ ] **Step 5: Build, lint, commit**

```bash
pnpm --filter @repo/shared build && pnpm lint && pnpm typecheck
git add packages/shared apps/api/src/modules/store-settings apps/web/src/features/settings
git commit -m "feat: ship-from address for Aquiline profiles"
```

---

### Task 9: `convertOnDemand` guard and the order-detail surface

**Files:**
- Modify: `apps/api/src/modules/amazon/tracking-conversion.service.ts` (`convertOnDemand`)
- Modify: `apps/web/src/features/orders/details/` (conversion row)
- Modify: `packages/shared/src/i18n/resources/{en,tr}/orders.json`
- Test: `apps/api/src/modules/amazon/tracking-conversion.spec.ts` (extend)

**Interfaces:**
- Consumes: `orders.ebay_tracking_pushed_number` (Task 3), `AquilineProblemCode` (Task 1).
- Produces: `shouldRefuseOnDemandConversion({ convertedTrackingNumber, ebayTrackingPushedNumber }): boolean`, exported from `tracking-conversion.service.ts`; `convertOnDemand` returns the existing shape plus `reasonKey: 'orders.errors.trackingAlreadyPushed'`.

- [ ] **Step 1: Write the failing test**

```ts
it('refuses an on-demand conversion once eBay already has the raw number', () => {
  // eBay's Fulfillment API cannot be corrected, so converting now would spend
  // a paid conversion the buyer will never see.
  expect(
    shouldRefuseOnDemandConversion({
      convertedTrackingNumber: null,
      ebayTrackingPushedNumber: 'TBA303940404000',
    }),
  ).toBe(true);
});

it('allows it when nothing has been pushed yet', () => {
  expect(
    shouldRefuseOnDemandConversion({
      convertedTrackingNumber: null,
      ebayTrackingPushedNumber: null,
    }),
  ).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter api test -- tracking-conversion`
Expected: FAIL — `shouldRefuseOnDemandConversion` is not exported.

- [ ] **Step 3: Implement the guard and surface**

Add the pure predicate, wire it into `convertOnDemand` before the quota is touched, and render on order detail: the converted number when present, the localized `tracking_problem_code` when set (never the raw enum — an unmapped code falls back to a generic sentence), and the convert action only when there is an Amazon number, no conversion, and nothing pushed.

- [ ] **Step 4: Add i18n keys to BOTH locales**

`orders.errors.trackingAlreadyPushed` and `orders.tracking.problem.*` for each `AquilineProblemCode`, plus a generic fallback.

- [ ] **Step 5: Run everything, commit**

```bash
pnpm --filter @repo/shared build && pnpm --filter api test && pnpm lint && pnpm typecheck
git add -A
git commit -m "feat: guard on-demand conversion and surface tracking problems"
```

---

### Task 10: Admin visibility for the provider plan

**Files:**
- Modify: `apps/api/src/modules/admin/admin.service.ts` (read the latest snapshot)
- Modify: `apps/api/src/modules/admin/admin.controller.ts`
- Modify: `apps/web/src/features/admin/` (a card on the Costs tab)
- Modify: `packages/shared/src/i18n/resources/{en,tr}/` admin namespace

**Interfaces:**
- Consumes: `aquiline_plan_snapshot` (Task 3).
- Produces: `AquilinePlanSnapshotDto { planCode, windowKey, planLimit, planUsed, planRemaining, profilesUsed, profilesLimit, capturedAt }` on the existing admin overview response.

- [ ] **Step 1: Add the read**

```sql
SELECT plan_code, window_key, plan_limit, plan_used, plan_remaining,
       profiles_used, captured_at
  FROM aquiline_plan_snapshot
 ORDER BY captured_at DESC
 LIMIT 1
```

`profilesLimit` comes from `PlatformSettingKey.AQUILINE_MAX_PROFILES`, not from the provider — the API does not expose it.

- [ ] **Step 2: Render the card**

Label is `caption` + `text.secondary`, figure is `metric` with `numeric`, per the KPI card pattern. An absent snapshot renders an em dash, never `0` — the same unknown-vs-zero rule the FinOps surfaces already follow.

**Show the profile count with its own emphasis and a hint that it never resets.** Shipments recover monthly; profiles do not, and an operator reading two numbers side by side will otherwise assume both behave the same way.

- [ ] **Step 3: Lint, typecheck, commit**

```bash
pnpm --filter @repo/shared build && pnpm lint && pnpm typecheck
git add -A
git commit -m "feat(admin): surface the Aquiline plan snapshot"
```

---

## Deferred to plan 2 (blocked on support)

- **The webhook receiver rewrite.** Payload body undocumented.
- **Action Center items for tracking problems.** Their signal is
  `orders.tracking_problem_code`, which only the webhook populates. The column
  and its localized rendering ship here (Task 9); the Action Center probe that
  reads it waits until something writes it.

## After this plan

1. Send the six questions in `docs/aquiline-open-questions.md` to Aquiline support.
2. Connect a real Amazon buyer account with a shipped order, then run the probe stages in one session:
   `pnpm --filter api aquiline:probe --create-profile sh-dev-<userId>-AMAZON_US --yes-permanent --profile <id> --upsert-order <amazonOrderId> --upload-html <file> --tracking-url <url> --assign --yes-billable`
   This settles the HTML size limit, assign idempotency and timing, the batch limit, and the duplicate-profile behaviour.
3. Write plan 2 — the webhook receiver — once the payload samples arrive.
