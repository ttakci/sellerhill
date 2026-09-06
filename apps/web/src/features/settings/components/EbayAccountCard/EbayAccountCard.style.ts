import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

/**
 * This card is content-height, unlike the other carousel cards (template /
 * listing-group / Amazon), which share `CAROUSEL_CARD_MIN_HEIGHT`. The eBay
 * card is read-only and always shows the same four short lines, so the shared
 * floor (sized for the template card's three-line preview) left a large empty
 * band beneath it.
 *
 * `width: 100%` is load-bearing: inside the carousel's row-flex slide, a flex
 * item without an explicit width shrinks to its content instead of filling
 * the slide, so the card renders narrower (and misaligned) than the single-
 * item path, where the column-flex `BodyStack` stretches it to full width
 * for free. Matches `ListingCard`'s own `width: 100%` for the same reason.
 */
export const CardRoot = styled(Card)`
  width: 100%;
  max-width: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
`;

export const StoreMain = styled.div`
  padding: ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  flex: 1;
`;

export const StoreHead = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const StoreIdText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const StoreMetaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const StoreMetaLine = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;
