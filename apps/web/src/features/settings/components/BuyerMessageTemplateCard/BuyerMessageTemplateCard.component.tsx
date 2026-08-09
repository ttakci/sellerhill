import { Icon } from '@repo/ui';
import React from 'react';

import * as S from './BuyerMessageTemplateCard.style';
import type { BuyerMessageTemplateCardProps } from './BuyerMessageTemplateCard.types';

/**
 * Summary card for a buyer message template — including the user's seeded
 * per-event defaults, which are ordinary editable/deletable rows like any
 * custom template (just flagged `isDefault` for the badge + "Reset to
 * default" action in the edit drawer). Clicking selects the card for editing;
 * the delete action is a stopPropagation'd icon button so it never triggers
 * selection. The full body renders (no truncation) so the card is readable
 * without opening the editor.
 */
export const BuyerMessageTemplateCard: React.FC<BuyerMessageTemplateCardProps> = ({
  template,
  eventLabel,
  defaultBadgeLabel,
  onClick,
  onDelete,
  deleteLabel,
  selected,
}) => {
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
        <S.TitleRow>
          <S.CardName variant="h5" weight="semibold" className="card-title" truncate>
            {template.name}
          </S.CardName>
          <S.BadgeRow>
            {template.isDefault && (
              <S.DefaultBadge variant="info" size="md">
                {defaultBadgeLabel}
              </S.DefaultBadge>
            )}
            <S.EventBadge variant="neutral" size="md">
              {eventLabel}
            </S.EventBadge>
          </S.BadgeRow>
          <S.DeleteButton variant="ghost" onClick={handleDelete} aria-label={deleteLabel}>
            <Icon name="trash" size={16} />
          </S.DeleteButton>
        </S.TitleRow>
        <S.BodyPreview variant="body-sm" color="text.secondary">
          {template.body}
        </S.BodyPreview>
      </S.CardBody>
    </S.InteractiveCard>
  );
};

BuyerMessageTemplateCard.displayName = 'BuyerMessageTemplateCard';
