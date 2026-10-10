import { AmazonAccountStatus } from '@repo/shared';
import { formatCurrency } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { amazonStatusBadgeVariant } from '../recordStatusBadge';
import { SettingsRecordCard } from '../SettingsRecordCard';

import type { AmazonAccountCardProps } from './AmazonAccountCard.types';

import { getAmazonAccountStatusLabel } from '@/features/amazon/utils/amazonAccountStatusLabel';

export const AmazonAccountCard: React.FC<AmazonAccountCardProps> = ({ account, onClick }) => {
  const { t } = useTranslation(['translation']);
  const k = (key: string, options?: Record<string, unknown>): string =>
    t(`translation:settingsHub.sections.amazon.${key}`, options);

  const autoFulfill =
    account.autoFulfillEnabled && account.autoFulfillCapTotal !== null
      ? k('autoFulfillCap', { cap: formatCurrency(account.autoFulfillCapTotal) })
      : k('statusOff');

  return (
    <SettingsRecordCard
      badges={[
        { label: getAmazonAccountStatusLabel(account.status, t), variant: amazonStatusBadgeVariant(account.status) },
      ]}
      title={account.displayName}
      facts={[
        { label: k('emailLabel'), value: account.email },
        {
          label: k('twoFactorLabel'),
          value: account.hasTwoFactor ? k('statusOn') : k('statusOff'),
          tone: account.hasTwoFactor ? 'default' : 'negative',
        },
        { label: k('autoFulfillLabel'), value: autoFulfill },
        { label: k('connectedSince'), value: account.connectedSince },
      ]}
      notice={
        account.status === AmazonAccountStatus.INVALID && account.verificationErrorCode
          ? k(`verificationError.${account.verificationErrorCode}`)
          : undefined
      }
      onClick={onClick}
      ariaLabel={account.displayName}
      detailLabel={t('translation:common.details')}
    />
  );
};

AmazonAccountCard.displayName = 'AmazonAccountCard';
