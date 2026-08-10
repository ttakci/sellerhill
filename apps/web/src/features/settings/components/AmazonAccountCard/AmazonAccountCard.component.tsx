import { AmazonAccountStatus } from '@repo/shared';
import { Icon, StatusBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AmazonAccountCard.style';
import type { AmazonAccountCardProps } from './AmazonAccountCard.types';

export const AmazonAccountCard: React.FC<AmazonAccountCardProps> = ({ account, onClick }) => {
  const { t } = useTranslation(['translation']);

  return (
    <S.ClickableCard
      variant="bordered"
      padding="none"
      hoverable={!!onClick}
      $clickable={!!onClick}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <S.AccountMain>
        <S.AccountHead>
          <Text variant="body" weight="semibold">{account.displayName}</Text>
          <StatusBadge status={account.status} size="sm" />
        </S.AccountHead>

        <S.AccountMetaList>
          <S.AccountMetaLine>
            <Icon name="mail" size={14} color="text.tertiary" />
            <Text variant="caption" color="text.secondary">
              {account.email}
            </Text>
          </S.AccountMetaLine>
          <S.BottomRow>
            <S.AccountMetaLine>
              <Icon name="calendar" size={14} color="text.tertiary" />
              <Text variant="caption" color="text.secondary">
                {t('translation:settingsHub.sections.amazon.connectedSince')}: {account.connectedSince}
              </Text>
            </S.AccountMetaLine>
            {onClick && <Icon name="arrow-right" size={16} color="brand.primary" />}
          </S.BottomRow>
          {account.status === AmazonAccountStatus.INVALID && account.lastVerificationError && (
            <S.AccountMetaLine>
              <Icon name="alert-triangle" size={14} color="semantic.error" />
              <Text variant="caption" color="semantic.error">
                {account.lastVerificationError}
              </Text>
            </S.AccountMetaLine>
          )}
        </S.AccountMetaList>
      </S.AccountMain>
    </S.ClickableCard>
  );
};

AmazonAccountCard.displayName = 'AmazonAccountCard';
