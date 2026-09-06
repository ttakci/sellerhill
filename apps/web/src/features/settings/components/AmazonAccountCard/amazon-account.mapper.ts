import { AmazonVerificationFailureCode, type AmazonAccountPublicDto } from '@repo/shared';
import { formatDate } from '@repo/ui';

import type { AmazonAccountCardView } from './AmazonAccountCard.types';

const KNOWN_VERIFICATION_CODES = new Set<string>(Object.values(AmazonVerificationFailureCode));

/**
 * Normalize the backend's `lastVerificationError` into a code the card can
 * localize. It should already be an `AmazonVerificationFailureCode` (the
 * verify processor persists only codes), but rows written before the enum
 * existed may still hold a raw English phrase — those collapse to `UNKNOWN`
 * so the seller never sees an untranslated sentence.
 */
const resolveVerificationErrorCode = (
  raw: string | null | undefined,
): AmazonVerificationFailureCode | undefined => {
  if (!raw) {return undefined;}
  return KNOWN_VERIFICATION_CODES.has(raw)
    ? (raw as AmazonVerificationFailureCode)
    : AmazonVerificationFailureCode.UNKNOWN;
};

export const toAmazonAccountCardView = (account: AmazonAccountPublicDto, locale: string): AmazonAccountCardView => ({
  id: account.id,
  displayName: account.label || account.email,
  email: account.email,
  connectedSince: formatDate(account.createdAt, locale, { year: 'numeric' }),
  status: account.status,
  verificationErrorCode: resolveVerificationErrorCode(account.lastVerificationError),
  hasTwoFactor: account.hasTwoFactor ?? false,
  autoFulfillEnabled: account.autoFulfillEnabled,
  autoFulfillCapTotal: account.autoFulfillCapTotal,
});
