# Forgot Password / Password Reset — Design

**Date:** 2026-09-02
**Status:** Approved, ready for implementation plan
**Scope:** Self-service password reset for password-based accounts (email + link + new-password form).

## Problem

There is no way for a user who forgot their password to regain access. The login
screen only offers sign-in and register. `AuthService.changePassword` exists but
requires an authenticated session and the current password, so it does not help a
locked-out user. Google-only accounts (`users.password_hash IS NULL`) are out of
scope — they sign in through Google.

## Decisions (settled during brainstorming)

1. **After a successful reset, the user is sent to the login screen** (not
   auto-logged-in). A reset can be initiated from an untrusted device; forcing a
   fresh sign-in with the new password confirms possession.
2. **No user enumeration.** `POST /auth/forgot-password` always returns `200` with
   the same generic body. Unknown emails, Google-only accounts, and non-active
   accounts receive no email and produce no distinguishing response or error.
3. **Dedicated hashed-token table.** A random opaque token is emailed; only its
   SHA-256 is stored. Single-use, 60-minute expiry, all outstanding tokens for the
   user are consumed when one is used. This deliberately does **not** mirror the
   existing email-verification pattern (JWT string in a `users` column).

## Flow

1. Login page shows a **"Forgot password?"** link → `/{locale}/forgot-password`.
2. **Forgot-password page:** email field → `POST /v1/auth/forgot-password`. On the
   (always-`200`) response the page flips to a "check your email" confirmation
   panel — same visual language as `CheckEmailPage` — with a resend link.
3. The email contains a link to `/{locale}/reset-password?token=<opaque>`.
4. **Reset-password page:** reads `token` from the query string, shows
   new-password + confirm-password fields → `POST /v1/auth/reset-password`.
   - Success → success panel, then redirect to `/{locale}/login` after ~2s.
   - Missing / invalid / expired token → error panel with a "request a new link"
     button back to `/forgot-password`.

## Backend — `apps/api/src/modules/auth`

### Migration `092_password_reset_tokens.sql`

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash    TEXT NOT NULL,                 -- SHA-256 hex of the opaque token
  expires_at    TIMESTAMPTZ NOT NULL,
  consumed_at   TIMESTAMPTZ,
  requested_ip  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prt_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_prt_user_active
  ON password_reset_tokens(user_id) WHERE consumed_at IS NULL;
```

The **same migration file** also seeds the `password_reset` email template rows
for `en` and `tr` into `email_templates` (`ON CONFLICT DO NOTHING`), following the
structure and brand styling of migrations `014` / `078` / `079`. Template
variables: `firstName`, `resetUrl`, `year`. `variables` column value:
`["firstName", "resetUrl", "year"]::jsonb`.

### `AuthService.requestPasswordReset(email: string, locale: string, ip?: string): Promise<void>`

- Look up user by `LOWER(email)`.
- **Silently return** (no email, no thrown error) when any of:
  - no user;
  - `password_hash IS NULL` (Google-only);
  - `status <> 'active'` (pending / inactive / banned);
  - an unconsumed `password_reset_tokens` row for the user with
    `created_at > NOW() - PASSWORD_RESET_COOLDOWN_SECONDS` exists (cooldown).
- Otherwise:
  - `token = crypto.randomBytes(32).toString('base64url')`;
    `tokenHash = sha256hex(token)`.
  - Consume any prior unconsumed tokens for the user
    (`UPDATE ... SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL`).
  - Insert the new row with `expires_at = NOW() + PASSWORD_RESET_TOKEN_TTL_MINUTES`
    and `requested_ip = ip`.
  - `resetUrl = ${FRONTEND_URL}/${locale}/reset-password?token=${token}`
    (`FRONTEND_URL` from `ConfigService`, same as the verification flow; `locale`
    resolved as `locale || user.locale || DEFAULT_LOCALE`).
  - `await emailService.sendPasswordResetEmail(user.email, user.first_name, resetUrl, userLocale)`
    inside `try/catch` — log at `error` on failure, never rethrow.

### `AuthService.resetPassword(token: string, newPassword: string): Promise<{ success: true }>`

- `tokenHash = sha256hex(token)`.
- `SELECT prt.id, prt.user_id, u.password_hash, u.status
   FROM password_reset_tokens prt JOIN users u ON u.id = prt.user_id
   WHERE prt.token_hash = $1 AND prt.consumed_at IS NULL AND prt.expires_at > NOW()`.
- No row → `UnauthorizedException('auth.errors.resetTokenInvalid')`.
- `password_hash IS NULL` or `status <> 'active'` → same
  `UnauthorizedException('auth.errors.resetTokenInvalid')` (do not leak account
  state).
- `bcrypt.compare(newPassword, currentHash)` truthy →
  `BadRequestException('auth.errors.samePassword')` (consistent with
  `changePassword`).
- One `databaseService.transaction`:
  - `UPDATE users SET password_hash = $1, session_version = session_version + 1, updated_at = NOW() WHERE id = $2`
    (`$1 = await bcrypt.hash(newPassword, 10)`).
  - `UPDATE auth_refresh_sessions SET revoked_at = COALESCE(revoked_at, NOW()) WHERE user_id = $1 AND revoked_at IS NULL`.
  - `UPDATE password_reset_tokens SET consumed_at = NOW() WHERE user_id = $1 AND consumed_at IS NULL`
    (consumes the used token and any siblings).
- Return `{ success: true }`. **No session is issued** — the client navigates to
  login.

### `AuthController` (existing `@OperatorSurface()` auth controller)

- `POST /auth/forgot-password`
  - `@HttpCode(HttpStatus.OK)`, `@Throttle({ short: { limit: 3, ttl: 60_000 } })`
    (per-IP, on top of the global `ThrottlerGuard`).
  - Body: `ForgotPasswordDto { email: string; locale?: string }`.
  - Passes `req.ip` to the service.
  - Always returns `{ message: 'auth.passwordReset.emailSent' }`.
- `POST /auth/reset-password`
  - `@HttpCode(HttpStatus.OK)`, `@Throttle({ short: { limit: 5, ttl: 60_000 } })`.
  - Body: `ResetPasswordDto { token: string; password: string }`.
  - Returns `GenericSuccessResponse`.

### DTOs

- `apps/api/src/modules/auth/dto/forgot-password.dto.ts` — `class-validator`
  (`@IsEmail`, optional `@IsString locale`), implements `ForgotPasswordRequest`.
- `apps/api/src/modules/auth/dto/reset-password.dto.ts` — `@IsString token`,
  `@IsString @MinLength(AUTH_CONSTANTS.PASSWORD_MIN_LENGTH) @MaxLength(...) password`,
  implements `ResetPasswordRequest`.

### `EmailService`

```ts
async sendPasswordResetEmail(
  email: string, firstName: string, resetUrl: string, locale: string = 'en',
): Promise<void> {
  await this.sendTemplatedEmail(email, 'password_reset', { firstName, resetUrl }, locale);
}
```

## Shared package — `packages/shared/src`

- `schemas/auth/password-reset.schema.ts`:
  - `forgotPasswordSchema(t)` → `{ email: z.string().email(t('translation:validation.invalidEmail')) }`.
  - `resetPasswordSchema(t)` → `{ password, confirmPassword }` with `password`
    using the **same** min/max + `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/` regex as
    `registerFormDataSchema`, `.refine` for `password === confirmPassword`
    (`path: ['confirmPassword']`). The `token` is carried from the query string,
    not part of this form schema.
  - Export `ForgotPasswordFormData`, `ResetPasswordFormData` inferred types.
  - Re-export from `schemas/auth/index.ts`.
- `domain/auth`: add `ForgotPasswordRequest { email: string; locale?: string }` and
  `ResetPasswordRequest { token: string; password: string }`; export from the auth
  domain barrel. Response of reset reuses the existing `GenericSuccessResponse`;
  forgot-password response reuses `{ message: string }` shape (define
  `PasswordResetRequestResponse` if a named type is cleaner at call sites).
- `domain/auth/auth.constants.ts`: add
  `PASSWORD_RESET_TOKEN_TTL_MINUTES: 60` and
  `PASSWORD_RESET_COOLDOWN_SECONDS: 60`.
- Rebuild: `pnpm --filter @repo/shared build` after these changes.

## Frontend — `apps/web/src/features/auth`

Both new pages follow the strict 4-file container/component/style/types split,
reuse the shared `AuthShowcase` left panel, and mirror `LoginPage`'s card styles
(`Container` / `LayoutWrapper` / `FormPanel` / `AuthCard` / `Header` / `Form` /
`Footer`). No landing exemption applies here — these are full-rules auth pages.

### `forgot-password/` — `ForgotPasswordPage.{container,component,style,types}.tsx` + `index.ts`

- **Container:** `useForgotPasswordMutation`, `useLoading(isLoading)`, `useUI` for
  the error `showMessage`, `useLocale`. Holds a local `submitted` boolean; on
  mutation success set `submitted = true`. Handlers: `onSubmit({ email })` →
  `forgotPassword({ email, locale })`; `onResend` → same call again;
  `onBackToLogin` → `localeNavigate('/login')`. Passes `submitted`, the submitted
  `email`, and `isLoading` to the component.
- **Component:** when `!submitted`, render `AuthShowcase` + a card with an email
  `ModernTextInput` (RHF + `zodResolver(forgotPasswordSchema(t))`), a submit
  `Button`, and a "Back to login" text link. When `submitted`, render the
  confirmation panel (mail icon, `passwordReset.forgot.sentHeader`,
  `passwordReset.forgot.sentDescription` with `{{email}}`, a "Back to login"
  primary button, and a `noEmail` + `resendLink` row) — visually matching
  `CheckEmailPage.component`.

### `reset-password/` — `ResetPasswordPage.{container,component,style,types}.tsx` + `index.ts`

- **Container:** `const token = useSearchParams()[0].get('token')`. If no token →
  `status = 'error'` without calling the API. `useResetPasswordMutation`,
  `useLoading`, `useUI`, `useLocale`. `status: 'form' | 'success' | 'error'`
  derived from `token` presence + mutation `isSuccess` / `error`. On `isSuccess`,
  `setTimeout(() => localeNavigate('/login', { replace: true }), 2000)`. Handlers:
  `onSubmit({ password })` → `resetPassword({ token, password })`;
  `onRequestNewLink` → `localeNavigate('/forgot-password')`;
  `onNavigateToLogin` → `localeNavigate('/login')`.
- **Component:** `AuthShowcase` + a card that switches on `status`:
  - `form`: new-password + confirm-password `ModernTextInput type="password"` (RHF +
    `zodResolver(resetPasswordSchema(t))`), submit `Button`.
  - `success`: check icon, `passwordReset.reset.successHeader` /
    `successBody`, note that redirect is happening.
  - `error`: alert icon, `passwordReset.reset.errorHeader` / `errorBody`, a
    "Request a new link" primary button, and a "Back to login" text link.

### `authApi.ts`

```ts
forgotPassword: builder.mutation<{ message: string }, { email: string; locale?: string }>({
  query: (body) => ({ url: '/auth/forgot-password', method: 'POST', body }),
}),
resetPassword: builder.mutation<GenericSuccessResponse, { token: string; password: string }>({
  query: (body) => ({ url: '/auth/reset-password', method: 'POST', body }),
  invalidatesTags: ['Auth'],
}),
```
Export `useForgotPasswordMutation`, `useResetPasswordMutation`.

### `LoginPage`

- `LoginPage.container.tsx`: add `onNavigateToForgotPassword` →
  `localeNavigate('/forgot-password')`, pass to the component.
- `LoginPage.component.tsx`: add a right-aligned "Forgot password?" link directly
  under the password `ModernTextInput`, before the submit button
  (`t('auth:auth.login.forgotPasswordLink')`).
- `LoginPage.style.ts`: one small styled element for the link row (right-aligned
  `text` button), tokens only.
- `LoginPage.types.ts`: add `onNavigateToForgotPassword: () => void`.

### `App.tsx`

- Lazy: `const ForgotPasswordPage = lazy(() => import('./features/auth/forgot-password'));`
  and `const ResetPasswordPage = lazy(() => import('./features/auth/reset-password'));`.
- Under `/:locale`: `<Route path="forgot-password" element={<Lazy><ForgotPasswordPage /></Lazy>} />`
  and `<Route path="reset-password" element={<Lazy><ResetPasswordPage /></Lazy>} />`.
- Locale-less fallbacks:
  `<Route path="/forgot-password" element={<LocaleRedirect to="forgot-password" />} />`
  and
  `<Route path="/reset-password" element={<LocaleRedirect to="reset-password" preserveQuery />} />`
  — `preserveQuery` is required on `reset-password` to carry the `token`.

## i18n — `packages/shared/src/i18n/resources/{en,tr}/auth.json`

Both locales kept structurally identical. New block under `auth`:

```
auth.passwordReset.emailSent                     generic response line
auth.passwordReset.forgot.title
auth.passwordReset.forgot.subtitle
auth.passwordReset.forgot.emailLabel
auth.passwordReset.forgot.submitButton
auth.passwordReset.forgot.backToLogin
auth.passwordReset.forgot.sentHeader
auth.passwordReset.forgot.sentDescription        uses {{email}}
auth.passwordReset.forgot.noEmail
auth.passwordReset.forgot.resendLink
auth.passwordReset.reset.title
auth.passwordReset.reset.subtitle
auth.passwordReset.reset.newPasswordLabel
auth.passwordReset.reset.confirmPasswordLabel
auth.passwordReset.reset.submitButton
auth.passwordReset.reset.verifying
auth.passwordReset.reset.successHeader
auth.passwordReset.reset.successBody
auth.passwordReset.reset.errorHeader
auth.passwordReset.reset.errorBody
auth.passwordReset.reset.requestNewLink
```

New keys under `auth.login`:
```
auth.login.forgotPasswordLink                    "Forgot password?"
```

New keys under `auth.errors`:
```
auth.errors.resetTokenInvalid                    "This reset link is invalid or has expired. Request a new one."
auth.errors.resetTokenExpired                    (optional alias; see note)
```
`getErrorI18nKey` already maps a backend error `message` string to an i18n key, so
`auth.errors.resetTokenInvalid` thrown by the service renders directly. A single
`resetTokenInvalid` key covers both "not found" and "expired" (the service does
not distinguish them, to avoid leaking token state); `resetTokenExpired` is
listed only if a distinct message is wanted for the client-side "no token in URL"
case — otherwise reuse `resetTokenInvalid`.

## Testing

- **Pure helpers:** `apps/api/src/modules/auth/password-reset-helpers.ts` with
  `hashResetToken(token): string`, `isResetTokenExpired(expiresAt, now): boolean`,
  `isWithinResetCooldown(lastCreatedAt, now, cooldownSeconds): boolean`, covered
  by `password-reset-helpers.spec.ts`. This fits the repo's "pure-logic only"
  Jest harness; add the spec path to the covered list in `CLAUDE.md`.
- **Service / DB paths:** manual-verified per repo convention (no integration
  harness).
- **Manual matrix (browser, 375px + desktop):**
  1. Happy path: request → email → open link → set new password → redirected to
     login → sign in with new password works, old password rejected.
  2. Expired token (manually age `expires_at`) → error panel.
  3. Malformed / unknown token → error panel.
  4. Unknown email → generic confirmation panel, **no** email sent, no error.
  5. Google-only account email → generic confirmation panel, **no** email sent.
  6. Cooldown: second request within 60s → generic panel, **no** second email.
  7. Reset invalidates sessions: an existing logged-in session for that user is
     rejected on its next request after the reset.
- `pnpm lint` and `pnpm typecheck` clean on every touched file;
  `pnpm --filter @repo/shared build` after schema/type/i18n changes;
  `pnpm --filter @repo/ui build` not required (no UI-package changes).

## Security properties

- Token is 256 bits of CSPRNG entropy, transmitted once in the email link; only
  its SHA-256 is persisted, so a database read never yields a usable token.
- 60-minute TTL, single-use; using or re-requesting consumes every outstanding
  token for the user.
- No user enumeration: constant `200` body regardless of account existence/state,
  plus a 3-requests-per-minute-per-IP throttle on the request endpoint.
- A completed reset bumps `users.session_version` and revokes all
  `auth_refresh_sessions`, so every pre-existing access and refresh token for that
  account stops working — the intended behaviour for "I lost access / may be
  compromised".
- Google-only, pending, inactive, and banned accounts never receive a reset
  email.

## Out of scope

- Rate-limiting by email address in a shared store (only the per-user DB cooldown
  + per-IP throttle are implemented).
- Notifying the user by email that their password was changed (a follow-up; the
  welcome-email infrastructure could carry it later).
- Any change to the Google-only sign-in path.
- Password reset for staff/operator accounts is unchanged — they use the same
  endpoints; nothing special is added or removed for them.
