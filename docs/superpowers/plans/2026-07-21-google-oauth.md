# Google OAuth Sign-in / Sign-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users register and log in with Google via a GIS popup auth-code flow, skipping only name entry + email verification while keeping session shape and onboarding identical to password login.

**Architecture:** FE `@react-oauth/google` popup returns a one-time auth code → `POST /api/v1/auth/google` → backend `google-auth-library` exchanges code (`redirectUri: 'postmessage'`) + verifies ID token → pure `decideGoogleLink` helper decides login/create/block → existing JWT + HttpOnly `zonds_rt` cookie session. Never auto-merge with password accounts. Multi-provider-ready `user_oauth_accounts` table; only Google implemented.

**Tech Stack:** NestJS 10, `google-auth-library`, Passport JWT (existing), React 18 + RTK Query, `@react-oauth/google`, Emotion + `@repo/ui` Button/Icon, PostgreSQL migration `039`, Jest pure-helper tests.

**Spec:** `docs/superpowers/specs/2026-07-21-google-oauth-design.md`

## Global Constraints

- No `any`. No hardcoded status strings — use enums from `@repo/shared` (`OAuthProvider.GOOGLE`, `UserStatus.*`).
- No hardcoded UI strings — all copy via i18n EN+TR.
- No hardcoded colors/spacing — theme tokens via `tkn()` only.
- Design-system only: our `Button` + `Icon name="brand-google"` — never Google's rendered button, never inline SVG in feature code.
- Container/component split strict: no `useState`/`useEffect`/RTK/GIS hooks in `.component.tsx`; no `styled` outside `.style.ts`; types only in `.types.ts`.
- Session parity: Google success response = login success response (`{ accessToken, user }` + `zonds_rt` cookie via `attachSession`).
- Never auto-merge password ↔ Google accounts by email.
- Google skips only name form + email verification; does **not** skip onboarding/eBay connect.
- When Google env is missing: API boots; endpoint returns 503; FE hides the button.
- After editing `@repo/shared` or `@repo/ui` source, rebuild the package (`pnpm --filter @repo/shared build` / `pnpm --filter @repo/ui build`) before apps consume it.
- Never `eslint-disable`. Never `--no-verify` on commit.
- Commit after each task. Pre-commit runs `pnpm lint` only.

## File Structure

| Path | Responsibility |
|---|---|
| `packages/shared/src/domain/auth/auth.types.ts` | `OAuthProvider` enum + `GoogleAuthRequest` |
| `packages/shared/src/i18n/resources/{en,tr}/auth.json` | Button/divider copy + error keys |
| `apps/api/migrations/039_user_oauth_accounts.sql` | `password_hash` nullable + `user_oauth_accounts` |
| `apps/api/src/modules/auth/google-link-decision.ts` | Pure link/create/block decision |
| `apps/api/src/modules/auth/google-link-decision.spec.ts` | Unit tests for decision helper |
| `apps/api/src/modules/auth/google-auth.service.ts` | Code exchange, verify, orchestrate create/login |
| `apps/api/src/modules/auth/dto/google-auth.dto.ts` | class-validator body DTO |
| `apps/api/src/modules/auth/auth.service.ts` | `issueSession(userId)` + null-hash login guard |
| `apps/api/src/modules/auth/auth.controller.ts` | `POST google` |
| `apps/api/src/modules/auth/auth.module.ts` | Register `GoogleAuthService` |
| `apps/api/src/common/config/env.validation.ts` | Optional `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` |
| `apps/api/.env.example` | Document Google env vars |
| `apps/api/package.json` | Add `google-auth-library` |
| `packages/ui/src/atoms/Icon/icons/google.tsx` | Official multicolour G SVG |
| `packages/ui/src/atoms/Icon/icons/index.tsx` | Register `google` + `brand-google` |
| `apps/web/package.json` | Add `@react-oauth/google` |
| `apps/web/.env.example` | `VITE_GOOGLE_CLIENT_ID` |
| `apps/web/src/main.tsx` | Conditional `GoogleOAuthProvider` wrap |
| `apps/web/src/features/auth/api/authApi.ts` | `googleLogin` mutation |
| `apps/web/src/features/auth/login/*` | Google button + container GIS wiring |
| `apps/web/src/features/auth/register/*` | Same as login |
| `CLAUDE.md` | Note Jest coverage + Google OAuth in auth section |

---

### Task 1: Shared types + i18n

**Files:**
- Modify: `packages/shared/src/domain/auth/auth.types.ts`
- Modify: `packages/shared/src/i18n/resources/en/auth.json`
- Modify: `packages/shared/src/i18n/resources/tr/auth.json`
- Rebuild: `@repo/shared`

**Interfaces:**
- Produces: `OAuthProvider` enum (`GOOGLE = 'google'`), `GoogleAuthRequest { code: string; locale?: SupportedLocale }` (barrel already re-exports `./auth.types`)

- [ ] **Step 1: Add enum + request type to auth.types.ts**

Append after the existing exports in `packages/shared/src/domain/auth/auth.types.ts`:

```ts
/**
 * OAuth identity providers stored in user_oauth_accounts.provider.
 * Only GOOGLE is implemented; schema is multi-provider-ready.
 */
export enum OAuthProvider {
  GOOGLE = 'google',
}

/**
 * Body for POST /auth/google (GIS popup auth-code exchange).
 */
export interface GoogleAuthRequest {
  code: string;
  locale?: SupportedLocale;
}
```

(`SupportedLocale` is already imported at the top of this file via `../common/common.constants`.)

- [ ] **Step 2: Update EN auth.json**

In `packages/shared/src/i18n/resources/en/auth.json`:

1. Change `auth.register.signUpWithGoogle` value from `"Google"` to `"Continue with Google"`.
2. Under `auth.errors`, add (keep existing keys; append before the closing of `errors`):

```json
"banned": "This account has been banned",
"googleNotConfigured": "Google sign-in is not configured on this server",
"googleCodeError": "Google sign-in failed. Please try again",
"googleEmailNotVerified": "Your Google email is not verified. Verify it with Google, then try again",
"emailExistsPassword": "This email is already registered with a password. Sign in with your email and password",
"googlePopupClosed": "Google sign-in was cancelled"
```

- [ ] **Step 3: Update TR auth.json**

In `packages/shared/src/i18n/resources/tr/auth.json`:

1. Change `auth.register.signUpWithGoogle` from `"Google"` to `"Google ile devam et"`.
2. Under `auth.errors`, append:

```json
"banned": "Bu hesap yasaklanmış",
"googleNotConfigured": "Google ile giriş bu sunucuda yapılandırılmamış",
"googleCodeError": "Google ile giriş başarısız. Lütfen tekrar deneyin",
"googleEmailNotVerified": "Google e-postanız doğrulanmamış. Google'da doğrulayıp tekrar deneyin",
"emailExistsPassword": "Bu e-posta zaten şifre ile kayıtlı. E-posta ve şifrenizle giriş yapın",
"googlePopupClosed": "Google ile giriş iptal edildi"
```

(`orDivider` already exists as `"Or"` / `"Veya"` — do not change.)

- [ ] **Step 4: Build shared**

Run: `pnpm --filter @repo/shared build`  
Expected: exit 0, `dist/` updated.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/domain/auth/auth.types.ts \
  packages/shared/src/i18n/resources/en/auth.json \
  packages/shared/src/i18n/resources/tr/auth.json
git commit -m "$(cat <<'EOF'
feat(shared): OAuthProvider enum, GoogleAuthRequest, Google auth i18n

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Migration 039 — nullable password_hash + user_oauth_accounts

**Files:**
- Create: `apps/api/migrations/039_user_oauth_accounts.sql`

**Interfaces:**
- Produces: DB schema consumed by Task 5 (`users.password_hash` nullable; `user_oauth_accounts` with unique `(provider, provider_user_id)`)

- [ ] **Step 1: Write migration file**

Create `apps/api/migrations/039_user_oauth_accounts.sql`:

```sql
-- Google OAuth (and future providers): passwordless users + identity links.
-- password_hash becomes nullable so Google-only accounts need no local password.
-- user_oauth_accounts is multi-provider-ready; only 'google' is written in this feature.

ALTER TABLE users
    ALTER COLUMN password_hash DROP NOT NULL;

CREATE TABLE IF NOT EXISTS user_oauth_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    provider_email VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_oauth_accounts_user
    ON user_oauth_accounts(user_id);
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/migrations/039_user_oauth_accounts.sql
git commit -m "$(cat <<'EOF'
feat(db): migration 039 user_oauth_accounts + nullable password_hash

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

(Migration runs automatically on next API boot via `DatabaseService.onModuleInit` → `MigrationRunner`. No manual migrate step required for local verify later.)

---

### Task 3: Pure link/create decision helper (TDD)

**Files:**
- Create: `apps/api/src/modules/auth/google-link-decision.ts`
- Create: `apps/api/src/modules/auth/google-link-decision.spec.ts`

**Interfaces:**
- Consumes: `OAuthProvider`, `UserStatus` from `@repo/shared`; `DEFAULT_LOCALE`, `isValidLocale`, `SupportedLocale` from `@repo/shared`
- Produces:
  - `GoogleIdPayload` (input shape from verified ID token)
  - `GoogleLinkLookup` (DB facts the service loads before calling)
  - `GoogleLinkDecision` discriminated union: `{ action: 'login'; userId } | { action: 'create'; profile } | { action: 'block'; reason }`
  - `GoogleBlockReason = 'googleEmailNotVerified' | 'emailExistsPassword' | 'banned' | 'inactive'`
  - `decideGoogleLink(payload, lookup, requestLocale?): GoogleLinkDecision`
  - `splitGoogleName(payload): { firstName: string; lastName: string }`
  - `resolveGoogleLocale(requestLocale?, googleLocale?): SupportedLocale`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/auth/google-link-decision.spec.ts`:

```ts
import { UserStatus } from '@repo/shared';

import {
  decideGoogleLink,
  resolveGoogleLocale,
  splitGoogleName,
  type GoogleIdPayload,
  type GoogleLinkLookup,
} from './google-link-decision';

const basePayload: GoogleIdPayload = {
  sub: 'google-sub-1',
  email: 'new@example.com',
  emailVerified: true,
  givenName: 'Ada',
  familyName: 'Lovelace',
  name: 'Ada Lovelace',
  picture: 'https://example.com/a.png',
  locale: 'en',
};

const emptyLookup: GoogleLinkLookup = {
  oauthUserId: null,
  oauthUserStatus: null,
  emailOwnerUserId: null,
};

describe('decideGoogleLink', () => {
  it('blocks when email is missing', () => {
    const r = decideGoogleLink({ ...basePayload, email: undefined }, emptyLookup);
    expect(r).toEqual({ action: 'block', reason: 'googleEmailNotVerified' });
  });

  it('blocks when email_verified is false', () => {
    const r = decideGoogleLink({ ...basePayload, emailVerified: false }, emptyLookup);
    expect(r).toEqual({ action: 'block', reason: 'googleEmailNotVerified' });
  });

  it('logs in existing oauth user when active', () => {
    const r = decideGoogleLink(basePayload, {
      oauthUserId: 'user-1',
      oauthUserStatus: UserStatus.ACTIVE,
      emailOwnerUserId: null,
    });
    expect(r).toEqual({ action: 'login', userId: 'user-1' });
  });

  it('blocks banned oauth user', () => {
    const r = decideGoogleLink(basePayload, {
      oauthUserId: 'user-1',
      oauthUserStatus: UserStatus.BANNED,
      emailOwnerUserId: null,
    });
    expect(r).toEqual({ action: 'block', reason: 'banned' });
  });

  it('blocks inactive oauth user', () => {
    const r = decideGoogleLink(basePayload, {
      oauthUserId: 'user-1',
      oauthUserStatus: UserStatus.INACTIVE,
      emailOwnerUserId: null,
    });
    expect(r).toEqual({ action: 'block', reason: 'inactive' });
  });

  it('blocks pending oauth user as inactive', () => {
    const r = decideGoogleLink(basePayload, {
      oauthUserId: 'user-1',
      oauthUserStatus: UserStatus.PENDING,
      emailOwnerUserId: null,
    });
    expect(r).toEqual({ action: 'block', reason: 'inactive' });
  });

  it('blocks when email already owned (never merge)', () => {
    const r = decideGoogleLink(basePayload, {
      oauthUserId: null,
      oauthUserStatus: null,
      emailOwnerUserId: 'password-user',
    });
    expect(r).toEqual({ action: 'block', reason: 'emailExistsPassword' });
  });

  it('creates profile when no oauth and no email owner', () => {
    const r = decideGoogleLink(basePayload, emptyLookup, 'tr');
    expect(r.action).toBe('create');
    if (r.action !== 'create') {
      return;
    }
    expect(r.profile).toEqual({
      providerUserId: 'google-sub-1',
      email: 'new@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      locale: 'tr',
      avatarUrl: 'https://example.com/a.png',
    });
  });
});

describe('splitGoogleName', () => {
  it('prefers given_name + family_name', () => {
    expect(splitGoogleName(basePayload)).toEqual({ firstName: 'Ada', lastName: 'Lovelace' });
  });

  it('splits full name when given/family missing', () => {
    expect(
      splitGoogleName({
        ...basePayload,
        givenName: undefined,
        familyName: undefined,
        name: 'Grace Hopper',
      })
    ).toEqual({ firstName: 'Grace', lastName: 'Hopper' });
  });

  it('falls back to User when nothing present', () => {
    expect(
      splitGoogleName({
        ...basePayload,
        givenName: undefined,
        familyName: undefined,
        name: undefined,
      })
    ).toEqual({ firstName: 'User', lastName: '' });
  });
});

describe('resolveGoogleLocale', () => {
  it('prefers valid request locale', () => {
    expect(resolveGoogleLocale('tr', 'en-US')).toBe('tr');
  });

  it('maps google locale prefix when request missing', () => {
    expect(resolveGoogleLocale(undefined, 'tr-TR')).toBe('tr');
  });

  it('defaults when neither is supported', () => {
    expect(resolveGoogleLocale('de', 'fr-FR')).toBe('en');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `pnpm --filter api test -- google-link-decision`  
Expected: FAIL (module not found / cannot find module).

- [ ] **Step 3: Implement google-link-decision.ts**

Create `apps/api/src/modules/auth/google-link-decision.ts`:

```ts
import {
  DEFAULT_LOCALE,
  isValidLocale,
  UserStatus,
  type SupportedLocale,
} from '@repo/shared';

/** Normalized fields from a verified Google ID token. */
export interface GoogleIdPayload {
  sub: string;
  email?: string;
  emailVerified: boolean;
  givenName?: string;
  familyName?: string;
  name?: string;
  picture?: string;
  locale?: string;
}

/** DB facts loaded by GoogleAuthService before calling decideGoogleLink. */
export interface GoogleLinkLookup {
  /** users.id linked via user_oauth_accounts for this Google sub, if any */
  oauthUserId: string | null;
  /** that user's status, if oauthUserId is set */
  oauthUserStatus: UserStatus | null;
  /** users.id that already owns payload.email (any auth method), if any */
  emailOwnerUserId: string | null;
}

export type GoogleBlockReason =
  | 'googleEmailNotVerified'
  | 'emailExistsPassword'
  | 'banned'
  | 'inactive';

export interface GoogleCreateProfile {
  providerUserId: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: SupportedLocale;
  avatarUrl?: string;
}

export type GoogleLinkDecision =
  | { action: 'login'; userId: string }
  | { action: 'create'; profile: GoogleCreateProfile }
  | { action: 'block'; reason: GoogleBlockReason };

export function splitGoogleName(payload: GoogleIdPayload): { firstName: string; lastName: string } {
  const given = payload.givenName?.trim();
  const family = payload.familyName?.trim();
  if (given || family) {
    return {
      firstName: given && given.length > 0 ? given : 'User',
      lastName: family ?? '',
    };
  }
  const full = payload.name?.trim();
  if (full) {
    const parts = full.split(/\s+/);
    const firstName = parts[0] || 'User';
    const lastName = parts.slice(1).join(' ');
    return { firstName, lastName };
  }
  return { firstName: 'User', lastName: '' };
}

export function resolveGoogleLocale(
  requestLocale?: string,
  googleLocale?: string
): SupportedLocale {
  if (requestLocale && isValidLocale(requestLocale)) {
    return requestLocale;
  }
  if (googleLocale) {
    const prefix = googleLocale.toLowerCase().split('-')[0];
    if (isValidLocale(prefix)) {
      return prefix;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Pure Google link/create/block decision.
 * Never merges a Google identity into an existing password account.
 */
export function decideGoogleLink(
  payload: GoogleIdPayload,
  lookup: GoogleLinkLookup,
  requestLocale?: string
): GoogleLinkDecision {
  const email = payload.email?.trim();
  if (!email || payload.emailVerified !== true) {
    return { action: 'block', reason: 'googleEmailNotVerified' };
  }

  if (lookup.oauthUserId) {
    const status = lookup.oauthUserStatus;
    if (status === UserStatus.BANNED) {
      return { action: 'block', reason: 'banned' };
    }
    if (status !== UserStatus.ACTIVE) {
      // inactive, pending, or unknown → treat as inactive
      return { action: 'block', reason: 'inactive' };
    }
    return { action: 'login', userId: lookup.oauthUserId };
  }

  if (lookup.emailOwnerUserId) {
    return { action: 'block', reason: 'emailExistsPassword' };
  }

  const { firstName, lastName } = splitGoogleName(payload);
  return {
    action: 'create',
    profile: {
      providerUserId: payload.sub,
      email,
      firstName,
      lastName,
      locale: resolveGoogleLocale(requestLocale, payload.locale),
      avatarUrl: payload.picture,
    },
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm --filter api test -- google-link-decision`  
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/auth/google-link-decision.ts \
  apps/api/src/modules/auth/google-link-decision.spec.ts
git commit -m "$(cat <<'EOF'
feat(api): pure Google link/create decision helper + tests

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: AuthService.issueSession + null-hash login guard

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts`

**Interfaces:**
- Consumes: existing `generateTokens`, `mapToUserDto`, `UserEntity`
- Produces: `AuthService.issueSession(userId: string): Promise<AuthResponse>` (public) for GoogleAuthService

- [ ] **Step 1: Make password_hash nullable on UserEntity + guard login**

In `apps/api/src/modules/auth/auth.service.ts`:

1. Change the private `UserEntity` interface field:

```ts
password_hash: string | null;
```

(Also add optional fields used later by Google create path if you prefer reading them back — not required for this task.)

2. In `login`, after the user is found and **before** `bcrypt.compare`, add:

```ts
if (!user.password_hash) {
  throw new UnauthorizedException('auth.errors.invalidCredentials');
}
```

Then keep the existing:

```ts
const isPasswordValid = await bcrypt.compare(request.password, user.password_hash);
```

3. In `changePassword`, after loading the user, if `!users[0].password_hash` throw `UnauthorizedException('auth.errors.wrongPassword')` before `bcrypt.compare` (clearer than letting bcrypt throw).

- [ ] **Step 2: Add public issueSession**

Still in `auth.service.ts`, add a public method (near `getMe` / after `login`):

```ts
/**
 * Issue access+refresh tokens + UserDto for an already-authenticated user id.
 * Used by password login/verify and by GoogleAuthService after link/create.
 */
async issueSession(userId: string): Promise<AuthResponse> {
  const users = await this.databaseService.query<UserEntity & { has_connected_accounts?: boolean }>(
    `SELECT u.*, EXISTS(SELECT 1 FROM ebay_accounts WHERE user_id = u.id) as has_connected_accounts
     FROM users u WHERE u.id = $1`,
    [userId]
  );

  if (users.length === 0) {
    throw new UnauthorizedException('auth.errors.userNotFound');
  }

  const user = users[0];

  if (user.status === UserStatus.BANNED) {
    throw new UnauthorizedException('auth.errors.banned');
  }
  if (user.status !== UserStatus.ACTIVE) {
    throw new UnauthorizedException('auth.errors.inactive');
  }

  const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);

  return {
    accessToken,
    refreshToken,
    user: this.mapToUserDto(user),
  };
}
```

Ensure `UserStatus` is already imported from `@repo/shared` (it is).

Optional cleanup (same commit if small): refactor `login` success path and `verifyEmail` success path to call `issueSession(user.id)` instead of duplicating token generation — only if it stays a small diff; do not rewrite the whole service.

- [ ] **Step 3: Typecheck api (optional sanity)**

Run: `pnpm --filter api typecheck`  
Expected: no new errors in auth.service (pre-existing errors elsewhere are OK if any).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts
git commit -m "$(cat <<'EOF'
feat(api): AuthService.issueSession + block password login for Google-only users

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: GoogleAuthService + endpoint + env + dependency

**Files:**
- Create: `apps/api/src/modules/auth/dto/google-auth.dto.ts`
- Create: `apps/api/src/modules/auth/google-auth.service.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.module.ts`
- Modify: `apps/api/src/common/config/env.validation.ts`
- Modify: `apps/api/.env.example`
- Modify: `apps/api/package.json` (via pnpm add)

**Interfaces:**
- Consumes: `decideGoogleLink`, `GoogleIdPayload`, `AuthService.issueSession`, `OAuthProvider.GOOGLE`, `UserStatus.ACTIVE`, `DatabaseService.transaction` / `query`
- Produces: `POST /api/v1/auth/google` → same body as login + refresh cookie

- [ ] **Step 1: Install google-auth-library**

Run from repo root:

```bash
pnpm --filter api add google-auth-library
```

Expected: `apps/api/package.json` lists `google-auth-library`; lockfile updated.

- [ ] **Step 2: DTO**

Create `apps/api/src/modules/auth/dto/google-auth.dto.ts`:

```ts
import { ApiProperty } from '@nestjs/swagger';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  type GoogleAuthRequest,
  type SupportedLocale,
} from '@repo/shared';
import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GoogleAuthDto implements GoogleAuthRequest {
  @ApiProperty({
    description: 'GIS popup authorization code (auth-code flow)',
    example: '4/0AeanS...',
  })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({
    description: 'User preferred locale from the FE',
    example: 'en',
    enum: SUPPORTED_LOCALES,
    required: false,
    default: DEFAULT_LOCALE,
  })
  @IsOptional()
  @IsString()
  @IsIn(SUPPORTED_LOCALES)
  locale?: SupportedLocale;
}
```

- [ ] **Step 3: GoogleAuthService**

Create `apps/api/src/modules/auth/google-auth.service.ts`:

```ts
import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OAuthProvider,
  UserStatus,
  type AuthResponse,
  type SupportedLocale,
} from '@repo/shared';
import { OAuth2Client } from 'google-auth-library';

import { DatabaseService } from '../../common/database/database.service';

import { AuthService } from './auth.service';
import {
  decideGoogleLink,
  type GoogleIdPayload,
  type GoogleLinkLookup,
} from './google-link-decision';

interface OauthRow {
  user_id: string;
  status: UserStatus;
}

interface EmailOwnerRow {
  id: string;
}

interface InsertedUserRow {
  id: string;
}

@Injectable()
export class GoogleAuthService {
  private readonly logger = new Logger(GoogleAuthService.name);
  private readonly clientId: string | undefined;
  private readonly clientSecret: string | undefined;

  constructor(
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
    private readonly authService: AuthService
  ) {
    this.clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')?.trim() || undefined;
    this.clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET')?.trim() || undefined;
  }

  isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  async authenticate(code: string, locale?: SupportedLocale): Promise<AuthResponse> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('auth.errors.googleNotConfigured');
    }

    const payload = await this.exchangeAndVerify(code);
    const lookup = await this.loadLookup(payload.sub, payload.email);
    const decision = decideGoogleLink(payload, lookup, locale);

    if (decision.action === 'block') {
      this.throwForBlock(decision.reason);
    }

    if (decision.action === 'login') {
      this.logger.log(`Google login for user ${decision.userId}`);
      return this.authService.issueSession(decision.userId);
    }

    // create
    const userId = await this.createGoogleUser(decision.profile);
    this.logger.log(`Google user created ${userId}`);
    return this.authService.issueSession(userId);
  }

  private async exchangeAndVerify(code: string): Promise<GoogleIdPayload> {
    try {
      const client = new OAuth2Client({
        clientId: this.clientId,
        clientSecret: this.clientSecret,
        redirectUri: 'postmessage',
      });

      const { tokens } = await client.getToken(code);
      if (!tokens.id_token) {
        throw new UnauthorizedException('auth.errors.googleCodeError');
      }

      const ticket = await client.verifyIdToken({
        idToken: tokens.id_token,
        audience: this.clientId,
      });
      const p = ticket.getPayload();
      if (!p?.sub) {
        throw new UnauthorizedException('auth.errors.googleCodeError');
      }

      return {
        sub: p.sub,
        email: p.email,
        emailVerified: p.email_verified === true,
        givenName: p.given_name,
        familyName: p.family_name,
        name: p.name,
        picture: p.picture,
        locale: p.locale,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.warn('Google code exchange/verify failed', {
        error: error instanceof Error ? error.message : error,
      });
      throw new UnauthorizedException('auth.errors.googleCodeError');
    }
  }

  private async loadLookup(sub: string, email: string | undefined): Promise<GoogleLinkLookup> {
    const oauthRows = await this.databaseService.query<OauthRow>(
      `SELECT o.user_id, u.status
       FROM user_oauth_accounts o
       INNER JOIN users u ON u.id = o.user_id
       WHERE o.provider = $1 AND o.provider_user_id = $2
       LIMIT 1`,
      [OAuthProvider.GOOGLE, sub]
    );

    let emailOwnerUserId: string | null = null;
    if (email) {
      const emailRows = await this.databaseService.query<EmailOwnerRow>(
        `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email]
      );
      emailOwnerUserId = emailRows[0]?.id ?? null;
    }

    return {
      oauthUserId: oauthRows[0]?.user_id ?? null,
      oauthUserStatus: oauthRows[0]?.status ?? null,
      emailOwnerUserId,
    };
  }

  private async createGoogleUser(profile: {
    providerUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    locale: SupportedLocale;
    avatarUrl?: string;
  }): Promise<string> {
    return this.databaseService.transaction(async (client) => {
      const userResult = await client.query<InsertedUserRow>(
        `INSERT INTO users (
           first_name, last_name, email, password_hash,
           email_verified, status, locale, avatar_url
         ) VALUES ($1, $2, $3, NULL, TRUE, $4, $5, $6)
         RETURNING id`,
        [
          profile.firstName,
          profile.lastName,
          profile.email,
          UserStatus.ACTIVE,
          profile.locale,
          profile.avatarUrl ?? null,
        ]
      );
      const userId = userResult.rows[0].id;

      await client.query(
        `INSERT INTO user_oauth_accounts (user_id, provider, provider_user_id, provider_email)
         VALUES ($1, $2, $3, $4)`,
        [userId, OAuthProvider.GOOGLE, profile.providerUserId, profile.email]
      );

      return userId;
    });
  }

  private throwForBlock(
    reason: 'googleEmailNotVerified' | 'emailExistsPassword' | 'banned' | 'inactive'
  ): never {
    switch (reason) {
      case 'emailExistsPassword':
        throw new ConflictException('auth.errors.emailExistsPassword');
      case 'googleEmailNotVerified':
        throw new UnauthorizedException('auth.errors.googleEmailNotVerified');
      case 'banned':
        throw new UnauthorizedException('auth.errors.banned');
      case 'inactive':
        throw new UnauthorizedException('auth.errors.inactive');
    }
  }
}
```

- [ ] **Step 4: Controller endpoint**

In `apps/api/src/modules/auth/auth.controller.ts`:

1. Import `GoogleAuthService` and `GoogleAuthDto`.
2. Inject `GoogleAuthService` in the constructor alongside `AuthService`.
3. Add:

```ts
@Post('google')
@HttpCode(HttpStatus.OK)
@ApiOperation({
  summary: 'Sign in or register with Google',
  description:
    'Exchanges a GIS popup auth code for a session. Never merges into an existing password account.',
})
@ApiOkResponse({ description: 'Authenticated; access token in body, refresh in HttpOnly cookie' })
@ApiUnauthorizedResponse({ description: 'Invalid code, unverified email, or inactive/banned user' })
@ApiBadRequestResponse({ description: 'Invalid input' })
async google(
  @Body() body: GoogleAuthDto,
  @Res({ passthrough: true }) res: Response
): Promise<Omit<AuthResponse, 'refreshToken'>> {
  const auth = await this.googleAuthService.authenticate(body.code, body.locale);
  return this.attachSession(res, auth);
}
```

Also import `ApiServiceUnavailable` is optional; 503 is fine without a dedicated decorator if not already used — skip extra swagger decorators if they are not imported elsewhere.

- [ ] **Step 5: Module**

In `apps/api/src/modules/auth/auth.module.ts`:

- Import `GoogleAuthService`.
- Add `GoogleAuthService` to `providers` (keep `AuthService`, `JwtStrategy`).
- Do **not** export `GoogleAuthService` unless another module needs it (not required).

- [ ] **Step 6: Env validation + .env.example**

In `apps/api/src/common/config/env.validation.ts`, inside `EnvironmentVariables`, add:

```ts
@IsString()
@IsOptional()
GOOGLE_CLIENT_ID?: string;

@IsString()
@IsOptional()
GOOGLE_CLIENT_SECRET?: string;
```

In `apps/api/.env.example`, append:

```env
# Google OAuth (GIS popup auth-code). Optional — without these, POST /auth/google returns 503
# and the FE hides the Google button when VITE_GOOGLE_CLIENT_ID is empty.
# Create a Web application OAuth client; Authorized JavaScript origins = FE origin(s).
# Authorized redirect URIs can stay empty (GIS uses postmessage).
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

- [ ] **Step 7: Sanity — api boots without Google env**

If Docker/DB is up, run api briefly or at least:

```bash
pnpm --filter api typecheck
```

Expected: no errors introduced in new files. (Full boot optional.)

- [ ] **Step 8: Commit**

```bash
git add apps/api/package.json apps/api/src/modules/auth/dto/google-auth.dto.ts \
  apps/api/src/modules/auth/google-auth.service.ts \
  apps/api/src/modules/auth/auth.controller.ts \
  apps/api/src/modules/auth/auth.module.ts \
  apps/api/src/common/config/env.validation.ts \
  apps/api/.env.example pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(api): POST /auth/google — GIS code exchange + session issue

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: brand-google Icon

**Files:**
- Create: `packages/ui/src/atoms/Icon/icons/google.tsx`
- Modify: `packages/ui/src/atoms/Icon/icons/index.tsx`
- Rebuild: `@repo/ui`

**Interfaces:**
- Produces: `IconName` includes `'google' | 'brand-google'`

- [ ] **Step 1: Create google.tsx**

Create `packages/ui/src/atoms/Icon/icons/google.tsx` with the official multicolour G (fixed brand colors are intentional for the logo mark — same exception class as other brand icons; do not use `currentColor` for the four Google hues):

```tsx
/**
 * Official Google "G" mark (4-color). Brand asset — fixed fills, not theme tokens.
 */
import React from 'react';

export const GoogleIcon = (props: React.SVGProps<SVGSVGElement>): React.ReactElement => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" {...props}>
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);
```

Note: ESLint `no-hardcoded-colors` may flag `#4285F4` etc. inside `packages/ui`. If the rule applies to this path and fails lint:

- Prefer adding a file-level exception **only if the project already does so for brand assets**; otherwise keep fills and ensure the rule's allowlist/scope excludes `icons/**` brand files the same way amazon/ebay custom icons work today.
- Do **not** add `eslint-disable` comments (project rule). If lint fails, check how other brand SVGs with fills are handled; amazon/ebay currently use `currentColor`. If `no-hardcoded-colors` blocks this file, use a single-path monochrome G with `fill="currentColor"` as fallback so the button still ships — document the fallback in the commit message. Prefer the 4-color mark if lint allows.

- [ ] **Step 2: Register in icon map**

In `packages/ui/src/atoms/Icon/icons/index.tsx`:

1. Add import next to amazon/ebay imports:

```ts
import { GoogleIcon } from './google';
```

2. In the brand section of `iconMap`:

```ts
google: GoogleIcon as React.FC<React.SVGProps<SVGSVGElement>>,
'brand-google': GoogleIcon as React.FC<React.SVGProps<SVGSVGElement>>,
```

- [ ] **Step 3: Build UI**

Run: `pnpm --filter @repo/ui build`  
Expected: exit 0.

- [ ] **Step 4: Lint check on icon files**

Run: `pnpm lint`  
If hardcoded-color fails on `google.tsx`, switch to monochrome `currentColor` G and rebuild; then re-lint.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/atoms/Icon/icons/google.tsx \
  packages/ui/src/atoms/Icon/icons/index.tsx
git commit -m "$(cat <<'EOF'
feat(ui): brand-google icon for OAuth button

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: FE dependency, env, provider, authApi

**Files:**
- Modify: `apps/web/package.json` (via pnpm)
- Modify: `apps/web/.env.example`
- Modify: `apps/web/src/main.tsx`
- Modify: `apps/web/src/features/auth/api/authApi.ts`

**Interfaces:**
- Consumes: `GoogleAuthRequest`, `AuthResponse` from `@repo/shared`
- Produces: `useGoogleLoginMutation`, root `GoogleOAuthProvider` when `VITE_GOOGLE_CLIENT_ID` is set

- [ ] **Step 1: Install @react-oauth/google**

```bash
pnpm --filter web add @react-oauth/google
```

- [ ] **Step 2: .env.example**

Append to `apps/web/.env.example`:

```env
# Google Identity Services (popup auth-code). Same Client ID as API GOOGLE_CLIENT_ID.
# Leave empty to hide the Google button on login/register.
VITE_GOOGLE_CLIENT_ID=
```

- [ ] **Step 3: Wrap main.tsx**

Replace the render tree in `apps/web/src/main.tsx` so `GoogleOAuthProvider` wraps only when the client id is non-empty:

```tsx
import { ThemeProvider, UIProvider } from '@repo/ui';
import { GoogleOAuthProvider } from '@react-oauth/google';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';

import { App } from './App';
import { store } from './app/store';
import { GlobalMessageModal } from './components/GlobalMessageModal';
import { AuthBootstrap } from './features/auth/AuthBootstrap';
import './i18n.config';
import './index.css';

const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';

function RootProviders({ children }: { children: React.ReactNode }): React.ReactElement {
  const tree = (
    <Provider store={store}>
      <ThemeProvider>
        <UIProvider>
          <AuthBootstrap>
            {children}
            <GlobalMessageModal />
          </AuthBootstrap>
        </UIProvider>
      </ThemeProvider>
    </Provider>
  );

  if (!googleClientId) {
    return tree;
  }

  return <GoogleOAuthProvider clientId={googleClientId}>{tree}</GoogleOAuthProvider>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RootProviders>
      <App />
    </RootProviders>
  </React.StrictMode>
);
```

- [ ] **Step 4: authApi googleLogin mutation**

In `apps/web/src/features/auth/api/authApi.ts`:

1. Extend the type import from `@repo/shared` to include `GoogleAuthRequest`.
2. Add endpoint inside `endpoints`:

```ts
googleLogin: builder.mutation<AuthResponse, GoogleAuthRequest>({
  query: (body) => ({
    url: '/auth/google',
    method: 'POST',
    body,
  }),
  invalidatesTags: ['Auth'],
}),
```

3. Export hook from the destructured list:

```ts
useGoogleLoginMutation,
```

(Name collision note: the GIS hook is also conceptually "useGoogleLogin". Our RTK hook is `useGoogleLoginMutation`. In containers, import GIS as:

```ts
import { useGoogleLogin as useGoogleOAuth } from '@react-oauth/google';
```

and RTK as `useGoogleLoginMutation` — never shadow.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/.env.example apps/web/src/main.tsx \
  apps/web/src/features/auth/api/authApi.ts pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
feat(web): GoogleOAuthProvider + googleLogin RTK mutation

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Login + Register UI + container GIS wiring

**Files:**
- Modify: `apps/web/src/features/auth/login/LoginPage.types.ts`
- Modify: `apps/web/src/features/auth/login/LoginPage.style.ts`
- Modify: `apps/web/src/features/auth/login/LoginPage.component.tsx`
- Modify: `apps/web/src/features/auth/login/LoginPage.container.tsx`
- Modify: `apps/web/src/features/auth/register/RegisterPage.types.ts`
- Modify: `apps/web/src/features/auth/register/RegisterPage.style.ts`
- Modify: `apps/web/src/features/auth/register/RegisterPage.component.tsx`
- Modify: `apps/web/src/features/auth/register/RegisterPage.container.tsx`

**Interfaces:**
- Consumes: `useGoogleLoginMutation`, GIS `useGoogleLogin` (aliased), `setCredentials`, `getErrorI18nKey`, `useLocale`
- Produces: Google button above form on both pages; success navigates like password login

- [ ] **Step 1: Types (both pages)**

`LoginPage.types.ts`:

```ts
import type { LoginFormData } from '@repo/shared';

export interface LoginPageComponentProps {
  onSubmit: (data: LoginFormData) => void;
  isLoading: boolean;
  onNavigateToRegister: () => void;
  onGoogleSignIn: () => void;
  isGoogleLoading: boolean;
  googleEnabled: boolean;
}
```

`RegisterPage.types.ts`:

```ts
import type { RegisterFormData } from '@repo/shared';

export interface RegisterPageComponentProps {
  onSubmit: (data: RegisterFormData) => void;
  isLoading: boolean;
  onNavigateToLogin: () => void;
  onGoogleSignIn: () => void;
  isGoogleLoading: boolean;
  googleEnabled: boolean;
}
```

- [ ] **Step 2: Styles — GoogleButtonRow + OrDivider (both style files)**

Append to **both** `LoginPage.style.ts` and `RegisterPage.style.ts`:

```ts
export const GoogleButtonRow = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: ${tkn('spacing.lg')};
`;

export const OrDivider = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  margin-bottom: ${tkn('spacing.lg')};
  width: 100%;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${tkn('colors.border.primary')};
  }
`;
```

(`tkn` and `styled` already imported in both files.)

- [ ] **Step 3: Login component markup**

In `LoginPage.component.tsx`:

1. Import `Icon` from `@repo/ui` (alongside existing Button, Text, …).
2. Destructure new props: `onGoogleSignIn`, `isGoogleLoading`, `googleEnabled`.
3. Inside `S.AuthCard`, **after** `S.Header` and **before** `S.Form`, insert:

```tsx
{googleEnabled ? (
  <>
    <S.GoogleButtonRow>
      <Button
        type="button"
        variant="secondary"
        fullWidth
        size="large"
        isLoading={isGoogleLoading}
        isDisabled={isLoading || isSubmitting || isGoogleLoading}
        onClick={onGoogleSignIn}
      >
        <Icon name="brand-google" size="md" />
        <Text>{t('auth:auth.register.signUpWithGoogle')}</Text>
      </Button>
    </S.GoogleButtonRow>
    <S.OrDivider>
      <Text variant="body-sm" color="text.secondary">
        {t('auth:auth.register.orDivider')}
      </Text>
    </S.OrDivider>
  </>
) : null}
```

Check whether `Button` supports `isDisabled` in this codebase; if the prop is `disabled`, use `disabled={...}` per `ButtonProps` (it extends button HTML attrs — prefer `disabled`).

If Button children layout does not auto-gap icon+text, wrap children in a fragment only — do not add inline `style`. If visual gap is missing, add a tiny flex gap on a styled wrapper in `.style.ts` (e.g. `GoogleButtonContent`) using `tkn('spacing.xs')` — not inline styles.

Namespace: pages already use `useTranslation(['translation', 'auth'])` and keys like `auth:auth.login.title`. Keep that pattern: `t('auth:auth.register.signUpWithGoogle')`.

- [ ] **Step 4: Register component markup**

Same Google block as login in `RegisterPage.component.tsx` (same placement: after header, before form). Same props.

- [ ] **Step 5: Login container GIS wiring**

Rewrite logic in `LoginPage.container.tsx` along these lines (keep existing password path):

```tsx
import type { LoginFormData, SupportedLocale } from '@repo/shared';
import { useLoading, useUI } from '@repo/ui';
import { useGoogleLogin as useGoogleOAuth } from '@react-oauth/google';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { useGoogleLoginMutation, useLoginMutation } from '../api/authApi';
import { setCredentials } from '../store/authSlice';

import { LoginPageComponent } from './LoginPage.component';

import { getErrorI18nKey } from '@/utils/errorHandler';
import { useLocale } from '@/utils/useLocale';

const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';

export const LoginPageContainer = (): React.ReactElement => {
  const dispatch = useDispatch();
  const { locale, localeNavigate } = useLocale();
  const { showMessage, closeMessage } = useUI();
  const { i18n } = useTranslation();

  const [login, { isLoading, isSuccess, error, data }] = useLoginMutation();
  const [googleLogin, { isLoading: isGoogleLoading, isSuccess: isGoogleSuccess, error: googleError, data: googleData }] =
    useGoogleLoginMutation();

  useLoading(isLoading || isGoogleLoading);

  const navigateAfterAuth = (user: { hasConnectedAccounts: boolean }): void => {
    if (user.hasConnectedAccounts) {
      localeNavigate('/dashboard');
    } else {
      localeNavigate('/onboarding/ebay');
    }
  };

  useEffect(() => {
    if (isSuccess && data) {
      dispatch(setCredentials(data));
      navigateAfterAuth(data.user);
    }
  }, [isSuccess, data, dispatch, localeNavigate]);

  useEffect(() => {
    if (isGoogleSuccess && googleData) {
      dispatch(setCredentials(googleData));
      navigateAfterAuth(googleData.user);
    }
  }, [isGoogleSuccess, googleData, dispatch, localeNavigate]);

  const showError = (err: unknown): void => {
    const key = getErrorI18nKey(err as Parameters<typeof getErrorI18nKey>[0]);
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: key,
        primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
      },
      i18n.t.bind(i18n)
    );
  };

  useEffect(() => {
    if (error) {
      showError(error);
    }
  }, [error]);

  useEffect(() => {
    if (googleError) {
      showError(googleError);
    }
  }, [googleError]);

  const startGoogleOAuth = useGoogleOAuth({
    flow: 'auth-code',
    onSuccess: (res) => {
      void googleLogin({ code: res.code, locale: locale as SupportedLocale });
    },
    onError: () => {
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: 'auth:auth.errors.googlePopupClosed',
          primaryButton: { labelKey: 'translation:message.error.close', onClick: closeMessage },
        },
        i18n.t.bind(i18n)
      );
    },
  });

  // useGoogleOAuth must not be called when provider is missing — GIS throws.
  // Only invoke the returned function when googleEnabled.
  const handleGoogleSignIn = (): void => {
    if (!googleClientId) {
      return;
    }
    startGoogleOAuth();
  };

  const handleSubmit = (form: LoginFormData): void => {
    void login({ email: form.email, password: form.password });
  };

  const handleNavigateToRegister = (): void => {
    localeNavigate('/register');
  };

  return (
    <LoginPageComponent
      onSubmit={handleSubmit}
      isLoading={isLoading}
      onNavigateToRegister={handleNavigateToRegister}
      onGoogleSignIn={handleGoogleSignIn}
      isGoogleLoading={isGoogleLoading}
      googleEnabled={Boolean(googleClientId)}
    />
  );
};
```

**Important hooks rule:** `useGoogleOAuth` cannot be called conditionally. Calling it when `GoogleOAuthProvider` is absent (no client id) will throw. Fix:

**Preferred approach when client id may be missing:** always wrap with `GoogleOAuthProvider` in `main.tsx` using a placeholder empty string is **invalid**. Instead:

Option A (recommended in this plan): In Task 7, **always** mount `GoogleOAuthProvider` only when id is set; in the login/register containers, **split** into two components:

- `LoginPageContainer` reads `googleClientId` and renders either `LoginPageContainerWithGoogle` (calls `useGoogleOAuth`) or `LoginPageContainerPasswordOnly` (does not call the hook).

Implement the split so hooks rules are satisfied:

```tsx
export const LoginPageContainer = (): React.ReactElement => {
  if (!googleClientId) {
    return <LoginPageContainerPasswordOnly />;
  }
  return <LoginPageContainerWithGoogle />;
};
```

Put shared password logic in a small internal helper or duplicate the thin password path in both — prefer extracting `usePasswordLogin()` local hook in the same file if it stays under ~40 lines. **Do not** call `useGoogleOAuth` in the password-only branch.

Apply the same split pattern to Register.

If this feels heavy, **Option B:** always wrap `GoogleOAuthProvider` with the real client id in dev once env is set; document that local FE without the env simply never mounts the Google branch component. Still implement the split — it is required for correct hooks usage.

- [ ] **Step 6: Register container**

Mirror login: password register path unchanged; Google success → `setCredentials` + same `navigateAfterAuth`; same split WithGoogle / PasswordOnly; `googleLogin({ code, locale })`; `googleEnabled={Boolean(googleClientId)}`.

Register does **not** go to check-email on Google success — only password register does.

- [ ] **Step 7: Lint**

Run: `pnpm lint`  
Expected: 0 warnings. Fix container/component split violations if the hook flags them.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/features/auth/login apps/web/src/features/auth/register
git commit -m "$(cat <<'EOF'
feat(web): Google continue button on login and register

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: CLAUDE.md + final verification

**Files:**
- Modify: `CLAUDE.md` (Jest coverage list + short auth/Google note if there is an auth section; otherwise only Jest list)

- [ ] **Step 1: Update Jest coverage list in CLAUDE.md**

Find the sentence listing covered pure helpers (`profit-calculation.ts`, `order-matcher.ts`, …) and append `google-link-decision.ts`.

Optional one-liner under auth / environment: Google OAuth needs `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` (api) and `VITE_GOOGLE_CLIENT_ID` (web); GIS popup auth-code; see spec `docs/superpowers/specs/2026-07-21-google-oauth-design.md`. Keep it short.

- [ ] **Step 2: Run tests + lint**

```bash
pnpm --filter api test -- google-link-decision
pnpm lint
```

Expected: tests PASS; lint 0 warnings.

- [ ] **Step 3: Manual checklist (document in commit body if not runnable here)**

Operator must set Google Cloud OAuth Web client + env before live click works:

1. API restart picks up migration `039`.
2. Without env: login/register show **no** Google button; password auth works.
3. With env: button visible → popup → new user lands on `/onboarding/ebay` with session.
4. Second Google login same account → dashboard or onboarding per eBay link; no duplicate user.
5. Password-registered email via Google → error `emailExistsPassword`.
6. Google-only user password login → `invalidCredentials`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "$(cat <<'EOF'
docs: note Google OAuth + google-link-decision in CLAUDE.md

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Spec coverage checklist (plan self-review)

| Spec requirement | Task |
|---|---|
| GIS popup auth-code FE | 7, 8 |
| `POST /auth/google` code exchange `postmessage` | 5 |
| Never merge by email | 3, 5 |
| `user_oauth_accounts` + nullable `password_hash` | 2 |
| `issueSession` / cookie parity via `attachSession` | 4, 5 |
| Null-hash password login blocked | 4 |
| Onboarding navigation unchanged | 8 |
| `OAuthProvider` + i18n EN/TR | 1 |
| `brand-google` + design-system Button | 6, 8 |
| Env optional / hide button | 5, 7, 8 |
| Pure helper unit tests | 3 |
| CLAUDE.md Jest list | 9 |
| No settings link flow / no other providers UI | out of scope (not in tasks) |

## Placeholder / consistency scan

- No TBD/TODO left in task steps.
- RTK hook name `useGoogleLoginMutation` vs GIS `useGoogleOAuth` alias locked in Task 7–8.
- i18n keys: reuse `auth.register.signUpWithGoogle` + `auth.register.orDivider`; errors under `auth.errors.*`.
- Block reasons map 1:1 to i18n keys via `auth.errors.<reason>`.
- Hooks-rule split (WithGoogle / PasswordOnly) mandatory when provider may be absent.
