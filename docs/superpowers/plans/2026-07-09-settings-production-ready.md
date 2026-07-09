# Settings Production Ready — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Settings hub production-ready by removing non-functional sections (API Access, 2FA, Notifications, Plan) and implementing the remaining ones with real backends (Change Password, Deactivate Account).

**Architecture:** Backend additions live in the existing `auth` module (NestJS). New shared DTOs/Zod schemas extend `packages/shared/src/domain/auth/`. Frontend mutations extend `authApi.ts`. Settings hub simplifies to Profile, eBay, Amazon, Store Config, Listing Groups, Security (Password + Language), and Danger Zone. Deactivation uses a modal (destructive confirmation pattern), not a drawer.

**Tech Stack:** NestJS 10, raw `pg`, bcrypt, Zod, class-validator, React 18, Redux Toolkit + RTK Query, Emotion, i18next (EN + TR).

## Global Constraints

- **No hardcoded strings.** All UI strings via `t()`. Domain constants (status, types) via enums from `packages/shared`.
- **No hardcoded colors/spacing.** Use `tkn('colors.*')` / `tkn('spacing.*')`.
- **Container/component split.** Stateful components must split `.container.tsx` + `.component.tsx` + `.style.ts` + `.types.ts`. Component files allowed hooks: `useTranslation`, `useTheme`. Exempt: landing, RTK api files, `store.ts`, configs.
- **Design system only.** Form controls from `@repo/ui` (ModernTextInput, Button, Modal, etc.). No raw `<input>`, `<button>`, `<select>`.
- **i18n namespaces:** Dot notation for primary (`settingsHub.sections.danger.title`), colon for cross-namespace (`translation:settingsHub.sections.danger.title`).
- **Auth error keys:** Backend throws keys like `auth.errors.wrongPassword`. Frontend resolves via `getErrorI18nKey(error)` → `auth:auth.errors.wrongPassword`. Keys must exist in `auth.json` (both EN + TR).
- **Password rules:** `AUTH_CONSTANTS.PASSWORD_MIN_LENGTH = 8`, `PASSWORD_MAX_LENGTH = 100` (from `packages/shared/src/domain/auth/auth.constants.ts`).
- **Commits:** Run `pnpm validate` before each commit. Never use `--no-verify`.
- **Build packages first:** After any `packages/shared` or `packages/ui` change, run `pnpm --filter @repo/shared build` (and `@repo/ui` if touched) before apps can typecheck.

---

## File Structure

**Backend (NestJS):**
- Modify: `apps/api/src/modules/auth/auth.service.ts` — add `changePassword()`, `deactivateAccount()`
- Modify: `apps/api/src/modules/auth/auth.controller.ts` — add `@Patch('password')`, `@Post('deactivate')`
- Create: `apps/api/src/modules/auth/dto/change-password.dto.ts`
- (No DTO needed for deactivate — no body)

**Shared package:**
- Modify: `packages/shared/src/domain/auth/auth.dto.ts` — add `ChangePasswordRequestDto`
- Modify: `packages/shared/src/domain/auth/auth.types.ts` — add `ChangePasswordRequest`, `GenericSuccessResponse` interfaces
- Create: `packages/shared/src/schemas/auth/change-password.schema.ts`
- Modify: `packages/shared/src/schemas/auth/index.ts` — re-export change-password schema

**i18n (both EN + TR):**
- Modify: `packages/shared/src/i18n/resources/en/translation.json` — add `settingsHub.modal.deactivate.*`, `settingsHub.drawer.password.{sameAsCurrent,successHeader,successDescription}`, update `settingsHub.sections.account.subtitle` (drop 2FA/API/lang mention), remove `sections.{account.twoFactor, account.apiAccess, notifications, plan}`, remove `drawer.{twoFactor, apiAccess, notifications}`, remove `notImplemented`
- Modify: `packages/shared/src/i18n/resources/en/auth.json` — add `errors.wrongPassword`, `errors.samePassword`
- Same for TR: `packages/shared/src/i18n/resources/tr/translation.json`, `packages/shared/src/i18n/resources/tr/auth.json`

**Frontend:**
- Modify: `apps/web/src/features/auth/api/authApi.ts` — add `changePassword`, `deactivateAccount` mutations
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.types.ts` — trim `SettingsDrawerKey`, add deactivate modal prop
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.container.tsx` — add deactivate modal state
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.component.tsx` — remove ApiAccess/Plan/Notifications refs, slim AccountSecurity, change DangerZone handler
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.style.ts` — if layout breaks (verify after edit)
- Modify: `apps/web/src/features/settings/drawers/index.ts` — remove deleted exports
- Modify: `apps/web/src/features/settings/drawers/ChangePasswordDrawer.tsx` — rewrite to use API
- Delete: `apps/web/src/features/settings/drawers/ApiAccessDrawer.tsx`
- Delete: `apps/web/src/features/settings/drawers/TwoFactorDrawer.tsx`
- Delete: `apps/web/src/features/settings/drawers/NotificationsDrawer.tsx`
- Delete: `apps/web/src/features/settings/drawers/NotImplementedNotice.tsx`
- Create: `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.container.tsx`
- Create: `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.component.tsx`
- Create: `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.style.ts`
- Create: `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.types.ts`
- Create: `apps/web/src/features/settings/components/DeactivateAccountModal/index.ts`

---

## Task 1: Shared — ChangePassword types + Zod schema

**Files:**
- Modify: `packages/shared/src/domain/auth/auth.types.ts`
- Modify: `packages/shared/src/domain/auth/auth.dto.ts`
- Create: `packages/shared/src/schemas/auth/change-password.schema.ts`
- Modify: `packages/shared/src/schemas/auth/index.ts`

**Interfaces:**
- Produces: `ChangePasswordRequest` (interface), `ChangePasswordRequestDto` (class), `GenericSuccessResponse`, `changePasswordSchema(t)` (Zod schema)

- [ ] **Step 1: Add types to `auth.types.ts`**

Open `packages/shared/src/domain/auth/auth.types.ts`. At end of file, add:

```ts
/**
 * Change password request payload
 */
export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Generic success response (no data)
 */
export interface GenericSuccessResponse {
  success: boolean;
}
```

- [ ] **Step 2: Add DTO class to `auth.dto.ts`**

Open `packages/shared/src/domain/auth/auth.dto.ts`. At end of file, add:

```ts
export class ChangePasswordRequestDto {
  currentPassword!: string;
  newPassword!: string;
}

export class GenericSuccessResponseDto {
  success!: boolean;
}
```

- [ ] **Step 3: Create Zod schema**

Create `packages/shared/src/schemas/auth/change-password.schema.ts`:

```ts
/**
 * Change Password Form Validation Schema
 */

import type { TFunction } from 'i18next';
import { z } from 'zod';

import { AUTH_CONSTANTS } from '../../domain/auth/auth.constants';

export const changePasswordSchema = (t: TFunction) =>
  z
    .object({
      currentPassword: z.string().min(1, t('translation:validation.required')),
      newPassword: z
        .string()
        .min(
          AUTH_CONSTANTS.PASSWORD_MIN_LENGTH,
          t('translation:settingsHub.drawer.password.tooShort')
        )
        .max(
          AUTH_CONSTANTS.PASSWORD_MAX_LENGTH,
          t('translation:validation.maxLength', {
            max: AUTH_CONSTANTS.PASSWORD_MAX_LENGTH,
          })
        ),
      confirmPassword: z.string().min(1, t('translation:validation.required')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('translation:settingsHub.drawer.password.mismatch'),
      path: ['confirmPassword'],
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
      message: t('translation:settingsHub.drawer.password.sameAsCurrent'),
      path: ['newPassword'],
    });

export type ChangePasswordFormData = z.infer<ReturnType<typeof changePasswordSchema>>;
```

- [ ] **Step 4: Re-export from schema index**

Open `packages/shared/src/schemas/auth/index.ts`. Add line:

```ts
export * from './change-password.schema';
```

- [ ] **Step 5: Build shared package**

Run: `pnpm --filter @repo/shared build`
Expected: Build succeeds, no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/domain/auth/auth.types.ts \
  packages/shared/src/domain/auth/auth.dto.ts \
  packages/shared/src/schemas/auth/change-password.schema.ts \
  packages/shared/src/schemas/auth/index.ts \
  packages/shared/dist
git commit -m "feat(shared): add ChangePassword types and Zod schema"
```

---

## Task 2: i18n — Add new keys, remove dead keys

**Files:**
- Modify: `packages/shared/src/i18n/resources/en/translation.json`
- Modify: `packages/shared/src/i18n/resources/tr/translation.json`
- Modify: `packages/shared/src/i18n/resources/en/auth.json`
- Modify: `packages/shared/src/i18n/resources/tr/auth.json`

**Interfaces:**
- Produces i18n keys used by later tasks:
  - `settingsHub.modal.deactivate.{title, warning, typeEmail, confirmLabel, cancelLabel, successHeader, successDescription}`
  - `settingsHub.drawer.password.{sameAsCurrent, successHeader, successDescription}`
  - `auth:auth.errors.wrongPassword`, `auth:auth.errors.samePassword`

- [ ] **Step 1: Update EN `translation.json` — add modal + new password keys**

Under `settingsHub.drawer.password` (after `tooShort`), add:

```json
        "sameAsCurrent": "New password must be different from current",
        "successHeader": "Password updated",
        "successDescription": "Your password has been changed successfully."
```

Under `settingsHub.drawer` (after `language` block, before closing brace), add a `deactivate` modal sibling. Actually add at top level of `settingsHub` after `drawer`:

```json
    "modal": {
      "deactivate": {
        "title": "Deactivate account",
        "warning": "This will revoke your access to Zonds. Your listings, orders, and connected accounts will remain in the system but you will not be able to sign in.",
        "typeEmail": "To confirm, type your email address below:",
        "emailPlaceholder": "{{email}}",
        "confirmLabel": "Deactivate account",
        "cancelLabel": "Cancel",
        "successHeader": "Account deactivated",
        "successDescription": "Your account has been deactivated. You will be signed out."
      }
    }
```

Update `settingsHub.sections.account.subtitle` to:

```json
"subtitle": "Password and language preferences"
```

- [ ] **Step 2: Remove dead EN keys**

In `settingsHub.sections.account`: delete keys `twoFactor`, `apiAccess`.
In `settingsHub.sections`: delete `notifications` and `plan` blocks entirely.
In `settingsHub.drawer`: delete `twoFactor`, `apiAccess`, `notifications` blocks.
Delete `settingsHub.notImplemented` entirely.
Also delete `settingsHub.sections.profile.plan` (was `"Pro Plan"`) — no longer used.

Verify (grep): `grep -E "(apiAccess|twoFactor|notImplemented|\"plan\"|\"notifications\")" packages/shared/src/i18n/resources/en/translation.json` should return nothing under `settingsHub` (top-level `notifications` outside settingsHub at line ~127 stays untouched — verify it is not under settingsHub).

- [ ] **Step 3: Apply identical structure to TR `translation.json`**

Mirror EN changes for TR. TR values:

```json
"settingsHub.sections.account.subtitle": "Şifre ve dil tercihleri"

settingsHub.drawer.password additions:
  "sameAsCurrent": "Yeni şifre mevcut şifreden farklı olmalı",
  "successHeader": "Şifre güncellendi",
  "successDescription": "Şifreniz başarıyla değiştirildi."

settingsHub.modal.deactivate:
  "title": "Hesabı devre dışı bırak",
  "warning": "Zonds erişiminiz iptal edilir. Listeleriniz, siparişleriniz ve bağlı hesaplarınız sistemde kalır ancak oturum açamazsınız.",
  "typeEmail": "Onaylamak için aşağıya e-posta adresinizi yazın:",
  "emailPlaceholder": "{{email}}",
  "confirmLabel": "Hesabı devre dışı bırak",
  "cancelLabel": "İptal",
  "successHeader": "Hesap devre dışı bırakıldı",
  "successDescription": "Hesabınız devre dışı bırakıldı. Oturumunuz kapatılacak."
```

- [ ] **Step 4: Add to EN `auth.json` under `auth.errors`**

```json
      "wrongPassword": "Current password is incorrect",
      "samePassword": "New password must be different from current",
      "inactive": "Account is deactivated"
```

(Also add `inactive` — needed because `auth.service.login()` throws `auth.errors.inactive` and a deactivated user re-trying to login needs a localized message. Check existing TR file first; if missing, add.)

- [ ] **Step 5: Add to TR `auth.json` under `auth.errors`**

```json
      "wrongPassword": "Mevcut şifre hatalı",
      "samePassword": "Yeni şifre mevcut şifreden farklı olmalı",
      "inactive": "Hesap devre dışı bırakılmış"
```

- [ ] **Step 6: Build shared + validate JSON**

Run: `pnpm --filter @repo/shared build && pnpm typecheck`
Expected: No errors. JSON parse errors mean syntax mistakes — fix.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/i18n packages/shared/dist
git commit -m "feat(i18n): add deactivate/change-password keys, remove apiAccess/twoFactor/notifications/plan"
```

---

## Task 3: Backend — AuthService methods

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/dto/change-password.dto.ts`

**Interfaces:**
- Consumes: `ChangePasswordRequest` from `@repo/shared`
- Produces: `AuthService.changePassword(userId, dto)` → `Promise<{ success: boolean }>`; `AuthService.deactivateAccount(userId)` → `Promise<{ success: boolean }>`

- [ ] **Step 1: Create DTO**

Create `apps/api/src/modules/auth/dto/change-password.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import type { ChangePasswordRequest } from '@repo/shared';
import { AUTH_CONSTANTS } from '@repo/shared';
import { IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';

export class ChangePasswordDto implements ChangePasswordRequest {
  @ApiProperty({ description: 'Current password', example: 'OldPass123' })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({ description: 'New password', example: 'NewSecurePass123' })
  @IsString()
  @MinLength(AUTH_CONSTANTS.PASSWORD_MIN_LENGTH)
  @MaxLength(AUTH_CONSTANTS.PASSWORD_MAX_LENGTH)
  newPassword!: string;
}
```

- [ ] **Step 2: Add `BadRequestException` to imports in `auth.service.ts`**

Open `apps/api/src/modules/auth/auth.service.ts`. Line 1 currently:
```ts
import { ConflictException, HttpException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
```
Replace with:
```ts
import { BadRequestException, ConflictException, HttpException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
```

- [ ] **Step 3: Add `changePassword` method**

In `AuthService` class, after the `getMe` method (before `refreshToken`), add:

```ts
  /**
   * Change password for authenticated user
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean }> {
    this.logger.log(`Change password attempt for user: ${userId}`);

    const users = await this.databaseService.query<UserEntity>(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (users.length === 0) {
      throw new UnauthorizedException('auth.errors.userNotFound');
    }

    const isCurrentValid = await bcrypt.compare(currentPassword, users[0].password_hash);
    if (!isCurrentValid) {
      throw new UnauthorizedException('auth.errors.wrongPassword');
    }

    if (currentPassword === newPassword) {
      throw new BadRequestException('auth.errors.samePassword');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.databaseService.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, userId]
    );

    this.logger.log(`Password changed successfully for user: ${userId}`);
    return { success: true };
  }
```

- [ ] **Step 4: Add `deactivateAccount` method**

Right after `changePassword`, add:

```ts
  /**
   * Deactivate (soft-delete) user account
   * Sets status to INACTIVE — user can no longer log in.
   * Referential integrity preserved (orders, listings, etc. kept).
   */
  async deactivateAccount(userId: string): Promise<{ success: boolean }> {
    this.logger.log(`Deactivating account: ${userId}`);

    await this.databaseService.query(
      'UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2',
      [UserStatus.INACTIVE, userId]
    );

    this.logger.log(`Account deactivated: ${userId}`);
    return { success: true };
  }
```

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/dto/change-password.dto.ts
git commit -m "feat(auth): add changePassword and deactivateAccount service methods"
```

---

## Task 4: Backend — Controller endpoints

**Files:**
- Modify: `apps/api/src/modules/auth/auth.controller.ts`

**Interfaces:**
- Produces: `PATCH /v1/auth/password` (JWT-guarded), `POST /v1/auth/deactivate` (JWT-guarded)

- [ ] **Step 1: Add imports**

Open `apps/api/src/modules/auth/auth.controller.ts`. Update nestjs import line:

```ts
import { Body, Controller, Get, HttpCode, HttpStatus, Patch, Post, Request, UseGuards } from '@nestjs/common';
```

Add to DTO imports:

```ts
import { ChangePasswordDto } from './dto/change-password.dto';
```

Add to `@repo/shared` import (extend the type import):

```ts
import type { AuthResponse, GenericSuccessResponse, RegistrationResponse, UserDto } from '@repo/shared';
```

- [ ] **Step 2: Add `changePassword` endpoint**

After `getMe` method, before the closing brace of the class, add:

```ts
  @Patch('password')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change password',
    description: 'Change password for the authenticated user. Requires current password verification.',
  })
  @ApiOkResponse({ description: 'Password changed successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid current password or not authenticated' })
  @ApiBadRequestResponse({ description: 'New password is same as current, or invalid input' })
  async changePassword(
    @Request() req: { user: { sub: string } },
    @Body() body: ChangePasswordDto
  ): Promise<GenericSuccessResponse> {
    return this.authService.changePassword(req.user.sub, body.currentPassword, body.newPassword);
  }
```

- [ ] **Step 3: Add `deactivate` endpoint**

Right after `changePassword`, add:

```ts
  @Post('deactivate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deactivate account',
    description: 'Soft-deletes the authenticated user account. User can no longer sign in. Data preserved.',
  })
  @ApiOkResponse({ description: 'Account deactivated successfully' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async deactivate(@Request() req: { user: { sub: string } }): Promise<GenericSuccessResponse> {
    return this.authService.deactivateAccount(req.user.sub);
  }
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 5: Manual sanity check (optional but recommended)**

If the API is running, you can curl:

```bash
# Get token first via login, then:
curl -X PATCH http://localhost:3000/api/v1/auth/password \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword":"test1234","newPassword":"newpass1234"}'
```
Expected: `{"success":true}` or proper error (401/400).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/auth/auth.controller.ts
git commit -m "feat(auth): add PATCH /password and POST /deactivate endpoints"
```

---

## Task 5: Frontend — authApi mutations

**Files:**
- Modify: `apps/web/src/features/auth/api/authApi.ts`

**Interfaces:**
- Consumes: `ChangePasswordRequest`, `GenericSuccessResponse` from `@repo/shared`
- Produces: `useChangePasswordMutation`, `useDeactivateAccountMutation` hooks

- [ ] **Step 1: Add type import**

Open `apps/web/src/features/auth/api/authApi.ts`. Update import line:

```ts
import type { AuthResponse, ChangePasswordRequest, GenericSuccessResponse, LoginRequest, RegisterRequest, RegistrationResponse, UserDto } from '@repo/shared';
```

- [ ] **Step 2: Add endpoints**

Inside `endpoints: (builder) => ({ ... })`, after the `getMe` query block, add:

```ts
    /**
     * Change password for authenticated user
     */
    changePassword: builder.mutation<GenericSuccessResponse, ChangePasswordRequest>({
      query: (body) => ({
        url: '/auth/password',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['Auth'],
    }),

    /**
     * Deactivate (soft-delete) the authenticated account
     */
    deactivateAccount: builder.mutation<GenericSuccessResponse, void>({
      query: () => ({
        url: '/auth/deactivate',
        method: 'POST',
      }),
      invalidatesTags: ['Auth'],
    }),
```

- [ ] **Step 3: Export hooks**

At bottom of file, in the existing `export const { ... } = authApi;` block, add:

```ts
  useChangePasswordMutation,
  useDeactivateAccountMutation,
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/auth/api/authApi.ts
git commit -m "feat(auth-api): add changePassword and deactivateAccount mutations"
```

---

## Task 6: Frontend — Delete unused drawers

**Files:**
- Delete: `apps/web/src/features/settings/drawers/ApiAccessDrawer.tsx`
- Delete: `apps/web/src/features/settings/drawers/TwoFactorDrawer.tsx`
- Delete: `apps/web/src/features/settings/drawers/NotificationsDrawer.tsx`
- Delete: `apps/web/src/features/settings/drawers/NotImplementedNotice.tsx`
- Modify: `apps/web/src/features/settings/drawers/index.ts`

- [ ] **Step 1: Delete files**

Run:
```bash
rm apps/web/src/features/settings/drawers/ApiAccessDrawer.tsx \
   apps/web/src/features/settings/drawers/TwoFactorDrawer.tsx \
   apps/web/src/features/settings/drawers/NotificationsDrawer.tsx \
   apps/web/src/features/settings/drawers/NotImplementedNotice.tsx
```

- [ ] **Step 2: Update barrel `index.ts`**

Replace contents of `apps/web/src/features/settings/drawers/index.ts` with:

```ts
export { AmazonAccountDrawer } from './AmazonAccountDrawer';
export type { AmazonAccountDrawerProps } from './AmazonAccountDrawer';
export { EbayAccountDrawer } from './EbayAccountDrawer/EbayAccountDrawer.component';
export type { EbayAccountDrawerProps } from './EbayAccountDrawer/EbayAccountDrawer.types';
export { ChangePasswordDrawer } from './ChangePasswordDrawer';
export type { ChangePasswordDrawerProps } from './ChangePasswordDrawer';
export { LanguageDrawer } from './LanguageDrawer';
export type { LanguageDrawerProps } from './LanguageDrawer';
export { ListingGroupDrawer } from './ListingGroupDrawer';
export type { ListingGroupDrawerProps } from './ListingGroupDrawer';
export { ProfileDrawer } from './ProfileDrawer';
export type { ProfileDrawerProps } from './ProfileDrawer';
export { StoreConfigDrawer } from './StoreConfigDrawer';
export type { StoreConfigDrawerProps } from './StoreConfigDrawer';
```

- [ ] **Step 3: Do NOT typecheck yet** — `SettingsHubPage.component.tsx` still imports the deleted drawers. Fixed in Task 8. Leave that to next task.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/settings/drawers/
git commit -m "chore(settings): remove ApiAccess/TwoFactor/Notifications drawers and NotImplementedNotice"
```

---

## Task 7: Frontend — Rewrite ChangePasswordDrawer

**Files:**
- Modify: `apps/web/src/features/settings/drawers/ChangePasswordDrawer.tsx`
- Modify: `apps/web/src/features/settings/drawers/ChangePasswordDrawer.style.ts` (verify no changes needed)

**Interfaces:**
- Consumes: `useChangePasswordMutation` from `@/features/auth/api/authApi`, `getErrorI18nKey` from `@/utils/errorHandler`, `useUI` from `@repo/ui`

- [ ] **Step 1: Replace `ChangePasswordDrawer.tsx` entirely**

Overwrite `apps/web/src/features/settings/drawers/ChangePasswordDrawer.tsx` with:

```tsx
import {
  Button,
  Drawer,
  ModernTextInput,
  Text,
  useUI,
} from '@repo/ui';
import { AUTH_CONSTANTS } from '@repo/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useChangePasswordMutation } from '@/features/auth/api/authApi';
import { getErrorI18nKey } from '@/utils/errorHandler';

import {
  BodyStack,
  ErrorText,
  FooterRow,
} from './ChangePasswordDrawer.style';

export interface ChangePasswordDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordDrawer: React.FC<ChangePasswordDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();
  const [changePassword, { isLoading }] = useChangePasswordMutation();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = (): void => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const validate = (): string | null => {
    if (!current || !next || !confirm) {
      return t('translation:validation.required');
    }
    if (next.length < AUTH_CONSTANTS.PASSWORD_MIN_LENGTH) {
      return t('translation:settingsHub.drawer.password.tooShort');
    }
    if (next !== confirm) {
      return t('translation:settingsHub.drawer.password.mismatch');
    }
    if (next === current) {
      return t('translation:settingsHub.drawer.password.sameAsCurrent');
    }
    return null;
  };

  const handleSubmit = (): void => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);

    void changePassword({ currentPassword: current, newPassword: next })
      .unwrap()
      .then(() => {
        reset();
        onClose();
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:settingsHub.drawer.password.successHeader',
            descriptionKey: 'translation:settingsHub.drawer.password.successDescription',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t,
        );
      })
      .catch((err: unknown) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(err),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
      });
  };

  const footer = (
    <FooterRow>
      <Button variant="ghost" onClick={handleClose} disabled={isLoading}>
        <Text>{t('translation:common.cancel')}</Text>
      </Button>
      <Button variant="primary" onClick={handleSubmit} isLoading={isLoading}>
        <Text>{t('translation:common.save')}</Text>
      </Button>
    </FooterRow>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={handleClose}
      title={t('translation:settingsHub.drawer.password.title')}
      subtitle={t('translation:settingsHub.drawer.password.subtitle')}
      footer={footer}
      size="md"
    >
      <BodyStack>
        <ModernTextInput
          label={t('translation:settingsHub.drawer.password.current')}
          value={current}
          type="password"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setCurrent(e.target.value)
          }
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.password.new')}
          value={next}
          type="password"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setNext(e.target.value)
          }
        />
        <ModernTextInput
          label={t('translation:settingsHub.drawer.password.confirm')}
          value={confirm}
          type="password"
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setConfirm(e.target.value)
          }
        />
        {error && <ErrorText variant="caption">{error}</ErrorText>}
      </BodyStack>
    </Drawer>
  );
};
```

- [ ] **Step 2: Verify `ChangePasswordDrawer.style.ts` exports**

Open `apps/web/src/features/settings/drawers/ChangePasswordDrawer.style.ts`. Confirm exports: `BodyStack`, `FooterRow`, `ErrorText`. (Already correct from earlier read — no change.)

- [ ] **Step 3: Verify `showMessage` signature matches MessageModal pattern**

Cross-check with an existing working drawer (e.g., how `SettingsHubPage.container.tsx` uses `showMessage` with `headerKey`/`descriptionKey`/`primaryButton`/`t`). The pattern in the file above matches.

- [ ] **Step 4: Commit (typecheck comes after Task 8 — hub rewire)**

```bash
git add apps/web/src/features/settings/drawers/ChangePasswordDrawer.tsx
git commit -m "feat(settings): wire ChangePasswordDrawer to auth API"
```

---

## Task 8: Frontend — Create DeactivateAccountModal

**Files:**
- Create: `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.types.ts`
- Create: `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.style.ts`
- Create: `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.component.tsx`
- Create: `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.container.tsx`
- Create: `apps/web/src/features/settings/components/DeactivateAccountModal/index.ts`

**Interfaces:**
- Consumes: `useDeactivateAccountMutation`, `useGetMeQuery` (for email), `getErrorI18nKey`, `logout` action, `api.util.resetApiState`, `localeNavigate`
- Produces: `<DeactivateAccountModal isOpen={bool} onClose={fn} />` component

- [ ] **Step 1: Create types file**

Create `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.types.ts`:

```ts
export interface DeactivateAccountModalComponentProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  confirmInput: string;
  onConfirmInputChange: (value: string) => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export interface DeactivateAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
}
```

- [ ] **Step 2: Create style file**

Create `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.style.ts`:

```ts
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const WarningBlock = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.semanticTint.error')};
  border: 1px solid ${tkn('colors.semanticTintBorder.error')};
`;

export const FooterRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.xs')};
`;
```

**Note:** Verify `semanticTint.error` and `semanticTintBorder.error` exist in the theme. If they don't (only `warning` exists), use `colors.surface.secondary` background + `colors.border.danger` instead. Check `packages/ui/src/theme/themes.ts` before writing — adjust to existing tokens.

- [ ] **Step 3: Create component file**

Create `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.component.tsx`:

```tsx
import { Button, Icon, Modal, ModernTextInput, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './DeactivateAccountModal.style';
import type { DeactivateAccountModalComponentProps } from './DeactivateAccountModal.types';

export const DeactivateAccountModalComponent = ({
  isOpen,
  onClose,
  userEmail,
  confirmInput,
  onConfirmInputChange,
  onConfirm,
  isLoading,
}: DeactivateAccountModalComponentProps): React.ReactElement => {
  const { t } = useTranslation();
  const isMatch = confirmInput.trim().toLowerCase() === userEmail.trim().toLowerCase();

  const footer = (
    <S.FooterRow>
      <Button variant="ghost" onClick={onClose} disabled={isLoading}>
        <Text>{t('translation:settingsHub.modal.deactivate.cancelLabel')}</Text>
      </Button>
      <Button variant="danger" onClick={onConfirm} isLoading={isLoading} disabled={!isMatch}>
        <Text>{t('translation:settingsHub.modal.deactivate.confirmLabel')}</Text>
      </Button>
    </S.FooterRow>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.modal.deactivate.title')}
      size="sm"
      footer={footer}
    >
      <S.BodyStack>
        <S.WarningBlock>
          <Icon name="alert-triangle" color="semantic.error" size={20} />
          <Text variant="body-sm" color="text.secondary">
            {t('translation:settingsHub.modal.deactivate.warning')}
          </Text>
        </S.WarningBlock>
        <Text variant="body-sm" weight="medium">
          {t('translation:settingsHub.modal.deactivate.typeEmail')}
        </Text>
        <ModernTextInput
          label={t('translation:settingsHub.modal.deactivate.emailPlaceholder', { email: userEmail })}
          value={confirmInput}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => onConfirmInputChange(e.target.value)}
          placeholder={userEmail}
        />
      </S.BodyStack>
    </Modal>
  );
};
```

- [ ] **Step 4: Create container file**

Create `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.container.tsx`:

```tsx
import { useUI } from '@repo/ui';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { useDeactivateAccountMutation, useGetMeQuery } from '@/features/auth/api/authApi';
import { logout } from '@/features/auth/store/authSlice';
import { baseApi } from '@/api/baseApi';
import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

import { DeactivateAccountModalComponent } from './DeactivateAccountModal.component';
import type { DeactivateAccountModalProps } from './DeactivateAccountModal.types';

export const DeactivateAccountModal: React.FC<DeactivateAccountModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();
  const { showMessage, closeMessage } = useUI();
  const dispatch = useDispatch();
  const { localeNavigate } = useLocale();
  const [deactivate, { isLoading }] = useDeactivateAccountMutation();
  const { data: user } = useGetMeQuery();
  const [confirmInput, setConfirmInput] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setConfirmInput('');
    }
  }, [isOpen]);

  const userEmail = user?.email ?? '';

  const handleConfirm = (): void => {
    void deactivate()
      .unwrap()
      .then(() => {
        onClose();
        dispatch(baseApi.util.resetApiState());
        dispatch(logout());
        showMessage(
          {
            type: 'success',
            headerKey: 'translation:settingsHub.modal.deactivate.successHeader',
            descriptionKey: 'translation:settingsHub.modal.deactivate.successDescription',
            primaryButton: { labelKey: 'translation:common.ok', onClick: closeMessage },
          },
          t,
        );
        localeNavigate('/login');
      })
      .catch((err: unknown) => {
        showMessage(
          {
            type: 'error',
            headerKey: 'translation:message.error.header',
            descriptionKey: getErrorI18nKey(err),
            primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
          },
          t,
        );
      });
  };

  return (
    <DeactivateAccountModalComponent
      isOpen={isOpen}
      onClose={onClose}
      userEmail={userEmail}
      confirmInput={confirmInput}
      onConfirmInputChange={setConfirmInput}
      onConfirm={handleConfirm}
      isLoading={isLoading}
    />
  );
};
```

**Note:** The export name from `apps/web/src/api/baseApi.ts` is `baseApi` (verified — `export const baseApi = createApi({...})`). RTK Query exposes `baseApi.util.resetApiState()` as a thunk action.

- [ ] **Step 5: Create index barrel**

Create `apps/web/src/features/settings/components/DeactivateAccountModal/index.ts`:

```ts
export { DeactivateAccountModal } from './DeactivateAccountModal.container';
export type { DeactivateAccountModalProps } from './DeactivateAccountModal.types';
```

- [ ] **Step 6: Verify imports compile**

Run: `pnpm typecheck`
Expected: May still error if hub rewire (Task 9) hasn't happened yet — that's expected. Just verify no errors specific to this modal (e.g., `api.util` name, `useLocale` path).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/settings/components/DeactivateAccountModal/
git commit -m "feat(settings): add DeactivateAccountModal with type-email-to-confirm pattern"
```

---

## Task 9: Frontend — Rewire SettingsHubPage (types + container + component)

**Files:**
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.types.ts`
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.container.tsx`
- Modify: `apps/web/src/features/settings/SettingsPage/SettingsHubPage.component.tsx`

**Interfaces:**
- Consumes: `DeactivateAccountModal` from `@/features/settings/components/DeactivateAccountModal`
- Produces: slimmed `SettingsDrawerKey` type, `isDeactivateModalOpen` prop on component

- [ ] **Step 1: Replace `SettingsHubPage.types.ts`**

The file currently has a duplicate `SettingsHubPageComponentProps` declaration. Replace entire contents with:

```ts
import type {
  AmazonAccountPublicDto,
  EbayAccountPublicDto,
  ListingSettingsGroupResponse,
  ProfileDto,
} from '@repo/shared';

export type SettingsDrawerKey =
  | 'profile'
  | 'ebay'
  | 'amazonAdd'
  | 'storeConfig'
  | 'listingGroupNew'
  | 'listingGroupEdit'
  | 'password'
  | 'language'
  | null;

export interface SettingsHubPageComponentProps {
  profile: ProfileDto | null;
  ebayAccounts: EbayAccountPublicDto[];
  amazonAccounts: AmazonAccountPublicDto[];
  listingGroups: ListingSettingsGroupResponse[];
  activeDrawer: SettingsDrawerKey;
  onOpenDrawer: (drawer: SettingsDrawerKey) => void;
  onCloseDrawer: () => void;
  editingListingGroupId: string | null;
  onEditListingGroup: (id: string) => void;
  onNavigateToEbayConnect: () => void;
  isImpersonatingAdmin: boolean;
  isDeactivateModalOpen: boolean;
  onOpenDeactivateModal: () => void;
  onCloseDeactivateModal: () => void;
}
```

- [ ] **Step 2: Update `SettingsHubPage.container.tsx` — add modal state**

Open the container file. Add a `useState` import to React (currently imports `useEffect, useMemo`). Update line 8:

```ts
import React, { useEffect, useMemo, useState } from 'react';
```

After `const editingListingGroupId = searchParams.get(EDIT_GROUP_PARAM);`, add:

```ts
  const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
```

After `handleNavigateToEbayConnect`, add:

```ts
  const handleOpenDeactivateModal = (): void => setIsDeactivateModalOpen(true);
  const handleCloseDeactivateModal = (): void => setIsDeactivateModalOpen(false);
```

Update the `<SettingsHubPageComponent ... />` props block to include:

```ts
      isDeactivateModalOpen={isDeactivateModalOpen}
      onOpenDeactivateModal={handleOpenDeactivateModal}
      onCloseDeactivateModal={handleCloseDeactivateModal}
```

- [ ] **Step 3: Rewrite `SettingsHubPage.component.tsx`**

Replace entire file contents with:

```tsx
/**
 * SettingsHubPage Component (Presentation)
 * Single scrolling page consolidating all settings sections.
 */

import {
  Button,
  Card,
  CardBody,
  Icon,
  PageHeader,
  SettingsCard,
  StatusBadge,
  Text,
} from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { DeactivateAccountModal } from '../components/DeactivateAccountModal';
import {
  AmazonAccountDrawer,
  ChangePasswordDrawer,
  EbayAccountDrawer,
  LanguageDrawer,
  ListingGroupDrawer,
  ProfileDrawer,
  StoreConfigDrawer,
} from '../drawers';

import * as S from './SettingsHubPage.style';
import type { SettingsHubPageComponentProps } from './SettingsHubPage.types';

const AmazonAccountsSection = ({
  accounts,
  onAdd,
}: {
  accounts: SettingsHubPageComponentProps['amazonAccounts'];
  onAdd: () => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'amazon',
        title: t('translation:settingsHub.sections.amazon.title'),
        subtitle: t('translation:settingsHub.sections.amazon.subtitle'),
      }}
      headerRight={
        <Button variant="text" onClick={onAdd}>
          <Text>{t('translation:settingsHub.sections.amazon.add')}</Text>
        </Button>
      }
    >
      {accounts.length > 0 ? (
        accounts.slice(0, 3).map((acc) => (
          <S.AccountRow key={acc.id}>
            <S.AccountRowInfo>
              <Text variant="body-sm" weight="medium">{acc.label || acc.email}</Text>
              {acc.label && <Text variant="caption" color="text.tertiary">{acc.email}</Text>}
            </S.AccountRowInfo>
            <StatusBadge status={acc.status} size="sm" />
          </S.AccountRow>
        ))
      ) : (
        <Text variant="body-sm" color="text.secondary">{t('translation:settingsHub.sections.amazon.noAccounts')}</Text>
      )}
    </SettingsCard>
  );
};

const ListingGroupsSection = ({
  groups,
  onNew,
  onEdit,
}: {
  groups: SettingsHubPageComponentProps['listingGroups'];
  onNew: () => void;
  onEdit: (id: string) => void;
}): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'layers',
        title: t('translation:settingsHub.sections.listingGroups.title'),
        subtitle: t('translation:settingsHub.sections.listingGroups.subtitle'),
      }}
      headerRight={
        <Button variant="text" onClick={onNew}>
          <Text>{t('translation:settingsHub.sections.listingGroups.new')}</Text>
        </Button>
      }
    >
      {groups.length > 0 ? (
        groups.slice(0, 5).map((g) => (
          <S.AccountRow key={g.id}>
            <S.AccountRowInfo>
              <Text variant="body-sm" weight="medium">{g.name}</Text>
              {g.description && <Text variant="caption" color="text.tertiary">{g.description}</Text>}
            </S.AccountRowInfo>
            <Button variant="text" size="sm" onClick={() => onEdit(g.id)}>
              <Text>{t('translation:settingsHub.sections.listingGroups.edit')}</Text>
            </Button>
          </S.AccountRow>
        ))
      ) : (
        <Text variant="body-sm" color="text.secondary">{t('translation:settingsHub.sections.listingGroups.noGroups')}</Text>
      )}
    </SettingsCard>
  );
};

const AccountSecuritySection = ({ onAction }: { onAction: (key: 'password' | 'language') => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const items: Array<{ key: 'password' | 'language'; icon: string; labelKey: string }> = [
    { key: 'password', icon: 'lock', labelKey: 'translation:settingsHub.sections.account.changePassword' },
    { key: 'language', icon: 'globe', labelKey: 'translation:settingsHub.sections.account.language' },
  ];
  return (
    <SettingsCard
      variant="section"
      header={{
        icon: 'shield-check',
        title: t('translation:settingsHub.sections.account.title'),
        subtitle: t('translation:settingsHub.sections.account.subtitle'),
      }}
    >
      {items.map(({ key, icon, labelKey }) => (
        <S.AccountActionRow key={key} onClick={() => onAction(key)}>
          <S.AccountActionRowInfo>
            <Icon name={icon as never} size={18} color="text.secondary" />
            <Text variant="body-sm" weight="medium">{t(labelKey)}</Text>
          </S.AccountActionRowInfo>
          <Icon name="chevron-right" size={18} color="text.tertiary" />
        </S.AccountActionRow>
      ))}
    </SettingsCard>
  );
};

const DangerZoneSection = ({ onDeactivate }: { onDeactivate: () => void }): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  return (
    <S.DangerNotice>
      <Text variant="body-sm" weight="semibold" color="semantic.error">
        {t('translation:settingsHub.sections.danger.title')}
      </Text>
      <Text variant="caption" color="text.secondary">
        {t('translation:settingsHub.sections.danger.deactivateDescription')}
      </Text>
      <div>
        <Button variant="danger" onClick={onDeactivate}>
          <Text>{t('translation:settingsHub.sections.danger.deactivate')}</Text>
        </Button>
      </div>
    </S.DangerNotice>
  );
};

export const SettingsHubPageComponent = ({
  profile,
  ebayAccounts,
  amazonAccounts,
  listingGroups,
  activeDrawer,
  onOpenDrawer,
  onCloseDrawer,
  editingListingGroupId,
  onEditListingGroup,
  onNavigateToEbayConnect,
  isDeactivateModalOpen,
  onOpenDeactivateModal,
  onCloseDeactivateModal,
}: SettingsHubPageComponentProps): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const displayName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
  const initials = displayName
    ? displayName.split(' ').slice(0, 2).map((s) => s[0]?.toUpperCase()).join('')
    : '?';

  return (
    <S.Container>
      <PageHeader
        title={t('translation:settingsHub.title')}
        subtitle={t('translation:settingsHub.subtitle')}
      />

      {/* Profile Hero */}
      <S.ProfileHeroCard>
        <S.Avatar>{initials}</S.Avatar>
        <S.ProfileHeroInfo>
          <Text variant="h1" weight="bold">{displayName || t('translation:settingsHub.sections.profile.title')}</Text>
          {profile?.email && <Text variant="body-sm" color="text.secondary">{profile.email}</Text>}
        </S.ProfileHeroInfo>
        <S.ProfileHeroActions>
          <S.ProfileNavItem
            type="button"
            onClick={() => onOpenDrawer('profile')}
            aria-label={t('translation:settingsHub.sections.profile.tabs.personalInfo')}
          >
            <Text>{t('translation:settingsHub.sections.profile.tabs.personalInfo')}</Text>
            <Icon name="chevron-right" size={22} color="brand.primary" />
          </S.ProfileNavItem>
          <S.ProfileNavItem
            type="button"
            onClick={() => onOpenDrawer('ebay')}
            aria-label={t('translation:settingsHub.sections.ebay.title')}
          >
            <Text>{t('translation:settingsHub.sections.ebay.title')}</Text>
            <Icon name="chevron-right" size={22} color="brand.primary" />
          </S.ProfileNavItem>
        </S.ProfileHeroActions>
      </S.ProfileHeroCard>

      {/* Amazon row */}
      <AmazonAccountsSection accounts={amazonAccounts} onAdd={() => onOpenDrawer('amazonAdd')} />

      {/* Store config + Listing groups */}
      <S.TwoColGrid>
        <SettingsCard
          variant="section"
          header={{
            icon: 'map-pin',
            title: t('translation:settingsHub.sections.storeConfig.title'),
            subtitle: t('translation:settingsHub.sections.storeConfig.subtitle'),
          }}
          headerRight={
            <Button variant="text" onClick={() => onOpenDrawer('storeConfig')}>
              <Text>{t('translation:settingsHub.sections.storeConfig.edit')}</Text>
            </Button>
          }
        >
          <Text variant="body-sm" color="text.secondary">
            {t('translation:settingsHub.sections.storeConfig.subtitle')}
          </Text>
        </SettingsCard>

        <ListingGroupsSection
          groups={listingGroups}
          onNew={() => onOpenDrawer('listingGroupNew')}
          onEdit={onEditListingGroup}
        />
      </S.TwoColGrid>

      {/* Security + Danger Zone */}
      <S.TwoColGrid>
        <AccountSecuritySection onAction={(key) => onOpenDrawer(key)} />
        <Card variant="bordered">
          <CardBody>
            <DangerZoneSection onDeactivate={onOpenDeactivateModal} />
          </CardBody>
        </Card>
      </S.TwoColGrid>

      {/* Drawers */}
      <ProfileDrawer isOpen={activeDrawer === 'profile'} onClose={onCloseDrawer} profile={profile ?? undefined} />
      <EbayAccountDrawer
        isOpen={activeDrawer === 'ebay'}
        onClose={onCloseDrawer}
        accounts={ebayAccounts}
        onConnect={onNavigateToEbayConnect}
      />
      <AmazonAccountDrawer isOpen={activeDrawer === 'amazonAdd'} onClose={onCloseDrawer} />
      <StoreConfigDrawer isOpen={activeDrawer === 'storeConfig'} onClose={onCloseDrawer} />
      <ListingGroupDrawer
        isOpen={activeDrawer === 'listingGroupNew' || activeDrawer === 'listingGroupEdit'}
        onClose={onCloseDrawer}
        editingId={activeDrawer === 'listingGroupEdit' ? editingListingGroupId : null}
      />
      <ChangePasswordDrawer isOpen={activeDrawer === 'password'} onClose={onCloseDrawer} />
      <LanguageDrawer isOpen={activeDrawer === 'language'} onClose={onCloseDrawer} />

      {/* Deactivate modal */}
      <DeactivateAccountModal isOpen={isDeactivateModalOpen} onClose={onCloseDeactivateModal} />
    </S.Container>
  );
};

SettingsHubPageComponent.displayName = 'SettingsHubPageComponent';
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS. If errors:
- "Cannot find module '../components/DeactivateAccountModal'" — Task 8 incomplete
- "Property 'apiAccess' does not exist on type SettingsDrawerKey" — leftover reference, search & remove
- Styled components missing exports in `SettingsHubPage.style.ts` — verify `AccountRow`, `AccountRowInfo`, `AccountActionRow`, `AccountActionRowInfo`, `ProfileHeroCard`, `Avatar`, `ProfileHeroInfo`, `ProfileHeroActions`, `ProfileNavItem`, `TwoColGrid`, `Container`, `DangerNotice` all still exported (we didn't modify the style file, so they should be)

- [ ] **Step 5: Lint**

Run: `pnpm lint`
Expected: PASS with 0 warnings. Fix any issues.

- [ ] **Step 6: Validate**

Run: `pnpm validate`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/settings/SettingsPage/
git commit -m "feat(settings): production-ready hub - remove ApiAccess/2FA/Notifications/Plan, wire deactivate modal"
```

---

## Task 10: Final verification + manual smoke test

- [ ] **Step 1: Build everything**

Run: `pnpm build`
Expected: All packages and apps build successfully.

- [ ] **Step 2: Start dev servers**

Run: `pnpm dev` (in background or separate terminal). Confirm API on :3000, web on :5173.

- [ ] **Step 3: Manual smoke test**

Log in, navigate to `/{locale}/settings`. Verify:

1. **Sections present:** Profile Hero (with Personal Info + eBay nav), Amazon Accounts, Store Config, Listing Groups, Account & Security (only Password + Language rows), Danger Zone
2. **Sections absent:** API Access, 2FA, Notifications, Plan
3. **No "Not Implemented" notices** anywhere
4. **Change Password:** Open drawer → wrong current password → error MessageModal "Mevcut şifre hatalı"; correct + valid new → success MessageModal + drawer closes
5. **Language:** Switch EN ↔ TR, persists
6. **Profile:** Edit firstName + save → success
7. **Deactivate:** Click "Deactivate Account" → modal opens (not drawer) → type wrong email → button disabled; type correct email → button enables → click → success → redirected to login; try logging in → blocked with "Account is deactivated" error
8. **Store Config / Listing Groups:** Drawers navigate to their full pages as before

- [ ] **Step 4: Dead key scan**

Run: `grep -rE "(apiAccess|twoFactor|notImplemented)" packages/shared/src/i18n/ apps/web/src/ apps/api/src/ 2>/dev/null`
Expected: Only matches in compiled `.d.ts`/`.js` files (will rebuild on next install) or none at all. No source references.

- [ ] **Step 5: Commit any fixups**

If manual test surfaced fixes:
```bash
git add -p
git commit -m "fix(settings): post-smoke-test polish"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Remove API Access — Task 6 (delete), Task 9 (rewire)
- ✅ Remove 2FA — Task 6, Task 9
- ✅ Remove Notifications — Task 6, Task 9
- ✅ Remove Plan — Task 9
- ✅ Remove NotImplementedNotice — Task 6
- ✅ Change Password backend — Task 3, Task 4
- ✅ Deactivate backend — Task 3, Task 4
- ✅ ChangePasswordDrawer rewrite — Task 7
- ✅ DeactivateAccountModal new — Task 8
- ✅ Hub rewire — Task 9
- ✅ i18n cleanup — Task 2
- ✅ Shared types/schema — Task 1
- ✅ RTK Query mutations — Task 5

**Type consistency check:**
- `ChangePasswordRequest` used consistently across shared, DTO, service, controller, authApi, drawer ✓
- `GenericSuccessResponse` used consistently ✓
- `SettingsDrawerKey` trimmed consistently in types/container/component ✓
- `useChangePasswordMutation`, `useDeactivateAccountMutation` exported from authApi ✓
- `logout` from existing authSlice — confirmed exists
- `baseApi.util.resetApiState` — confirmed export name is `baseApi` in `apps/web/src/api/baseApi.ts`
- `useLocale` from `@/utils/useLocale` — confirmed exists (used in container currently)

**Placeholder check:** No TODO/TBD. All code blocks complete.
