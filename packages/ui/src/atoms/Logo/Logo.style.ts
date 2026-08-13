import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const DefaultWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  background: transparent;
`;

/**
 * Inline SVG, not an <img> — the wordmark fill is `currentColor` on the nav
 * lockup so it inherits whatever ink color the surrounding surface already
 * sets (sidebar white, landing navbar theme ink), instead of needing a
 * separate pre-rendered asset per background.
 */
export const LogoSvg = styled.svg`
  display: block;
  flex-shrink: 0;
  background: transparent;
`;

/**
 * "hill" in the two-tone wordmark. The amber is a deliberate brand exception
 * matching sellerboard's white + amber logotype treatment.
 */
export const HillAccent = styled.tspan`
  fill: ${tkn('colors.landing.accentAmber')};
`;
