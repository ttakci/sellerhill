import type { AmazonAccountPublicDto } from '@repo/shared';
import { getLocaleConfig } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AmazonAccountsAllDrawerComponent } from './AmazonAccountsAllDrawer.component';
import type { AmazonAccountsAllDrawerProps } from './AmazonAccountsAllDrawer.types';

import { toAmazonAccountCardView } from '@/features/settings/components/AmazonAccountCard';

export const AmazonAccountsAllDrawer: React.FC<AmazonAccountsAllDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  accounts,
  onEdit,
}) => {
  const { i18n } = useTranslation();
  const { locale } = getLocaleConfig(i18n.language);

  const cards = accounts.map((a: AmazonAccountPublicDto) => toAmazonAccountCardView(a, locale));

  return (
    <AmazonAccountsAllDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      accounts={cards}
      onEdit={onEdit}
    />
  );
};

AmazonAccountsAllDrawer.displayName = 'AmazonAccountsAllDrawer';
