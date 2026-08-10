import { Drawer, QuickActionCard } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack } from './EbayAccountsDrawer.style';
import type { EbayAccountsDrawerComponentProps } from './EbayAccountsDrawer.types';

import { AccountCarousel } from '@/features/settings/components/AccountCarousel';
import { EbayAccountCard } from '@/features/settings/components/EbayAccountCard';

export const EbayAccountsDrawerComponent: React.FC<EbayAccountsDrawerComponentProps> = ({
  isOpen,
  onClose,
  stores,
  onConnectNew,
  onViewAll,
}) => {
  const { t } = useTranslation(['translation']);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.ebayAccounts.title')}
      subtitle={t('translation:settingsHub.drawer.ebayAccounts.subtitle')}
      size="md"
    >
      <BodyStack>
        <AccountCarousel
          items={stores}
          keyExtractor={(store) => store.id}
          renderCard={(store) => <EbayAccountCard store={store} />}
          onViewAll={onViewAll}
          viewAllLabel={t('translation:settingsHub.drawer.ebayAccounts.viewAll.title')}
        />
        <QuickActionCard
          variant="brand"
          title={t('translation:settingsHub.drawer.ebayAccounts.addNew.title')}
          subtitle={t('translation:settingsHub.drawer.ebayAccounts.addNew.subtitle')}
          onClick={onConnectNew}
        />
      </BodyStack>
    </Drawer>
  );
};

EbayAccountsDrawerComponent.displayName = 'EbayAccountsDrawerComponent';
