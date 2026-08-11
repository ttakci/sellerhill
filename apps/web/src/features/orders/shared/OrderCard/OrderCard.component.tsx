import { Badge, Icon, IdBadge, StatusBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { orderStatusToBadgeStatus } from '../order-status';

import * as S from './OrderCard.style';
import type { OrderCardProps } from './OrderCard.types';

export const OrderCard: React.FC<OrderCardProps> = ({
  productTitle,
  imageUrl,
  ebayOrderId,
  status,
  statusLabel,
  statsBadge,
  meta,
  stats,
  onClick,
  className,
  hoverEffect = true,
}) => {
  const { t } = useTranslation(['translation']);

  return (
    <S.Wrapper
      type="button"
      onClick={onClick}
      className={className}
      aria-label={ebayOrderId}
      $hoverEffect={hoverEffect}
    >
      <S.Image>
        {imageUrl ? (
          <img src={imageUrl} alt={productTitle} />
        ) : (
          <Icon name="image" size={28} />
        )}
      </S.Image>

      <S.Content>
        <S.HeaderBlock>
          <S.TitleRow>
            <S.Title variant="body" weight="semibold" color="text.primary">
              {productTitle}
            </S.Title>
            <StatusBadge status={orderStatusToBadgeStatus(status)} size="sm">
              {statusLabel}
            </StatusBadge>
          </S.TitleRow>

          {meta.length > 0 && (
            <S.MetaList>
              {meta.map((item) => (
                <S.MetaRow key={`${item.label}-${item.value}`}>
                  <S.MetaLabel variant="caption" weight="medium" color="text.secondary">
                    {item.label}
                  </S.MetaLabel>
                  <S.MetaValue>
                    {item.storeType ? (
                      <IdBadge id={item.value} storeType={item.storeType} size="sm" />
                    ) : (
                      <S.MetaValueText variant="caption" weight="semibold" color="text.primary">
                        {item.value}
                      </S.MetaValueText>
                    )}
                  </S.MetaValue>
                </S.MetaRow>
              ))}
            </S.MetaList>
          )}
        </S.HeaderBlock>

        <S.StatsGrid>
          {statsBadge && (
            <S.StatsBadge>
              <Badge variant={statsBadge.variant ?? 'warning'} size="xs">
                {statsBadge.label}
              </Badge>
            </S.StatsBadge>
          )}
          {stats.map((stat) => (
            <S.StatCell key={stat.label}>
              <S.StatLabel variant="caption" color="text.tertiary">
                {stat.label}
              </S.StatLabel>
              <S.StatValue variant="body-sm" weight="semibold" numeric $tone={stat.tone ?? 'default'}>
                {stat.value}
              </S.StatValue>
            </S.StatCell>
          ))}
        </S.StatsGrid>

        <S.Footer>
          <S.DetailAction>
            <Text variant="body-sm" weight="semibold" color="brand.primary">
              {t('translation:common.details')}
            </Text>
            <Icon name="arrow-right" size={14} color="brand.primary" />
          </S.DetailAction>
        </S.Footer>
      </S.Content>
    </S.Wrapper>
  );
};

OrderCard.displayName = 'OrderCard';
