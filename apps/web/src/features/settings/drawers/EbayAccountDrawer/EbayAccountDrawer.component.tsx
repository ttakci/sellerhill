import { Card, Drawer, Icon, StatusBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './EbayAccountDrawer.style';
import type { EbayAccountDrawerComponentProps } from './EbayAccountDrawer.types';

export const EbayAccountDrawerComponent: React.FC<EbayAccountDrawerComponentProps> = ({
  isOpen,
  onClose,
  stores,
  onConnect,
}) => {
  const { t } = useTranslation();

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.sections.ebay.manageStores.title')}
      subtitle={t('translation:settingsHub.sections.ebay.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:settingsHub.sections.ebay.connectNew.action'),
        onClick: onConnect,
      }}
    >
      {stores.length > 0 ? (
        <S.StoreList>
          {stores.map((s) => (
            <Card key={s.id} variant="elevated" padding="none">
              <S.StoreMain>
                <S.StoreHead>
                  <S.StoreIdText>
                    <Text variant="caption" color="text.tertiary">
                      {t('translation:settingsHub.sections.ebay.sellerId')}: {s.sellerId}
                    </Text>
                    <Text variant="body" weight="semibold">{s.displayName}</Text>
                  </S.StoreIdText>
                  <StatusBadge status={s.status} size="sm" />
                </S.StoreHead>

                <S.StoreMetaList>
                  <S.StoreMetaLine>
                    <Icon name="globe" size={14} color="text.tertiary" />
                    <Text variant="caption" color="text.secondary">
                      {s.marketplaceLabel} · {s.currency}
                    </Text>
                  </S.StoreMetaLine>
                  <S.StoreMetaLine>
                    <Icon name="calendar" size={14} color="text.tertiary" />
                    <Text variant="caption" color="text.secondary">
                      {t('translation:settingsHub.sections.ebay.connectedSince')}: {s.connectedSince}
                    </Text>
                  </S.StoreMetaLine>
                </S.StoreMetaList>
              </S.StoreMain>
            </Card>
          ))}
        </S.StoreList>
      ) : (
        <S.EmptyState>
          <S.EmptyIconCircle>
            <Icon name="storefront" size={28} />
          </S.EmptyIconCircle>
          <Text variant="body" color="text.secondary">
            {t('translation:settingsHub.sections.ebay.manageStores.empty')}
          </Text>
        </S.EmptyState>
      )}
    </Drawer>
  );
};

EbayAccountDrawerComponent.displayName = 'EbayAccountDrawerComponent';
