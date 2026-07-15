import { EBAY_MARKETPLACE_CONFIG, type EbayAccountPublicDto, type EbayMarketplaceId } from '@repo/shared';
import { formatDate, getLocaleConfig } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EbayAccountDrawerComponent } from './EbayAccountDrawer.component';
import type {
  EbayAccountDrawerProps,
  EbayStoreCardView,
} from './EbayAccountDrawer.types';

/** "EBAY_US" -> "eBay US", "EBAY_UK" -> "eBay UK" */
const marketplaceLabel = (id: EbayMarketplaceId): string =>
  `eBay ${id.replace('EBAY_', '')}`;

export const EbayAccountDrawer: React.FC<EbayAccountDrawerProps> = ({
  isOpen,
  onClose,
  accounts,
}) => {
  const { i18n } = useTranslation();
  const { locale } = getLocaleConfig(i18n.language);

  const stores: EbayStoreCardView[] = accounts.map((a: EbayAccountPublicDto) => ({
    id: a.id,
    displayName: a.storeName || a.sellerId,
    sellerId: a.sellerId,
    marketplaceLabel: marketplaceLabel(a.marketplaceId),
    currency: EBAY_MARKETPLACE_CONFIG[a.marketplaceId]?.currency ?? '—',
    connectedSince: formatDate(a.createdAt, locale, { year: 'numeric' }),
    status: a.status,
  }));

  return (
    <EbayAccountDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      stores={stores}
    />
  );
};

EbayAccountDrawer.displayName = 'EbayAccountDrawer';
