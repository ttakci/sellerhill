import React from 'react';

import * as S from './Logo.style';
import type { LogoProps } from './Logo.types';

/**
 * Fixed brand values. A logotype's color and typeface are a brand decision,
 * not a themed UI value — binding the badge to `colors.brand.primary` would
 * shift the mark's hue between light/dark theme (blue → indigo), which reads
 * as an inconsistent brand rather than a themed one. The wordmark below is
 * the one part that DOES adapt, via `currentColor` (see Logo.style.ts).
 */
const BADGE_FILL = '#2563eb';
const BAR_FILL = '#ffffff';
/**
 * Montserrat, not the app's Inter — a deliberate exception, everywhere this
 * wordmark renders (landing AND the authenticated app's sidebar). It's
 * sellerboard's own headline/brand face (confirmed against sellerboard.com/tr's
 * live computed styles), already loaded site-wide for the landing page's own
 * type (see `LandingPage.style.ts`), so reusing it here costs no extra font
 * request. Letter-spacing is deliberately left at the browser default —
 * sellerboard's own text measured `letter-spacing: normal`, not a tightened
 * logotype tracking.
 */
const WORDMARK_FONT = "'Montserrat', -apple-system, 'Helvetica Neue', sans-serif";
const WORDMARK_WEIGHT = 700;
const WORDMARK_TRACKING = '1';

/** Nav lockup: sellerboard-style lowercase wordmark, sized for a 40px-tall row. */
const NAV_VIEWBOX_W = 139;
const NAV_VIEWBOX_H = 40;

/** Icon-only badge: square aspect, no wordmark (collapsed sidebar rail). */
const ICON_VIEWBOX = 40;

/**
 * Text-only wordmark, no badge — the sellerboard-style sidebar strip: the
 * icon lives on the collapse button instead (`layout="icon"`), so the
 * expanded rail shows plain brand text next to it, not a second mark.
 * "Hill" is set in the fixed accent so the two-tone reads at a glance.
 */
const WORDMARK_VIEWBOX_W = 133;
const WORDMARK_VIEWBOX_H = 40;

/** Full lockup: icon over wordmark, sized for a tall auth branding panel. */
const FULL_VIEWBOX_W = 220;
const FULL_VIEWBOX_H = 200;

export const Logo: React.FC<LogoProps> = ({ height, size, className, layout = 'default', onClick }) => {
  const resolvedHeight = height ?? size ?? 40;
  const useNav = layout === 'nav' || layout === 'stacked';

  if (layout === 'wordmark') {
    const width = (resolvedHeight * WORDMARK_VIEWBOX_W) / WORDMARK_VIEWBOX_H;
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
            <tspan fill="currentColor">seller</tspan>
            <S.HillAccent>hill</S.HillAccent>
          </text>
        </S.LogoSvg>
      </S.DefaultWrapper>
    );
  }

  if (layout === 'icon') {
    return (
      <S.DefaultWrapper onClick={onClick} className={className}>
        <S.LogoSvg
          width={resolvedHeight}
          height={resolvedHeight}
          viewBox={`0 0 ${ICON_VIEWBOX} ${ICON_VIEWBOX}`}
          role="img"
          aria-label="SellerHill"
        >
          <rect width="40" height="40" rx="10" fill={BADGE_FILL} />
          <rect x="8" y="20" width="6" height="11" rx="1.6" fill={BAR_FILL} />
          <rect x="17" y="15" width="6" height="16" rx="1.6" fill={BAR_FILL} />
          <rect x="26" y="9" width="6" height="22" rx="1.6" fill={BAR_FILL} />
        </S.LogoSvg>
      </S.DefaultWrapper>
    );
  }

  if (useNav) {
    const width = (resolvedHeight * NAV_VIEWBOX_W) / NAV_VIEWBOX_H;
    return (
      <S.DefaultWrapper onClick={onClick} className={className}>
        <S.LogoSvg
          width={width}
          height={resolvedHeight}
          viewBox={`0 0 ${NAV_VIEWBOX_W} ${NAV_VIEWBOX_H}`}
          overflow="visible"
          role="img"
          aria-label="SellerHill"
        >
          <rect width="40" height="40" rx="10" fill={BADGE_FILL} />
          <rect x="8" y="20" width="6" height="11" rx="1.6" fill={BAR_FILL} />
          <rect x="17" y="15" width="6" height="16" rx="1.6" fill={BAR_FILL} />
          <rect x="26" y="9" width="6" height="22" rx="1.6" fill={BAR_FILL} />
          <text
            x="50"
            y="27"
            fontFamily={WORDMARK_FONT}
            fontSize="22"
            fontWeight={WORDMARK_WEIGHT}
            letterSpacing={WORDMARK_TRACKING}
          >
            <tspan fill="currentColor">seller</tspan>
            <S.HillAccent>hill</S.HillAccent>
          </text>
        </S.LogoSvg>
      </S.DefaultWrapper>
    );
  }

  const width = (resolvedHeight * FULL_VIEWBOX_W) / FULL_VIEWBOX_H;
  return (
    <S.DefaultWrapper onClick={onClick} className={className}>
      <S.LogoSvg
        width={width}
        height={resolvedHeight}
        viewBox={`0 0 ${FULL_VIEWBOX_W} ${FULL_VIEWBOX_H}`}
        role="img"
        aria-label="SellerHill"
      >
        <rect x="62" y="0" width="96" height="96" rx="24" fill={BADGE_FILL} />
        <rect x="82" y="52" width="14" height="26" rx="3.5" fill={BAR_FILL} />
        <rect x="103" y="40" width="14" height="38" rx="3.5" fill={BAR_FILL} />
        <rect x="124" y="24" width="14" height="54" rx="3.5" fill={BAR_FILL} />
        {/*
          Hardcoded white, not currentColor — the auth branding panel is
          always on the dark aurora background regardless of app theme
          (see MeshBackground / colors.landing.auroraBg), so there is no
          ambiguous ancestor color to inherit here.
        */}
        <text
          x="110"
          y="140"
          textAnchor="middle"
          fontFamily={WORDMARK_FONT}
          fontSize="30"
          fontWeight={WORDMARK_WEIGHT}
          letterSpacing={WORDMARK_TRACKING}
          fill="#ffffff"
        >
          <tspan>seller</tspan>
          <S.HillAccent>hill</S.HillAccent>
        </text>
      </S.LogoSvg>
    </S.DefaultWrapper>
  );
};
