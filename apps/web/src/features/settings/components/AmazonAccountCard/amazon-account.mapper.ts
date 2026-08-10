import type { AmazonAccountPublicDto } from '@repo/shared';
import { formatDate } from '@repo/ui';

import type { AmazonAccountCardView } from './AmazonAccountCard.types';

export const toAmazonAccountCardView = (account: AmazonAccountPublicDto, locale: string): AmazonAccountCardView => ({
  id: account.id,
  displayName: account.label || account.email,
  email: account.email,
  connectedSince: formatDate(account.createdAt, locale, { year: 'numeric' }),
  status: account.status,
  lastVerificationError: account.lastVerificationError ?? undefined,
});
