import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { ProgressRingSize, ProgressRingVariant } from './ProgressRing.types';

/** Outer diameter per size, in rem. */
export const RING_DIAMETER_REM: Record<ProgressRingSize, number> = {
  sm: 3,
  md: 4,
  lg: 5,
};

/** Stroke width per size, in rem. */
export const RING_STROKE_REM: Record<ProgressRingSize, number> = {
  sm: 0.3,
  md: 0.375,
  lg: 0.45,
};

export const RingWrapper = styled.div<{ $size: ProgressRingSize }>`
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: ${(props) => RING_DIAMETER_REM[props.$size]}rem;
  height: ${(props) => RING_DIAMETER_REM[props.$size]}rem;
`;

/**
 * Rotated so the arc starts at 12 o'clock. SVG circles begin at 3 o'clock,
 * which reads as "already part-way" on an empty ring.
 */
export const RingSvg = styled.svg`
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
  display: block;
`;

export const RingTrack = styled.circle`
  fill: none;
  stroke: ${tkn('colors.background.tertiary')};
`;

export const RingFill = styled.circle<{ $variant: ProgressRingVariant }>`
  fill: none;
  stroke-linecap: round;
  transition: stroke-dashoffset ${tkn('transitions.fast')};

  ${(props) => {
    switch (props.$variant) {
      case 'success':
        return `stroke: ${tkn('colors.semantic.success')(props)};`;
      case 'warning':
        return `stroke: ${tkn('colors.semantic.warning')(props)};`;
      case 'error':
        return `stroke: ${tkn('colors.semantic.error')(props)};`;
      case 'default':
      default:
        return `stroke: ${tkn('colors.brand.primary')(props)};`;
    }
  }}
`;

/**
 * Centred label. Absolutely positioned rather than an SVG <text> so it inherits
 * the app's font stack and tabular numerals like every other figure on screen.
 */
export const RingLabel = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-variant-numeric: tabular-nums;
  color: ${tkn('colors.text.primary')};
  white-space: nowrap;
  pointer-events: none;
`;
