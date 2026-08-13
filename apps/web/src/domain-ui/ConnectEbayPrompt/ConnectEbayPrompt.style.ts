import styled from '@emotion/styled';
import { Card, Text, tkn } from '@repo/ui';

/**
 * Capped and centered — without this the bordered card stretches edge-to-edge
 * on wide pages (Dashboard/Listings/Orders), leaving a thin bar of border
 * around a small centered icon. Same width everywhere this prompt appears.
 */
export const StyledCard = styled(Card)`
  max-width: 32rem;
  margin: 0 auto;
`;

export const MarketplaceSelectWrapper = styled.div`
  margin-bottom: ${tkn('spacing.lg')};
`;

export const Footnote = styled(Text)`
  text-align: center;
  max-width: 20rem;
  margin: ${tkn('spacing.md')} auto 0;
`;
