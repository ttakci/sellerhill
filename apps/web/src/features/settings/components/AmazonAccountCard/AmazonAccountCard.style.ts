import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

/**
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
  ${({ $clickable }) => ($clickable ? 'cursor: pointer;' : '')}
`;

export const AccountMain = styled.div`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.md+')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
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
`;

export const AccountMetaLine = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/** Bottom meta line + trailing arrow — the arrow signals the card is clickable. */
export const BottomRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;
