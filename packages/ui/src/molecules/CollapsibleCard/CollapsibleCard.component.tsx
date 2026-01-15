import React, { useState } from 'react';

import { Icon } from '../../atoms/Icon';
import { Text } from '../../atoms/Text';
import { useTheme } from '../../hooks/useTheme';

import * as S from './CollapsibleCard.style';
import type { CollapsibleCardProps } from './CollapsibleCard.types';

export const CollapsibleCard = ({
  title,
  icon,
  children,
  defaultExpanded = true,
  className,
}: CollapsibleCardProps): React.ReactElement => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const { theme } = useTheme();

  return (
    <S.Container className={className}>
      <S.Header type="button" onClick={() => setIsExpanded(!isExpanded)}>
        <S.HeaderLabel>
          {icon}
          <Text variant="body" weight="medium">{title}</Text>
        </S.HeaderLabel>
        <S.ChevronWrapper $rotated={isExpanded}>
          <Icon name="chevron-right" size={14} color={theme.colors.text.secondary} />
        </S.ChevronWrapper>
      </S.Header>
      {isExpanded && <S.Content>{children}</S.Content>}
    </S.Container>
  );
};

CollapsibleCard.displayName = 'CollapsibleCard';
