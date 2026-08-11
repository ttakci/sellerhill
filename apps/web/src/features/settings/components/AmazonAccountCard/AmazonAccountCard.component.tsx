import { AmazonAccountStatus } from '@repo/shared';
import { formatCurrency, Icon, StatusBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CARD_ACTION_ICON_SIZE } from '../cardMetrics';

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
          <S.AccountMetaLine>
            <Icon name={account.hasTwoFactor ? 'shield-check' : 'shield'} size={14} color="text.tertiary" />
            <Text variant="caption" color="text.secondary">
              {t(
                account.hasTwoFactor
                  ? 'translation:settingsHub.sections.amazon.twoFactorOn'
                  : 'translation:settingsHub.sections.amazon.twoFactorOff',
              )}
            </Text>
          </S.AccountMetaLine>
          <S.AccountMetaLine>
            <Icon name="zap" size={14} color="text.tertiary" />
            <Text variant="caption" color="text.secondary">
              {account.autoFulfillEnabled && account.autoFulfillCapTotal !== null
                ? t('translation:settingsHub.sections.amazon.autoFulfillOn', {
                    cap: formatCurrency(account.autoFulfillCapTotal),
                  })
                : t('translation:settingsHub.sections.amazon.autoFulfillOff')}
            </Text>
          </S.AccountMetaLine>
          <S.BottomRow>
            <S.AccountMetaLine>
              <Icon name="calendar" size={14} color="text.tertiary" />
              <Text variant="caption" color="text.secondary">
                {t('translation:settingsHub.sections.amazon.connectedSince')}: {account.connectedSince}
              </Text>
            </S.AccountMetaLine>
            {onClick && (
              <S.DetailAction>
                <Text variant="body-sm" weight="semibold" color="brand.primary">
                  {t('translation:common.details')}
                </Text>
                <S.ArrowSlot>
                  <Icon name="arrow-right" size={CARD_ACTION_ICON_SIZE} color="brand.primary" />
                </S.ArrowSlot>
              </S.DetailAction>
            )}
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
