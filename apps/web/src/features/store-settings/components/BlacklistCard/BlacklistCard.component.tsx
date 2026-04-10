import { Card, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './BlacklistCard.style';
import { BlacklistCardProps } from './BlacklistCard.types';

export const BlacklistCard: React.FC<BlacklistCardProps> = ({ keyword, scope, onRemove }) => {
  const { t } = useTranslation(['storeSettings', 'translation']);

  return (
    <S.CardWrapper>
      <Card variant="bordered" padding="sm">
        <S.CardContent>
          <S.KeywordSection>
            <Text weight="semibold" color="text.primary">
              {keyword}
            </Text>
            <S.ScopeBadge status={scope} size="sm">{t(`storeSettings:storeSettings.scope_${scope}`).toUpperCase()}</S.ScopeBadge>
          </S.KeywordSection>
          <S.ActionButton variant="ghost" onClick={onRemove} aria-label={t('translation:common.delete')}>
            <Icon name="trash" size={16} />
          </S.ActionButton>
        </S.CardContent>
      </Card>
    </S.CardWrapper>
  );
};

BlacklistCard.displayName = 'BlacklistCard';
