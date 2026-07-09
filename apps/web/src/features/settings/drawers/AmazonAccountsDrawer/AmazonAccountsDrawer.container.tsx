import type { AmazonAccountPublicDto } from '@repo/shared';
import { formatDate, getLocaleConfig } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AmazonAccountsDrawerComponent } from './AmazonAccountsDrawer.component';
import type {
  AmazonAccountCardView,
  AmazonAccountsDrawerProps,
} from './AmazonAccountsDrawer.types';

export const AmazonAccountsDrawer: React.FC<AmazonAccountsDrawerProps> = ({
  isOpen,
  onClose,
  accounts,
  onAdd,
}) => {
  const { i18n } = useTranslation();
  const { locale } = getLocaleConfig(i18n.language);

  const cards: AmazonAccountCardView[] = accounts.map((a: AmazonAccountPublicDto) => ({
    id: a.id,
    displayName: a.label || a.email,
    email: a.email,
    connectedSince: formatDate(a.createdAt, locale, { year: 'numeric' }),
    status: a.status,
  }));

  return (
    <AmazonAccountsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      accounts={cards}
      onAdd={onAdd}
    />
  );
};

AmazonAccountsDrawer.displayName = 'AmazonAccountsDrawer';
