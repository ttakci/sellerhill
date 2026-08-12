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
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.surface.primary} 0%,
    ${({ theme }) => theme.colors.surface.secondary} 50%,
    ${({ theme }) => theme.colors.surface.primary} 100%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.4s ease-in-out infinite;
`;
