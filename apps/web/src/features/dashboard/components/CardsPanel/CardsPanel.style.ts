/**
 * CardsPanel styles — period card grid + the two list sections below it.
 */

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

/*
 * Was a hand-rolled surface (border + radius + shadow) that only sized to the
 * EmptyState's own airy padding, so an empty section stood taller than a real
 * populated card. Now the Card atom (mirrors ListingsOverviewPage's EmptyCard)
 * with a min-height of exactly one populated ListingCard/OrderCard — image
 * (10.5rem) + the card's own vertical padding (2 x spacing.lg) — and its
 * content centered in that box.
 */
export const EmptyCard = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: calc(10.5rem + 2 * ${tkn('spacing.lg')});
`;

export const SectionHeading = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;
