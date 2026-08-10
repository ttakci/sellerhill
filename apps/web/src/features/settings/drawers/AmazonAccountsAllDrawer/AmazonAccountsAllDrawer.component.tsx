import { Drawer, Text } from '@repo/ui';
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
        <S.EmptyState>
          <S.EmptyIconCircle>
            <Text variant="body" weight="semibold">Amazon</Text>
          </S.EmptyIconCircle>
          <Text variant="body" color="text.secondary">
            {t('translation:settingsHub.sections.amazon.noAccounts')}
          </Text>
        </S.EmptyState>
      )}
    </Drawer>
  );
};

AmazonAccountsAllDrawerComponent.displayName = 'AmazonAccountsAllDrawerComponent';
