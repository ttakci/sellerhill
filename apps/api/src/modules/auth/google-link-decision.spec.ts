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
