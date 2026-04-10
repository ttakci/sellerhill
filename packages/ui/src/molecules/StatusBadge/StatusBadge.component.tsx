import React from 'react';
import * as S from './StatusBadge.style';
import type { StatusBadgeProps } from './StatusBadge.types';

export const StatusBadge = ({
  status,
  size = 'md',
  children,
  className,
}: StatusBadgeProps): React.ReactElement => {
  return (
    <S.StatusBadgeContainer $status={status} $size={size} className={className}>
      {children ?? status}
    </S.StatusBadgeContainer>
  );
};

StatusBadge.displayName = 'StatusBadge';
