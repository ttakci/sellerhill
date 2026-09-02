import {
  generateResetToken,
  hashResetToken,
  isResetTokenExpired,
  isWithinResetCooldown,
  resetTokenExpiry,
} from './password-reset-helpers';

describe('generateResetToken', () => {
  it('produces a URL-safe string with no padding', () => {
    const token = generateResetToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token).not.toContain('=');
  });

  it('is unique per call', () => {
    expect(generateResetToken()).not.toBe(generateResetToken());
  });
});

describe('hashResetToken', () => {
  it('is a stable 64-char sha256 hex digest', () => {
    const h = hashResetToken('abc');
    expect(h).toHaveLength(64);
    expect(h).toBe(hashResetToken('abc'));
  });

  it('never returns the token itself', () => {
    const token = generateResetToken();
    expect(hashResetToken(token)).not.toBe(token);
  });
});

describe('isResetTokenExpired', () => {
  const now = new Date('2026-09-02T12:00:00Z');

  it('false while the expiry is in the future', () => {
    expect(isResetTokenExpired(new Date('2026-09-02T12:30:00Z'), now)).toBe(false);
  });

  it('true at or past the expiry (boundary is expired)', () => {
    expect(isResetTokenExpired(new Date('2026-09-02T12:00:00Z'), now)).toBe(true);
    expect(isResetTokenExpired('2026-09-02T11:59:59Z', now)).toBe(true);
  });
});

describe('isWithinResetCooldown', () => {
  const now = new Date('2026-09-02T12:00:00Z');

  it('false when there is no prior token', () => {
    expect(isWithinResetCooldown(null, 60, now)).toBe(false);
    expect(isWithinResetCooldown(undefined, 60, now)).toBe(false);
  });

  it('true when the last token is younger than the cooldown', () => {
    expect(isWithinResetCooldown('2026-09-02T11:59:30Z', 60, now)).toBe(true);
  });

  it('false once the cooldown has fully elapsed', () => {
    expect(isWithinResetCooldown('2026-09-02T11:59:00Z', 60, now)).toBe(false);
    expect(isWithinResetCooldown('2026-09-02T11:58:00Z', 60, now)).toBe(false);
  });
});

describe('resetTokenExpiry', () => {
  it('adds the TTL in minutes to now', () => {
    const now = new Date('2026-09-02T12:00:00Z');
    expect(resetTokenExpiry(60, now).toISOString()).toBe('2026-09-02T13:00:00.000Z');
  });
});
