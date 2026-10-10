import { TemplateType } from '@repo/shared';
import { formatCurrency, Icon, Text, Tooltip } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SettingsRecordCard } from '../SettingsRecordCard';

import * as S from './ListingGroupCard.style';
import type { ListingGroupCardProps } from './ListingGroupCard.types';

import { buildMarginRangeDetails, summarizeMarginStrategy } from '@/features/listings/shared/margin-strategy';

/**
 * A Listing Settings Group in the settings record card: the template as a
 * solid badge top-left, the group's numbers as label / value rows (the same
 * margin summary + per-range tooltip the listing detail page shows), and the
 * whole card opens the editor.
 */
export const ListingGroupCard: React.FC<ListingGroupCardProps> = ({ group, onClick, templateName, selected }) => {
  const { t } = useTranslation(['listingSettingsGroup', 'listings', 'translation']);

  const isPredefined = group.templates.type === TemplateType.PREDEFINED;
  // The predefined template's actual name; the type label for custom
  // templates or while the predefined list is still loading.
  const templateLabel =
    templateName ??
    (isPredefined ? t('listingSettingsGroup.predefined') : t('listingSettingsGroup.card.customTemplate'));

  // `NUMERIC` columns can arrive as strings over the wire, hence the coercion inside the helper.
  const fmtMoney = (value: number): string => formatCurrency(value, undefined, undefined, 2);
  const marginNotSet = t('listings:listings.detail.notSet');
  const marginSummary = summarizeMarginStrategy(group.repricingStrategy, fmtMoney, t) ?? marginNotSet;
  const marginRangeDetails = buildMarginRangeDetails(group.repricingStrategy, fmtMoney, t, marginNotSet);

  const marginValue = (
    <>
      <Text variant="body-sm" weight="bold" numeric>
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
            // The info icon lives inside the clickable card — opening the
            // tooltip must not also open the group editor.
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Icon name="info" size={14} color="text.tertiary" />
          </S.MarginInfoButton>
        </Tooltip>
      )}
    </>
  );

  return (
    <SettingsRecordCard
      badges={[{ label: templateLabel, variant: isPredefined ? 'info' : 'navy' }]}
      title={group.name}
      description={group.description || undefined}
      facts={[
        { label: t('listingSettingsGroup.card.defaultQuantity'), value: String(group.stock.defaultQuantity) },
        { label: t('listingSettingsGroup.card.stockBuffer'), value: String(group.stock.stockBuffer ?? 0) },
        { label: t('listings:listings.detail.groupMarginLabel'), value: marginValue },
      ]}
      onClick={() => onClick(group.id)}
      ariaLabel={t('listingSettingsGroup.tooltips.editGroup')}
      selected={selected}
      detailLabel={t('translation:common.details')}
    />
  );
};

ListingGroupCard.displayName = 'ListingGroupCard';
