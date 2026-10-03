import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';

import type { SkeletonRadius } from './Skeleton.types';

const shimmer = keyframes`
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
`;

export const SkeletonBlock = styled.div<{
  $width: string;
  $height: string;
  $radius: SkeletonRadius;
  $circle: boolean;
}>`
  width: ${({ $width }) => $width};
  height: ${({ $height }) => $height};
  flex-shrink: 0;
  border-radius: ${({ $circle, $radius, theme }) => ($circle ? theme.radius.full : theme.radius[$radius])};
  /*
   * The blocks sit on white glass cards, so they are drawn in the canvas
   * tint, not in surface white: surface.primary ↔ surface.secondary on a white card was a
   * skeleton nobody could see, and a page waiting on Amazon looked frozen.
   */
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.background.tertiary} 0%,
    ${({ theme }) => theme.colors.background.primary} 50%,
    ${({ theme }) => theme.colors.background.tertiary} 100%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.4s ease-in-out infinite;
`;
