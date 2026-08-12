import React from 'react';

import * as S from './Skeleton.style';
import type { SkeletonProps } from './Skeleton.types';

export const Skeleton = ({
  width = '100%',
  height = '1rem',
  radius = 'sm',
  circle = false,
  className,
}: SkeletonProps): React.ReactElement => (
  <S.SkeletonBlock $width={width} $height={height} $radius={radius} $circle={circle} className={className} />
);

Skeleton.displayName = 'Skeleton';
