# Google OAuth Sign-in / Sign-up — Design Spec

**Date:** 2026-07-21  
**Status:** Approved  
**Branch:** `development`

## Goal

Let users register and log in with Google on the existing auth screens. Google is a **shortcut past name entry + email verification only**. Everything after that (session shape, onboarding, eBay connect, dashboard routing) is identical to the password path.

## Non-goals

- Automatic account linking / merging of a Google identity into an existing password account.
- Settings-page "connect Google" flow for already-registered users.
- Other OAuth providers in this change (schema is multi-provider-ready; only Google is implemented).
- Bypassing eBay onboarding or any post-auth product flow.
- Password reset / forgot-password (unchanged, out of scope).
- Changing the access-token-in-memory + HttpOnly-refresh-cookie session model.

## Decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| OAuth flow | **GIS popup auth-code** (`@react-oauth/google` + backend `google-auth-library`) | Design-system Button/Icon stay ours; login-shaped JSON response (no redirect/success page); code exchanged server-side |
| Account collision | **Never auto-merge** | Same email with a password account → hard error (`emailExistsPassword`). User must use password login. |
| Provider storage | **`user_oauth_accounts` table** | Multi-provider-ready; unique on `(provider, provider_user_id)` |
| What Google skips | Name form fields + email-verification step | Google supplies verified name + email |
| What Google does **not** skip | Onboarding, eBay connect, session shape, post-login routing | Same as password login |
| Password column | `password_hash` becomes nullable | Google-only users have no password |

## End-to-end flow

```
Login or Register page
  └─ "Continue with Google" (our Button + brand-google Icon)
       └─ useGoogleLogin({ flow: 'auth-code' })  → Google popup
            └─ onSuccess({ code })
                 └─ POST /api/v1/auth/google  { code, locale? }
                      └─ Backend:
                           1. OAuth2Client.getToken({ code })  // redirectUri: 'postmessage'
                           2. verifyIdToken(id_token)
                           3. link/create decision (see below)
                           4. generateTokens + setRefreshTokenCookie
                           5. return { accessToken, user }   // identical to login
                 └─ FE: dispatch(setCredentials) + navigate
                      hasConnectedAccounts ? /dashboard : /onboarding/ebay
```

No new FE routes. No success/callback page. `AuthBootstrap` and `/auth/refresh` are untouched.

## Data model — migration `039`

### `users`

```sql
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
```

- Password-registered users: unchanged (`password_hash` set, `email_verified` via existing flow).
- Google-only users: `password_hash = NULL`, `email_verified = true`, `status = 'active'`, `avatar_url` = Google `picture` (best-effort), names from `given_name`/`family_name` (fallback to `name` split / `"User"`).

### `user_oauth_accounts` (new)

```sql
CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL,              -- OAuthProvider enum value, e.g. 'google'
    provider_user_id VARCHAR(255) NOT NULL,    -- Google 'sub'
    provider_email VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_oauth_accounts_user
    ON user_oauth_accounts(user_id);
```

No unique on `provider_email` — email is never used as a merge key.

## Backend link / create rules

Pure helper `google-link-decision.ts` (unit-tested, same pattern as `order-matcher.ts`):

```
if !payload.email OR payload.email_verified !== true
  → BLOCK  reason: googleEmailNotVerified
  // missing email is treated the same as unverified — we never create
  // an account without a verified email address

lookup user_oauth_accounts WHERE provider='google' AND provider_user_id = payload.sub
  found → LOGIN that user
          (status banned → block banned;
           status inactive → block inactive;
           status pending should not occur for oauth users — treat as inactive)
  not found →
    lookup users WHERE LOWER(email) = LOWER(payload.email)
      found  → BLOCK  reason: emailExistsPassword
               // covers ACTIVE password users AND PENDING unverified
               // password registrations — never merge either way
      not found → CREATE
                    users row:
                      first_name, last_name from Google
                        (given_name/family_name; else split name; else "User"/"")
                      email = payload.email
                      password_hash = NULL
                      email_verified = true
                      status = 'active'
                      locale = request.locale || mapGoogleLocale(payload.locale) || DEFAULT_LOCALE
                        // mapGoogleLocale: only 'en'/'tr' accepted; anything else → DEFAULT
                      avatar_url = payload.picture (optional, best-effort)
                    + user_oauth_accounts row (provider=google, sub, email)
                  → LOGIN (no welcome email required; optional best-effort later)
```

All CREATE+oauth insert runs in a single `DatabaseService.transaction`.

### Password-path guards (small follow-ons)

- `AuthService.login`: if `password_hash IS NULL` → `auth.errors.invalidCredentials` (Google-only user cannot password-login).
- `AuthService.changePassword`: existing `bcrypt.compare(current, hash)` already fails on null hash → `wrongPassword`. No special branch required.
- Deactivate / refresh / getMe: unchanged (status-based).

## API

### `POST /api/v1/auth/google`

**Body** (`GoogleAuthRequest`):

```ts
{
  code: string;                 // GIS auth-code from popup
  locale?: SupportedLocale;     // FE current locale (optional)
}
```

**Success (200)** — same shape as login:

```ts
{
  accessToken: string;
  user: UserDto;
}
// + Set-Cookie: sellerhill_rt=... (HttpOnly, path=/api) via existing attachSession
```

**Errors (i18n keys, HttpException):**

| Condition | Status | Key |
|---|---|---|
| Google env not configured | 503 | `auth.errors.googleNotConfigured` |
| Code exchange / verify fails | 401 | `auth.errors.googleCodeError` |
| `email_verified !== true` | 401 | `auth.errors.googleEmailNotVerified` |
| Email already has a password account | 409 | `auth.errors.emailExistsPassword` |
| Linked user banned | 401 | `auth.errors.banned` |
| Linked user inactive | 401 | `auth.errors.inactive` |

Controller reuses `attachSession` from `AuthController` (cookie write + body strip of refreshToken) — identical to login/verifyEmail.

## Backend file layout

| Path | Role |
|---|---|
| `apps/api/migrations/039_user_oauth_accounts.sql` | Schema |
| `apps/api/src/modules/auth/google-auth.service.ts` | Code exchange + verify + create/login orchestration |
| `apps/api/src/modules/auth/google-link-decision.ts` | Pure decision helper |
| `apps/api/src/modules/auth/google-link-decision.spec.ts` | Unit tests (Jest harness) |
| `apps/api/src/modules/auth/dto/google-auth.dto.ts` | class-validator DTO |
| `apps/api/src/modules/auth/auth.controller.ts` | `POST google` endpoint |
| `apps/api/src/modules/auth/auth.service.ts` | Expose `issueSession(userId)` (or keep `generateTokens` + `mapToUserDto` reachable); login null-hash guard |
| `apps/api/src/modules/auth/auth.module.ts` | Register `GoogleAuthService` |
| `apps/api/src/common/config/env.validation.ts` | Optional `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| `apps/api/.env.example` | Document the two vars |
| `apps/api/package.json` | Add `google-auth-library` |

`GoogleAuthService` is a no-op provider when env is missing; the endpoint itself throws `googleNotConfigured` so local dev without Google credentials still boots.

### Code-exchange detail

```ts
const client = new OAuth2Client({
  clientId: GOOGLE_CLIENT_ID,
  clientSecret: GOOGLE_CLIENT_SECRET,
  redirectUri: 'postmessage', // required for GIS popup auth-code
});
const { tokens } = await client.getToken(code);
const ticket = await client.verifyIdToken({
  idToken: tokens.id_token!,
  audience: GOOGLE_CLIENT_ID,
});
const payload = ticket.getPayload(); // sub, email, email_verified, given_name, family_name, name, picture, locale
```

## Shared package

- `OAuthProvider` enum in `packages/shared/src/domain/auth/auth.types.ts`:

  ```ts
  export enum OAuthProvider {
    GOOGLE = 'google',
  }
  ```

- `GoogleAuthRequest` interface + re-export from auth index.
- i18n in **both** `packages/shared/src/i18n/resources/{en,tr}/auth.json` (namespace `auth`, top-level wrapper key `auth` → FE calls `t('auth.login…')` / `t('auth.errors…')`):

  **Reuse existing keys** (already present under `auth.register.*`):
  - `auth.register.signUpWithGoogle` — expand copy from bare `"Google"` → `"Continue with Google"` / `"Google ile devam et"` (same key used on **both** login and register; do not invent a parallel `auth.login.*` key).
  - `auth.register.orDivider` — already `"Or"` / `"Veya"`; reuse as-is on both pages.

  **Add under `auth.errors.*`:**
  - `googleNotConfigured`
  - `googleCodeError`
  - `googleEmailNotVerified`
  - `emailExistsPassword`
  - `googlePopupClosed` (FE-only; user closed the popup)
  - `banned` (already thrown by backend login/oauth paths; missing from JSON today — add EN+TR)

## Frontend

### Dependencies / env

- `apps/web`: add `@react-oauth/google`.
- `apps/web/.env.example`: `VITE_GOOGLE_CLIENT_ID=`.
- Wrap app root with `<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>` (only when the env is set; when missing, hide the Google button rather than crash).

### Design system

- New icon `brand-google` (+ `google` alias) in `packages/ui/src/atoms/Icon/icons/` — official multicolour G, same pattern as `brand-amazon` / `brand-ebay`.
- Rebuild `@repo/ui` after adding the icon (`pnpm --filter @repo/ui build`).
- Use existing `Button` atom (variant secondary / outline, `fullWidth`, `size="large"`) + `<Icon name="brand-google" />`. No Google-rendered button, no inline SVG, no hardcoded colors.

### Auth API / state

- `authApi.ts`: `googleLogin: builder.mutation<AuthResponse, GoogleAuthRequest>` → `POST /auth/google`.
- Export `useGoogleLoginMutation`.
- `authSlice` / `AuthBootstrap` / refresh / logout: **no changes**.

### Login + Register pages (container/component split preserved)

**Container** (logic only):

- Import `useGoogleLogin` from `@react-oauth/google` and `useGoogleLoginMutation` from authApi.
- `handleGoogleSignIn` triggers the GIS popup; `onSuccess` calls the mutation with `{ code, locale }`.
- On mutation success: `dispatch(setCredentials(data))` + same navigate rule as password login (`hasConnectedAccounts ? /dashboard : /onboarding/ebay`).
- On mutation / popup error: `showMessage` via existing `getErrorI18nKey` path (map popup-closed to `auth.errors.googlePopupClosed`).
- Pass `onGoogleSignIn` + `isGoogleLoading` (+ optional `googleEnabled` when client id missing) into the component.
- `useLoading(isLoading || isGoogleLoading)` for the global overlay on the blocking mutation.

**Component** (markup only):

- **Placement (locked, same on login + register):** Google button **above** the email/password form, then divider, then form:
  1. Google `Button` (secondary, fullWidth, large) with `brand-google` icon + `t('auth.register.signUpWithGoogle')` — only rendered when `googleEnabled !== false`.
  2. Divider row with `t('auth.register.orDivider')` — only when Google button is shown.
  3. Existing form unchanged.
- Style: add `GoogleButtonRow` + `OrDivider` (flex row, hairline borders via `tkn('colors.border.primary')`, centered muted label) in both `LoginPage.style.ts` and `RegisterPage.style.ts`. No hardcoded colors/spacing.
- No hooks beyond `useTranslation` / `useTheme`. No `useGoogleLogin` in the component.

**Types:** add `onGoogleSignIn: () => void`, `isGoogleLoading: boolean`, `googleEnabled?: boolean` to both pages' `*.types.ts`.

### Routes

No new routes. Existing `/:locale/login` and `/:locale/register` only.

## Security

- Auth code is single-use and exchanged only on the server (`clientSecret` never reaches the browser).
- `verifyIdToken` enforces audience = our client id (token substitution blocked).
- `email_verified !== true` → hard reject (no account creation on unverified Google emails).
- Never auto-merge by email → blocks the classic "attacker registers Google on victim's email" takeover when the victim already has a password account. (If the attacker registers Google *first*, the victim later cannot password-register the same email either — existing `emailExists` conflict covers that direction; out of scope to change.)
- Global `ThrottlerGuard` covers `POST /auth/google`.
- No CSRF token needed: browser never navigates to our backend for the OAuth dance (GIS uses `postmessage`); the subsequent `POST /auth/google` is a same-site credentialed XHR like login.
- Session cookies keep existing `HttpOnly` / `Secure` / `SameSite` / `path=/api` policy.

## Testing

| Layer | Coverage |
|---|---|
| `google-link-decision.spec.ts` | All decision branches (unverified email, existing oauth → login, banned/inactive, email collision, create path) |
| `AuthService.login` null-hash | Existing invalid-credentials path; add a unit case if pure enough, else covered by decision + manual |
| FE | No test harness (accepted project gap) |
| Live Google | Manual: dry run against a real Google Cloud OAuth client (dev JS origin `http://localhost:5173`) |

Add the new pure helper to the existing Jest harness list in CLAUDE.md when implemented (`pnpm --filter api test`).

## Operational setup (operator, not code)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID (type: **Web application**).
2. **Authorized JavaScript origins:** `http://localhost:5173` (dev) + production web origin(s).
3. **Authorized redirect URIs:** leave empty for GIS popup auth-code (`postmessage`). Do not add the API callback URL — there is none.
4. Copy Client ID → `VITE_GOOGLE_CLIENT_ID` (web) **and** `GOOGLE_CLIENT_ID` (api). Copy Client Secret → `GOOGLE_CLIENT_SECRET` (api only).
5. Restart api + web after env change.

If env is missing: API boots, `POST /auth/google` returns 503 `googleNotConfigured`; FE hides the Google button when `VITE_GOOGLE_CLIENT_ID` is empty.

## Out of scope / deferred

- Linking Google later from Settings for an existing password user.
- Unlinking Google / multiple providers UI.
- "Sign in with Apple / Microsoft / GitHub" (schema supports; not built).
- Forced re-consent / incremental scopes.
- Storing Google refresh tokens (we only need identity, not Google API access).

## Acceptance criteria

1. New user clicks "Continue with Google" on Register or Login → popup → account created as `ACTIVE` with `password_hash NULL` + oauth row → lands on `/onboarding/ebay` (no eBay yet) with a valid session (refresh cookie set, access token in memory).
2. Returning Google user clicks the button → same popup → lands on `/dashboard` or `/onboarding/ebay` per `hasConnectedAccounts`, no second user row.
3. Password-registered email attempted via Google → 409 `emailExistsPassword`, no merge, existing password account untouched.
4. Google-only user cannot log in with email+password (`invalidCredentials`).
5. Password path (register → verify-email → login), refresh, logout, deactivate all still work unchanged.
6. When `VITE_GOOGLE_CLIENT_ID` / `GOOGLE_*` are unset, app boots; Google button is hidden; password auth works.
7. Button uses design-system `Button` + `Icon name="brand-google"`; no hardcoded colors/spacing; EN + TR i18n complete.
8. `pnpm --filter api test` covers `google-link-decision` branches; `pnpm lint` clean on touched files.
