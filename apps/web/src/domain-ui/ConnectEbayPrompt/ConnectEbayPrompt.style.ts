import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

/**
 * The "connect your eBay store" screen in the hero language every summary
 * screen uses (billing, listing / order detail, campaigns): one glass card with
 * the blue wash, the mark in a brand-gradient disc, the copy left-aligned, the
 * actions as solid buttons and the marketplace note on the card's own foot
 * behind a hairline — not a second tinted box under the card.
 */
export const Layout = styled.div`
  box-sizing: border-box;
  width: 100%;
  max-width: 40rem;
  margin: 0 auto;
`;

/* `box-sizing: border-box` is load-bearing — there is no global reset. */
export const Hero = styled(Card)`
  box-sizing: border-box;
  width: 100%;
  background-image: linear-gradient(135deg, ${tkn('colors.semanticTint.infoStrong')} 0%, transparent 65%);
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.xl')};
  }
`;

export const Head = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    flex-direction: column;
  }
`;

export const IconDisc = styled.div`
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.brand.gradient')};
  box-shadow: ${tkn('shadows.glass')};
`;

export const Copy = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const MarketplaceSelectWrapper = styled.div`
  max-width: 20rem;
`;

export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    flex-direction: column;
    align-items: stretch;
  }
`;

export const Footnote = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
`;
