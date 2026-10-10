import { Drawer, EmptyState } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AmazonAccountsAllDrawer.style';
import type { AmazonAccountsAllDrawerComponentProps } from './AmazonAccountsAllDrawer.types';

import { AmazonAccountCard } from '@/features/settings/components/AmazonAccountCard';

export const AmazonAccountsAllDrawerComponent: React.FC<AmazonAccountsAllDrawerComponentProps> = ({
  isOpen,
  onClose,
  onBack,
  accounts,
  onEdit,
}) => {
  const { t } = useTranslation(['translation']);

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      onBack={onBack}
      backAriaLabel={t('translation:common.back')}
      title={t('translation:settingsHub.drawer.amazonAccountsAll.title')}
      subtitle={t('translation:settingsHub.drawer.amazonAccountsAll.subtitle')}
      size="md"
    >
      {accounts.length > 0 ? (
        <S.AccountList>
          {accounts.map((account) => (
            <AmazonAccountCard key={account.id} account={account} onClick={() => onEdit(account.id)} />
          ))}
        </S.AccountList>
      ) : (
        <S.FormCard>
          <EmptyState
            icon="shopping-bag"
            title={t('translation:settingsHub.drawer.amazonAccounts.empty.title')}
            description={t('translation:settingsHub.drawer.amazonAccounts.empty.description')}
          />
        </S.FormCard>
      )}
    </Drawer>
  );
};

AmazonAccountsAllDrawerComponent.displayName = 'AmazonAccountsAllDrawerComponent';
