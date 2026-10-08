import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { SparklineSize, SparklineTone } from './Sparkline.types';

const TONE_COLOR = {
  positive: tkn('colors.semantic.success'),
  negative: tkn('colors.semantic.error'),
  neutral: tkn('colors.text.tertiary'),
};

export const Svg = styled.svg<{ $tone: SparklineTone; $size: SparklineSize }>`
  display: block;
  width: 100%;
  height: ${(props) => tkn(props.$size === 'sm' ? 'spacing.lg' : 'spacing.xl')(props)};
  color: ${(props) => TONE_COLOR[props.$tone](props)};
  overflow: visible;
`;

export const Line = styled.polyline`
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linejoin: round;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
`;
