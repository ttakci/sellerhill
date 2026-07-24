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
