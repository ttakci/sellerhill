import React from 'react';

import * as S from './Badge.style';
import type { BadgeProps } from './Badge.types';

export const Badge = ({
  children,
  variant = 'secondary',
  size = 'sm',
  isPill = true,
  className,
}: BadgeProps): React.ReactElement => {
  return (
    <S.BadgeContainer
      $variant={variant}
      $size={size}
      $isPill={isPill}
      className={className}
    >
      {children}
    </S.BadgeContainer>
  );
};

Badge.displayName = 'Badge';
