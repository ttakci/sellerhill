/**
 * CardsPanel styles — period card grid + the two list sections below it.
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

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

export const SectionsRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${tkn('spacing.lg')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.lgBelow')}) {
    grid-template-columns: 1fr;
  }
`;

export const CarouselSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const EmptyCard = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.sm')};
  box-sizing: border-box;
`;

export const SectionHeading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;
