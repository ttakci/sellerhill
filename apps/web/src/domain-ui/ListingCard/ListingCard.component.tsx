import { Badge, Checkbox, Icon, IdBadge, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingCard.style';
import type { ListingCardMetaItem, ListingCardProps } from './ListingCard.types';

const resolveMeta = (props: ListingCardProps): ListingCardMetaItem[] => {
  if (props.meta && props.meta.length > 0) {
    return props.meta;
  }

  const legacy: ListingCardMetaItem[] = [];
  if (props.brand) {
    legacy.push({ label: 'Brand', value: props.brand });
  }
  if (props.primaryBadge) {
    legacy.push({
      label: props.primaryBadge.label ?? 'ASIN',
      value: props.primaryBadge.id,
      storeType: props.primaryBadge.storeType,
    });
  }
  if (props.secondaryBadge) {
    legacy.push({
      label: props.secondaryBadge.label ?? 'eBay',
      value: props.secondaryBadge.id,
      storeType: props.secondaryBadge.storeType,
    });
  }
  return legacy;
};

export const ListingCard = ({
  title,
  imageUrl,
  stats,
  status,
  soldCount,
  orientation,
  onClick,
  className,
  selectable,
  selected,
  onSelectedChange,
  selectionAriaLabel,
  ...rest
}: ListingCardProps): React.ReactElement => {
  const { t } = useTranslation(['translation']);
  const meta = resolveMeta({ title, imageUrl, stats, status, orientation, ...rest });
  const hasExtras = (soldCount ?? 0) > 0;
  const statusVariant = status?.tone === 'active' ? 'success' : 'neutral';

  return (
    <S.Wrapper
      $orientation={orientation}
      $selected={!!selected}
      onClick={onClick}
      className={className}
      variant="elevated"
    >
      {selectable && (
        <S.SelectionControl
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <Checkbox
            checked={!!selected}
            onChange={(checked) => onSelectedChange?.(checked)}
            aria-label={selectionAriaLabel}
          />
        </S.SelectionControl>
      )}

      <S.Image $orientation={orientation}>
        {imageUrl ? (
          <img src={imageUrl} alt={title} />
        ) : (
          <Icon name="image" size={orientation === 'horizontal' ? 32 : 48} />
        )}
      </S.Image>

      <S.Content $orientation={orientation}>
        <S.HeaderBlock>
          <S.Title variant="body" weight="semibold" color="text.primary">
            {title}
          </S.Title>

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
                      <S.MetaValueText variant="caption" weight="bold" color="text.primary">
                        {item.value}
                      </S.MetaValueText>
                    )}
                  </S.MetaValue>
                </S.MetaRow>
              ))}
            </S.MetaList>
          )}
        </S.HeaderBlock>

        {hasExtras && (
          <S.ExtraFields>
            {(soldCount ?? 0) > 0 && (
              <S.ExtraItem>
                <Icon name="shopping-bag" size={12} />
                <Text variant="caption" color="text.secondary">
                  {soldCount}
                </Text>
              </S.ExtraItem>
            )}
          </S.ExtraFields>
        )}

        <S.StatsGrid>
          {stats.map((stat) => (
            <S.StatCell key={stat.label}>
              <S.StatLabel variant="caption" color="text.tertiary">
                {stat.label}
              </S.StatLabel>
              <S.StatValue variant="body-sm" weight="bold" $tone={stat.tone ?? 'default'}>
                {stat.value}
              </S.StatValue>
            </S.StatCell>
          ))}
        </S.StatsGrid>

        <S.Footer>
          {status ? (
            <Badge variant={statusVariant} size="sm">
              {status.label}
            </Badge>
          ) : (
            <span />
          )}
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

ListingCard.displayName = 'ListingCard';
