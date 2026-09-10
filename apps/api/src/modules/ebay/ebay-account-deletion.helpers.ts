/**
 * eBay Marketplace Account Deletion / Closure Notification — pure helpers.
 *
 * eBay disables every new PRODUCTION keyset until the app proves it can receive
 * the GDPR "right to erasure" notifications eBay sends when one of its users
 * permanently closes their account. Proof is a two-part public endpoint:
 *
 *   1. A challenge GET: eBay appends `?challenge_code=<random>` and the endpoint
 *      must return `sha256(challengeCode + verificationToken + endpointUrl)` as
 *      lowercase hex, wrapped as `{"challengeResponse": "<hex>"}`.
 *   2. A notification POST carrying `{ username, userId, eiasToken }` for the
 *      user whose data must now be erased.
 *
 * The concatenation ORDER in (1) is not negotiable — eBay recomputes the exact
 * same string server-side, and the only feedback on a mismatch is "endpoint
 * validation failed". A trailing-slash difference on the endpoint URL is the
 * usual cause, which is why the URL used here must be the byte-identical string
 * registered in the eBay developer portal.
 */

import { createHash } from 'crypto';

const VERIFICATION_TOKEN_RE = /^[A-Za-z0-9_-]{32,80}$/;

/**
 * The challenge response eBay expects: SHA-256 of the three values concatenated
 * in this exact order, as a lowercase hex string.
 */
export function computeChallengeResponse(
  challengeCode: string,
  verificationToken: string,
  endpointUrl: string,
): string {
  return createHash('sha256')
    .update(challengeCode + verificationToken + endpointUrl)
    .digest('hex');
}

/** eBay's rule: 32–80 chars, only alphanumerics, underscore and hyphen. */
export function isValidVerificationToken(token: unknown): token is string {
  return typeof token === 'string' && VERIFICATION_TOKEN_RE.test(token);
}

export interface AccountDeletionTarget {
  /** eBay username, or null if the payload only carried a userId. */
  username: string | null;
  /** Immutable public user id, or null if the payload only carried a username. */
  userId: string | null;
  /** Legacy token; corroborating only, never the sole match key. */
  eiasToken: string | null;
}

/** Blank-safe string read: trims, returns null for missing/blank/non-string. */
function str(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Narrow eBay's notification payload to the fields we act on. Returns null when
 * the shape is wrong OR when neither a username nor a userId is present — with
 * neither there is nothing to match a row against, so treating it as a no-op
 * (200) is correct: eBay must not retry something we cannot action.
 */
export function parseAccountDeletionNotification(body: unknown): AccountDeletionTarget | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const notification = (body as { notification?: unknown }).notification;
  if (typeof notification !== 'object' || notification === null) {
    return null;
  }
  const data = (notification as { data?: unknown }).data;
  if (typeof data !== 'object' || data === null) {
    return null;
  }

  const record = data as Record<string, unknown>;
  const username = str(record.username);
  const userId = str(record.userId);
  if (!username && !userId) {
    return null;
  }

  return { username, userId, eiasToken: str(record.eiasToken) };
}
