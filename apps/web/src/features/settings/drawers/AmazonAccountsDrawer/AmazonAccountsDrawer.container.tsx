import type { AmazonAccountPublicDto } from '@repo/shared';
import { getLocaleConfig } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AmazonAccountsDrawerComponent } from './AmazonAccountsDrawer.component';
import type { AmazonAccountsDrawerProps } from './AmazonAccountsDrawer.types';

import { toAmazonAccountCardView } from '@/features/settings/components/AmazonAccountCard';

export const AmazonAccountsDrawer: React.FC<AmazonAccountsDrawerProps> = ({
  isOpen,
  onClose,
  accounts,
  onAddNew,
  onViewAll,
  onEdit,
}) => {
  const { i18n } = useTranslation();
  const { locale } = getLocaleConfig(i18n.language);

  const cards = accounts.map((a: AmazonAccountPublicDto) => toAmazonAccountCardView(a, locale));

  return (
    <AmazonAccountsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      accounts={cards}
      onAddNew={onAddNew}
      onViewAll={onViewAll}
      onEdit={onEdit}
    />
  );
};

AmazonAccountsDrawer.displayName = 'AmazonAccountsDrawer';
