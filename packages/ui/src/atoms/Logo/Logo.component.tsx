import React from 'react';

import * as S from './Logo.style';
import type { LogoProps } from './Logo.types';

/**
 * Montserrat, not the app's Inter — a deliberate exception, everywhere this
 * wordmark renders (landing, the authenticated app's sidebar, the auth
 * branding panel). It's sellerboard's own headline/brand face (confirmed
 * against sellerboard.com/tr's live computed styles), already loaded
 * site-wide for the landing page's own type (see `LandingPage.style.ts`), so
 * reusing it here costs no extra font request. Letter-spacing is
 * deliberately left at the browser default — sellerboard's own text
 * measured `letter-spacing: normal`, not a tightened logotype tracking.
 */
const WORDMARK_FONT = "'Montserrat', -apple-system, 'Helvetica Neue', sans-serif";
const WORDMARK_WEIGHT = 700;
const WORDMARK_TRACKING = '1';

/**
 * The ONLY mark: a two-tone text wordmark, no icon/badge graphic anywhere.
 * "Hill" renders in the fixed accent (`Logo.style.ts`'s `HillAccent`) so the
 * two-tone reads at a glance; "seller" adapts to its surface (see below).
 */
const WORDMARK_VIEWBOX_W = 133;
const WORDMARK_VIEWBOX_H = 40;

export const Logo: React.FC<LogoProps> = ({ height, size, className, layout = 'default', onClick }) => {
  const resolvedHeight = height ?? size ?? 40;
  const width = (resolvedHeight * WORDMARK_VIEWBOX_W) / WORDMARK_VIEWBOX_H;

  /**
   * `default`/`full` is the auth branding panel, which always sits on the
   * dark aurora background regardless of app theme (see MeshBackground /
   * colors.landing.auroraBg) — so "seller" is hardcoded white there rather
   * than inherited. Every other layout uses `currentColor` so it inherits
   * whatever ink color the surrounding surface already sets (sidebar white,
   * landing navbar theme ink).
   */
  const sellerFill = layout === 'default' || layout === 'full' ? '#ffffff' : 'currentColor';

  return (
    <S.DefaultWrapper onClick={onClick} className={className}>
      <S.LogoSvg
        width={width}
        height={resolvedHeight}
        viewBox={`0 0 ${WORDMARK_VIEWBOX_W} ${WORDMARK_VIEWBOX_H}`}
        overflow="visible"
        role="img"
        aria-label="SellerHill"
      >
        <text
          x="0"
          y="29"
          fontFamily={WORDMARK_FONT}
          fontSize="26"
          fontWeight={WORDMARK_WEIGHT}
          letterSpacing={WORDMARK_TRACKING}
        >
          <tspan fill={sellerFill}>seller</tspan>
          <S.HillAccent>hill</S.HillAccent>
        </text>
      </S.LogoSvg>
    </S.DefaultWrapper>
  );
};
