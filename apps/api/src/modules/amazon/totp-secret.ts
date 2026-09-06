/**
 * TOTP (2FA) secret normalization for Amazon buyer accounts.
 *
 * The implementation moved to `@repo/shared` (`utils/totp-secret.ts`) so the
 * web drawer normalizes a pasted secret exactly the way this service stores it
 * and the way otplib later decodes it — one definition, no drift. This file
 * stays as the local import path (`./totp-secret`) used across the module and
 * by `totp-secret.spec.ts`.
 */
export { isValidTotpSecret, normalizeTotpSecret } from '@repo/shared';
