import type { EbayAccountPublicDto } from '@repo/shared';
import { getLocaleConfig } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EbayAccountsDrawerComponent } from './EbayAccountsDrawer.component';
import type { EbayAccountsDrawerProps } from './EbayAccountsDrawer.types';

import { toEbayStoreCardView } from '@/features/settings/components/EbayAccountCard';

export const EbayAccountsDrawer: React.FC<EbayAccountsDrawerProps> = ({
  isOpen,
  onClose,
  accounts,
  onConnectNew,
  onViewAll,
  marketplaceOptions,
  selectedMarketplace,
  onMarketplaceChange,
}) => {
  const { t, i18n } = useTranslation(['ebay', 'translation']);
  const { locale } = getLocaleConfig(i18n.language);

  const stores = accounts.map((a: EbayAccountPublicDto) => toEbayStoreCardView(a, locale, t));

  return (
    <EbayAccountsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      stores={stores}
      onConnectNew={onConnectNew}
      onViewAll={onViewAll}
      marketplaceOptions={marketplaceOptions}
      selectedMarketplace={selectedMarketplace}
      onMarketplaceChange={onMarketplaceChange}
    />
  );
};

EbayAccountsDrawer.displayName = 'EbayAccountsDrawer';
