import { AmazonAccountStatus, EbayAccountStatus } from '@repo/shared';
import type { BadgeVariant } from '@repo/ui';

/**
 * Solid badge colour for an account status — the same one-hue-per-state rule
 * `StatusBadge` follows (active green · verifying sky · broken red), so a
 * store reads the same in Settings as everywhere else. A state the seller
 * chose (disconnected) is grey, never an alarm.
 */
export const ebayStatusBadgeVariant = (status: EbayAccountStatus): BadgeVariant => {
  switch (status) {
    case EbayAccountStatus.ACTIVE:
      return 'success';
    case EbayAccountStatus.REVOKED:
    case EbayAccountStatus.ERROR:
      return 'error';
    default:
      return 'neutral';
  }
};

export const amazonStatusBadgeVariant = (status: AmazonAccountStatus): BadgeVariant => {
  switch (status) {
    case AmazonAccountStatus.ACTIVE:
      return 'success';
    case AmazonAccountStatus.VERIFYING:
      return 'sky';
    case AmazonAccountStatus.NEEDS_REAUTH:
      return 'orange';
    default:
      return 'error';
  }
};
