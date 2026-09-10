import { createHash } from 'crypto';

import {
  computeChallengeResponse,
  isValidVerificationToken,
  parseAccountDeletionNotification,
} from './ebay-account-deletion.helpers';

describe('computeChallengeResponse', () => {
  const token = 'a'.repeat(40);
  const endpoint = 'https://app.sellerhill.com/api/v1/ebay/marketplace-deletion-notification';

  it('hashes challengeCode + verificationToken + endpoint in that exact order', () => {
    // eBay validates the response by recomputing this exact concatenation. Any
    // other order (or a trailing slash mismatch on the endpoint) makes the
    // keyset stay permanently disabled with no error beyond "validation failed".
    const expected = createHash('sha256')
      .update('CHAL123' + token + endpoint)
      .digest('hex');
    expect(computeChallengeResponse('CHAL123', token, endpoint)).toBe(expected);
  });

  it('returns lowercase hex', () => {
    const out = computeChallengeResponse('x', token, endpoint);
    expect(out).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is order-sensitive — swapping token and endpoint changes the hash', () => {
    const a = computeChallengeResponse('c', token, endpoint);
    const b = computeChallengeResponse('c', endpoint, token);
    expect(a).not.toBe(b);
  });
});

describe('isValidVerificationToken', () => {
  it('accepts 32 to 80 chars of [A-Za-z0-9_-]', () => {
    expect(isValidVerificationToken('a'.repeat(32))).toBe(true);
    expect(isValidVerificationToken('a'.repeat(80))).toBe(true);
    expect(isValidVerificationToken('Ab9_-'.repeat(8))).toBe(true); // 40 chars
  });

  it('rejects anything shorter than 32 or longer than 80', () => {
    expect(isValidVerificationToken('a'.repeat(31))).toBe(false);
    expect(isValidVerificationToken('a'.repeat(81))).toBe(false);
    expect(isValidVerificationToken('')).toBe(false);
  });

  it('rejects disallowed characters (eBay allows only alphanumerics, _ and -)', () => {
    expect(isValidVerificationToken('a'.repeat(31) + '!')).toBe(false);
    expect(isValidVerificationToken('a'.repeat(31) + ' ')).toBe(false);
    expect(isValidVerificationToken('a'.repeat(31) + '.')).toBe(false);
  });

  it('rejects non-strings', () => {
    expect(isValidVerificationToken(undefined)).toBe(false);
    expect(isValidVerificationToken(null)).toBe(false);
    expect(isValidVerificationToken(12345 as unknown as string)).toBe(false);
  });
});

describe('parseAccountDeletionNotification', () => {
  const valid = {
    metadata: { topic: 'MARKETPLACE_ACCOUNT_DELETION', schemaVersion: '1.0', deprecated: false },
    notification: {
      notificationId: 'n-1',
      eventDate: '2026-09-11T00:00:00.000Z',
      publishDate: '2026-09-11T00:00:01.000Z',
      publishAttemptCount: 1,
      data: { username: 'someBuyer', userId: 'u-123', eiasToken: 'eias-abc' },
    },
  };

  it('extracts username, userId and eiasToken from a well-formed payload', () => {
    expect(parseAccountDeletionNotification(valid)).toEqual({
      username: 'someBuyer',
      userId: 'u-123',
      eiasToken: 'eias-abc',
    });
  });

  it('tolerates a missing eiasToken (nulls it) — username/userId are what we match on', () => {
    const noEias = {
      ...valid,
      notification: { ...valid.notification, data: { username: 'b', userId: 'u' } },
    };
    expect(parseAccountDeletionNotification(noEias)).toEqual({
      username: 'b',
      userId: 'u',
      eiasToken: null,
    });
  });

  it('returns null when neither username nor userId is present — nothing to match', () => {
    const empty = {
      ...valid,
      notification: { ...valid.notification, data: {} },
    };
    expect(parseAccountDeletionNotification(empty)).toBeNull();
  });

  it('accepts a payload carrying only userId (no username)', () => {
    const idOnly = {
      ...valid,
      notification: { ...valid.notification, data: { userId: 'u-9' } },
    };
    expect(parseAccountDeletionNotification(idOnly)).toEqual({
      username: null,
      userId: 'u-9',
      eiasToken: null,
    });
  });

  it('returns null for garbage / wrong shape', () => {
    expect(parseAccountDeletionNotification(null)).toBeNull();
    expect(parseAccountDeletionNotification('nope')).toBeNull();
    expect(parseAccountDeletionNotification({})).toBeNull();
    expect(parseAccountDeletionNotification({ notification: {} })).toBeNull();
    expect(parseAccountDeletionNotification({ notification: { data: 'x' } })).toBeNull();
  });

  it('trims whitespace and rejects blank-after-trim values', () => {
    const padded = {
      ...valid,
      notification: { ...valid.notification, data: { username: '  buyer  ', userId: '   ' } },
    };
    expect(parseAccountDeletionNotification(padded)).toEqual({
      username: 'buyer',
      userId: null,
      eiasToken: null,
    });
  });
});
