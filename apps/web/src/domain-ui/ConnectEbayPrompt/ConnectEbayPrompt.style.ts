import styled from '@emotion/styled';
import { Card, InfoMessage, tkn } from '@repo/ui';

/**
 * Stacks the white card and the note beneath it, both capped at the same width
 * and centered — without the cap the bordered card stretches edge-to-edge on
 * wide pages (Dashboard/Listings/Orders).
 */
export const Layout = styled.div`
  max-width: 32rem;
  margin: 0 auto;
`;

/*
 * `box-sizing: border-box` on BOTH is load-bearing — the app has no global
 * box-sizing reset, so the default is `content-box`. With `width: 100%` the
 * card (20px inset) would then render 8px wider than the note (16px inset),
 * and the two edges would not line up.
 */
export const StyledCard = styled(Card)`
  box-sizing: border-box;
  width: 100%;
`;

export const MarketplaceSelectWrapper = styled.div`
  margin-bottom: ${tkn('spacing.lg')};
`;

export const Footnote = styled(InfoMessage)`
  box-sizing: border-box;
  width: 100%;
  margin-top: ${tkn('spacing.md')};
`;
