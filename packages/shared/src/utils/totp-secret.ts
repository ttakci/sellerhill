/**
 * TOTP (2FA) secret normalization for Amazon buyer accounts.
 *
 * Shared by the web drawer (normalizes as the user pastes) and the API
 * (`AmazonAccountsService` — normalizes again at write, and before feeding the
 * secret to otplib at scrape/checkout time). ONE definition so the value the
 * user sees in the field is byte-for-byte what gets stored and what otplib
 * decodes.
 *
 * WHY THIS EXISTS: Amazon displays the authenticator secret grouped in blocks
 * ("abcd efgh ijkl mnop"), and users copy-paste it verbatim. otplib v13 decodes
 * the secret with `ScureBase32Plugin` -> `@scure/base` `base32.decode`, which is
 * strict about the alphabet: a single space throws
 * `Invalid Base32 string: Unknown letter: " "`. On the API that error would
 * otherwise surface much later — at scrape/checkout time inside `performLogin`,
 * misclassified as a `login` block — so the account looks credential-broken when
 * only the paste format was wrong.
 */

/** Base32 (RFC 4648) alphabet + optional `=` padding — what otplib accepts. */
const BASE32_RE = /^[A-Z2-7]+=*$/;

/**
 * Shortest secret we accept, in base32 chars. 16 chars = 80 bits, the
 * Google-Authenticator floor and well below Amazon's own length, so this
 * rejects garbage (e.g. a pasted 6-digit OTP code) without rejecting a real
 * secret.
 */
const MIN_SECRET_LENGTH = 16;

/**
 * Strip the separators authenticator UIs add for readability (whitespace,
 * hyphens, underscores) and uppercase the rest. Returns `null` for
 * empty/whitespace-only input so callers can treat "no secret" uniformly.
 *
 * Lowercase is accepted because the base32 plugin uppercases internally; we do
 * it here too so the stored value is canonical.
 */
export function normalizeTotpSecret(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) {
    return null;
  }
  const normalized = raw.replace(/[\s\-_]/g, '').toUpperCase();
  return normalized === '' ? null : normalized;
}

/**
 * True when an ALREADY-NORMALIZED secret is decodable base32 of plausible
 * length. Kept separate from `normalizeTotpSecret` so the write path can
 * reject a malformed paste up front while the read path stays lenient (a
 * stored row must never become unusable because validation got stricter).
 */
export function isValidTotpSecret(secret: string): boolean {
  if (secret.length < MIN_SECRET_LENGTH) {
    return false;
  }
  return BASE32_RE.test(secret);
}
