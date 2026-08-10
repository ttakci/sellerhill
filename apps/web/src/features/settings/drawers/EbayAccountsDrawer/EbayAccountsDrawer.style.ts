import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/**
 * Horizontal inset — without it, the carousel's arrows (which protrude past
 * the card's own edges by design) land almost flush against the drawer's
 * edge. Insetting here keeps the carousel, the single-item card, and the
 * "add new" card all the same width and aligned with each other.
 */
export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
  padding: 0 ${tkn('spacing.md')};
`;
