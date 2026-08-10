import { Icon, StatusBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './EbayAccountCard.style';
import type { EbayAccountCardProps } from './EbayAccountCard.types';

/**
 * Read-only eBay store card — eBay accounts are OAuth-connected, so there is
 * nothing to edit here (unlike Amazon's credential-based accounts). Every
 * field the seller might want is already on the card.
 */
export const EbayAccountCard: React.FC<EbayAccountCardProps> = ({ store }) => {
  const { t } = useTranslation(['translation']);

  return (
    <S.CardRoot variant="bordered" padding="none">
      <S.StoreMain>
        <S.StoreHead>
          <S.StoreIdText>
            <Text variant="caption" color="text.tertiary">
              {t('translation:settingsHub.sections.ebay.sellerId')}: {store.sellerId}
            </Text>
            <Text variant="body" weight="semibold">{store.displayName}</Text>
          </S.StoreIdText>
          <StatusBadge status={store.status} size="sm" />
        </S.StoreHead>

        <S.StoreMetaList>
          <S.StoreMetaLine>
            <Icon name="globe" size={14} color="text.tertiary" />
            <Text variant="caption" color="text.secondary">
              {store.marketplaceLabel} · {store.currency}
            </Text>
          </S.StoreMetaLine>
          <S.StoreMetaLine>
            <Icon name="calendar" size={14} color="text.tertiary" />
            <Text variant="caption" color="text.secondary">
              {t('translation:settingsHub.sections.ebay.connectedSince')}: {store.connectedSince}
            </Text>
          </S.StoreMetaLine>
        </S.StoreMetaList>
      </S.StoreMain>
    </S.CardRoot>
  );
};

EbayAccountCard.displayName = 'EbayAccountCard';
