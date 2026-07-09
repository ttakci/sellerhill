# Settings Production Ready — Design Spec

**Date:** 2026-07-09
**Status:** Approved (brainstormed 2026-07-09)
**Branch:** UAT

## Goal

Make the Settings hub production-ready by removing non-functional sections (API Access, 2FA, Notifications, Plan) and implementing the remaining ones with real backends where missing. Settings is reached at `/{locale}/settings` and rendered by `SettingsHubPageContainer`.

## Scope

### Removed (cleanup)
- **API Access** — drawer + section entry + all i18n keys + nav item
- **2FA** — drawer + section entry + all i18n keys + nav item
- **Notifications** — drawer + section entry + all i18n keys
- **Plan** — full section + all i18n keys
- **NotImplementedNotice** component — no remaining consumers

### Kept (already working)
- `ProfileDrawer` — PATCH `/v1/profile` ✅
- `EbayAccountDrawer` — navigates to `/ebay/connect` ✅
- `AmazonAccountDrawer` — POST `/v1/amazon-accounts` ✅
- `LanguageDrawer` — `i18n.changeLanguage` ✅
- `StoreConfigDrawer` — navigates to `/settings/store` ✅
- `ListingGroupDrawer` — navigates to `/settings/listing-groups/...` ✅

### Implemented (new backend + frontend)
- **Change Password** — `PATCH /v1/auth/password`
- **Deactivate Account** — `POST /v1/auth/deactivate` + new `DeactivateAccountModal`

## Backend

### 1. Change Password — `PATCH /v1/auth/password`

**Request body** (`ChangePasswordRequest`):
```ts
{
  currentPassword: string;  // min 1 char, required
  newPassword: string;      // min 8 char, max 128, required
}
```

**Service method** (`AuthService.changePassword`):
1. `SELECT password_hash FROM users WHERE id = $1`
2. `bcrypt.compare(currentPassword, hash)` → throw `UnauthorizedException('auth.errors.wrongPassword')` if no match
3. If `newPassword === currentPassword` → throw `BadRequestException('auth.errors.samePassword')`
4. `bcrypt.hash(newPassword, 10)`
5. `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2`
6. Return `{ success: true }` (no data leak)

**Controller:** `@Patch('password')` on existing `AuthController`, `@UseGuards(JwtAuthGuard)`.

**Shared:** `ChangePasswordRequest` interface + Zod schema in `packages/shared/src/domain/auth/`. Existing `UpdatePasswordRequest` in `apps/api/src/modules/profile/dto/` (if any) NOT touched — this is auth-scoped.

### 2. Deactivate Account — `POST /v1/auth/deactivate`

**Request body:** none (uses JWT `req.user.sub`).

**Service method** (`AuthService.deactivateAccount`):
1. `UPDATE users SET status = 'inactive', updated_at = NOW() WHERE id = $1`
2. Reuses existing `UserStatus.INACTIVE` — no migration needed
3. Existing `login()` already rejects inactive users via `auth.errors.inactive`
4. Return `{ success: true }`

**Controller:** `@Post('deactivate')` on `AuthController`, `@UseGuards(JwtAuthGuard)`.

**Note:** Hard delete is intentionally avoided. `inactive` is reversible (admin can flip) and preserves referential integrity (orders, listings, etc.).

## Frontend

### Hub layout (simplified)

```
[Profile Hero]                     — Personal Info + eBay nav items (existing)
[Amazon Accounts]                  — existing section
[Store Config] | [Listing Groups]  — 2-col grid (existing)
[Security | Danger Zone]           — 2-col grid (new)
```

### `AccountSecuritySection` (slimmed)
Now contains only:
- Change Password → opens `password` drawer
- Language → opens `language` drawer

Icon + label + chevron row pattern unchanged.

### `DangerZoneSection`
- Single destructive card, full-width or 1-col in the 2-col grid with Security
- `<Button variant="danger">` opens `DeactivateAccountModal` (NOT a drawer — destructive confirmation)
- No longer routes to ApiAccess

### ChangePasswordDrawer (rewrite)
- Remove `NotImplementedNotice`
- Three `ModernTextInput` (current, new, confirm) — `type="password"`
- Frontend validation before submit:
  - Empty fields
  - `newPassword.length < 8` → `drawer.password.tooShort`
  - `newPassword !== confirm` → `drawer.password.mismatch`
  - `newPassword === current` → `drawer.password.sameAsCurrent` (UX, backend also rejects)
- Uses `useChangePasswordMutation()` from `authApi`
- On success: `showMessage({ type: 'success', ... })` + close drawer + clear local state
- On error: `getErrorI18nKey(error)` → `showMessage({ type: 'error', ... })`

### DeactivateAccountModal (new, 4-file split)
**Why modal not drawer:** Destructive confirmations are interruptive by design. Drawers slide in for editing; modals demand attention and block other interaction. Industry pattern (GitHub, Vercel, Stripe) uses modals for account deletion.

**Files:**
- `DeactivateAccountModal.container.tsx` — mutation, handlers, validation
- `DeactivateAccountModal.component.tsx` — JSX (Modal + warning + input + button)
- `DeactivateAccountModal.style.ts` — styled wrappers
- `DeactivateAccountModal.types.ts` — props

**UX pattern (type-email-to-confirm):**
1. Warning text listing consequences (orders, listings, connections lost)
2. `ModernTextInput` with label `"Email adresinizi yazın: {userEmail}"`
3. Confirm button disabled until `input.trim().toLowerCase() === userEmail.toLowerCase()`
4. On submit: `useDeactivateAccountMutation()`
5. On success: `dispatch(api.util.resetApiState())`, clear auth tokens, navigate `/{locale}/login`

Lives at: `apps/web/src/features/settings/components/DeactivateAccountModal/`

### RTK Query (`authApi.ts`)
New file: `apps/web/src/features/auth/api/authApi.ts` if not present, else extend.

```ts
changePassword: build.mutation<{ success: boolean }, ChangePasswordRequest>({
  query: (body) => ({ url: 'auth/password', method: 'PATCH', body }),
}),
deactivateAccount: build.mutation<{ success: boolean }, void>({
  query: () => ({ url: 'auth/deactivate', method: 'POST' }),
}),
```

Verify against existing authApi path before writing — if `apps/web/src/features/auth/api/authApi.ts` already exists with different conventions, follow them.

### `SettingsDrawerKey` type (trimmed)
Before:
```ts
'profile' | 'ebay' | 'amazonAdd' | 'storeConfig' | 'listingGroupNew' | 'listingGroupEdit'
  | 'password' | 'twoFactor' | 'apiAccess' | 'language' | 'notifications'
```
After:
```ts
'profile' | 'ebay' | 'amazonAdd' | 'storeConfig' | 'listingGroupNew' | 'listingGroupEdit'
  | 'password' | 'language'
```

Separate local state for `isDeactivateModalOpen` (not in URL params — it's transient confirmation UI).

### i18n changes

**Remove from both EN + TR `translation.json`:**
- `settingsHub.sections.apiAccess.*`
- `settingsHub.sections.account.twoFactor`
- `settingsHub.sections.account.apiAccess`
- `settingsHub.sections.notifications.*`
- `settingsHub.sections.plan.*`
- `settingsHub.drawer.apiAccess.*`
- `settingsHub.drawer.twoFactor.*`
- `settingsHub.drawer.notifications.*`
- `settingsHub.notImplemented.*` (no more consumers)

**Add to both EN + TR:**
- `settingsHub.sections.danger.title` (already exists)
- `settingsHub.sections.danger.subtitle`
- `settingsHub.sections.danger.deactivate` (exists)
- `settingsHub.modal.deactivate.title`
- `settingsHub.modal.deactivate.warning`
- `settingsHub.modal.deactivate.typeEmail` (with `{email}` interpolation)
- `settingsHub.modal.deactivate.confirm`
- `settingsHub.modal.deactivate.cancel`
- `settingsHub.modal.deactivate.successHeader`
- `settingsHub.modal.deactivate.successDescription`
- `auth.errors.wrongPassword`
- `auth.errors.samePassword`
- `settingsHub.drawer.password.mismatch` (exists)
- `settingsHub.drawer.password.tooShort` (exists)
- `settingsHub.drawer.password.sameAsCurrent`
- `settingsHub.drawer.password.successHeader`
- `settingsHub.drawer.password.successDescription`

### File changes summary

**Delete:**
- `apps/web/src/features/settings/drawers/ApiAccessDrawer.tsx`
- `apps/web/src/features/settings/drawers/TwoFactorDrawer.tsx`
- `apps/web/src/features/settings/drawers/NotificationsDrawer.tsx`
- `apps/web/src/features/settings/drawers/NotImplementedNotice.tsx`

**Create:**
- `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.container.tsx`
- `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.component.tsx`
- `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.style.ts`
- `apps/web/src/features/settings/components/DeactivateAccountModal/DeactivateAccountModal.types.ts`
- `apps/web/src/features/settings/components/DeactivateAccountModal/index.ts`
- `packages/shared/src/domain/auth/change-password.{types,schema}.ts` (if pattern dictates split)

**Modify:**
- `apps/api/src/modules/auth/auth.service.ts` — add `changePassword`, `deactivateAccount`
- `apps/api/src/modules/auth/auth.controller.ts` — add 2 endpoints
- `apps/api/src/modules/auth/dto/` — add DTOs (or reuse shared)
- `packages/shared/src/domain/auth/` — add `ChangePasswordRequest`, Zod schema, export
- `apps/web/src/features/auth/api/authApi.ts` (verify path) — add 2 mutations
- `apps/web/src/features/settings/SettingsPage/SettingsHubPage.component.tsx` — remove sections, layout
- `apps/web/src/features/settings/SettingsPage/SettingsHubPage.style.ts` — adjust if needed
- `apps/web/src/features/settings/SettingsPage/SettingsHubPage.types.ts` — trim `SettingsDrawerKey`
- `apps/web/src/features/settings/SettingsPage/SettingsHubPage.container.tsx` — add deactivate modal state, pass handlers
- `apps/web/src/features/settings/drawers/index.ts` — remove deleted exports
- `apps/web/src/features/settings/drawers/ChangePasswordDrawer.tsx` — rewrite to use API
- `packages/shared/src/i18n/resources/en/translation.json` — add/remove keys
- `packages/shared/src/i18n/resources/tr/translation.json` — add/remove keys

## Verification

1. `pnpm validate` passes (lint + typecheck)
2. Manual:
   - Open settings → only Profile, eBay, Amazon, Store Config, Listing Groups, Security (Password + Language), Danger Zone visible
   - No `NotImplemented` warnings anywhere
   - Change Password: wrong current → error MessageModal; correct → success MessageModal + drawer closes
   - Deactivate: type wrong email → button disabled; type correct → success → redirected to login; cannot log back in
3. No dead i18n keys (grep `apiAccess`, `twoFactor`, `notifications`, `plan` under `settingsHub` returns nothing)

## Non-Goals

- Hard account deletion (only soft-deactivate via `status='inactive'`)
- Password reset email flow (separate feature)
- Session invalidation on password change (nice-to-have, not in scope)
- Admin reactivation UI (admin module scope)
