import { TemplateType } from '@repo/shared';
import { Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CARD_ACTION_ICON_SIZE } from '../cardMetrics';

import * as S from './ListingGroupCard.style';
import type { ListingGroupCardProps } from './ListingGroupCard.types';

/**
 * Compact, info-dense summary card for a Listing Settings Group.
 * Shown in compact grids (e.g. the Settings hub). Clicking navigates to the
 * group's edit page. Full detail/delete lives on the dedicated list page.
 */
export const ListingGroupCard: React.FC<ListingGroupCardProps> = ({ group, onClick, templateName, selected }) => {
  const { t } = useTranslation(['listingSettingsGroup', 'translation']);

  const handleActivate = (): void => onClick(group.id);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  const isPredefined = group.templates.type === TemplateType.PREDEFINED;
  // Show the predefined template's actual name; fall back to the type label
  // for custom templates or while the predefined list is still loading.
  const templateLabel = templateName
    ?? (isPredefined
      ? t('listingSettingsGroup.predefined')
      : t('listingSettingsGroup.card.customTemplate'));

  return (
    <S.InteractiveCard
      variant="elevated"
      $selected={selected}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={t('listingSettingsGroup.tooltips.editGroup')}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      <S.CardBody>
        <S.TitleRow>
          <S.CardName variant="h5" weight="semibold" className="card-title" truncate>
            {group.name}
          </S.CardName>
          <S.ActiveBadge variant={isPredefined ? 'info' : 'neutral'} size="md">
            {templateLabel}
          </S.ActiveBadge>
        </S.TitleRow>
        {group.description && (
          <Text variant="caption" color="text.secondary" truncate>
            {group.description}
          </Text>
        )}

        <S.StatColumns>
          <S.StatColumn>
            <S.StatColumnTitle variant="overline" color="text.tertiary">
              {t('listingSettingsGroup.card.generalTitle')}
            </S.StatColumnTitle>
            <S.StatItem>
              <Icon name="inventory" size={16} color="text.tertiary" />
              <Text variant="caption" color="text.secondary">
                {t('listingSettingsGroup.card.stock')}: {group.stock.defaultQuantity}
              </Text>
            </S.StatItem>
            <S.StatItem>
              <Icon name="shield-check" size={16} color="text.tertiary" />
              <Text variant="caption" color="text.secondary">
                {t('listingSettingsGroup.card.buffer')}: {group.stock.stockBuffer ?? 0}
              </Text>
            </S.StatItem>
          </S.StatColumn>

          <S.StatColumn>
            <S.StatColumnTitle variant="overline" color="text.tertiary">
              {t('listingSettingsGroup.card.deductionsTitle')}
            </S.StatColumnTitle>
            <S.StatItem>
              <Icon name="percent" size={16} color="text.tertiary" />
              <Text variant="caption" color="text.secondary">
                {t('listingSettingsGroup.card.fee')}: {group.fees.ebayFeePercent}%
              </Text>
            </S.StatItem>
            <S.StatItem>
              <Icon name="receipt" size={16} color="text.tertiary" />
              <Text variant="caption" color="text.secondary">
                {t('listingSettingsGroup.card.fixedFee')}: ${group.fees.fixedFeeAmount}
              </Text>
            </S.StatItem>
          </S.StatColumn>
        </S.StatColumns>

        <S.BottomRow>
          <S.DetailAction>
            <Text variant="body-sm" weight="semibold" color="brand.primary">
              {t('translation:common.details')}
            </Text>
            <S.ArrowSlot>
              <Icon name="arrow-right" size={CARD_ACTION_ICON_SIZE} color="brand.primary" />
            </S.ArrowSlot>
          </S.DetailAction>
        </S.BottomRow>
      </S.CardBody>
    </S.InteractiveCard>
  );
};

ListingGroupCard.displayName = 'ListingGroupCard';
