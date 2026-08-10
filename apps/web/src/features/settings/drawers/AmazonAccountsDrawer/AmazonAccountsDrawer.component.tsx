import { Drawer, QuickActionCard } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { BodyStack } from './AmazonAccountsDrawer.style';
import type { AmazonAccountsDrawerComponentProps } from './AmazonAccountsDrawer.types';

import { AccountCarousel } from '@/features/settings/components/AccountCarousel';
import { AmazonAccountCard } from '@/features/settings/components/AmazonAccountCard';

export const AmazonAccountsDrawerComponent: React.FC<AmazonAccountsDrawerComponentProps> = ({
  isOpen,
  onClose,
  accounts,
  onAddNew,
  onViewAll,
  onEdit,
}) => {
  const { t } = useTranslation(['translation']);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.drawer.amazonAccounts.title')}
      subtitle={t('translation:settingsHub.drawer.amazonAccounts.subtitle')}
      size="md"
    >
      <BodyStack>
        <AccountCarousel
          items={accounts}
          keyExtractor={(account) => account.id}
          renderCard={(account) => <AmazonAccountCard account={account} onClick={() => onEdit(account.id)} />}
          onViewAll={onViewAll}
          viewAllLabel={t('translation:settingsHub.drawer.amazonAccounts.viewAll.title')}
        />
        <QuickActionCard
          variant="brand"
          title={t('translation:settingsHub.drawer.amazonAccounts.addNew.title')}
          subtitle={t('translation:settingsHub.drawer.amazonAccounts.addNew.subtitle')}
          onClick={onAddNew}
        />
      </BodyStack>
    </Drawer>
  );
};

AmazonAccountsDrawerComponent.displayName = 'AmazonAccountsDrawerComponent';
