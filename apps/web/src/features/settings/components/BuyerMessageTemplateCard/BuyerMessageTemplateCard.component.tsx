import { Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { CARD_ACTION_ICON_SIZE } from '../cardMetrics';

import * as S from './BuyerMessageTemplateCard.style';
import type { BuyerMessageTemplateCardProps } from './BuyerMessageTemplateCard.types';

/**
 * Summary card for a buyer message template — including the user's seeded
 * per-event defaults, which are ordinary editable/deletable rows like any
 * custom template (just flagged `isDefault` for the badge + "Reset to
 * default" action in the edit drawer). The header row clusters the event
 * badge and the custom/default status badge (both blue-toned) on the left,
 * with the delete action pinned top-right — a stopPropagation'd icon button
 * so it never triggers selection. Clicking anywhere else selects the card
 * for editing. Every card is a fixed height with the body clamped to a few
 * lines, so cards stay uniform (and the carousel never reflows) regardless
 * of how long a given template's body is.
 */
export const BuyerMessageTemplateCard: React.FC<BuyerMessageTemplateCardProps> = ({
  template,
  eventLabel,
  defaultBadgeLabel,
  customBadgeLabel,
  onClick,
  onDelete,
  deleteLabel,
  selected,
}) => {
  const { t } = useTranslation(['translation']);

  const handleActivate = (): void => onClick(template.id);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  const handleDelete = (e: React.MouseEvent): void => {
    e.stopPropagation();
    onDelete(template.id);
  };

  return (
    <S.InteractiveCard
      variant="elevated"
      $selected={selected}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      <S.CardBody>
        <S.HeaderRow>
          <S.HeaderBadges>
            <S.EventBadge variant="info" size="md">
              {eventLabel}
            </S.EventBadge>
            {template.isDefault ? (
              <S.DefaultBadge variant="primary" size="md">
                {defaultBadgeLabel}
              </S.DefaultBadge>
            ) : (
              <S.CustomBadge variant="info" size="md">
                {customBadgeLabel}
              </S.CustomBadge>
            )}
          </S.HeaderBadges>
          <S.DeleteButton variant="ghost" onClick={handleDelete} aria-label={deleteLabel}>
            <Icon name="trash" size={16} />
          </S.DeleteButton>
        </S.HeaderRow>
        <S.CardName variant="h5" weight="semibold" className="card-title" truncate>
          {template.name}
        </S.CardName>
        <S.BodyPreview variant="body-sm" color="text.secondary">
          {template.body}
        </S.BodyPreview>
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

BuyerMessageTemplateCard.displayName = 'BuyerMessageTemplateCard';
