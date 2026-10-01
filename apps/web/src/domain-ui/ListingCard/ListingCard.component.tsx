import { Badge, Checkbox, Icon, IdBadge, Text, Tooltip } from '@repo/ui';
import React from 'react';

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
  orientation,
  onClick,
  className,
  selectable,
  selected,
  onSelectedChange,
  selectionAriaLabel,
  ...rest
}: ListingCardProps): React.ReactElement => {
  const meta = resolveMeta({ title, imageUrl, stats, status, orientation, ...rest });
  const statusVariant = status?.tone === 'active' ? 'success' : 'neutral';

  return (
    <S.Wrapper
      $orientation={orientation}
      $selected={!!selected}
      onClick={onClick}
      className={className}
      variant="elevated"
    >
      <S.Top $orientation={orientation}>
        <S.TitleRow>
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
          {/* The title is clamped to two lines, so the full text lives on the tooltip. */}
          <S.TitleSlot>
            <Tooltip content={title} position="top" variant="dark">
              <S.Title variant="body" weight="semibold" color="text.primary">
                {title}
              </S.Title>
            </Tooltip>
          </S.TitleSlot>
          {status ? (
            <S.BadgeRow>
              <Badge variant={statusVariant} size="xs">
                {status.label}
              </Badge>
            </S.BadgeRow>
          ) : null}
        </S.TitleRow>

        <S.Body $orientation={orientation}>
          <S.Image $orientation={orientation}>
            {imageUrl ? <img src={imageUrl} alt={title} /> : <Icon name="image" size={32} />}
          </S.Image>

          <S.Content>
            {meta.length > 0 && (
              <S.MetaList>
                {meta.map((item) => (
                  <React.Fragment key={`${item.label}-${item.value}`}>
                    <S.MetaLabel>
                      <Text variant="caption" color="text.secondary">
                        {item.label}
                      </Text>
                    </S.MetaLabel>
                    <S.MetaValue>
                      {item.storeType ? (
                        <IdBadge id={item.value} storeType={item.storeType} size="sm" />
                      ) : (
                        <S.MetaValueText variant="body-sm" color="text.primary">
                          {item.value}
                        </S.MetaValueText>
                      )}
                    </S.MetaValue>
                  </React.Fragment>
                ))}
              </S.MetaList>
            )}
          </S.Content>
        </S.Body>
      </S.Top>

      <S.StatsGrid>
        {stats.map((stat) => (
          <S.StatCell key={stat.label}>
            <S.StatLabel variant="caption" color="text.secondary">
              {stat.label}
            </S.StatLabel>
            <S.StatValueRow>
              {stat.icon ? <Icon name={stat.icon} size={14} color={stat.iconColor} filled /> : null}
              <S.StatValue variant="body" weight="semibold" numeric $tone={stat.tone ?? 'default'}>
                {stat.value}
              </S.StatValue>
            </S.StatValueRow>
          </S.StatCell>
        ))}
      </S.StatsGrid>
    </S.Wrapper>
  );
};

ListingCard.displayName = 'ListingCard';
