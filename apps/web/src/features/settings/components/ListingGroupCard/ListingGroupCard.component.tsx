import { TemplateType } from '@repo/shared';
import { formatCurrency, Icon, Text, Tooltip, type IconName } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CARD_ACTION_ICON_SIZE } from '../cardMetrics';

import * as S from './ListingGroupCard.style';
import type { ListingGroupCardProps } from './ListingGroupCard.types';

import { buildMarginRangeDetails, summarizeMarginStrategy } from '@/features/listings/shared/margin-strategy';

/**
 * One fact row — the listing detail page's `Meta` row, so a group's numbers
 * read identically wherever they appear.
 */
const Fact = ({ icon, label, value }: { icon: IconName; label: string; value: string }): React.ReactElement => (
  <S.MetaRow>
    <S.MetaLabel>
      <Icon name={icon} size={16} color="brand.primary" />
      <Text variant="body-sm" color="text.secondary" truncate>
        {label}
      </Text>
    </S.MetaLabel>
    <S.MetaValue variant="body-sm" weight="semibold" numeric>
      {value}
    </S.MetaValue>
  </S.MetaRow>
);

/**
 * Compact, info-dense summary card for a Listing Settings Group.
 * Shown in compact grids (e.g. the Settings hub). Clicking navigates to the
 * group's edit page. Full detail/delete lives on the dedicated list page.
 */
export const ListingGroupCard: React.FC<ListingGroupCardProps> = ({ group, onClick, templateName, selected }) => {
  const { t } = useTranslation(['listingSettingsGroup', 'listings', 'translation']);

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

  // Kâr Marjı row — the same summary + per-range tooltip the listing detail
  // page shows for this group, via the shared helper so the two never drift.
  // `NUMERIC` columns can arrive as strings over the wire, hence the coercion.
  const fmtMoney = (value: number): string => formatCurrency(value, undefined, undefined, 2);
  const marginNotSet = t('listings:listings.detail.notSet');
  const marginSummary = summarizeMarginStrategy(group.repricingStrategy, fmtMoney, t) ?? marginNotSet;
  const marginRangeDetails = buildMarginRangeDetails(group.repricingStrategy, fmtMoney, t, marginNotSet);

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
          <S.TemplateBadge variant={isPredefined ? 'info' : 'neutral'} size="md">
            {templateLabel}
          </S.TemplateBadge>
        </S.TitleRow>
        {group.description && (
          <Text variant="caption" color="text.secondary" truncate>
            {group.description}
          </Text>
        )}

        <S.MetaList>
          <Fact
            icon="box"
            label={t('listingSettingsGroup.card.defaultQuantity')}
            value={String(group.stock.defaultQuantity)}
          />
          <Fact
            icon="sliders-horizontal"
            label={t('listingSettingsGroup.card.stockBuffer')}
            value={String(group.stock.stockBuffer ?? 0)}
          />
          <S.MetaRow>
            <S.MetaLabel>
              <Icon name="badge-percent" size={16} color="brand.primary" />
              <Text variant="body-sm" color="text.secondary" truncate>
                {t('listings:listings.detail.groupMarginLabel')}
              </Text>
            </S.MetaLabel>
            <S.MarginValueRow>
              <Text variant="body-sm" weight="semibold">
                {marginSummary}
              </Text>
              {marginRangeDetails.length > 0 && (
                <Tooltip
                  content={
                    <S.MarginTooltipList>
                      {marginRangeDetails.map((row) => (
                        <span key={row}>{row}</span>
                      ))}
                    </S.MarginTooltipList>
                  }
                  position="left"
                  variant="dark"
                >
                  <S.MarginInfoButton
                    variant="ghost"
                    aria-label={t('listings:listings.detail.groupMarginTooltipLabel')}
                    // Info icon lives inside the clickable card — opening the
                    // tooltip must not also trigger the card's "edit group" action.
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <Icon name="info" size={14} color="text.tertiary" />
                  </S.MarginInfoButton>
                </Tooltip>
              )}
            </S.MarginValueRow>
          </S.MetaRow>
        </S.MetaList>

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
