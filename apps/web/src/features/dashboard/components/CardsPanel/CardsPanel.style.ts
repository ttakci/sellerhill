/**
 * CardsPanel styles — period card grid + the two list sections below it.
 */

import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

export const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  min-width: 0;
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${tkn('spacing.md')};

  @media (max-width: ${tkn('breakpoints.xlBelow')}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
  }
`;

const shimmer = keyframes`
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
`;

export const SkeletonCard = styled.div`
  height: 19rem;
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  background: linear-gradient(
    90deg,
    ${({ theme }) => theme.colors.surface.primary} 0%,
    ${({ theme }) => theme.colors.surface.secondary} 50%,
    ${({ theme }) => theme.colors.surface.primary} 100%
  );
  background-size: 200% 100%;
  animation: ${shimmer} 1.4s ease-in-out infinite;
`;

export const SectionsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${tkn('spacing.lg')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.lgBelow')}) {
    grid-template-columns: 1fr;
  }
`;

export const CarouselCard = styled(Card)`
  overflow: visible;
`;

export const SectionBody = styled.div`
  padding: ${tkn('spacing.md')};
  min-width: 0;
`;

export const SectionIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.brand.secondary')};
  color: ${tkn('colors.brand.primary')};
  flex-shrink: 0;
`;
