import { Drawer, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './EbayAccountsAllDrawer.style';
import type { EbayAccountsAllDrawerComponentProps } from './EbayAccountsAllDrawer.types';

import { EbayAccountCard } from '@/features/settings/components/EbayAccountCard';

export const EbayAccountsAllDrawerComponent: React.FC<EbayAccountsAllDrawerComponentProps> = ({
  isOpen,
  onClose,
  onBack,
  stores,
}) => {
  const { t } = useTranslation(['translation']);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backAriaLabel={t('translation:common.back')}
      title={t('translation:settingsHub.drawer.ebayAccountsAll.title')}
      subtitle={t('translation:settingsHub.drawer.ebayAccountsAll.subtitle')}
      size="md"
    >
      {stores.length > 0 ? (
        <S.StoreList>
          {stores.map((store) => (
            <EbayAccountCard key={store.id} store={store} />
          ))}
        </S.StoreList>
      ) : (
        <S.EmptyState>
          <S.EmptyIconCircle>
            <Text variant="body" weight="semibold">eBay</Text>
          </S.EmptyIconCircle>
          <Text variant="body" color="text.secondary">
            {t('translation:settingsHub.sections.ebay.manageStores.empty')}
          </Text>
        </S.EmptyState>
      )}
    </Drawer>
  );
};

EbayAccountsAllDrawerComponent.displayName = 'EbayAccountsAllDrawerComponent';
