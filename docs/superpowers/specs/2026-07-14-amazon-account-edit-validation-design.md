# Amazon Buyer-Account Editing & Credential Validation — Design

**Date:** 2026-07-14
**Scope:** Settings → Amazon accounts (connected-accounts drawer + add/edit drawer) and the `amazon` backend module. Buyer accounts used to scrape orders from Amazon.

## Problem

Three issues on the Settings → Amazon accounts surface:

1. **Redundant hover border.** Connected-account cards use `Card variant="interactive"`, so hovering paints a border even though the selected state already paints one. Hover emphasis is noise.
2. **Edit form is crippled.** On edit, email is disabled ("cannot be changed"), the 2FA field is empty with no indication of whether 2FA is configured, and only the password field offers a "leave blank to keep" hint. These are the user's own buyer accounts — they must be freely editable.
3. **No credential validation.** Create/update store credentials and mark the account `ACTIVE` without ever logging in. The only existing verifier (`POST /amazon/accounts/:id/verify`) is a naive inline Playwright login that **does not handle 2FA**, doesn't persist browser state, and isn't called from create/update. So invalid/locked credentials sail through as `active`.

## Goals

- On **save** (create, or update that changes credentials), the system immediately starts a background login against Amazon using the real 2FA-aware scraper. The account shows `verifying` ("doğrulanıyor") instantly — in both the card list and the edit drawer — and resolves to `active` (success) or `invalid` (failure, with a stored reason) when the login attempt finishes.
- Email, password, and 2FA are all editable on update. The 2FA secret is **never** returned to the frontend.
- Only one login code path: `AmazonScrapingService.performLogin`.

## Non-goals

- Touching the legacy standalone `AmazonAccountsPage` (`apps/web/src/features/amazon/accounts/`). Only the Settings drawer surface changes. (Its shared RTK Query API and the backend DTO/service changes are shared, so it benefits incidentally, but its UI is out of scope.)
- Token-balance-driven throttling, per-user cost isolation, or admin UI for verification logs.
- Changing the order-scraping or order-tracking flows (they already reuse `performLogin`).

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Validation timing | **Async** via a new BullMQ `amazon-verify` queue. Account is stored as `verifying` and the job runs in the background. No long HTTP request. |
| 2FA field on edit | **Hint + badge.** Field stays blank with a "leave blank to keep current" hint; a `2FA set`/`not set` badge reflects a new `hasTwoFactor` boolean. Secret never leaves the server. |
| When to re-verify on update | **Only when credentials change** (`email`, `password`, or `twoFactorSecret`). Label-only edits keep the current status and do not trigger a login (avoids wasted attempts / CAPTCHA risk). |
| Status semantics | New `AmazonAccountStatus.VERIFYING`. Create always verifies. |

**Acknowledged limitation:** Amazon may serve a CAPTCHA during a headless Playwright login even with correct credentials. Such an account lands in `invalid` with the captured reason surfaced to the user. There is no API-only credential check for Amazon buyer accounts, so "validate by logging in" is the only option; the user accepts this.

## Architecture

```
Create / credential-changing Update
  → AmazonAccountsService: encrypt + store with status = VERIFYING
  → AmazonVerifyQueueService.enqueue({ userId, accountId })   // immediate
  → (HTTP response returns; UI refetch shows "doğrulanıyor")

Background:
  AmazonVerifyProcessorService (concurrency 1)
    → accountsService.getDecrypted(userId, accountId)
    → scrapingService.performLogin(accountId, email, password, twoFactorSecret)   // 2FA-aware, single login path
        success → accountsService.markVerified()            // ACTIVE + last_verified_at, clear error
        failure → accountsService.updateStatus(INVALID) + last_verification_error
    → tag invalidation / polling → UI reflects ACTIVE / INVALID
```

The existing manual `POST /amazon/accounts/:id/verify` endpoint is repurposed to enqueue the same job (drops its inline Playwright), so the one login path serves manual re-verify too.

## Detailed changes

### 1. Status model — shared + DB

- `packages/shared/src/domain/amazon/amazon.enums.ts`: add `AmazonAccountStatus.VERIFYING = 'verifying'`.
- New migration (next number): `ALTER TABLE amazon_accounts ADD COLUMN last_verification_error TEXT NULL`. Cleared on successful verify.
- `AmazonAccountPublicDto` (`packages/shared/src/domain/amazon/amazon.dto.ts`): add `hasTwoFactor: boolean`. Derived in `toPublicDto` from `two_factor_secret IS NOT NULL`.

### 2. Backend DTO + service

- `UpdateAmazonAccountDto` (shared schema + backend DTO): add optional `email` with `@IsEmail`. Zod mirror updated.
- `AmazonAccountsService`:
  - `update` writes `email` when provided.
  - `create` stores `status = VERIFYING` (was `ACTIVE`).
  - `update`: detect credential change (compare incoming `email`/`password`/`twoFactorSecret` against stored). On change → set `status = VERIFYING`. On label-only → leave status untouched. Returns enough info for the controller to enqueue.
  - `toPublicDto` sets `hasTwoFactor`.
  - New helper to write `last_verification_error`.
- `markVerified` already clears nothing — extend to clear `last_verification_error`.

### 3. Verify queue

- New BullMQ queue `amazon-verify`, registered in `AmazonModule`.
- `AmazonVerifyQueueService` (producer, `@InjectQueue('amazon-verify')`): `enqueue(userId, accountId)` — `jobId` bucketed per account (one in-flight verify per account; a second save replaces/coalesces).
- `AmazonVerifyProcessorService` (`@Processor('amazon-verify')`, concurrency 1 — Playwright is heavy; the existing per-account rate limiter (1 concurrent, 3s spacing) governs the actual browser action):
  - `getDecrypted` → `performLogin(...)`.
  - Success → `markVerified`.
  - Failure (thrown `'login failed'`/`'Invalid credentials'`, captcha, timeout) → `updateStatus(INVALID)` + `last_verification_error` = normalized reason.
  - `attempts: 2`, exponential backoff (a transient captcha may clear on retry). Wrapped so a processor throw never leaves the account stuck in `verifying` — terminal attempts set `INVALID`.

### 4. Controller

- `POST /amazon/accounts`: after `create`, call `verifyQueue.enqueue(userId, account.id)`.
- `PUT /amazon/accounts/:id`: after `update`, if the service signals a credential change, `verifyQueue.enqueue(...)`.
- `POST /amazon/accounts/:id/verify`: replace inline Playwright with `verifyQueue.enqueue(...)` (manual re-verify).

### 5. Frontend — card hover

`AmazonAccountsDrawer.style.ts`: `SelectableCard` switches from `Card variant="interactive"` → `variant="bordered"` (no hover border). The existing `$selected` brand-primary border + `shadows.sm` remains the only emphasis.

### 6. Frontend — edit drawer (`AmazonAccountDrawer.tsx`)

- **Email**: remove `isDisabled={isEdit}` and the `emailReadOnly` caption. Always editable. Include `email` in the update payload type (`UpdateAmazonAccountFormData`).
- **2FA**: keep the empty field; replace caption with a "leave blank to keep current" hint; render a `2FA set` / `not set` badge from `hasTwoFactor`.
- **Password**: unchanged.
- **Status badge**: add a `verifying` variant ("doğrulanıyor", info tone + small spinner) to the existing status→variant map.

### 7. Frontend — async feedback

- After `createAmazonAccount` / `updateAmazonAccount` mutations, invalidate the `Amazon` tag → list refetches and shows `verifying` immediately.
- Conditional `pollingInterval` on `getAmazonAccounts` while any account is `verifying`, stopping once all resolve to `active`/`invalid`/etc. Surfaces the final outcome without manual refresh.
- Drawer closes on save (verification continues in the background); the list card reflects `verifying` → `active`/`invalid`.

### 8. i18n

Update `packages/shared/src/i18n/resources/{en,tr}/amazon.json` and `translation.json`:
- `statusVerifying` / "doğrulanıyor".
- 2FA "set"/"not set" badge labels.
- 2FA "leave blank to keep current" hint.
- Remove the `emailReadOnly` caption usage (string can stay for now or be removed).

## Data flow summary

Create or credential-changing update → store `verifying` + enqueue → `performLogin` → `markVerified` (`active`) or `INVALID` + reason → UI refetch/poll → card & drawer reflect final status. Label-only update → no enqueue, status preserved.

## Open / deferred

- `last_verification_error` surfacing in the UI: stored now; a future addition can render it as a sub-caption under an `invalid` card. (Cheap to include during implementation if straightforward.)
- Polling cadence: pick a modest interval (e.g. 5s) while any account is `verifying`.
