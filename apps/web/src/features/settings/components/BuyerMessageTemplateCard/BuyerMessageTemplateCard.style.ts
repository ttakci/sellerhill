import styled from '@emotion/styled';
import { Badge, Card, IconButton, Text, tkn } from '@repo/ui';

/**
 * Fixed height — every card is the same size regardless of body length, so
 * the carousel never reflows between slides. `width: 100%` is load-bearing:
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
  height: 13rem;

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

export const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex-shrink: 0;
`;

export const CardName = styled(Text)`
  flex: 1;
  min-width: 0;
  transition: color ${tkn('transitions.normal')};
`;

export const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  flex-shrink: 0;
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
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
`;

/** Default badge bottom-left, arrow bottom-right — `ArrowSlot`'s auto margin
 *  keeps the arrow pinned to the end whether or not the badge is present. */
export const BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-shrink: 0;
`;

export const ArrowSlot = styled.span`
  display: inline-flex;
  align-items: center;
  margin-left: auto;
`;
