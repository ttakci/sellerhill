import styled from '@emotion/styled';
import { IconButton, tkn } from '@repo/ui';

/** `styled(IconButton)` so the ghost hover / focus ring match the listing
 *  detail card's margin row; the negative margins keep the padded box from
 *  pushing the row taller than its neighbours. */
export const MarginInfoButton = styled(IconButton)`
  margin: calc(-1 * ${tkn('spacing.xs')}) 0;
  padding: ${tkn('spacing.2xs')};
  flex-shrink: 0;
`;

/** Tooltip body — one price range per line, each kept on a single unbroken
 *  line so the box widens to fit instead of chopping every range into a
 *  vertical stack of fragments in the narrow drawer. */
export const MarginTooltipList = styled.span`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  white-space: nowrap;
`;
