import { Badge, Card, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './BlacklistCard.style';
import { BlacklistCardProps } from './BlacklistCard.types';

export const BlacklistCard: React.FC<BlacklistCardProps> = ({ keyword, scope, onRemove }) => {
  const { t } = useTranslation(['storeSettings', 'translation']);

  const scopeVariantMap: Record<string, 'primary' | 'secondary'> = {
    both: 'primary',
    title: 'secondary',
    description: 'secondary',
  };

  return (
    <S.CardWrapper>
      <Card variant="bordered" padding="sm">
        <S.CardContent>
          <S.KeywordSection>
            <Text weight="semibold" color="text.primary">
              {keyword}
            </Text>
            <Badge variant={scopeVariantMap[scope] || 'secondary'} size="sm">
              {t(`storeSettings:storeSettings.scope_${scope}`).toUpperCase()}
            </Badge>
          </S.KeywordSection>
          <S.ActionButton onClick={onRemove} aria-label={t('translation:common.delete')}>
            <Icon name="trash" size={16} />
          </S.ActionButton>
        </S.CardContent>
      </Card>
    </S.CardWrapper>
  );
};

BlacklistCard.displayName = 'BlacklistCard';
