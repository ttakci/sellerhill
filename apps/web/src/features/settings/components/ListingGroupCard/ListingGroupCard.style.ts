import styled from '@emotion/styled';
import { Badge, Card, Text, tkn } from '@repo/ui';

import { CARD_ACTION_ARROW_INSET, CAROUSEL_CARD_MIN_HEIGHT } from '../cardMetrics';

/**
 * Shared carousel height — every card is the same size regardless of whether
 * the group has a description, so the carousel never reflows between slides and
 * this card matches the other carousels' cards. `width: 100%` is load-bearing:
 * inside the carousel's row-flex slide, a flex item without an explicit width
 * shrinks to its content instead of filling the slide, so the card renders
 * narrower than the slide (and than the "add new" card below it) and the arrows,
 * pinned to the slide's edges, end up off the card.
 */
export const InteractiveCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected?: boolean }>`
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-height: ${CAROUSEL_CARD_MIN_HEIGHT};
  /* White surface on drawer canvas (elevated = surface.primary + border + sm shadow) */
  background: ${tkn('colors.surface.primary')};

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-0.125rem); /* -2px */
  }

  &:hover .card-title {
    color: ${tkn('colors.brand.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }

  ${({ $selected, theme }) =>
    $selected
      ? `border-color: ${tkn('colors.brand.primary')({ theme })}; box-shadow: ${tkn('shadows.md')({ theme })};`
      : ''}
`;

export const TitleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const CardName = styled(Text)`
  transition: color ${tkn('transitions.normal')};
  min-width: 0;
`;

export const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.xl')};
  flex: 1;
`;

export const StatColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.lg')};
  margin-top: ${tkn('spacing.sm')};
`;

export const StatColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const StatColumnTitle = styled(Text)`
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
`;

export const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;

  & > span,
  & > p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

/** Arrow bottom-right — the same "this card opens something" affordance the
 *  buyer message template card carries. `margin-top: auto` pins it to the
 *  bottom of the fixed-height card whatever the content above it measures. */
export const BottomRow = styled.div`
  display: flex;
  align-items: center;
  margin-top: auto;
  flex-shrink: 0;
`;

/** "Detay" label + arrow. The arrow keeps its own fixed-width slot so its tip
 *  lines up with the "add new" card's arrow below it — see `cardMetrics`. */
export const DetailAction = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  margin-left: auto;
`;

export const ArrowSlot = styled.span`
  display: inline-flex;
  align-items: center;
  margin-right: ${tkn(CARD_ACTION_ARROW_INSET)};
  flex-shrink: 0;
`;

export const ActiveBadge = styled(Badge)`
  max-width: 11rem; /* 176px — long template names / "Customized Template" */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
`;
