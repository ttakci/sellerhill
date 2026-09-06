import styled from '@emotion/styled';
import { Badge, Card, IconButton, Text, tkn } from '@repo/ui';

import { CARD_ACTION_ARROW_INSET, CAROUSEL_CARD_MIN_HEIGHT } from '../cardMetrics';

/**
 * Shared carousel height — every card is the same size regardless of body
 * length, so the carousel never reflows between slides and this card matches
 * the other carousels' cards. `width: 100%` is load-bearing:
 * inside the carousel's row-flex slide, a flex item without an explicit
 * width shrinks to its content instead of filling the slide, so the card
 * renders narrower (and misaligned) than the single-item path, where the
 * column-flex `BodyStack` stretches it to full width for free. Matches
 * `ListingCard`'s own `width: 100%` for the same reason.
 */
export const InteractiveCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected?: boolean }>`
  width: 100%;
  max-width: 100%;
  cursor: pointer;
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  transition: all ${tkn('transitions.normal')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: ${CAROUSEL_CARD_MIN_HEIGHT};

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }

  ${({ $selected, theme }) =>
    $selected
      ? `border-color: ${tkn('colors.brand.primary')({ theme })}; box-shadow: ${tkn('shadows.sm')({ theme })};`
      : ''}
`;

export const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.xl')};
  flex: 1;
  min-height: 0;
`;

/** Top row: event + status badges clustered left, delete button pinned right. */
export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex-shrink: 0;
`;

/** Left cluster of the header — event badge, then the custom/default badge. */
export const HeaderBadges = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  flex-wrap: wrap;
`;

export const CardName = styled(Text)`
  min-width: 0;
  max-width: 100%;
  flex-shrink: 0;
  transition: color ${tkn('transitions.normal')};
`;

export const DefaultBadge = styled(Badge)`
  flex-shrink: 0;
`;

export const CustomBadge = styled(Badge)`
  flex-shrink: 0;
`;

export const EventBadge = styled(Badge)`
  flex-shrink: 0;
`;

export const DeleteButton = styled(IconButton)`
  flex-shrink: 0;
`;

/** Clamped to a fixed number of lines so the card's fixed height never overflows. */
export const BodyPreview = styled(Text)`
  white-space: pre-wrap;
  margin-top: ${tkn('spacing.sm-md')};
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
`;

/** Trailing "Detay →" action only — `DetailAction`'s auto margin keeps the
 *  arrow pinned to the end. All badges live in `HeaderRow`. */
export const BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
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
