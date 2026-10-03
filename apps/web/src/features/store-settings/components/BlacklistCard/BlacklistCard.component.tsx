import { BlacklistAction } from '@repo/shared';
import { Badge, Card, Checkbox, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './BlacklistCard.style';
import { BlacklistCardProps } from './BlacklistCard.types';

export const BlacklistCard: React.FC<BlacklistCardProps> = ({
  keyword,
  types,
  action,
  onRemove,
  selectable = false,
  selected = false,
  onSelect,
}) => {
  const { t } = useTranslation(['storeSettings', 'translation']);

  const handleCardClick = (): void => {
    if (selectable && onSelect) {
      onSelect();
    }
  };

  return (
    <S.CardWrapper $selectable={selectable}>
      <Card variant="flat" padding="sm" onClick={handleCardClick}>
        <S.CardHeader>
          <S.HeaderLeft>
            {selectable && (
              <S.CheckboxSection onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={selected} onChange={onSelect} aria-label={t('translation:common.select')} />
              </S.CheckboxSection>
            )}
            <S.KeywordSection title={keyword}>
              <Text weight="semibold" color="text.primary">
                {keyword}
              </Text>
            </S.KeywordSection>
          </S.HeaderLeft>
          <S.ActionButton
            variant="ghost"
            onClick={(e) => {
              // Stop the click bubbling to the card, which would toggle
              // selection and re-add this keyword to the bulk-delete set.
              e.stopPropagation();
              onRemove();
            }}
            aria-label={t('translation:common.delete')}
          >
            <Icon name="trash" size={16} />
          </S.ActionButton>
        </S.CardHeader>
        <S.CardBody>
          <S.ScopeSection>
            {action === BlacklistAction.REMOVE && (
              <Badge variant="sky" size="xs">
                {t('storeSettings:storeSettings.blacklistAction_remove')}
              </Badge>
            )}
            {types.map((type) => (
              <Badge key={type} variant="neutral" size="xs">
                {t(`storeSettings:storeSettings.blacklistType_${type}`)}
              </Badge>
            ))}
          </S.ScopeSection>
        </S.CardBody>
      </Card>
    </S.CardWrapper>
  );
};

BlacklistCard.displayName = 'BlacklistCard';
