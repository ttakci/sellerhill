import React from 'react';

import * as S from './ProgressRing.style';
import type { ProgressRingProps } from './ProgressRing.types';

/**
 * A circular progress indicator.
 *
 * Geometry is computed in rem-relative units against a fixed 100-unit viewBox,
 * so the SVG scales with the wrapper's rem size and the stroke stays
 * proportional — hardcoding pixel radii would make the ring drift out of
 * proportion at another size.
 */
export const ProgressRing = ({
  value,
  variant = 'default',
  size = 'md',
  centerLabel,
  label,
  className,
}: ProgressRingProps): React.ReactElement => {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  // Work in a 100x100 viewBox; the wrapper's rem width does the real sizing.
  const strokeWidth = (S.RING_STROKE_REM[size] / S.RING_DIAMETER_REM[size]) * 100;
  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <S.RingWrapper
      className={className}
      $size={size}
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <S.RingSvg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
        <S.RingTrack cx={50} cy={50} r={radius} strokeWidth={strokeWidth} />
        <S.RingFill
          $variant={variant}
          cx={50}
          cy={50}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </S.RingSvg>
      {centerLabel ? <S.RingLabel>{centerLabel}</S.RingLabel> : null}
    </S.RingWrapper>
  );
};

ProgressRing.displayName = 'ProgressRing';
