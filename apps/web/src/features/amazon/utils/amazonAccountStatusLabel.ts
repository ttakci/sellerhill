import { AmazonAccountStatus } from '@repo/shared';
import type { TFunction } from 'i18next';

/** The one resolver for a buyer account's status label (see `getEbayAccountStatusLabel`). */
export const getAmazonAccountStatusLabel = (status: AmazonAccountStatus, t: TFunction): string => {
  switch (status) {
    case AmazonAccountStatus.ACTIVE:
      return t('amazon:amazon.accounts.statusActive');
    case AmazonAccountStatus.VERIFYING:
      return t('amazon:amazon.accounts.statusVerifying');
    case AmazonAccountStatus.INVALID:
      return t('amazon:amazon.accounts.statusInvalid');
    case AmazonAccountStatus.NEEDS_REAUTH:
      return t('amazon:amazon.accounts.statusNeedsReauth');
    case AmazonAccountStatus.LOCKED:
      return t('amazon:amazon.accounts.statusLocked');
    default:
      return String(status);
  }
};
