import { Card, Checkbox, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './BlacklistCard.style';
import { BlacklistCardProps } from './BlacklistCard.types';

export const BlacklistCard: React.FC<BlacklistCardProps> = ({
  keyword,
  types,
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
      <Card variant="bordered" padding="sm" onClick={handleCardClick}>
        <S.CardContent>
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
          <S.ScopeSection>
            {types.map((type) => (
              <S.ScopeTag key={type} $status={type}>
                {t(`storeSettings:storeSettings.blacklistType_${type}`)}
              </S.ScopeTag>
            ))}
          </S.ScopeSection>
          <S.ActionButton variant="ghost" onClick={onRemove} aria-label={t('translation:common.delete')}>
            <Icon name="trash" size={16} />
          </S.ActionButton>
        </S.CardContent>
      </Card>
    </S.CardWrapper>
  );
};

BlacklistCard.displayName = 'BlacklistCard';
