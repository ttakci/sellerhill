import { Badge, Icon, IdBadge, Text, Tooltip } from '@repo/ui';
import React from 'react';

import { OrderStageBadge } from '../OrderStageBadge';

import * as S from './OrderCard.style';
import type { OrderCardProps } from './OrderCard.types';

export const OrderCard: React.FC<OrderCardProps> = ({
  productTitle,
  imageUrl,
  ebayOrderId,
  stage,
  shippedDetectedAt,
  statsBadges,
  meta,
  stats,
  detailLabel,
  onClick,
  className,
  hoverEffect = true,
}) => (
  <S.Wrapper type="button" onClick={onClick} className={className} aria-label={ebayOrderId} $hoverEffect={hoverEffect}>
    <S.Top>
      <S.TitleRow>
        <S.TitleSlot>
          <Tooltip content={productTitle} position="top" variant="dark">
            <S.Title variant="body" weight="semibold" color="text.primary">
              {productTitle}
            </S.Title>
          </Tooltip>
        </S.TitleSlot>
        {/* The stage and whatever qualifies it (estimated profit, blocked
            reason, not linked) sit together opposite the title: one glance
            says where the order stands and why. */}
        <S.BadgeRow>
          <OrderStageBadge stage={stage} shippedDetectedAt={shippedDetectedAt} size="sm" />
          {statsBadges?.map((badge) => (
            <Badge key={badge.label} variant={badge.variant ?? 'warning'} size="sm">
              {badge.label}
            </Badge>
          ))}
        </S.BadgeRow>
      </S.TitleRow>

      <S.Body>
        <S.Image>{imageUrl ? <img src={imageUrl} alt={productTitle} /> : <Icon name="image" size={28} />}</S.Image>

        <S.Content>
          {meta.length > 0 && (
            <S.MetaList>
              {meta.map((item) => (
                <React.Fragment key={`${item.label}-${item.value}`}>
                  <S.MetaLabel>
                    <Text variant="body-sm" color="text.secondary">
                      {item.label}
                    </Text>
                  </S.MetaLabel>
                  <S.MetaValue>
                    {item.storeType ? (
                      <IdBadge id={item.value} storeType={item.storeType} size="sm" plain />
                    ) : (
                      <Text variant="body-sm" color="text.primary" numeric>
                        {item.value}
                      </Text>
                    )}
                  </S.MetaValue>
                </React.Fragment>
              ))}
            </S.MetaList>
          )}
        </S.Content>
      </S.Body>
    </S.Top>

    <S.MoneyRow>
      {stats.map((stat) => (
        <S.StatCell key={stat.label}>
          <Text variant="caption" color="text.secondary">
            {stat.label}
          </Text>
          <S.StatValue variant="body" weight="semibold" numeric $tone={stat.tone ?? 'default'}>
            {stat.value}
          </S.StatValue>
        </S.StatCell>
      ))}
      {detailLabel && onClick ? (
        <S.DetailHint>
          <Text variant="caption" weight="semibold" color="brand.primary">
            {detailLabel}
          </Text>
          <Icon name="chevron-right" size={16} color="brand.primary" />
        </S.DetailHint>
      ) : null}
    </S.MoneyRow>
  </S.Wrapper>
);

OrderCard.displayName = 'OrderCard';
