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
          <Text variant="body" weight="bold">{title}</Text>
        </S.HeaderLabel>
        <S.ChevronWrapper $rotated={isExpanded}>
          <Icon name="chevron-right" size={16} color={theme.colors.text.tertiary} />
        </S.ChevronWrapper>
      </S.Header>
      <S.ContentGrid $isExpanded={isExpanded}>
        <S.ContentInner>
          {children}
        </S.ContentInner>
      </S.ContentGrid>
    </S.Container>
  );
};

CollapsibleCard.displayName = 'CollapsibleCard';
