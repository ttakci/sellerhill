import { EbayAccountStatus } from '@repo/shared';
import { Button, Drawer, Icon, StatusBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './EbayAccountDrawer.style';
import type { EbayAccountDrawerProps } from './EbayAccountDrawer.types';

export const EbayAccountDrawer: React.FC<EbayAccountDrawerProps> = ({
  isOpen,
  onClose,
  accounts,
  onConnect,
}) => {
  const { t } = useTranslation();
  const connected = accounts.find((a) => a.status === EbayAccountStatus.ACTIVE);

  const handleConnect = (): void => {
    onClose();
    onConnect();
  };

  const footer = (
    <S.FooterRow>
      <Button variant="secondary" onClick={onClose}>
        <Text>{t('translation:common.close')}</Text>
      </Button>
      {connected && (
        <Button variant="primary" onClick={handleConnect}>
          <Text>{t('translation:settingsHub.sections.ebay.connect')}</Text>
        </Button>
      )}
    </S.FooterRow>
  );

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.sections.ebay.title')}
      subtitle={t('translation:settingsHub.sections.ebay.subtitle')}
      size="md"
      footer={footer}
    >
      {connected ? (
        <S.BodyStack>
          <S.MetaGrid>
            <S.MetaItem>
              <Text variant="caption" color="text.tertiary">
                {t('translation:settingsHub.sections.ebay.sellerId')}
              </Text>
              <Text variant="body-sm" weight="medium">
                {connected.sellerId}
              </Text>
            </S.MetaItem>
            <S.MetaItem>
              <Text variant="caption" color="text.tertiary">
                {t('translation:settingsHub.sections.ebay.marketplace')}
              </Text>
              <Text variant="body-sm" weight="medium">
                {connected.marketplaceId}
              </Text>
            </S.MetaItem>
            <S.MetaItem>
              <Text variant="caption" color="text.tertiary">
                {t('translation:settingsHub.sections.ebay.status')}
              </Text>
              <StatusBadge status={connected.status} size="sm" />
            </S.MetaItem>
          </S.MetaGrid>
        </S.BodyStack>
      ) : (
        <S.EmptyState>
          <S.EmptyIconCircle>
            <Icon name="storefront" size={28} />
          </S.EmptyIconCircle>
          <Text variant="body" color="text.secondary">
            {t('translation:settingsHub.sections.ebay.notConnected')}
          </Text>
          <Button variant="primary" onClick={handleConnect}>
            <Text>{t('translation:settingsHub.sections.ebay.connect')}</Text>
          </Button>
        </S.EmptyState>
      )}
    </Drawer>
  );
};
