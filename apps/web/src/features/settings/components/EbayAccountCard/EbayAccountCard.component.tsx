import { Button, Icon, StatusBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './EbayAccountCard.style';
import type { EbayAccountCardProps } from './EbayAccountCard.types';

/**
 * eBay store card — OAuth-connected, so there is nothing to EDIT here (unlike
 * Amazon's credential-based accounts). The one action it carries is
 * disconnect, and only where a handler is supplied.
 */
export const EbayAccountCard: React.FC<EbayAccountCardProps> = ({ store, onDisconnect, isDisconnecting }) => {
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

        {onDisconnect && (
          <S.StoreActions>
            <Button
              variant="danger-tint"
              size="small"
              onClick={() => onDisconnect(store.id)}
              isLoading={isDisconnecting}
            >
              <Text variant="body-sm" weight="semibold">
                {t('translation:settingsHub.sections.ebay.disconnect.action')}
              </Text>
            </Button>
          </S.StoreActions>
        )}
      </S.StoreMain>
    </S.CardRoot>
  );
};

EbayAccountCard.displayName = 'EbayAccountCard';
