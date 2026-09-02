import { createHash, randomBytes } from 'crypto';

/**
 * Pure helpers for the password-reset flow. Kept side-effect-free so they can be
 * unit-tested without a DB (the rest of AuthService is manual-verified per repo
 * convention).
 */

/** Opaque, URL-safe reset token — 256 bits of CSPRNG entropy. */
export function generateResetToken(): string {
  return randomBytes(32).toString('base64url');
}

/** What we actually persist. The raw token only ever exists in the emailed link. */
export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** A token is dead once its expiry is at or before `now`. */
export function isResetTokenExpired(expiresAt: Date | string, now: Date = new Date()): boolean {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return expiry.getTime() <= now.getTime();
}

/**
 * True when a fresh reset email must NOT be sent because one was issued less
 * than `cooldownSeconds` ago. `lastCreatedAt` is the newest unconsumed token's
 * `created_at`, or null when the user has none.
 */
export function isWithinResetCooldown(
  lastCreatedAt: Date | string | null | undefined,
  cooldownSeconds: number,
  now: Date = new Date(),
): boolean {
  if (!lastCreatedAt) {
    return false;
  }
  const created = lastCreatedAt instanceof Date ? lastCreatedAt : new Date(lastCreatedAt);
  return now.getTime() - created.getTime() < cooldownSeconds * 1000;
}

/** Absolute expiry timestamp for a token minted `now`. */
export function resetTokenExpiry(ttlMinutes: number, now: Date = new Date()): Date {
  return new Date(now.getTime() + ttlMinutes * 60 * 1000);
}
