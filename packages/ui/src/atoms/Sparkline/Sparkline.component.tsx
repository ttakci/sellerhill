import React from 'react';

import { buildSparklinePoints } from '../../utils/sparkline';

import * as S from './Sparkline.style';
import type { SparklineProps } from './Sparkline.types';

// viewBox 100×32, stretched to the box; the stroke stays 1.5px.
const VIEW_W = 100;
const VIEW_H = 32;

export const Sparkline = ({
  values,
  tone = 'neutral',
  ariaLabel,
  size = 'md',
  className,
}: SparklineProps): React.ReactElement => (
  <S.Svg
    viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
    preserveAspectRatio="none"
    $tone={tone}
    $size={size}
    role={ariaLabel ? 'img' : undefined}
    aria-label={ariaLabel}
    aria-hidden={ariaLabel ? undefined : true}
    className={className}
  >
    <S.Line points={buildSparklinePoints(values, VIEW_W, VIEW_H, 2)} />
  </S.Svg>
);
