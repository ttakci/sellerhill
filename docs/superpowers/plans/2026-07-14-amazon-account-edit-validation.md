# Amazon Buyer-Account Editing & Credential Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [`) syntax for tracking.

**Goal:** Make Amazon buyer accounts fully editable (email/password/2FA) on the Settings drawer, remove the redundant hover border on connected-account cards, and validate credentials on every create and credential-changing update by running the real 2FA-aware Amazon login in the background — the account shows `verifying` immediately and resolves to `active`/`invalid`.

**Architecture:** A new BullMQ `amazon-verify` queue runs the existing `AmazonScrapingService.performLogin` (the only login code path). Create and credential-changing updates persist the account with `status = verifying` and enqueue a verify job; the worker flips status to `active` (success) or `invalid` (failure + stored reason). The shared `Card`/`StatusBadge` atoms and RTK Query tag invalidation handle the UI feedback; conditional polling surfaces the final outcome.

**Tech Stack:** NestJS 10, BullMQ (Redis), raw `pg`, class-validator + Zod (shared), React 18 + RTK Query, Emotion, i18n.

## Global Constraints

- **No tests in this repo** (CLAUDE.md). Verify every task with `pnpm typecheck` (strict, reports all errors — pre-existing web errors are okay as long as you introduce none) + `pnpm lint` (max-warnings 0) + manual app verification. Do not add Jest tests.
- **No `any`, no hardcoded UI strings, no hardcoded colors/spacing, no inline styles, no native HTML form controls** — use `tkn()` tokens, `ModernTextInput`, `StatusBadge`, enums for status values. (CLAUDE.md Architectural Rules.)
- **Container/Component split** — logic in `.container.tsx`, markup in `.component.tsx`, `styled(...)` only in `.style.ts`, types in `.types.ts`.
- **Status values must come from the `AmazonAccountStatus` enum** — never string literals like `'verifying'` in app code.
- **Pre-commit hook runs `pnpm lint` only** — do not use `--no-verify`.
- Shared package must be rebuilt (`pnpm build` or the dev workspace resolve) for apps to pick up changes; `pnpm dev`/`pnpm build` handles this.
- Spec: `docs/superpowers/specs/2026-07-14-amazon-account-edit-validation-design.md`.

---

## File Structure

**Shared (`packages/shared/src/`):**
- Modify `domain/amazon/amazon.enums.ts` — add `VERIFYING`.
- Modify `domain/amazon/amazon.dto.ts` — add `hasTwoFactor`, `lastVerificationError` to `AmazonAccountPublicDto`.
- Modify `schemas/amazon/amazon-account.schema.ts` — add `email` to `UpdateAmazonAccountDto` + Zod mirror.

**Backend (`apps/api/src/modules/amazon/`):**
- Create `migrations/028_amazon_accounts_verification_error.sql` — add `last_verification_error` column.
- Modify `amazon-accounts.service.ts` — `create` stores `verifying`; `update` handles `email` + credential-change detection + returns `{ account, credentialsChanged }`; `markVerified` clears error; new `markInvalid(userId, id, reason)`; `toPublicDto` adds new fields.
- Modify `amazon-scraping.service.ts` — new public `testLogin(userId, accountId)` wrapper around private `performLogin`.
- Create `amazon-verify-queue.service.ts` — BullMQ producer.
- Create `amazon-verify-processor.service.ts` — BullMQ consumer.
- Modify `amazon.module.ts` — register `amazon-verify` queue + new providers.
- Modify `amazon.controller.ts` — enqueue on create/credential-update/manual-verify; drop inline Playwright.

**UI package (`packages/ui/src/`):**
- Modify `molecules/StatusBadge/StatusBadge.types.ts` — add `verifying` tone key + union member.

**i18n (`packages/shared/src/i18n/resources/{en,tr}/`):**
- Modify `amazon.json` — `statusVerifying`.
- Modify `translation.json` — `amazonEdit.twoFactorHint`, `amazonEdit.twoFactorBadgeSet`, `amazonEdit.twoFactorBadgeNotSet`; keep `emailReadOnly` string (unused after edit but harmless).

**Frontend (`apps/web/src/`):**
- Modify `features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.component.tsx` — `variant="bordered"` (kill hover); render invalid reason caption.
- Modify `features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.container.tsx` — thread `lastVerificationError` into card view.
- Modify `features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.types.ts` — add `lastVerificationError?` to `AmazonAccountCardView`.
- Modify `features/settings/drawers/AmazonAccountDrawer.tsx` — email editable; 2FA badge + hint; `email` in update payload.
- Modify `features/settings/SettingsPage/SettingsHubPage.container.tsx` — conditional polling while any account is `verifying`.
- Modify `features/amazon/accounts/AmazonAccountsPage.component.tsx` — add `verifying: 'info'` to `STATUS_VARIANT_MAP` (consistency).

---

### Task 1: Shared — status enum, DTOs, Zod schemas

**Files:**
- Modify: `packages/shared/src/domain/amazon/amazon.enums.ts`
- Modify: `packages/shared/src/domain/amazon/amazon.dto.ts`
- Modify: `packages/shared/src/schemas/amazon/amazon-account.schema.ts`

**Interfaces:**
- Produces: `AmazonAccountStatus.VERIFYING = 'verifying'`; `AmazonAccountPublicDto.hasTwoFactor?: boolean` and `lastVerificationError?: string | null`; `UpdateAmazonAccountDto.email?: string` (`@IsEmail`); `updateAmazonAccountSchema` shape gains optional `email`; `UpdateAmazonAccountFormData` gains optional `email`.

- [ ] **Step 1: Add `VERIFYING` to the enum**

`packages/shared/src/domain/amazon/amazon.enums.ts` — replace the whole file:

```ts
export enum AmazonAccountStatus {
  ACTIVE = 'active',
  VERIFYING = 'verifying',
  INVALID = 'invalid',
  NEEDS_REAUTH = 'needs_reauth',
  LOCKED = 'locked',
}
```

- [ ] **Step 2: Extend the public DTO**

`packages/shared/src/domain/amazon/amazon.dto.ts` — add two optional fields to `AmazonAccountPublicDto` (after `status`):

```ts
export class AmazonAccountPublicDto {
  id!: string;
  userId!: string;
  label?: string;
  email!: string;
  status!: AmazonAccountStatus;
  hasTwoFactor?: boolean;
  lastVerificationError?: string | null;
  lastVerifiedAt?: string;
  lastUsedAt?: string;
  createdAt!: string;
  updatedAt!: string;
}
```

- [ ] **Step 3: Add `email` to the update DTO + Zod mirror**

`packages/shared/src/schemas/amazon/amazon-account.schema.ts` — add an optional `email` to `UpdateAmazonAccountDto` (after `label`):

```ts
export class UpdateAmazonAccountDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsOptional()
  @IsString()
  twoFactorSecret?: string;
}
```

And add `email` to `updateAmazonAccountSchema`:

```ts
export const updateAmazonAccountSchema = z.object({
  label: z.string().max(100).optional(),
  email: z.string().email('Please enter a valid email').optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  twoFactorSecret: z.string().optional(),
});
```

(`UpdateAmazonAccountFormData = z.infer<typeof updateAmazonAccountSchema>` picks up `email` automatically — do not redeclare it.)

- [ ] **Step 4: Verify**

Run: `pnpm --filter @repo/shared build && pnpm typecheck`
Expected: shared builds clean; typecheck introduces no new errors in shared.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/domain/amazon/amazon.enums.ts packages/shared/src/domain/amazon/amazon.dto.ts packages/shared/src/schemas/amazon/amazon-account.schema.ts
git commit -m "feat(shared): add AmazonAccountStatus.VERIFYING, editable email on update, public hasTwoFactor/lastVerificationError"
```

---

### Task 2: DB migration — `last_verification_error` column

**Files:**
- Create: `apps/api/migrations/028_amazon_accounts_verification_error.sql`
- Modify: `docker/postgres/init.sql` (mirror the column into the bootstrap schema)

**Interfaces:** none (pure schema).

- [ ] **Step 1: Create the migration**

`apps/api/migrations/028_amazon_accounts_verification_error.sql`:

```sql
-- Stores the reason the last verification attempt failed (null when verified/never failed).
-- Surfaced to the owner on the connected-accounts card when status = invalid.
ALTER TABLE amazon_accounts ADD COLUMN IF NOT EXISTS last_verification_error TEXT;
```

- [ ] **Step 2: Mirror into the bootstrap schema**

In `docker/postgres/init.sql`, inside the `CREATE TABLE IF NOT EXISTS amazon_accounts (...)` block, add the column after `status` so a fresh DB matches:

```sql
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    last_verification_error TEXT,
```

- [ ] **Step 3: Apply the migration to the running DB**

Run: `pnpm docker:up` (if not already up), then apply the migration. The repo applies migrations via the API's migration runner on boot — restart the API (`pnpm dev:api`) and confirm the column exists:

```bash
docker compose exec postgres psql -U postgres -d zonds -c "\d amazon_accounts"
```

Expected: `last_verification_error | text` appears in the column list.

- [ ] **Step 4: Commit**

```bash
git add apps/api/migrations/028_amazon_accounts_verification_error.sql docker/postgres/init.sql
git commit -m "feat(db): add amazon_accounts.last_verification_error (028)"
```

---

### Task 3: Backend — `AmazonAccountsService` (create verifying, update email + change detection, markInvalid, public DTO fields)

**Files:**
- Modify: `apps/api/src/modules/amazon/amazon-accounts.service.ts`

**Interfaces:**
- Consumes: `AmazonAccountStatus.VERIFYING` (Task 1), `last_verification_error` column (Task 2).
- Produces:
  - `create(...)` → still returns `AmazonAccountPublicDto`, but inserts `status = VERIFYING`.
  - `update(userId, id, data)` → now returns `{ account: AmazonAccountPublicDto; credentialsChanged: boolean }`. `data` gains optional `email`.
  - `markInvalid(userId, id, reason): Promise<void>` — sets `status = INVALID` + `last_verification_error = reason`.
  - `markVerified` now also clears `last_verification_error`.
  - `toPublicDto` emits `hasTwoFactor` and `lastVerificationError`.

- [ ] **Step 1: Extend `AmazonAccountRow` with the new column**

In `apps/api/src/modules/amazon/amazon-accounts.service.ts`, add the field to the `AmazonAccountRow` interface (after `status`):

```ts
export interface AmazonAccountRow {
  id: string;
  user_id: string;
  label: string;
  email: string;
  encrypted_password: string;
  two_factor_secret: string;
  status: string;
  last_verification_error: string | null;
  last_verified_at: Date;
  last_used_at: Date;
  created_at: Date;
  updated_at: Date;
}
```

- [ ] **Step 2: `create` inserts `VERIFYING`**

Replace the `create` method body's `RETURNING` insert to use `AmazonAccountStatus.VERIFYING` instead of `ACTIVE`:

```ts
  async create(
    userId: string,
    data: { label?: string; email: string; password: string; twoFactorSecret?: string }
  ) {
    const encryptedPassword = this.encryption.encrypt(data.password);
    const encryptedTwoFactor = data.twoFactorSecret
      ? this.encryption.encrypt(data.twoFactorSecret)
      : null;

    const rows = await this.databaseService.query<AmazonAccountRow>(
      `INSERT INTO amazon_accounts (user_id, label, email, encrypted_password, two_factor_secret, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, data.label || null, data.email, encryptedPassword, encryptedTwoFactor, AmazonAccountStatus.VERIFYING]
    );

    return this.toPublicDto(rows[0]);
  }
```

- [ ] **Step 3: Rewrite `update` to accept `email`, detect credential change, return `{ account, credentialsChanged }`**

Replace the entire `update` method with:

```ts
  async update(
    userId: string,
    id: string,
    data: { label?: string; email?: string; password?: string; twoFactorSecret?: string }
  ): Promise<{ account: AmazonAccountPublicDto; credentialsChanged: boolean }> {
    const existing = await this.findOne(userId, id);

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    let credentialsChanged = false;

    if (data.label !== undefined) {
      updates.push(`label = $${paramIndex}`);
      params.push(data.label);
      paramIndex++;
    }

    if (data.email !== undefined && data.email !== existing.email) {
      updates.push(`email = $${paramIndex}`);
      params.push(data.email);
      paramIndex++;
      credentialsChanged = true;
    }

    if (data.password !== undefined) {
      updates.push(`encrypted_password = $${paramIndex}`);
      params.push(this.encryption.encrypt(data.password));
      paramIndex++;
      credentialsChanged = true;
    }

    if (data.twoFactorSecret !== undefined) {
      updates.push(`two_factor_secret = $${paramIndex}`);
      params.push(data.twoFactorSecret ? this.encryption.encrypt(data.twoFactorSecret) : null);
      paramIndex++;
      credentialsChanged = true;
    }

    if (credentialsChanged) {
      // Re-verify against Amazon; clear any stale failure reason while in-flight.
      updates.push(`status = $${paramIndex}`);
      params.push(AmazonAccountStatus.VERIFYING);
      paramIndex++;
      updates.push(`last_verification_error = NULL`);
    }

    params.push(id, userId);
    const rows = await this.databaseService.query<AmazonAccountRow>(
      `UPDATE amazon_accounts SET ${updates.join(', ')} WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
       RETURNING *`,
      params
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Amazon account ${id} not found`);
    }

    return { account: this.toPublicDto(rows[0]), credentialsChanged };
  }
```

Note: the import for `AmazonAccountPublicDto` must be added — change the existing `import { AmazonAccountStatus } from '@repo/shared';` to:

```ts
import { AmazonAccountStatus, type AmazonAccountPublicDto } from '@repo/shared';
```

- [ ] **Step 4: `markVerified` clears the error; add `markInvalid`**

Replace the `markVerified` method and add `markInvalid` immediately after it:

```ts
  async markVerified(userId: string, id: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE amazon_accounts
         SET status = $1, last_verified_at = CURRENT_TIMESTAMP, last_verification_error = NULL, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3`,
      [AmazonAccountStatus.ACTIVE, id, userId]
    );
  }

  async markInvalid(userId: string, id: string, reason: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE amazon_accounts
         SET status = $1, last_verification_error = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4`,
      [AmazonAccountStatus.INVALID, reason, id, userId]
    );
  }
```

- [ ] **Step 5: Emit new fields from `toPublicDto`**

Replace the `toPublicDto` return object with:

```ts
    return {
      id: row.id,
      userId: row.user_id,
      label: row.label || undefined,
      email: row.email,
      status: row.status as AmazonAccountStatus,
      hasTwoFactor: !!row.two_factor_secret,
      lastVerificationError: row.last_verification_error ?? undefined,
      lastVerifiedAt: row.last_verified_at?.toISOString() || undefined,
      lastUsedAt: row.last_used_at?.toISOString() || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
```

- [ ] **Step 6: Verify**

Run: `pnpm typecheck`
Expected: no new errors in `apps/api` (the controller still calls `update` expecting a `PublicDto` — that break is fixed in Task 7; a transient type error in `amazon.controller.ts` is expected here and will be resolved by Task 7).

Run: `pnpm lint`
Expected: passes (max-warnings 0).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/amazon/amazon-accounts.service.ts
git commit -m "feat(api): AmazonAccountsService stores verifying, detects credential changes, markInvalid + public hasTwoFactor/lastVerificationError"
```

---

### Task 4: Backend — public `testLogin` on `AmazonScrapingService`

**Files:**
- Modify: `apps/api/src/modules/amazon/amazon-scraping.service.ts`

**Interfaces:**
- Consumes: private `performLogin(accountId, email, password, twoFactorSecret)`, `rateLimiter.schedule`, `accountsService.getDecrypted`.
- Produces: `testLogin(userId, accountId): Promise<{ success: boolean; error?: string }>` — the single entry point the verify processor calls.

- [ ] **Step 1: Add the public `testLogin` method**

In `apps/api/src/modules/amazon/amazon-scraping.service.ts`, add this method to the `AmazonScrapingService` class (place it right before the `private async performLogin` method, around line 152):

```ts
  /**
   * Verifies that stored credentials can log into Amazon (2FA-aware).
   * Runs under the per-account rate limiter, reuses performLogin (the only
   * login code path), and never throws — callers get a result object.
   */
  async testLogin(
    userId: string,
    amazonAccountId: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.rateLimiter.schedule(amazonAccountId, async () => {
      const account = await this.accountsService.getDecrypted(userId, amazonAccountId);
      try {
        const page = await this.performLogin(
          amazonAccountId,
          account.email,
          account.decryptedPassword,
          account.decryptedTwoFactorSecret
        );
        await page.close();
        return { success: true };
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Verify login failed for account ${amazonAccountId}: ${message}`);
        return { success: false, error: message };
      }
    });
  }
```

(`performLogin` already clears browser state on a credential-error path; on success it saves state — both correct for verification.)

- [ ] **Step 2: Verify**

Run: `pnpm typecheck`
Expected: no new errors in `apps/api`.

Run: `pnpm lint`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/amazon/amazon-scraping.service.ts
git commit -m "feat(api): expose AmazonScrapingService.testLogin (2FA-aware credential check)"
```

---

### Task 5: Backend — `amazon-verify` queue producer + processor

**Files:**
- Create: `apps/api/src/modules/amazon/amazon-verify-queue.service.ts`
- Create: `apps/api/src/modules/amazon/amazon-verify-processor.service.ts`

**Interfaces:**
- Consumes: `AmazonScrapingService.testLogin` (Task 4), `AmazonAccountsService.markVerified`/`markInvalid`/`findOne` (Task 3).
- Produces:
  - `AmazonVerifyQueueService.enqueue(userId, accountId): Promise<void>` — adds a `verify-amazon-account` job, `jobId` bucketed per account (`verify-${accountId}`) so a second save coalesces with an in-flight one.
  - `AmazonVerifyProcessorService` (`@Processor('amazon-verify')`, concurrency 1) consumes `{ userId, accountId }`.

- [ ] **Step 1: Create the producer**

`apps/api/src/modules/amazon/amazon-verify-queue.service.ts`:

```ts
import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

interface VerifyAmazonAccountData {
  userId: string;
  accountId: string;
}

@Injectable()
export class AmazonVerifyQueueService {
  private readonly logger = new Logger(AmazonVerifyQueueService.name);

  constructor(
    @InjectQueue('amazon-verify') private readonly verifyQueue: Queue<VerifyAmazonAccountData>
  ) {}

  /**
   * Enqueue a credential verification. jobId is bucketed per account so a rapid
   * second save coalesces with any in-flight job rather than stacking logins.
   */
  async enqueue(userId: string, accountId: string): Promise<void> {
    await this.verifyQueue.add(
      'verify-amazon-account',
      { userId, accountId },
      {
        jobId: `verify-${accountId}`,
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
        attempts: 2,
        backoff: { type: 'exponential', delay: 30000 },
      }
    );
    this.logger.debug(`Enqueued verification for account ${accountId}`);
  }
}
```

- [ ] **Step 2: Create the processor**

`apps/api/src/modules/amazon/amazon-verify-processor.service.ts`:

```ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';

import { AmazonAccountsService } from './amazon-accounts.service';
import { AmazonScrapingService } from './amazon-scraping.service';

interface VerifyAmazonAccountData {
  userId: string;
  accountId: string;
}

/**
 * Consumes `amazon-verify` jobs. Concurrency 1 — Playwright is heavy and the
 * scraping service's rate limiter already caps per-account browser actions.
 * Terminal outcome (success or final-attempt failure) always resolves the
 * account out of `verifying` so it can never get stuck in-flight.
 */
@Processor('amazon-verify', { concurrency: 1 })
export class AmazonVerifyProcessorService extends WorkerHost {
  private readonly logger = new Logger(AmazonVerifyProcessorService.name);

  constructor(
    private readonly accountsService: AmazonAccountsService,
    private readonly scrapingService: AmazonScrapingService
  ) {
    super();
  }

  async process(job: Job<VerifyAmazonAccountData>): Promise<void> {
    const { userId, accountId } = job.data;

    // Account may have been deleted between enqueue and execution.
    try {
      await this.accountsService.findOne(userId, accountId);
    } catch {
      this.logger.warn(`Account ${accountId} no longer exists; skipping verification`);
      return;
    }

    const result = await this.scrapingService.testLogin(userId, accountId);

    if (result.success) {
      await this.accountsService.markVerified(userId, accountId);
      this.logger.log(`Account ${accountId} verified successfully`);
      return;
    }

    // BullMQ will retry per `attempts`; only mark invalid on the final attempt
    // so a transient captcha/transport blip doesn't prematurely flip the status.
    const isFinalAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    if (isFinalAttempt) {
      await this.accountsService.markInvalid(userId, accountId, result.error ?? 'Verification failed');
      this.logger.warn(`Account ${accountId} marked invalid: ${result.error ?? 'unknown'}`);
    } else {
      // Let BullMQ retry by rethrowing; status stays `verifying`.
      throw new Error(result.error ?? 'Verification failed');
    }
  }
}
```

- [ ] **Step 3: Verify**

Run: `pnpm typecheck`
Expected: the two new files compile. (`AmazonModule` registration happens in Task 6; Nest injection errors aren't compile-time.)

Run: `pnpm lint`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/amazon/amazon-verify-queue.service.ts apps/api/src/modules/amazon/amazon-verify-processor.service.ts
git commit -m "feat(api): amazon-verify BullMQ queue (producer + 2FA-aware verify processor)"
```

---

### Task 6: Backend — register queue + providers in `AmazonModule`

**Files:**
- Modify: `apps/api/src/modules/amazon/amazon.module.ts`

**Interfaces:** none.

- [ ] **Step 1: Add imports**

Add to the import block at the top of `apps/api/src/modules/amazon/amazon.module.ts`:

```ts
import { AmazonVerifyProcessorService } from './amazon-verify-processor.service';
import { AmazonVerifyQueueService } from './amazon-verify-queue.service';
```

- [ ] **Step 2: Register the queue**

In the `imports` array, add `amazon-verify` alongside `amazon-tracking`:

```ts
  imports: [
    DatabaseModule,
    EbayModule,
    OrdersModule,
    BullModule.registerQueue({ name: 'amazon-tracking' }, { name: 'amazon-verify' }),
  ],
```

- [ ] **Step 3: Register the providers**

Add both services to the `providers` array and export the queue producer:

```ts
  providers: [
    BrowserStateManager,
    AmazonRateLimiter,
    AmazonAccountsService,
    AmazonScrapingService,
    AmazonOrderParserService,
    AmazonTrackingQueueService,
    AmazonTrackingProcessorService,
    AmazonVerifyQueueService,
    AmazonVerifyProcessorService,
  ],
  exports: [AmazonAccountsService, AmazonTrackingQueueService, AmazonVerifyQueueService],
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass.

Boot the API (`pnpm dev:api`) and confirm no DI errors in the log — the queue registers and the worker attaches to Redis.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/amazon/amazon.module.ts
git commit -m "feat(api): register amazon-verify queue + verify services in AmazonModule"
```

---

### Task 7: Backend — controller wires enqueue on create / credential-update / manual-verify

**Files:**
- Modify: `apps/api/src/modules/amazon/amazon.controller.ts`

**Interfaces:**
- Consumes: `AmazonAccountsService.update` new return shape (Task 3), `AmazonVerifyQueueService.enqueue` (Task 5).

- [ ] **Step 1: Inject the verify queue**

In `apps/api/src/modules/amazon/amazon.controller.ts`, add the import:

```ts
import { AmazonVerifyQueueService } from './amazon-verify-queue.service';
```

Add it to the constructor (after `trackingQueueService`):

```ts
  constructor(
    private readonly accountsService: AmazonAccountsService,
    private readonly scrapingService: AmazonScrapingService,
    private readonly trackingQueueService: AmazonTrackingQueueService,
    private readonly verifyQueueService: AmazonVerifyQueueService,
    private readonly databaseService: DatabaseService,
    private readonly orderSyncService: OrderSyncService
  ) {}
```

- [ ] **Step 2: Enqueue after `create`**

Replace the `createAccount` method body:

```ts
  @Post('accounts')
  async createAccount(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAmazonAccountDto
  ): Promise<AmazonAccountPublicDto> {
    const account = await this.accountsService.create(req.user.sub, {
      label: dto.label,
      email: dto.email,
      password: dto.password,
      twoFactorSecret: dto.twoFactorSecret,
    });
    await this.verifyQueueService.enqueue(req.user.sub, account.id);
    return account;
  }
```

- [ ] **Step 3: Enqueue after `update` only when credentials changed; pass `email`**

Replace the `updateAccount` method body (now passes `dto.email`, unpacks `{ account, credentialsChanged }`):

```ts
  @Put('accounts/:id')
  async updateAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAmazonAccountDto
  ): Promise<AmazonAccountPublicDto> {
    const { account, credentialsChanged } = await this.accountsService.update(req.user.sub, id, {
      label: dto.label,
      email: dto.email,
      password: dto.password,
      twoFactorSecret: dto.twoFactorSecret,
    });
    if (credentialsChanged) {
      await this.verifyQueueService.enqueue(req.user.sub, id);
    }
    return account;
  }
```

- [ ] **Step 4: Replace inline Playwright in `verifyAccount` with enqueue**

Replace the entire `verifyAccount` method (lines 75-112) with:

```ts
  @Post('accounts/:id/verify')
  async verifyAccount(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string
  ): Promise<{ success: boolean; message: string }> {
    // Mark verifying + enqueue a background login. The account resolves to
    // active/invalid asynchronously (see AmazonVerifyProcessorService).
    await this.accountsService.updateStatus(req.user.sub, id, AmazonAccountStatus.VERIFYING);
    await this.verifyQueueService.enqueue(req.user.sub, id);
    return { success: true, message: 'Verification started' };
  }
```

(`updateStatus` already exists from the original service; it does not touch `last_verification_error`, which is fine here — a manual re-verify clears the reason on success via `markVerified`.)

- [ ] **Step 5: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: both pass — this resolves the transient type error left by Task 3.

Run: `pnpm dev:api`, then exercise the flow manually (Task 12 covers full E2E; here just confirm the API boots and the routes register).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/amazon/amazon.controller.ts
git commit -m "feat(api): enqueue amazon-verify on create/credential-update/manual-verify; drop inline Playwright"
```

---

### Task 8: UI package — `StatusBadge` verifying tone

**Files:**
- Modify: `packages/ui/src/molecules/StatusBadge/StatusBadge.types.ts`

**Interfaces:**
- Produces: a `verifying` key in `getStatusColors` (info tint) and `verifying` added to the `StatusType` union. Children (e.g. a spinner) already render inline thanks to existing `gap`/`inline-flex`.

- [ ] **Step 1: Add `verifying` to the union**

In `packages/ui/src/molecules/StatusBadge/StatusBadge.types.ts`, add `'verifying'` to the `StatusType` union (keep it aligned with the existing list):

```ts
export type StatusType =
  | 'active' | 'verifying' | 'processing' | 'pending' | ... // (add 'verifying' to the existing union)
```

(Open the file, add `'verifying'` as one member of the existing `StatusType` union — do not remove existing members.)

- [ ] **Step 2: Add the `verifying` color mapping**

In the `getStatusColors()` `map` object, add a `verifying` entry keyed identically to the existing `processing`/info entries (copy the exact property names the surrounding entries use — `background`, `color`, `border` — pulling from `t.colors.semanticTint.info` / `t.colors.semantic.info` / `t.colors.semanticTintBorder.info`):

```ts
  verifying: {
    background: t.colors.semanticTint.info,
    color: t.colors.semantic.info,
    border: t.colors.semanticTintBorder.info,
  },
```

If the existing info-tinted entries use different property names (e.g. `bg` vs `background`), match those names exactly — the explorer confirmed `background`/`color`/`border`, but verify against the neighboring `processing` entry before saving.

- [ ] **Step 3: Verify**

Run: `pnpm --filter @repo/ui build && pnpm typecheck && pnpm lint`
Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/molecules/StatusBadge/StatusBadge.types.ts
git commit -m "feat(ui): add verifying tone to StatusBadge"
```

---

### Task 9: i18n — verifying status, 2FA hint + badge

**Files:**
- Modify: `packages/shared/src/i18n/resources/en/amazon.json`
- Modify: `packages/shared/src/i18n/resources/tr/amazon.json`
- Modify: `packages/shared/src/i18n/resources/en/translation.json`
- Modify: `packages/shared/src/i18n/resources/tr/translation.json`

**Interfaces:** none.

- [ ] **Step 1: Add `statusVerifying` to `amazon.accounts` (EN + TR)**

In `en/amazon.json`, inside the `accounts` object (next to `statusActive`/`statusInvalid`), add:

```json
"statusVerifying": "Verifying",
```

In `tr/amazon.json`, inside the `accounts` object, add:

```json
"statusVerifying": "Doğrulanıyor",
```

- [ ] **Step 2: Add 2FA hint + badge keys to `settingsHub.drawer.amazonEdit` (EN + TR)**

In `en/translation.json`, inside `settingsHub.drawer.amazonEdit`, add:

```json
"twoFactorHint": "Leave blank to keep the current 2FA secret",
"twoFactorBadgeSet": "2FA set",
"twoFactorBadgeNotSet": "2FA not set"
```

In `tr/translation.json`, inside `settingsHub.drawer.amazonEdit`, add:

```json
"twoFactorHint": "Mevcut 2FA secret'ını korumak için boş bırakın",
"twoFactorBadgeSet": "2FA kurulu",
"twoFactorBadgeNotSet": "2FA yok"
```

(Leave the existing `emailReadOnly` key in place — it becomes unused after Task 11 but is harmless to keep; removing it is optional.)

- [ ] **Step 3: Verify**

Run: `pnpm --filter @repo/shared build`
Expected: JSON parses, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/i18n/resources/en/amazon.json packages/shared/src/i18n/resources/tr/amazon.json packages/shared/src/i18n/resources/en/translation.json packages/shared/src/i18n/resources/tr/translation.json
git commit -m "feat(i18n): amazon statusVerifying + 2FA hint/badge (en/tr)"
```

---

### Task 10: Frontend — kill hover border on connected-account cards

**Files:**
- Modify: `apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.component.tsx`

**Interfaces:** none. (`SelectableCard` already keeps the `$selected` brand border + shadow from its style file; only the `variant` changes, which removes the `:hover` border that came from `Card`'s `interactive` variant.)

- [ ] **Step 1: Switch the card to `bordered`**

In `apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.component.tsx`, change the `variant` on `<S.SelectableCard>` from `"interactive"` to `"bordered"` (line ~37):

```tsx
            <S.SelectableCard
              key={a.id}
              variant="bordered"
              padding="none"
              $selected={a.id === selectedId}
```

(`bordered` has no `:hover` rule, so the redundant hover border disappears; the `$selected` transient in `AmazonAccountsDrawer.style.ts` still paints the brand-primary border + `shadows.sm` when selected.)

- [ ] **Step 2: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: passes.

Manual: open Settings → Connected Accounts; hover an unselected card — no border/shadow change; click to select — brand-primary border appears.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.component.tsx
git commit -m "fix(settings): remove redundant hover border on Amazon account cards (bordered variant)"
```

---

### Task 11: Frontend — editable email + 2FA badge/hint on edit drawer

**Files:**
- Modify: `apps/web/src/features/settings/drawers/AmazonAccountDrawer.tsx`

**Interfaces:**
- Consumes: `UpdateAmazonAccountFormData.email` (Task 1), `editingAccount.hasTwoFactor` (Task 3), i18n keys (Task 9).
- Produces: an edit drawer where email is always editable, the 2FA field shows a "set/not set" badge + "leave blank" hint, and the update payload includes `email`.

- [ ] **Step 1: Remove the email-disable + readOnly caption; email is always editable**

In `apps/web/src/features/settings/drawers/AmazonAccountDrawer.tsx`, change the email `ModernTextInput` — remove `isDisabled={isEdit}` (so the input is editable in both modes) and delete the `isEdit && emailReadOnly` caption block directly beneath it. The email field becomes:

```tsx
        <ModernTextInput
          name="email"
          label={t(`${prefix}.email`)}
          value={email}
          type="email"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
        />
```

- [ ] **Step 2: Add 2FA badge + hint under the 2FA field**

Import `Badge` (and confirm `Text` is already imported) from `@repo/ui`:

```tsx
import { Badge, Drawer, ModernTextInput, Text, useUI } from '@repo/ui';
```

Replace the 2FA `ModernTextInput` block (and add a caption row after it) with:

```tsx
        <ModernTextInput
          name="twoFactorSecret"
          label={t(`${prefix}.twoFactorSecret`)}
          value={twoFactorSecret}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTwoFactorSecret(e.target.value)}
        />
        {isEdit && (
          <Text variant="caption" color="text.tertiary">
            <Badge
              variant={
                editingAccount?.hasTwoFactor
                  ? 'success'
                  : 'neutral'
              }
              size="sm"
            >
              {t(
                editingAccount?.hasTwoFactor
                  ? 'translation:settingsHub.drawer.amazonEdit.twoFactorBadgeSet'
                  : 'translation:settingsHub.drawer.amazonEdit.twoFactorBadgeNotSet',
              )}
            </Badge>{' '}
            {t('translation:settingsHub.drawer.amazonEdit.twoFactorHint')}
          </Text>
        )}
```

If `Badge` does not accept `variant`/`size` with those exact values, open `packages/ui/src/atoms/Badge/` (or molecules) and use the props it actually exposes — keep `success`/`neutral` semantic tones; do not hardcode colors.

- [ ] **Step 3: Include `email` in the update payload**

In `handleSave`, update the `UpdateAmazonAccountFormData` object to include `email`:

```tsx
      const data: UpdateAmazonAccountFormData = {
        label: label || undefined,
        email,
        password: password || undefined,
        twoFactorSecret: twoFactorSecret || undefined,
      };
```

- [ ] **Step 4: Verify**

Run: `pnpm typecheck && pnpm lint`
Expected: passes.

Manual: open an existing account via Connected Accounts → Continue. Edit the email (now editable); the 2FA field shows a "2FA set"/"2FA not set" badge + the leave-blank hint; save closes the drawer and the card shows `verifying` (the backend enqueues).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/settings/drawers/AmazonAccountDrawer.tsx
git commit -m "feat(settings): editable email + 2FA badge/hint on Amazon account edit"
```

---

### Task 12: Frontend — conditional polling + invalid-reason caption + legacy map consistency

**Files:**
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.container.tsx`
- Modify: `apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.types.ts`
- Modify: `apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.container.tsx`
- Modify: `apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.component.tsx`
- Modify: `apps/web/src/features/amazon/accounts/AmazonAccountsPage.component.tsx`

**Interfaces:**
- Consumes: `AmazonAccountPublicDto.lastVerificationError` + `status` (Task 3), `AmazonAccountStatus.VERIFYING` (Task 1).

- [ ] **Step 1: Conditional polling in `SettingsHubPage.container.tsx`**

In `apps/web/src/features/settings/SettingsPage/SettingsHubPage.container.tsx`, change the accounts query to poll while any account is `verifying`. Import the enum:

```ts
import { AmazonAccountStatus } from '@repo/shared';
```

Replace the existing query line (around line 47):

```ts
  const { data: amazonData, isLoading: isAmazonLoading, error: amazonError } = useGetAmazonAccountsQuery();
```

with:

```ts
  const { data: amazonData, isLoading: isAmazonLoading, error: amazonError } = useGetAmazonAccountsQuery(
    undefined,
    {
      pollingInterval:
        amazonData?.some((a) => a.status === AmazonAccountStatus.VERIFYING) ? 5000 : 0,
    },
  );
```

(The `pollingInterval: 0` value disables polling once no account is verifying. RTK Query reads the option each render, so it stops/resumes reactively.)

- [ ] **Step 2: Thread `lastVerificationError` into the card view type**

In `apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.types.ts`, add the field to `AmazonAccountCardView`:

```ts
  lastVerificationError?: string;
```

(Open the file and add it next to the existing `status` field on `AmazonAccountCardView`.)

- [ ] **Step 3: Populate it in the container**

In `apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.container.tsx`, add `lastVerificationError` to the mapped card object:

```ts
  const cards: AmazonAccountCardView[] = accounts.map((a: AmazonAccountPublicDto) => ({
    id: a.id,
    displayName: a.label || a.email,
    email: a.email,
    connectedSince: formatDate(a.createdAt, locale, { year: 'numeric' }),
    status: a.status,
    lastVerificationError: a.lastVerificationError ?? undefined,
  }));
```

- [ ] **Step 4: Render the reason under an invalid card**

In `apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.component.tsx`, inside the `<S.AccountMetaList>` block, append a reason line that only renders when the account is invalid and a reason exists. Import the enum at the top:

```ts
import { AmazonAccountStatus } from '@repo/shared';
```

Add after the "Connected Since" `AccountMetaLine` (still inside `AccountMetaList`):

```tsx
                  {a.status === AmazonAccountStatus.INVALID && a.lastVerificationError && (
                    <S.AccountMetaLine>
                      <Icon name="alert-triangle" size={14} color="semantic.error" />
                      <Text variant="caption" color="semantic.error">
                        {a.lastVerificationError}
                      </Text>
                    </S.AccountMetaLine>
                  )}
```

(Confirm `alert-triangle` is an available icon name; if the icon map uses a different alias, pick the existing warning icon. Do not introduce a new inline SVG.)

- [ ] **Step 5: Legacy page consistency — add `verifying` to its status map**

In `apps/web/src/features/amazon/accounts/AmazonAccountsPage.component.tsx`, add `verifying: 'info'` to `STATUS_VARIANT_MAP`:

```ts
const STATUS_VARIANT_MAP: Record<string, 'success' | 'warning' | 'error' | 'info'> = {
  active: 'success',
  verifying: 'info',
  invalid: 'error',
  needs_reauth: 'warning',
  locked: 'error',
};
```

- [ ] **Step 6: Verify (typecheck + lint)**

Run: `pnpm typecheck && pnpm lint`
Expected: passes.

- [ ] **Step 7: E2E manual verification**

With `pnpm docker:up` + `pnpm dev` running and a valid `AMAZON_ENCRYPTION_KEY`:

1. **Create with good credentials** → card appears with `verifying` ("Doğrulanıyor"), then flips to `active` within ~1 min (polling refetches).
2. **Create with bad credentials** → `verifying` then `invalid`, with the captured reason under the card.
3. **Edit email/password** → status returns to `verifying`, resolves again.
4. **Edit only the label** → status does **not** change (no login triggered).
5. **Manual Verify button** (legacy page) → enqueues; status goes `verifying` → `active`/`invalid`.
6. **Hover** an unselected connected card → no border/shadow change.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/settings/SettingsPage/SettingsHubPage.container.tsx apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.types.ts apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.container.tsx apps/web/src/features/settings/drawers/AmazonAccountsDrawer/AmazonAccountsDrawer.component.tsx apps/web/src/features/amazon/accounts/AmazonAccountsPage.component.tsx
git commit -m "feat(settings): poll while verifying, surface invalid reason, verifying status consistency"
```

---

## Self-Review notes

- **Spec coverage:** hover-border fix → Task 10; editable email → Task 11 (+ DTO Task 1, service Task 3, controller Task 7); 2FA empty/confusing → Task 11 (badge + hint, secret stays server-side via `hasTwoFactor` Task 3); validation on every add + credential-changing update → Tasks 2–7; `verifying` status shown on card + drawer immediately → Tasks 8, 12; immediate start on save → controller enqueues synchronously in the same request (Task 7). All spec sections covered.
- **Type consistency:** `update` returns `{ account, credentialsChanged }` (Task 3) and is consumed exactly so in Task 7. `testLogin` (Task 4) returns `{ success, error? }` consumed in Task 5. `hasTwoFactor`/`lastVerificationError` flow shared (Task 1/3) → card view (Task 12) → component. `VERIFYING` enum used everywhere instead of literals.
- **Verification without tests:** each task ends with `pnpm typecheck` + `pnpm lint` + (where relevant) manual steps; Task 12 step 7 is the end-to-end check.
