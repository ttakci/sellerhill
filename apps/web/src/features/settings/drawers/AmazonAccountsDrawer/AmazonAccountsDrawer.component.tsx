import { Card, Drawer, Icon, StatusBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AmazonAccountsDrawer.style';
import type { AmazonAccountsDrawerComponentProps } from './AmazonAccountsDrawer.types';

export const AmazonAccountsDrawerComponent: React.FC<AmazonAccountsDrawerComponentProps> = ({
  isOpen,
  onClose,
  accounts,
  onAdd,
}) => {
  const { t } = useTranslation();

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={t('translation:settingsHub.sections.amazon.manage.title')}
      subtitle={t('translation:settingsHub.sections.amazon.subtitle')}
      size="md"
      primaryAction={{
        label: t('translation:settingsHub.sections.amazon.add'),
        onClick: onAdd,
      }}
    >
      {accounts.length > 0 ? (
        <S.AccountList>
          {accounts.map((a) => (
            <Card key={a.id} variant="elevated" padding="none">
              <S.AccountMain>
                <S.AccountHead>
                  <S.AccountIdentity>
                    <Icon name="mail" size={20} color="brand.primary" />
                    <S.AccountIdText>
                      {a.displayName !== a.email && (
                        <Text variant="caption" color="text.tertiary">{a.email}</Text>
                      )}
                      <Text variant="body" weight="semibold">{a.displayName}</Text>
                    </S.AccountIdText>
                  </S.AccountIdentity>
                  <StatusBadge status={a.status} size="sm" />
                </S.AccountHead>

                <S.AccountMetaList>
                  <S.AccountMetaLine>
                    <Icon name="calendar" size={14} color="text.tertiary" />
                    <Text variant="caption" color="text.secondary">
                      {t('translation:settingsHub.sections.amazon.connectedSince')}: {a.connectedSince}
                    </Text>
                  </S.AccountMetaLine>
                </S.AccountMetaList>
              </S.AccountMain>
            </Card>
          ))}
        </S.AccountList>
      ) : (
        <S.EmptyState>
          <S.EmptyIconCircle>
            <Icon name="amazon" size={28} />
          </S.EmptyIconCircle>
          <Text variant="body" color="text.secondary">
            {t('translation:settingsHub.sections.amazon.noAccounts')}
          </Text>
        </S.EmptyState>
      )}
    </Drawer>
  );
};

AmazonAccountsDrawerComponent.displayName = 'AmazonAccountsDrawerComponent';
