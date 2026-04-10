import React from 'react';

import * as S from './ProgressBar.style';
import type { ProgressBarProps } from './ProgressBar.types';

export const ProgressBar = ({
  value,
  variant = 'default',
  size = 'md',
  showLabel = false,
  label,
  className,
}: ProgressBarProps): React.ReactElement => {
  const clampedValue = Math.max(0, Math.min(100, value));

  return (
    <S.ProgressBarWrapper
      className={className}
      role="progressbar"
      aria-valuenow={clampedValue}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <S.ProgressBarTrack $size={size}>
        <S.ProgressBarFill $variant={variant} $value={clampedValue} $size={size} />
      </S.ProgressBarTrack>
      {showLabel && <S.ProgressBarLabel>{`${Math.round(clampedValue)}%`}</S.ProgressBarLabel>}
    </S.ProgressBarWrapper>
  );
};

ProgressBar.displayName = 'ProgressBar';
