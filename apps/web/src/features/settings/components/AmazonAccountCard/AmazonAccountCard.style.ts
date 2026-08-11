import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

import { CARD_ACTION_ARROW_INSET, CAROUSEL_CARD_MIN_HEIGHT } from '../cardMetrics';

/**
 * The shared carousel height keeps this card the same size as the template and
 * listing-group cards in their own drawers.
 * `$clickable` only adds the pointer cursor — the `Card` atom's own
 * `hoverable` prop (set alongside this) already drives the hover affordance.
 * `width: 100%` is load-bearing: inside the carousel's row-flex slide, a flex
 * item without an explicit width shrinks to its content instead of filling
 * the slide, so the card renders narrower (and misaligned) than the single-
 * item path, where the column-flex `BodyStack` stretches it to full width
 * for free. Matches `ListingCard`'s own `width: 100%` for the same reason.
 */
export const ClickableCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== '$clickable',
})<{ $clickable?: boolean }>`
  width: 100%;
  max-width: 100%;
  min-height: ${CAROUSEL_CARD_MIN_HEIGHT};
  display: flex;
  flex-direction: column;
  ${({ $clickable }) => ($clickable ? 'cursor: pointer;' : '')}
`;

/** `flex: 1` so the shared min-height's slack lands inside the padded block —
 *  that is what lets `BottomRow` sit on the card's bottom edge. */
export const AccountMain = styled.div`
  padding: ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  flex: 1;
`;

export const AccountHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const AccountMetaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  flex: 1;
`;

export const AccountMetaLine = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/** Bottom meta line + trailing "Detay" action — signals the card is clickable.
 *  `margin-top: auto` pins it to the bottom of the shared-height card. */
export const BottomRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  margin-top: auto;
`;

/** "Detay" label + arrow. The arrow keeps its own fixed-width slot so its tip
 *  lines up with the "add new" card's arrow below it — see `cardMetrics`. */
export const DetailAction = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  flex-shrink: 0;
`;

export const ArrowSlot = styled.span`
  display: inline-flex;
  align-items: center;
  margin-right: ${tkn(CARD_ACTION_ARROW_INSET)};
  flex-shrink: 0;
`;
