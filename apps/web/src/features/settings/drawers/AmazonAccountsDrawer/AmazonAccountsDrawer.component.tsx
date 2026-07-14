import { Drawer, Icon, StatusBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AmazonAccountsDrawer.style';
import type { AmazonAccountsDrawerComponentProps } from './AmazonAccountsDrawer.types';

export const AmazonAccountsDrawerComponent: React.FC<AmazonAccountsDrawerComponentProps> = ({
  isOpen,
  onClose,
  accounts,
  selectedId,
  isContinueDisabled,
  onSelect,
  onContinue,
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
        label: t('translation:common.continue'),
        onClick: onContinue,
        disabled: isContinueDisabled,
      }}
    >
      {accounts.length > 0 ? (
        <S.AccountList>
          {accounts.map((a) => (
            <S.SelectableCard
              key={a.id}
              variant="bordered"
              padding="none"
              $selected={a.id === selectedId}
              role="button"
              tabIndex={0}
              aria-pressed={a.id === selectedId}
              aria-label={t('translation:settingsHub.sections.amazon.manage.title')}
              onClick={() => onSelect(a.id)}
              onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(a.id);
                }
              }}
            >
              <S.AccountMain>
                <S.AccountHead>
                  <S.AccountIdentity>
                    <Icon name="amazon" size={20} color="brand.primary" />
                    <S.AccountIdText>
                      <Text variant="body" weight="semibold">{a.displayName}</Text>
                    </S.AccountIdText>
                  </S.AccountIdentity>
                  <StatusBadge status={a.status} size="sm" />
                </S.AccountHead>

                <S.AccountMetaList>
                  <S.AccountMetaLine>
                    <Icon name="mail" size={14} color="text.tertiary" />
                    <Text variant="caption" color="text.secondary">
                      {a.email}
                    </Text>
                  </S.AccountMetaLine>
                  <S.AccountMetaLine>
                    <Icon name="calendar" size={14} color="text.tertiary" />
                    <Text variant="caption" color="text.secondary">
                      {t('translation:settingsHub.sections.amazon.connectedSince')}: {a.connectedSince}
                    </Text>
                  </S.AccountMetaLine>
                </S.AccountMetaList>
              </S.AccountMain>
            </S.SelectableCard>
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
