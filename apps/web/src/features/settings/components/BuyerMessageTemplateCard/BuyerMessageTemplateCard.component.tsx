import { Icon } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { SettingsRecordCard } from '../SettingsRecordCard';

import * as S from './BuyerMessageTemplateCard.style';
import type { BuyerMessageTemplateCardProps } from './BuyerMessageTemplateCard.types';

/**
 * Summary card for a buyer message template — including the user's seeded
 * per-event defaults, which are ordinary editable/deletable rows like any
 * custom template (just flagged `isDefault` for the badge + "Reset to
 * default" action in the edit drawer). Event + default/custom as solid badges
 * top-left, delete pinned to the badge row's right end (stopPropagation'd so
 * it never opens the editor), the body clamped to three lines.
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

  return (
    <SettingsRecordCard
      badges={[
        { label: eventLabel, variant: 'info' },
        template.isDefault
          ? { label: defaultBadgeLabel, variant: 'navy' }
          : { label: customBadgeLabel, variant: 'teal' },
      ]}
      badgeRowAction={
        <S.DeleteButton
          variant="ghost"
          aria-label={deleteLabel}
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            onDelete(template.id);
          }}
        >
          <Icon name="trash" size={16} />
        </S.DeleteButton>
      }
      title={template.name}
      preview={template.body}
      onClick={() => onClick(template.id)}
      ariaLabel={template.name}
      selected={selected}
      detailLabel={t('translation:common.details')}
    />
  );
};

BuyerMessageTemplateCard.displayName = 'BuyerMessageTemplateCard';
