import React from 'react';

import { Badge } from '../../atoms/Badge';
import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';
import { IdBadge } from '../../molecules/IdBadge';

import * as S from './ListingCard.style';
import type { ListingCardProps } from './ListingCard.types';

export const ListingCard = ({
  title,
  imageUrl,
  brand,
  primaryBadge,
  secondaryBadge,
  stats,
  status,
  soldCount,
  watchCount,
  orientation,
  onClick,
  className,
}: ListingCardProps): React.ReactElement => {
  const hasExtras = (soldCount ?? 0) > 0 || (watchCount ?? 0) > 0;
  const statusVariant = status.tone === 'active' ? 'success' : 'neutral';

  return (
    <S.Wrapper $orientation={orientation} onClick={onClick} className={className}>
      <S.Image $orientation={orientation}>
        {imageUrl ? <img src={imageUrl} alt={title} /> : <Icon name="image" size={orientation === 'horizontal' ? 32 : 48} />}
      </S.Image>
      <S.Content $orientation={orientation}>
        <S.Title variant="body-sm" weight="semibold">
          {title}
        </S.Title>
        {brand && (
          <S.Brand variant="caption" color="text.tertiary">
            {brand}
          </S.Brand>
        )}
        {(primaryBadge || secondaryBadge) && (
          <S.BadgeRow>
            {primaryBadge && <IdBadge id={primaryBadge.id} storeType={primaryBadge.storeType} size={primaryBadge.size ?? 'sm'} />}
            {secondaryBadge && (
              <IdBadge id={secondaryBadge.id} storeType={secondaryBadge.storeType} size={secondaryBadge.size ?? 'sm'} />
            )}
          </S.BadgeRow>
        )}
        {hasExtras && (
          <S.ExtraFields>
            {(soldCount ?? 0) > 0 && (
              <S.ExtraItem>
                <Icon name="shopping-cart" size={12} />
                <Text variant="caption">{soldCount}</Text>
              </S.ExtraItem>
            )}
            {(watchCount ?? 0) > 0 && (
              <S.ExtraItem>
                <Icon name="eye" size={12} />
                <Text variant="caption">{watchCount}</Text>
              </S.ExtraItem>
            )}
          </S.ExtraFields>
        )}
        <S.StatsGrid>
          {stats.map((stat) => (
            <S.StatCell key={stat.label}>
              <S.StatLabel variant="caption" weight="semibold" color="text.tertiary">
                {stat.label}
              </S.StatLabel>
              <S.StatValue variant="body-sm" weight="bold" $tone={stat.tone ?? 'default'}>
                {stat.value}
              </S.StatValue>
            </S.StatCell>
          ))}
        </S.StatsGrid>
        <S.Footer>
          <Badge variant={statusVariant} size="sm">
            {status.label}
          </Badge>
        </S.Footer>
      </S.Content>
    </S.Wrapper>
  );
};

ListingCard.displayName = 'ListingCard';
