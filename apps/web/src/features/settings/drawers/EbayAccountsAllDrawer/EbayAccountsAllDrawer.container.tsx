import type { EbayAccountPublicDto } from '@repo/shared';
import { getLocaleConfig } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EbayAccountsAllDrawerComponent } from './EbayAccountsAllDrawer.component';
import type { EbayAccountsAllDrawerProps } from './EbayAccountsAllDrawer.types';

import { toEbayStoreCardView } from '@/features/settings/components/EbayAccountCard';

export const EbayAccountsAllDrawer: React.FC<EbayAccountsAllDrawerProps> = ({
  isOpen,
  onClose,
  onBack,
  accounts,
}) => {
  const { t, i18n } = useTranslation(['ebay', 'translation']);
  const { locale } = getLocaleConfig(i18n.language);

  const stores = accounts.map((a: EbayAccountPublicDto) => toEbayStoreCardView(a, locale, t));

  return (
    <EbayAccountsAllDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      stores={stores}
    />
  );
};

EbayAccountsAllDrawer.displayName = 'EbayAccountsAllDrawer';
