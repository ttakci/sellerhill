import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/* =========================================================================
 * Landing — light, clean SaaS.
 *
 * The hero used to be unconditionally dark in both themes. It now follows the
 * theme like every other surface, which is why `colors.landing.heroText` is
 * real ink here and anything sitting on a brand-coloured fill uses
 * `colors.landing.onAccent` instead. Do not swap those two back.
 *
 * This feature is exempt from the design-system ESLint rules, but it still
 * reads tokens rather than literals, so a token change reaches it like any
 * other surface.
 * ========================================================================= */

const CONTENT_MAX = '1180px';
const NARROW_MAX = '900px';

/**
 * Section rhythm. One value, so no section invents its own vertical spacing.
 *
 * Tightened 2026-09-07 (7.5/4.5rem → 5.5/3.5rem) after three separate reports
 * of dead space above a section heading. The cause was structural rather than
 * local: at 7.5rem, two adjacent sections put 120px of their own padding on
 * each side of the boundary, so every seam carried 240px of empty page — enough
 * that a section eyebrow read as detached from the content it belongs to. Fix
 * it here, once, rather than per section; a section that needs less still uses
 * `$tightTop` instead of a literal.
 */
const SECTION_Y = '5.5rem';
const SECTION_Y_SM = '3.5rem';

/*
 * Landing-only type (2026-09-27, modernization pass): Plus Jakarta Sans for
 * headlines — tight, geometric, the face most newer SaaS pages use — and Inter
 * for everything else, which the app already loads. It replaced sellerboard's
 * Montserrat/Poppins, which read dated next to the rest of the refresh. The
 * app's own Inter/Lexend system is untouched; landing stays the one surface
 * that sets its own type.
 */
const FONT_HEADING =
  "'Plus Jakarta Sans', 'Inter', 'Noto Sans Devanagari', 'Noto Sans Arabic', 'Noto Sans Bengali', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_BODY =
  "'Inter', 'Noto Sans Devanagari', 'Noto Sans Arabic', 'Noto Sans Bengali', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Sellerboard-matched type scale (px, as rem @ 16px root). */
const TYPE = {
  h1: '3.5rem' /* 56px */,
  h2: '3rem' /* 48px */,
  h3: '2.5rem' /* 40px */,
  cardLg: '1.5rem' /* 24px */,
  cardMd: '1.25rem' /* 20px */,
  cardSm: '1.125rem' /* 18px */,
  price: '2rem' /* 32px */,
  lead: '1.125rem' /* 18px */,
  body: '1rem' /* 16px */,
  small: '0.875rem' /* 14px */,
  micro: '0.8125rem' /* 13px */,
};

/**
 * One tick above `TYPE.small` (14px → 15px), for the navbar row only. Live
 * feedback (2026-08-20) was that the nav read smaller than sellerboard.com/tr
 * despite matching its measured 14px — sellerboard's nav sits inside a taller,
 * more padded bar, which reads as bigger even at the same font size. Bumping
 * the navbar's own type by one step (rather than touching the measured `TYPE`
 * scale above, which several sections besides the navbar still rely on)
 * closes that gap without re-deriving sellerboard's numbers.
 */
const NAV_FONT_SIZE = '0.9375rem' /* 15px */;

/**
 * Scroll reveal — a short fade and a small rise, nothing more. The blur and
 * scale it used to carry were part of what made the page feel busy; the brief
 * (2026-09-27) was modern but calm, closer to the established competitors'
 * pages than to the heavily animated new ones.
 */
export const Reveal = styled.div<{ $visible: boolean; $delay?: number }>`
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: ${(p) => (p.$visible ? 'none' : 'translateY(14px)')};
  transition:
    opacity 600ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: ${(p) => (p.$delay ? `${p.$delay * 70}ms` : '0ms')};

  @media (prefers-reduced-motion: reduce) {
    opacity: 1;
    transform: none;
    transition: none;
  }
`;

/* =========================================================================
 * Page shell
 * ========================================================================= */

export const Page = styled.div`
  min-height: 100vh;
  background: ${tkn('colors.landing.heroBg')};
  color: ${tkn('colors.landing.heroText')};
  font-family: ${FONT_BODY};
  font-feature-settings: 'cv11', 'ss01', 'ss03';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  overflow-x: hidden;
`;

/* =========================================================================
 * Navbar
 * ========================================================================= */

/**
 * Sellerboard keeps its navbar dark at all times — over the blue hero AND
 * over the white sections once scrolled. Ours mirrors that: transparent
 * (blends into the dark hero) until scrolled, then an opaque dark-navy fill
 * so light nav text stays legible over whatever white section sits behind
 * it. \`colors.sidebar.background\` is reused deliberately — same deep blue
 * (light theme) / near-black (dark theme) as the app's own sidebar.
 */
/**
 * Width below which the navbar links give way to the hamburger menu. Sized to
 * the widest locale's full link row (Turkish, with "Hakkımızda") plus the
 * logo and the right-hand actions — the row may not scroll (see \`NavLinks\`).
 */
const NAV_COLLAPSE = '1280px';

export const Navbar = styled.header<{ $scrolled: boolean }>`
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 50;
  background: ${(p) =>
    p.$scrolled ? `color-mix(in srgb, ${tkn('colors.sidebar.background')(p)} 92%, transparent)` : 'transparent'};
  backdrop-filter: ${(p) => (p.$scrolled ? 'saturate(160%) blur(16px)' : 'none')};
  -webkit-backdrop-filter: ${(p) => (p.$scrolled ? 'saturate(160%) blur(16px)' : 'none')};
  border-bottom: 1px solid ${(p) => (p.$scrolled ? tkn('colors.sidebar.divider')(p) : 'transparent')};
  transition:
    background 240ms ease,
    backdrop-filter 240ms ease,
    border-color 240ms ease;
`;

export const NavInner = styled.nav`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  padding: 1.375rem ${tkn('spacing.xl')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};

  @media (max-width: 1080px) {
    padding: 1.125rem ${tkn('spacing.md')};
  }
`;

/**
 * Navbar-only (never reused on a light surface) — same unconditional
 * sidebar-text treatment as NavLink/Hamburger, so the wordmark's "seller"
 * run (currentColor) doesn't inherit the page's theme-following heroText
 * and go dark-on-dark. \`flex-shrink: 0\` keeps the brand mark at full size
 * even when the row is tight — it must never be the thing that compresses.
 */
export const NavBrand = styled.button`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: ${tkn('colors.sidebar.text')};
`;

/**
 * Never \`overflow\` here: any overflow value other than \`visible\` also
 * clips vertically, and the Features \`Dropdown\` menu is absolutely
 * positioned BELOW this row — an \`overflow-x: auto\` that was added to stop
 * the links wrapping cut the whole menu off, so "Features" opened to nothing.
 * Links keep their natural width (\`flex-shrink: 0\`, \`nowrap\`) instead, and
 * the row hands over to the hamburger menu at \`NAV_COLLAPSE\` before it
 * could run out of room.
 */
export const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 0.125rem;

  /* \`width: auto\` overrides the Dropdown atom's own \`width: 100%\`, which
     would otherwise claim the whole row once shrinking is off. Doubled \`&&\`
     so this outranks the atom's own single-class rule regardless of order. */
  && > * {
    flex-shrink: 0;
    width: auto;
    white-space: nowrap;
  }

  @media (max-width: ${NAV_COLLAPSE}) {
    display: none;
  }
`;

/**
 * Navbar-only (never reused on a light surface) — safe to pin to the
 * always-light sidebar text tokens. Full \`sidebar.text\` (not the muted
 * variant), matching sellerboard.com/tr's own nav item color — same weight
 * as before, just brighter; hover only adds the background tint now that
 * there's no dimmer resting state to brighten out of.
 */
export const NavLink = styled.button`
  flex-shrink: 0;
  white-space: nowrap;
  background: none;
  border: none;
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: ${NAV_FONT_SIZE};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.sidebar.text')};
  padding: 0.5rem 0.75rem;
  border-radius: ${tkn('radius.md')};
  transition: background 140ms ease;

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
  }
`;

/** Dropdown trigger with the exact NavLink look — used for the Features mega-menu-lite. Same full \`sidebar.text\` color as NavLink, see its comment. */
export const NavDropdownTrigger = styled.div`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  white-space: nowrap;
  gap: 0.3125rem;
  font-family: ${FONT_BODY};
  font-size: ${NAV_FONT_SIZE};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.sidebar.text')};
  padding: 0.5rem 0.75rem;
  border-radius: ${tkn('radius.md')};
  transition: background 140ms ease;

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
  }
`;

/** \`flex-shrink: 0\` pins language/login/register/hamburger at full size — this cluster must never be what compresses under a tight row (see NavLinks). */
export const NavActions = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: ${tkn('spacing.md')};
`;

/**
 * Locale trigger. Deliberately identical to the one in the app header
 * (`AppShell.style.ts` → `LanguageSelectTrigger`): a visitor who signs up
 * should meet the same control, not a second dialect of the same idea.
 *
 * Reused on two surfaces with opposite backgrounds — the always-dark navbar
 * and the theme-following (light) footer — so its colour is a \`$onDark\`
 * variant rather than a hardcoded choice.
 */
export const LanguageTrigger = styled.div<{ $onDark?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  cursor: pointer;
  padding: ${tkn('spacing.2xs')} 0.375rem;
  border-radius: ${tkn('radius.sm')};
  color: ${(p) => (p.$onDark ? tkn('colors.sidebar.textMuted')(p) : tkn('colors.landing.heroTextMuted')(p))};
  transition: background 140ms ease;

  &:hover {
    background: ${(p) => (p.$onDark ? tkn('colors.sidebar.hover')(p) : tkn('colors.landing.chipBg')(p))};

    & > span,
    & svg {
      color: ${tkn('colors.brand.primary')};
    }
  }
`;

export const LanguageText = styled.span<{ $onDark?: boolean }>`
  white-space: nowrap;
  font-family: ${FONT_BODY};
  font-size: ${NAV_FONT_SIZE};
  font-weight: 700; /* sellerboard's "bold" is a literal 700; our app's own bold token has since softened to 600 */
  color: ${(p) => (p.$onDark ? tkn('colors.sidebar.text')(p) : tkn('colors.landing.heroText')(p))};
  transition: color 140ms ease;
`;

/**
 * Navbar (\`$onDark\`) is a borderless icon+text link, matching sellerboard's
 * plain "Giriş yap" — a box around it competed with NavCta's filled button
 * for attention. The mobile-menu-panel (\`$block\`) usage stays a bordered
 * button: there it is one of two stacked CTAs, not a lightweight nav item.
 */
export const LoginButton = styled.button<{ $block?: boolean; $onDark?: boolean }>`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  white-space: nowrap;
  gap: ${tkn('spacing.xs')};
  background: none;
  border: ${(p) =>
    p.$block
      ? `1px solid ${(p.$onDark ? tkn('colors.sidebar.divider') : tkn('colors.landing.heroBorder'))(p)}`
      : 'none'};
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: ${NAV_FONT_SIZE};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${(p) => (p.$onDark ? tkn('colors.sidebar.text')(p) : tkn('colors.landing.heroText')(p))};
  padding: 0.5rem ${(p) => (p.$block ? '1rem' : '0.5rem')};
  border-radius: ${tkn('radius.md')};
  transition:
    color 140ms ease,
    background 140ms ease;
  ${(p) => (p.$block ? 'width: 100%;' : '')}

  &:hover {
    background: ${(p) => (p.$onDark ? tkn('colors.sidebar.hover')(p) : tkn('colors.landing.chipBg')(p))};
  }

  @media (max-width: ${NAV_COLLAPSE}) {
    display: ${(p) => (p.$block ? 'inline-flex' : 'none')};
  }
`;

export const NavCta = styled.button<{ $block?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  white-space: nowrap;
  gap: 0.375rem;
  background: ${tkn('colors.brand.primary')};
  border: none;
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: ${NAV_FONT_SIZE};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.onAccent')};
  padding: 0.5rem 1.125rem;
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  transition:
    background 160ms ease,
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 160ms ease;
  ${(p) => (p.$block ? 'width: 100%;' : '')}

  &:hover {
    background: ${tkn('colors.brand.primaryHover')};
    transform: translateY(-1px);
    box-shadow: ${tkn('colors.landing.shadowStrong')};
  }

  &:active {
    transform: translateY(0);
  }

  @media (max-width: ${NAV_COLLAPSE}) {
    display: ${(p) => (p.$block ? 'inline-flex' : 'none')};
  }
`;

export const Hamburger = styled.button<{ $open: boolean }>`
  display: none;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  background: none;
  border: 1px solid ${tkn('colors.sidebar.divider')};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.sidebar.text')};
  cursor: pointer;

  @media (max-width: ${NAV_COLLAPSE}) {
    display: inline-flex;
  }
`;

/* =========================================================================
 * Mobile menu
 * ========================================================================= */

export const MobileMenuOverlay = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 60;
  background: ${tkn('colors.surface.overlay')};
  opacity: ${(p) => (p.$open ? 1 : 0)};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition: opacity 200ms ease;
`;

/**
 * Mobile menu (2026-09-27, rebuilt): a full-screen navy sheet, the same colour
 * and ink as the navbar it opens from, so the logo's white "SELLER" is always
 * on a dark ground and the menu reads as the navbar expanded rather than a
 * second, light-themed surface.
 */
export const MobileMenu = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 61;
  background: ${tkn('colors.sidebar.background')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')} calc(${tkn('spacing.lg')} + env(safe-area-inset-bottom));
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  overflow-y: auto;
  visibility: ${(p) => (p.$open ? 'visible' : 'hidden')};
  transform: translateX(${(p) => (p.$open ? '0' : '100%')});
  transition:
    transform 260ms cubic-bezier(0.22, 1, 0.36, 1),
    visibility 260ms;
`;

/**
 * Navy band across the top of the panel. The logo's "SELLER" is hardcoded
 * white, so on the panel's near-white surface it disappeared — the band gives
 * it the same dark ground as the navbar. Negative margins cancel the panel's
 * own padding so the band runs edge to edge.
 */
export const MobileMenuHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3rem;
`;

export const MobileClose = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  background: none;
  border: 1px solid ${tkn('colors.sidebar.divider')};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.sidebar.text')};
  cursor: pointer;
`;

export const MobileLinks = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

export const MobileLink = styled.button`
  background: none;
  border: none;
  border-bottom: 1px solid ${tkn('colors.sidebar.divider')};
  cursor: pointer;
  text-align: left;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.lead};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.sidebar.text')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.xs')};

  &:hover,
  &:focus-visible {
    background: ${tkn('colors.sidebar.hover')};
  }
`;

export const MobileCtas = styled.div`
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};

  /* Both CTAs: same height, full width, label centred. */
  & > button {
    justify-content: center;
    min-height: 3rem;
    font-size: ${TYPE.body};
  }
`;

/* =========================================================================
 * Hero — the sellerboard-format band, restored (2026-09-27, third pass)
 *
 * The operator preferred the ORIGINAL hero over the aurora rework: a flat navy
 * band, left copy / right real screenshot, the big amber offer placard over the
 * screenshot's top-right corner, a real KPI crop on its left edge. Brought back
 * as it was, with two deliberate differences:
 *   - no 3D tilt on the screenshot (Chrome resamples it and the text goes soft),
 *   - a little restrained motion: the copy rises in once on load, the offer
 *     placard and KPI crop drift a few pixels, and the faint equaliser bars
 *     behind the band breathe slowly. Nothing loops fast, nothing changes hue.
 * The palette is the product's own: navy, brand blue, amber. No violet/rose
 * gradients and no gradient-clipped headline text.
 * Everything respects `prefers-reduced-motion`.
 * ========================================================================= */

const floatY = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-6px); }
`;

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const barBreathe = keyframes`
  0%, 100% { transform: scaleY(0.55); }
  50%      { transform: scaleY(1); }
`;

const pulse = keyframes`
  0%   { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 55%, transparent); }
  70%  { box-shadow: 0 0 0 7px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
`;

const breathe = keyframes`
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.07); }
`;

const railPulse = keyframes`
  0%   { transform: translateX(-10%); opacity: 0; }
  15%  { opacity: 1; }
  85%  { opacity: 1; }
  100% { transform: translateX(calc(100cqw - 90%)); opacity: 0; }
`;

const tickRing = keyframes`
  0%, 70%, 100% { box-shadow: 0 0 0 0 transparent; }
  8%  { box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.18); }
`;

const dotPulse = keyframes`
  0%   { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.45); }
  70%  { box-shadow: 0 0 0 7px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
`;

const REDUCED = '@media (prefers-reduced-motion: reduce)';

/**
 * Full-bleed navy band. `colors.sidebar.background` is the app's own sidebar
 * colour, so the band and the real screenshot inside it read as one brand.
 * The top padding clears the fixed navbar (~82px) and leaves ~38px of air.
 */
export const Hero = styled.section`
  position: relative;
  isolation: isolate;
  background: ${tkn('colors.sidebar.background')};
  padding: 7.5rem ${tkn('spacing.xl')} 7rem;
  overflow: hidden;

  @media (max-width: 980px) {
    padding: 6.5rem ${tkn('spacing.md')} 6rem;
  }
`;

/**
 * Soft radial washes behind the band — depth without a pattern the eye can
 * resolve (the ruled grid this replaced once read as graph paper).
 */
export const HeroGlow = styled.div`
  position: absolute;
  inset: -38% -16% auto -16%;
  height: 62rem;
  z-index: -2;
  pointer-events: none;
  background:
    radial-gradient(48rem 32rem at 16% 14%, ${tkn('colors.landing.heroGlow')} 0%, transparent 70%),
    radial-gradient(44rem 30rem at 84% 6%, ${tkn('colors.landing.heroGlowAlt')} 0%, transparent 72%),
    radial-gradient(64rem 28rem at 48% 46%, ${tkn('colors.landing.heroGlow')} 0%, transparent 78%);
`;

/**
 * Two faint clusters of equaliser bars — the "audio spectrum" of the original
 * hero, now drawn with real elements so each bar can breathe on its own delay.
 * Low opacity and slow: texture, not a feature.
 */
export const HeroSpectrum = styled.div<{ $side: 'left' | 'right' }>`
  position: absolute;
  z-index: -1;
  pointer-events: none;
  display: flex;
  align-items: center;
  gap: 5px;
  height: ${(p) => (p.$side === 'left' ? '7rem' : '9rem')};
  left: ${(p) => (p.$side === 'left' ? '37%' : '60%')};
  top: ${(p) => (p.$side === 'left' ? '72%' : '14%')};
  opacity: 0.35;

  @media (max-width: 980px) {
    display: none;
  }
`;

export const HeroSpectrumBar = styled.span<{ $h: number; $delay: number; $warm?: boolean }>`
  width: 4px;
  height: ${(p) => p.$h}%;
  border-radius: 2px;
  background: linear-gradient(
    to top,
    transparent,
    ${(p) => (p.$warm ? tkn('colors.landing.accentAmber')(p) : tkn('colors.landing.accentBlue')(p))},
    transparent
  );
  transform-origin: center;
  animation: ${barBreathe} 3.6s ease-in-out infinite;
  animation-delay: ${(p) => p.$delay}s;

  ${REDUCED} {
    animation: none;
  }
`;

/** Left content / right screenshot split — sellerboard's asymmetric hero. */
export const HeroInner = styled.div`
  position: relative;
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  align-items: center;
  gap: ${tkn('spacing.xxl')};
  text-align: left;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    gap: 3rem;
  }
`;

/** Each direct child rises in once, staggered — the only entrance motion on the band. */
export const HeroContent = styled.div`
  max-width: 34rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};

  & > * {
    animation: ${riseIn} 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
  }
  & > *:nth-of-type(2) { animation-delay: 80ms; }
  & > *:nth-of-type(3) { animation-delay: 160ms; }
  & > *:nth-of-type(4) { animation-delay: 240ms; }
  & > *:nth-of-type(5) { animation-delay: 320ms; }
  & > *:nth-of-type(6) { animation-delay: 400ms; }

  ${REDUCED} {
    & > * {
      animation: none;
    }
  }
`;

/** Category line above the headline; amber on `sidebar.hover` so it reads on navy. */
export const HeroEyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.4rem 0.95rem;
  border-radius: 999px;
  background: ${tkn('colors.sidebar.hover')};
  border: 1px solid ${tkn('colors.sidebar.divider')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: 600;
  letter-spacing: 0.03em;
  color: ${tkn('colors.landing.accentAmber')};
`;

/** Small amber "live" dot inside the eyebrow — the automation is running. */
export const LiveDot = styled.span`
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: currentColor;
  animation: ${pulse} 2.4s ease-out infinite;

  ${REDUCED} {
    animation: none;
  }
`;

export const HeroTitle = styled.h1`
  margin: 0;
  font-family: ${FONT_HEADING};
  font-size: clamp(2.35rem, 4.2vw, ${TYPE.h1});
  line-height: 1.12;
  letter-spacing: -0.02em;
  font-weight: 700;
  color: ${tkn('colors.sidebar.text')};
  text-wrap: balance;
`;

/** Second line of the headline — solid amber, the brand's own accent. */
export const HeroTitleAccent = styled.span`
  color: ${tkn('colors.landing.accentAmber')};
`;

export const HeroSubtitle = styled.p`
  margin: 0;
  max-width: 30rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.lead};
  line-height: 1.65;
  color: ${tkn('colors.sidebar.textMuted')};
  text-wrap: pretty;
`;

export const HeroCtas = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: ${tkn('spacing.sm')};
  margin-top: 0.25rem;
`;

/**
 * `$accent` = solid amber fill / navy text — the hero's primary CTA, the same
 * amber as "HILL" in the wordmark. Everywhere else: solid brand blue.
 */
export const PrimaryButton = styled.button<{ $lg?: boolean; $accent?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: ${(p) => (p.$accent ? tkn('colors.landing.accentAmber')(p) : tkn('colors.brand.primary')(p))};
  border: none;
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: ${(p) => (p.$lg ? '1.0625rem' : TYPE.body)};
  font-weight: 700;
  color: ${(p) => (p.$accent ? tkn('colors.sidebar.background')(p) : tkn('colors.landing.onAccent')(p))};
  padding: ${(p) => (p.$lg ? '0.95rem 1.8rem' : '0.75rem 1.5rem')};
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  transition:
    background 160ms ease,
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 160ms ease;

  svg {
    transition: transform 160ms ease;
  }

  &:hover {
    background: ${(p) =>
      p.$accent
        ? `color-mix(in srgb, ${tkn('colors.landing.accentAmber')(p)} 88%, white)`
        : tkn('colors.brand.primaryHover')(p)};
    transform: translateY(-2px);
    box-shadow: ${tkn('colors.landing.shadowStrong')};
  }

  &:hover svg {
    transform: translateX(3px);
  }

  &:active {
    transform: translateY(0);
  }
`;

/** Secondary CTA. `$onDark` = outline on the navy band; default = light surface. */
export const GhostButton = styled.button<{ $lg?: boolean; $onDark?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: ${(p) =>
    p.$onDark
      ? `color-mix(in srgb, ${tkn('colors.surface.primary')(p)} 92%, transparent)`
      : tkn('colors.surface.primary')(p)};
  border: 1px solid ${tkn('colors.landing.heroBorder')};
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: ${(p) => (p.$lg ? '1.0625rem' : TYPE.body)};
  font-weight: 600;
  color: ${tkn('colors.landing.heroText')};
  padding: ${(p) => (p.$lg ? '0.95rem 1.7rem' : '0.75rem 1.5rem')};
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  transition:
    border-color 160ms ease,
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 160ms ease,
    background 160ms ease;

  &:hover {
    border-color: ${tkn('colors.landing.cardBorderHover')};
    background: ${tkn('colors.surface.primary')};
    transform: translateY(-2px);
    box-shadow: ${tkn('colors.landing.shadowStrong')};
  }

  &:active {
    transform: translateY(0);
  }
`;

/** Trust microcopy under the CTAs — two muted lines, as on sellerboard. */
export const HeroNote = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-top: ${tkn('spacing.xs')};
`;

export const HeroNoteLine = styled.div`
  margin: 0;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  color: ${tkn('colors.sidebar.textMuted')};

  svg {
    color: ${tkn('colors.landing.accentAmber')};
  }
`;

/** Below 1080px the offer placard is hidden, so the offer rides under the CTAs instead. */
export const MobileOffer = styled.div`
  display: none;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 1rem;
  border-radius: ${tkn('radius.lg')};
  border: 1px solid color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 45%, transparent);
  background: color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 10%, transparent);
  font-family: ${FONT_BODY};
  color: ${tkn('colors.sidebar.text')};

  @media (max-width: 1080px) {
    display: inline-flex;
  }
`;

export const MobileOfferTag = styled.span`
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.03em;
  color: ${tkn('colors.landing.accentAmber')};
`;

export const MobileOfferPrice = styled.span`
  font-family: ${FONT_HEADING};
  font-size: 1.25rem;
  font-weight: 800;
`;

/* ── Hero product preview — a real demo-account screenshot, flat ─────────── */

export const HeroPreview = styled.div`
  position: relative;
  isolation: isolate;
  width: 100%;
  max-width: 40rem;
  margin-top: -2rem;
  justify-self: end;
  animation: ${riseIn} 900ms cubic-bezier(0.16, 1, 0.3, 1) 200ms both;

  /* A large soft light behind the frame so the screenshot floats on the navy. */
  &::before {
    content: '';
    position: absolute;
    inset: -20% -16% -26% -16%;
    z-index: -1;
    pointer-events: none;
    background:
      radial-gradient(38% 40% at 16% 88%, color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 30%, transparent) 0%, transparent 70%),
      radial-gradient(42% 46% at 30% 30%, ${tkn('colors.landing.heroGlow')} 0%, transparent 72%),
      radial-gradient(40% 40% at 80% 20%, color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 18%, transparent) 0%, transparent 72%);
    filter: blur(30px);
  }

  ${REDUCED} {
    animation: none;
  }

  @media (max-width: 980px) {
    max-width: 32rem;
    margin: 0 auto;
    justify-self: center;

    &::before {
      opacity: 0.5;
    }
  }
`;

/** Glass frame with a blue → amber hairline. Lifts a few pixels on hover. */
export const HeroPreviewGlass = styled.div`
  position: relative;
  z-index: 1;
  padding: 0.7rem;
  border-radius: calc(${tkn('radius.xl')} + 0.5rem);
  background:
    linear-gradient(
        160deg,
        color-mix(in srgb, ${tkn('colors.sidebar.hover')} 55%, transparent),
        color-mix(in srgb, ${tkn('colors.sidebar.background')} 42%, transparent)
      )
      padding-box,
    linear-gradient(
        135deg,
        color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 85%, transparent) 0%,
        color-mix(in srgb, ${tkn('colors.landing.onAccent')} 30%, transparent) 46%,
        color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 80%, transparent) 100%
      )
      border-box;
  border: 1.5px solid transparent;
  backdrop-filter: blur(12px);
  box-shadow:
    0 40px 90px -34px rgba(0, 0, 0, 0.6),
    0 0 64px -18px color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 50%, transparent);
  transition: transform 500ms cubic-bezier(0.22, 1, 0.36, 1);

  &:hover {
    transform: translateY(-4px);
  }

  ${REDUCED} {
    transition: none;
    &:hover {
      transform: none;
    }
  }
`;

export const HeroPreviewImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
  border-radius: ${tkn('radius.xl')};
`;

/**
 * A real crop of one KPI card from the same demo screenshot (never fabricated
 * numbers), over the frame's LEFT edge; drifts a few pixels, out of phase with
 * the offer placard.
 */
export const HeroFloatCard = styled.div`
  position: absolute;
  top: 34%;
  left: -2.25rem;
  width: 10.25rem;
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.55);
  z-index: 2;
  animation: ${floatY} 7s ease-in-out -2.5s infinite;

  ${REDUCED} {
    animation: none;
  }

  @media (max-width: 1080px) {
    display: none;
  }
`;

export const HeroFloatImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
`;

/**
 * The offer placard — price and trial in ONE frosted card with an amber rim,
 * straddling the screenshot's top-right corner. The amount comes from the
 * catalog's cheapest paid tier (see the container), never from copy. Its
 * wrapper carries the gentle drift so the corner offset stays a plain 2D one.
 */
export const HeroOfferCard = styled.div`
  position: absolute;
  top: -4.25rem;
  right: -5.5rem;
  z-index: 3;
  width: 20rem;
  animation: ${floatY} 6s ease-in-out infinite;

  ${REDUCED} {
    animation: none;
  }

  @media (max-width: 1280px) {
    right: -2rem;
  }

  @media (max-width: 1080px) {
    display: none;
  }
`;

export const HeroOfferInner = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 1.5rem 1.4rem;
  border-radius: 1.5rem;
  background:
    linear-gradient(
        160deg,
        color-mix(in srgb, ${tkn('colors.sidebar.hover')} 70%, transparent),
        color-mix(in srgb, ${tkn('colors.landing.auroraBg')} 88%, transparent)
      )
      padding-box,
    linear-gradient(
        135deg,
        color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 70%, white) 0%,
        ${tkn('colors.landing.accentAmber')} 28%,
        color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 25%, transparent) 55%,
        ${tkn('colors.landing.accentAmber')} 80%,
        color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 70%, white) 100%
      )
      border-box;
  border: 2px solid transparent;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow:
    0 30px 60px -18px rgba(0, 0, 0, 0.75),
    0 0 36px -8px color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 40%, transparent);
`;

/** Amber pill riding the placard's top edge. Solid fill, no gloss. */
export const HeroOfferTag = styled.span`
  display: inline-block;
  margin-top: -1.1rem;
  margin-bottom: 1.1rem;
  padding: 0.5rem 1.35rem;
  border-radius: 999px;
  white-space: nowrap;
  background: ${tkn('colors.landing.accentAmber')};
  box-shadow: 0 10px 22px -8px color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 75%, transparent);
  font-family: ${FONT_HEADING};
  font-size: 0.9375rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: ${tkn('colors.sidebar.background')};
`;

export const HeroOfferPrice = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
`;

export const HeroOfferAmount = styled.span`
  font-family: ${FONT_HEADING};
  font-size: 4rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  color: ${tkn('colors.sidebar.text')};
`;

export const HeroOfferPer = styled.span`
  font-family: ${FONT_HEADING};
  font-size: 1.35rem;
  font-weight: 800;
  color: ${tkn('colors.landing.accentAmber')};
`;

export const HeroOfferCaption = styled.span`
  margin-top: 0.55rem;
  font-family: ${FONT_BODY};
  font-size: 0.8125rem;
  font-weight: 500;
  line-height: 1.3;
  color: ${tkn('colors.sidebar.textMuted')};
`;

/* =========================================================================
 * Capability marquee — an endless, slow strip of what is automated
 * ========================================================================= */

const marquee = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
`;

export const MarqueeBand = styled.div`
  position: relative;
  overflow: hidden;
  padding: 2.25rem 0 0.5rem;
  mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
  -webkit-mask-image: linear-gradient(90deg, transparent, black 10%, black 90%, transparent);
`;

export const MarqueeTrack = styled.div`
  display: flex;
  width: max-content;
  gap: 0.75rem;
  animation: ${marquee} 55s linear infinite;

  &:hover {
    animation-play-state: paused;
  }

  ${REDUCED} {
    animation: none;
    flex-wrap: wrap;
    width: auto;
    justify-content: center;
  }
`;

export const MarqueeItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.05rem;
  border-radius: 999px;
  white-space: nowrap;
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  font-family: ${FONT_BODY};
  font-size: 0.875rem;
  font-weight: 600;
  color: ${tkn('colors.landing.heroText')};

  svg {
    color: ${tkn('colors.brand.primary')};
  }
`;

/* =========================================================================
 * Proof bar — four verifiable facts, straddling the hero's lower edge
 * ========================================================================= */

export const ProofWrap = styled.div`
  position: relative;
  z-index: 2;
  max-width: ${CONTENT_MAX};
  margin: -3.25rem auto 0;
  padding: 0 ${tkn('spacing.xl')};

  @media (max-width: 980px) {
    padding: 0 ${tkn('spacing.md')};
  }
`;

export const ProofBar = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-radius: 1.25rem;
  background: color-mix(in srgb, ${tkn('colors.surface.primary')} 92%, transparent);
  backdrop-filter: blur(14px);
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  box-shadow:
    0 30px 60px -30px color-mix(in srgb, ${tkn('colors.brand.primary')} 35%, transparent),
    ${tkn('colors.landing.shadowSoft')};
  overflow: hidden;

  @media (max-width: 820px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const ProofItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 1.35rem 1.5rem;
  border-left: 1px solid ${tkn('colors.landing.cardBorder')};

  &:first-of-type {
    border-left: none;
  }

  @media (max-width: 820px) {
    padding: 1.1rem 1.15rem;

    &:nth-of-type(3) {
      border-left: none;
    }

    &:nth-of-type(n + 3) {
      border-top: 1px solid ${tkn('colors.landing.cardBorder')};
    }
  }
`;

export const ProofValue = styled.span`
  font-family: ${FONT_HEADING};
  font-size: clamp(1.75rem, 2.8vw, 2.35rem);
  font-weight: 800;
  line-height: 1.1;
  letter-spacing: -0.018em;
  color: ${tkn('colors.sidebar.background')};
  font-variant-numeric: tabular-nums;
`;

export const ProofLabel = styled.span`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  line-height: 1.45;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

/* =========================================================================
 * Generic section
 * ========================================================================= */

/**
 * `$tightTop` halves the top padding for a section that follows content of its
 * own rather than opening a new stretch of page. Features is the one case: it
 * sits right under the pillars, which already have bottom padding of their own,
 * and the background change plus border between them is a strong enough
 * separator on its own — a full `SECTION_Y` on top of that stacked into a
 * visible dead gap above the "Features" chip.
 */
export const Section = styled.section<{ $alt?: boolean; $narrow?: boolean; $tightTop?: boolean }>`
  padding: ${(p) => (p.$tightTop ? SECTION_Y_SM : SECTION_Y)} ${tkn('spacing.xl')} ${SECTION_Y};
  background: ${(p) => (p.$alt ? tkn('colors.landing.sectionAlt')(p) : 'transparent')};
  border-top: 1px solid ${(p) => (p.$alt ? tkn('colors.landing.heroBorder')(p) : 'transparent')};
  border-bottom: 1px solid ${(p) => (p.$alt ? tkn('colors.landing.heroBorder')(p) : 'transparent')};

  & > * {
    max-width: ${(p) => (p.$narrow ? NARROW_MAX : CONTENT_MAX)};
    margin-inline: auto;
  }

  @media (max-width: 900px) {
    padding: ${(p) => (p.$tightTop ? tkn('spacing.xxl')(p) : SECTION_Y_SM)} ${tkn('spacing.md')}
      ${SECTION_Y_SM};
  }
`;

export const SectionHead = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.md')};
`;

/**
 * Section h2. Capped at ~42px (was sellerboard's 48px): the 2026-09-27 titles
 * are full sentences that argue a point, and at 48px they broke into three
 * lines and shouted.
 */
export const SectionTitle = styled.h2`
  margin: 0;
  max-width: 48rem;
  font-family: ${FONT_HEADING};
  font-size: clamp(1.9rem, 3.4vw, 2.75rem);
  line-height: 1.12;
  letter-spacing: -0.018em;
  font-weight: 800;
  color: ${tkn('colors.landing.heroText')};
  text-wrap: balance;
`;

export const SectionSubtitle = styled.p`
  margin: 0;
  max-width: 42rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.lead};
  line-height: 1.65;
  color: ${tkn('colors.landing.heroTextMuted')};
  text-wrap: pretty;
`;

/** Small label above a section title — one short phrase, brand-coloured. */
export const Eyebrow = styled.span`
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 0.45rem;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  background: ${tkn('colors.landing.chipBg')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  font-family: ${FONT_BODY};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: ${tkn('colors.brand.primary')};

  &::before {
    content: '';
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 50%;
    background: ${tkn('colors.landing.accentAmber')};
  }
`;

/** Left-aligned variant of `SectionHead`, for split layouts. */
export const SplitHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  text-align: left;
`;

/* =========================================================================
 * Why SellerHill — bento grid of the differentiators
 *
 * The competitors' pages list the same automation set; this grid is where the
 * page stops listing and starts arguing. Each card carries a small, static,
 * token-drawn visual rather than a screenshot, so the claim is legible at a
 * glance and nothing on the grid animates.
 * ========================================================================= */

export const Bento = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
  margin-top: ${tkn('spacing.xl')};

  @media (max-width: 980px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

export const BentoCard = styled.article<{ $span?: 2 | 3; $dark?: boolean }>`
  position: relative;
  overflow: hidden;
  isolation: isolate;
  grid-column: span ${(p) => p.$span ?? 1};
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.85rem;
  border-radius: 1.4rem;
  background: ${(p) =>
    p.$dark
      ? tkn('colors.sidebar.background')(p)
      : `linear-gradient(180deg, ${tkn('colors.surface.primary')(p)}, color-mix(in srgb, ${tkn('colors.landing.sectionAlt')(p)} 70%, ${tkn('colors.surface.primary')(p)}))`};
  border: 1px solid ${(p) => (p.$dark ? tkn('colors.sidebar.divider')(p) : tkn('colors.landing.cardBorder')(p))};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  min-width: 0;
  transition:
    transform 300ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 300ms ease,
    border-color 300ms ease;

  /* A soft colour field that brightens on hover. */
  &::before {
    content: '';
    position: absolute;
    z-index: -1;
    width: 22rem;
    height: 22rem;
    right: -8rem;
    top: -10rem;
    border-radius: 50%;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, ${(p) => (p.$dark ? tkn('colors.landing.accentAmber')(p) : tkn('colors.brand.primary')(p))} ${(p) => (p.$dark ? '30%' : '12%')}, transparent),
      transparent
    );
    opacity: 0.8;
    transition: opacity 300ms ease, transform 500ms ease;
  }

  &:hover {
    transform: translateY(-4px);
    border-color: ${(p) => (p.$dark ? tkn('colors.sidebar.textMuted')(p) : tkn('colors.landing.cardBorderHover')(p))};
    box-shadow: 0 30px 60px -30px color-mix(in srgb, ${tkn('colors.brand.primary')} 40%, transparent);
  }

  &:hover::before {
    opacity: 1;
    transform: scale(1.15);
  }

  @media (max-width: 980px) {
    grid-column: span ${(p) => Math.min(p.$span ?? 1, 2)};
  }

  @media (max-width: 680px) {
    grid-column: span 1;
    padding: 1.4rem;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }
`;

export const BentoIcon = styled.span<{ $dark?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 0.85rem;
  background: ${(p) =>
    p.$dark
      ? `color-mix(in srgb, ${tkn('colors.landing.accentAmber')(p)} 16%, transparent)`
      : `color-mix(in srgb, ${tkn('colors.brand.primary')(p)} 9%, transparent)`};
  color: ${(p) => (p.$dark ? tkn('colors.landing.accentAmber')(p) : tkn('colors.brand.primary')(p))};
  border: 1px solid
    ${(p) =>
      p.$dark
        ? `color-mix(in srgb, ${tkn('colors.landing.accentAmber')(p)} 30%, transparent)`
        : `color-mix(in srgb, ${tkn('colors.brand.primary')(p)} 16%, transparent)`};
`;

export const BentoTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
`;

export const ExclusiveBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  background: color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 18%, transparent);
  color: ${tkn('colors.landing.accentAmber')};
  font-family: ${FONT_BODY};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  white-space: nowrap;
`;

export const BentoTitle = styled.h3<{ $dark?: boolean }>`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.3;
  color: ${(p) => (p.$dark ? tkn('colors.sidebar.text')(p) : tkn('colors.landing.heroText')(p))};
`;

export const BentoText = styled.p<{ $dark?: boolean }>`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: 0.9375rem;
  line-height: 1.65;
  color: ${(p) => (p.$dark ? tkn('colors.sidebar.textMuted')(p) : tkn('colors.landing.heroTextMuted')(p))};
`;

/** The visual sits at the bottom of the card so text heights never misalign it. */
export const BentoVisual = styled.div`
  margin-top: auto;
  padding-top: 0.5rem;
`;

/* Setting-groups visual — three groups, each with its own margin/buffer/template. */
export const GroupRows = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;

  @media (max-width: 680px) {
    grid-template-columns: 1fr;
  }
`;

export const GroupRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.9rem;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.sidebar.hover')};
  border: 1px solid ${tkn('colors.sidebar.divider')};
`;

export const GroupRowName = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: ${FONT_BODY};
  font-size: 0.875rem;
  font-weight: 700;
  color: ${tkn('colors.sidebar.text')};
`;

export const GroupRowStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
`;

export const GroupStat = styled.span`
  padding: 0.15rem 0.5rem;
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.sidebar.background')};
  font-family: ${FONT_BODY};
  font-size: 0.75rem;
  font-weight: 600;
  color: ${tkn('colors.landing.accentAmber')};
`;


/* Sync visual — a 24-hour rail with four checks on it. */
export const SyncRail = styled.div`
  position: relative;
  container-type: inline-size;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  padding-top: 1.6rem;

  &::before {
    content: '';
    position: absolute;
    top: 0.45rem;
    left: 0;
    right: 0;
    height: 2px;
    border-radius: 2px;
    background: linear-gradient(
      90deg,
      color-mix(in srgb, ${tkn('colors.brand.primary')} 25%, transparent),
      ${tkn('colors.brand.primary')}
    );
  }

  /* A light pulse travelling the rail — "a check is always on its way". */
  &::after {
    content: '';
    position: absolute;
    top: 0.2rem;
    left: 0;
    width: 3.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, ${tkn('colors.brand.primary')} 70%, transparent),
      transparent
    );
    animation: ${railPulse} 4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
  }

  ${REDUCED} {
    &::after {
      display: none;
    }
  }
`;

export const SyncTick = styled.span`
  position: relative;
  font-family: ${FONT_BODY};
  font-size: 0.75rem;
  font-weight: 600;
  color: ${tkn('colors.landing.heroTextMuted')};

  &::before {
    content: '';
    position: absolute;
    top: -1.52rem;
    left: 0;
    width: 0.85rem;
    height: 0.85rem;
    border-radius: 50%;
    background: ${tkn('colors.surface.primary')};
    border: 3px solid ${tkn('colors.brand.primary')};
    animation: ${tickRing} 4s ease-out infinite;
  }

  &:nth-of-type(2)::before {
    animation-delay: 1s;
  }
  &:nth-of-type(3)::before {
    animation-delay: 2s;
  }
  &:nth-of-type(4)::before {
    animation-delay: 3s;
  }

  ${REDUCED} {
    &::before {
      animation: none;
    }
  }
`;

export const VisualCaption = styled.span`
  display: block;
  margin-top: 0.75rem;
  font-family: ${FONT_BODY};
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${tkn('colors.brand.primary')};
`;

/* Item-specifics visual — "theirs" vs "ours". A comparison table, styled as one:
 * a quiet header row, hairline rows, and the winning column carried by a tinted
 * lane rather than by colour on every cell. Rows fade in one after another. */
const specRowIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: none; }
`;

export const SpecTable = styled.div`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr) minmax(0, 1fr);
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  font-family: ${FONT_BODY};
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;

  @media (max-width: 420px) {
    font-size: 0.7rem;
  }
`;

export const SpecCell = styled.span<{ $head?: boolean; $muted?: boolean; $good?: boolean; $row?: number }>`
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  min-width: 0;
  padding: ${(p) => (p.$head ? '0.6rem 0.75rem' : '0.62rem 0.75rem')};
  border-top: 1px solid ${tkn('colors.landing.cardBorder')};
  background: ${(p) =>
    p.$good
      ? `color-mix(in srgb, ${tkn('colors.semantic.success')(p)} 8%, transparent)`
      : p.$head
        ? tkn('colors.landing.sectionAlt')(p)
        : 'transparent'};
  font-size: ${(p) => (p.$head ? '0.66rem' : 'inherit')};
  letter-spacing: ${(p) => (p.$head ? '0.08em' : 'normal')};
  text-transform: ${(p) => (p.$head ? 'uppercase' : 'none')};
  font-weight: ${(p) => (p.$head ? 700 : p.$good ? 600 : 500)};
  color: ${(p) =>
    p.$head
      ? tkn('colors.text.tertiary')(p)
      : p.$muted
        ? tkn('colors.text.tertiary')(p)
        : p.$good
          ? tkn('colors.semantic.success')(p)
          : tkn('colors.landing.heroText')(p)};
  text-decoration: ${(p) => (p.$muted ? 'line-through' : 'none')};
  text-decoration-color: color-mix(in srgb, ${tkn('colors.semantic.error')} 55%, transparent);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  animation: ${specRowIn} 500ms cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: ${(p) => `${(p.$row ?? 0) * 110}ms`};
  animation-play-state: ${(p) => (p.$row === undefined ? 'paused' : 'running')};

  &:nth-of-type(-n + 3) {
    border-top: none;
  }

  @media (max-width: 420px) {
    padding: 0.55rem 0.5rem;
  }

  ${REDUCED} {
    animation: none;
  }
`;

/* Pending-actions visual — three rows with a severity dot and a count. */
export const ActionRows = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
`;

export const ActionRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.7rem;
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  background: ${tkn('colors.landing.sectionAlt')};
  font-family: ${FONT_BODY};
  font-size: 0.8125rem;
  color: ${tkn('colors.landing.heroText')};

  span:nth-of-type(2) {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

export const SeverityDot = styled.span<{ $level: 'critical' | 'warning' | 'info' }>`
  flex-shrink: 0;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: ${(p) =>
    p.$level === 'critical'
      ? tkn('colors.semantic.error')(p)
      : p.$level === 'warning'
        ? tkn('colors.semantic.warning')(p)
        : tkn('colors.semantic.info')(p)};
  ${(p) =>
    p.$level === 'critical'
      ? css`
          animation: ${dotPulse} 2s ease-out infinite;
        `
      : undefined}

  ${REDUCED} {
    animation: none;
  }
`;

export const ActionCount = styled.span`
  flex-shrink: 0;
  min-width: 1.4rem;
  padding: 0 0.35rem;
  border-radius: 999px;
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  text-align: center;
  font-size: 0.75rem;
  font-weight: 700;
`;

/* Supplier visual — three chips. */
export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
`;

export const Chip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.7rem;
  border-radius: 999px;
  background: ${tkn('colors.landing.chipBg')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  font-family: ${FONT_BODY};
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${tkn('colors.brand.primary')};
`;

/* Price strip — the full-width closing card of the grid. */
export const PriceStrip = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.lg')};

  @media (max-width: 680px) {
    flex-direction: column;
    align-items: flex-start;
  }
`;

export const PriceStripCopy = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  max-width: 46rem;
`;

/* =========================================================================
 * Setting Groups spotlight
 * ========================================================================= */

export const GroupsLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
  gap: ${tkn('spacing.xxl')};
  align-items: center;

  @media (max-width: 940px) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.xl')};
  }
`;

export const ParamGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.5rem;
  margin-top: ${tkn('spacing.sm')};

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

export const ParamItem = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem;
  align-items: start;
`;

export const ParamIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.landing.chipBg')};
  color: ${tkn('colors.brand.primary')};
`;

export const ParamTitle = styled.h3`
  margin: 0 0 0.1rem;
  font-family: ${FONT_BODY};
  font-size: 1rem;
  font-weight: 700;
  color: ${tkn('colors.landing.heroText')};
`;

export const ParamText = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: 0.875rem;
  line-height: 1.55;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

/** Real screenshot of the "All groups" drawer — tall, so it is capped and cropped from the top. */
export const ScreenFrame = styled.figure`
  position: relative;
  isolation: isolate;
  margin: 0;
  padding: 0.45rem;
  border-radius: 1.4rem;
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  box-shadow: 0 40px 80px -40px color-mix(in srgb, ${tkn('colors.brand.primary')} 45%, transparent);

  /* Colour glow behind the frame so the capture sits in light, not on paper. */
  &::before {
    content: '';
    position: absolute;
    z-index: -1;
    inset: 12% -6% -8% 8%;
    border-radius: 2rem;
    background: color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 22%, transparent);
    filter: blur(40px);
    opacity: 0.5;
  }
`;

export const ScreenImage = styled.img<{ $maxHeight?: string }>`
  display: block;
  width: 100%;
  height: ${(p) => p.$maxHeight ?? 'auto'};
  object-fit: cover;
  object-position: top;
  border-radius: ${tkn('radius.xl')};
  border: 1px solid ${tkn('colors.border.secondary')};

  /* On a phone a whole desktop screen shrinks past legibility. Show its
   * top-left corner larger instead — the part that names the screen. */
  @media (max-width: 640px) {
    height: ${(p) => p.$maxHeight ?? '19rem'};
    object-position: top left;
  }
`;

export const ScreenCaption = styled.figcaption`
  padding: 0.6rem 0.4rem 0.2rem;
  text-align: center;
  font-family: ${FONT_BODY};
  font-size: 0.8125rem;
  color: ${tkn('colors.text.tertiary')};
`;

export const ExamplesTitle = styled.span`
  display: block;
  margin: ${tkn('spacing.xl')} 0 ${tkn('spacing.sm')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  font-weight: 700;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

export const ExampleGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
  }
`;

export const ExampleCard = styled.div`
  display: flex;
  gap: 0.85rem;
  padding: 1.1rem 1.2rem;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
`;

export const ExampleName = styled.span`
  display: block;
  font-family: ${FONT_BODY};
  font-size: 0.9375rem;
  font-weight: 700;
  color: ${tkn('colors.landing.heroText')};
`;

export const ExampleNote = styled.span`
  display: block;
  margin-top: 0.15rem;
  font-family: ${FONT_BODY};
  font-size: 0.8125rem;
  line-height: 1.55;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

/* =========================================================================
 * Templates gallery — real templates, rendered by the production renderer
 * ========================================================================= */

export const TemplatesLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  gap: ${tkn('spacing.xxl')};
  align-items: start;
  margin-top: ${tkn('spacing.xl')};

  /* Grid items default to min-width: auto, so the horizontally scrolling tab
   * row below 940px would otherwise widen its column past the viewport. */
  & > * {
    min-width: 0;
  }

  @media (max-width: 940px) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.lg')};
  }
`;

/**
 * Tabs + selling points. On one column it dissolves (`display: contents`) so the
 * preview can sit directly under the tabs that switch it, points after.
 */
export const TemplateSide = styled.div`
  @media (max-width: 940px) {
    display: contents;
  }
`;

export const TemplateTabs = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.35rem;

  @media (max-width: 940px) {
    min-width: 0;
    display: flex;
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 0.25rem;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
    }
  }
`;

export const TemplateTab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-width: 0;
  padding: 0.65rem 0.85rem;
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${(p) => (p.$active ? tkn('colors.landing.chipBorder')(p) : 'transparent')};
  background: ${(p) => (p.$active ? tkn('colors.surface.primary')(p) : 'transparent')};
  box-shadow: ${(p) => (p.$active ? tkn('colors.landing.shadowSoft')(p) : 'none')};
  cursor: pointer;
  text-align: left;
  font-family: ${FONT_BODY};
  font-size: 0.875rem;
  font-weight: ${(p) => (p.$active ? 700 : 500)};
  color: ${(p) => (p.$active ? tkn('colors.brand.primary')(p) : tkn('colors.landing.heroTextMuted')(p))};
  transition:
    background 160ms ease,
    color 160ms ease;

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }

  @media (max-width: 940px) {
    width: auto;
    flex-shrink: 0;
    white-space: nowrap;
    border-radius: 999px;
    padding: 0.5rem 0.95rem;
    border-color: ${(p) => (p.$active ? tkn('colors.landing.chipBorder')(p) : tkn('colors.landing.cardBorder')(p))};
    background: ${tkn('colors.surface.primary')};

    svg {
      display: none;
    }
  }
`;

export const TemplatePoints = styled.ul`
  margin: ${tkn('spacing.lg')} 0 0;

  @media (max-width: 940px) {
    order: 3;
    margin: 0;
  }

  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
`;

export const TemplatePoint = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  font-family: ${FONT_BODY};
  font-size: 0.9375rem;
  line-height: 1.55;
  color: ${tkn('colors.landing.heroText')};

  svg {
    flex-shrink: 0;
    margin-top: 0.2rem;
    color: ${tkn('colors.semantic.success')};
  }
`;

export const TemplatePreview = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs+')};
  padding: ${tkn('spacing.xs+')};
  border-radius: ${tkn('radius.2xl')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};

  @media (max-width: 940px) {
    order: 2;
  }
`;

/** Label + "open full page" link above the live template. */
export const TemplateBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: 0.15rem 0.35rem 0;
`;

export const PreviewBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: ${FONT_BODY};
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${tkn('colors.landing.heroTextMuted')};

  svg {
    color: ${tkn('colors.semantic.success')};
  }
`;

export const TemplateOpenLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  padding: 0.4rem 0.8rem;
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  font-family: ${FONT_BODY};
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${tkn('colors.brand.primary')};
  text-decoration: none;
  transition:
    border-color 160ms ease,
    background 160ms ease;

  &:hover {
    border-color: ${tkn('colors.landing.cardBorderHover')};
    background: ${tkn('colors.landing.chipBg')};
  }

  &:focus-visible {
    outline: 2px solid ${tkn('colors.brand.primary')};
    outline-offset: 2px;
  }
`;

/**
 * The template itself — its real HTML, not a picture of it. Being an iframe,
 * the template's own CSS runs at the frame's width, so on a phone it lays out
 * exactly as it would in the eBay app. The visitor scrolls inside the frame.
 */
export const TemplateFrame = styled.iframe`
  display: block;
  width: 100%;
  height: 34rem;
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.xl')};
  background: ${tkn('colors.surface.primary')};

  @media (max-width: 940px) {
    height: 30rem;
  }
`;

/* =========================================================================
 * Showcase — real screens, alternating sides
 * ========================================================================= */

export const ShowcaseList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5rem;
  margin-top: ${tkn('spacing.xl')};

  @media (max-width: 940px) {
    gap: 3.5rem;
  }
`;

export const ShowcaseRow = styled.div<{ $reversed?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  gap: ${tkn('spacing.xxl')};
  align-items: center;

  & > :first-of-type {
    order: ${(p) => (p.$reversed ? 2 : 1)};
  }

  & > :last-of-type {
    order: ${(p) => (p.$reversed ? 1 : 2)};
  }

  @media (max-width: 940px) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.lg')};

    & > :first-of-type {
      order: 1;
    }

    & > :last-of-type {
      order: 2;
    }
  }
`;

export const ShowcaseCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const ShowcaseTitle = styled.h3`
  margin: 0;
  font-family: ${FONT_HEADING};
  font-size: clamp(1.4rem, 2.2vw, 1.75rem);
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.015em;
  color: ${tkn('colors.landing.heroText')};
`;

export const ShowcaseText = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: 1rem;
  line-height: 1.7;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

export const KeyPoint = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  padding: 0.85rem 1.1rem;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.landing.chipBg')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  font-family: ${FONT_BODY};
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.5;
  color: ${tkn('colors.landing.heroText')};

  svg {
    flex-shrink: 0;
    margin-top: 0.15rem;
    color: ${tkn('colors.brand.primary')};
  }
`;

/* =========================================================================
 * Mobile — a navy band with three real phone captures
 * ========================================================================= */

export const DarkSection = styled.section`
  position: relative;
  overflow: hidden;
  padding: ${SECTION_Y} ${tkn('spacing.xl')};
  background: ${tkn('colors.sidebar.background')};

  @media (max-width: 900px) {
    padding: ${SECTION_Y_SM} ${tkn('spacing.md')};
  }
`;

export const MobileLayout = styled.div`
  position: relative;
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: ${tkn('spacing.xxl')};
  align-items: center;

  @media (max-width: 940px) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.xl')};
  }
`;

export const DarkEyebrow = styled(Eyebrow)`
  color: ${tkn('colors.landing.accentAmber')};
`;

export const DarkTitle = styled.h2`
  margin: 0;
  font-family: ${FONT_HEADING};
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  line-height: 1.17;
  letter-spacing: -0.015em;
  font-weight: 700;
  color: ${tkn('colors.sidebar.text')};
  text-wrap: balance;
`;

export const DarkText = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: 1.0625rem;
  line-height: 1.65;
  color: ${tkn('colors.sidebar.textMuted')};
`;

export const DarkBullets = styled.ul`
  margin: ${tkn('spacing.xs')} 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
`;

export const DarkBullet = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 0.55rem;
  font-family: ${FONT_BODY};
  font-size: 0.9375rem;
  line-height: 1.55;
  color: ${tkn('colors.sidebar.text')};

  svg {
    flex-shrink: 0;
    margin-top: 0.2rem;
    color: ${tkn('colors.landing.accentEmerald')};
  }
`;

export const Phones = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 1.25rem;
`;

export const Phone = styled.figure<{ $raised?: boolean }>`
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.7rem;
  width: 13.5rem;
  transform: translateY(${(p) => (p.$raised ? '-1.75rem' : '0')});

  @media (max-width: 1080px) {
    width: 11.5rem;
  }

  @media (max-width: 680px) {
    display: ${(p) => (p.$raised ? 'flex' : 'none')};
    width: 15rem;
    transform: none;
  }
`;

export const PhoneBezel = styled.div`
  width: 100%;
  padding: 0.45rem;
  border-radius: 2.1rem;
  background: ${tkn('colors.landing.auroraBg')};
  border: 1px solid ${tkn('colors.sidebar.divider')};
  box-shadow: 0 30px 60px -30px ${tkn('colors.landing.auroraBg')};
`;

export const PhoneScreen = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 390 / 844;
  object-fit: cover;
  object-position: top;
  border-radius: 1.7rem;
`;

export const PhoneLabel = styled.figcaption`
  font-family: ${FONT_BODY};
  font-size: 0.8125rem;
  font-weight: 600;
  color: ${tkn('colors.sidebar.textMuted')};
`;

/* =========================================================================
 * Trust — privacy facts, each a card, with the legal documents one click away
 * ========================================================================= */

export const TrustGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.25rem;
  margin-top: ${tkn('spacing.xl')};

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const TrustCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 1.6rem;
  border-radius: ${tkn('radius.xl')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
`;

export const TrustIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: color-mix(in srgb, ${tkn('colors.semantic.success')} 12%, transparent);
  color: ${tkn('colors.semantic.success')};
`;

export const TrustLinks = styled.div`
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: ${tkn('spacing.lg')};
`;

export const TextLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: none;
  border: none;
  padding: 0.25rem 0.5rem;
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: 0.9375rem;
  font-weight: 600;
  color: ${tkn('colors.brand.primary')};

  &:hover {
    text-decoration: underline;
  }
`;

/* =========================================================================
 * Standard features — compact icon grid
 * ========================================================================= */

export const StandardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1.75rem 1.5rem;
  margin-top: ${tkn('spacing.xl')};

  @media (max-width: 980px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

export const StandardItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

export const StandardIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  margin-bottom: 0.25rem;
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.landing.chipBg')};
  color: ${tkn('colors.brand.primary')};
`;

/* =========================================================================
 * Profit section — the differentiator, so it gets a real split layout
 * ========================================================================= */

export const SplitLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: ${tkn('spacing.xxl')};
  /* Top-aligned, not centred: the right column's tab panel is a fixed height,
   * but keeping this \`center\` meant any height difference between the columns
   * nudged the copy on the left up and down. */
  align-items: start;

  @media (max-width: 940px) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.xl')};
  }
`;

export const SplitCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  text-align: left;
`;

/** Sub-hero headline tier (profit + demo bands). */
export const SplitTitle = styled.h2`
  margin: 0;
  font-family: ${FONT_HEADING};
  font-size: clamp(1.75rem, 3vw, 2.5rem);
  line-height: 1.12;
  letter-spacing: -0.018em;
  font-weight: 800;
  color: ${tkn('colors.landing.heroText')};
  text-wrap: balance;
`;

export const SplitSubtitle = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.lead};
  line-height: 1.6;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

export const ProfitList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  margin-top: ${tkn('spacing.xs')};
`;

export const ProfitItem = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: ${tkn('spacing.sm')};
  align-items: start;
`;

export const ProfitItemIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.landing.chipBg')};
  color: ${tkn('colors.brand.primary')};
`;

export const ProfitItemTitle = styled.h3`
  margin: 0 0 0.125rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.cardSm};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const ProfitItemText = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  line-height: 1.75;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

/** Houses the Overview / P&L / Per order pill tabs above the profit visual. */
export const ProfitTabsWrap = styled.div`
  margin-bottom: ${tkn('spacing.md')};
`;

/**
 * Fixed-height frame for the profit-tab screenshots. Same idea as the Features
 * section: cap the height and crop the screenshot from the top with
 * \`object-fit: cover\`, so every tab renders the panel at the exact same size
 * and switching tabs swaps the image in place — no vertical jump, no page
 * below being shoved around.
 */
export const ProfitPreviewFrame = styled.div`
  padding: ${tkn('spacing.xs+')};
  border-radius: ${tkn('radius.2xl')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  overflow: hidden;
`;

export const ProfitPreviewImage = styled.img`
  display: block;
  width: 100%;
  height: 26rem;
  object-fit: cover;
  object-position: top left;
  border-radius: ${tkn('radius.xl')};
  border: 1px solid ${tkn('colors.border.secondary')};
  animation: profitPreviewFade 260ms cubic-bezier(0.16, 1, 0.3, 1);

  @keyframes profitPreviewFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @media (max-width: 940px) {
    height: 20rem;
  }
`;

/* =========================================================================
 * Steps
 * ========================================================================= */

/**
 * Five steps, so the track minimum is narrower than the three-step version it
 * replaced (16rem): at 16rem the grid fits four across and orphans the fifth on
 * a row of its own. 12.5rem lets all five sit on one line at desktop width and
 * still reflows to 3 / 2 / 1 as the viewport narrows.
 */
export const Steps = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12.5rem, 1fr));
  gap: ${tkn('spacing.md')};
`;

export const StepCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.lg')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
`;

export const StepNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 0.8rem;
  background: ${tkn('colors.sidebar.background')};
  color: ${tkn('colors.sidebar.text')};
  font-family: ${FONT_HEADING};
  font-size: ${TYPE.body};
  font-weight: 800;
  margin-bottom: 0.25rem;
  box-shadow: 0 10px 22px -10px color-mix(in srgb, ${tkn('colors.brand.primary')} 70%, transparent);
`;

export const StepTitle = styled.h3`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.cardMd};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const StepDesc = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  line-height: 1.75;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

/* =========================================================================
 * Demo band — the "try before you sign up" surface
 * ========================================================================= */

export const DemoBand = styled.div`
  position: relative;
  overflow: hidden;
  isolation: isolate;
  border-radius: 1.75rem;
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  padding: ${tkn('spacing.xxl')};
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: ${tkn('spacing.xxl')};
  align-items: center;

  /* Soft aurora + dot texture — the light-surface echo of the hero. */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      radial-gradient(30rem 18rem at 100% 0%, color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 16%, transparent), transparent 70%),
      radial-gradient(26rem 16rem at 0% 100%, color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 12%, transparent), transparent 70%),
      radial-gradient(color-mix(in srgb, ${tkn('colors.brand.primary')} 10%, transparent) 1px, transparent 1.4px) 0 0 / 22px 22px;
  }

  @media (max-width: 940px) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.lg')};
    padding: ${tkn('spacing.xl')} ${tkn('spacing.lg')};
  }
`;

/** A screenshot tile that behaves like a video thumbnail: the whole tile opens the demo. */
export const DemoPreview = styled.button`
  position: relative;
  display: block;
  width: 100%;
  padding: 0;
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  border-radius: ${tkn('radius.xl')};
  overflow: hidden;
  cursor: pointer;
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  transition: transform 400ms ease, box-shadow 400ms ease;

  &:hover {
    transform: translateY(-4px);
  }

  &:focus-visible {
    outline: 2px solid ${tkn('colors.brand.primary')};
    outline-offset: 3px;
  }

  img {
    display: block;
    width: 100%;
    height: 15rem;
    object-fit: cover;
    object-position: top left;
  }

  ${REDUCED} {
    transform: none;
    transition: none;
    &:hover {
      transform: none;
    }
  }
`;

export const DemoPlay = styled.span`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, transparent 30%, color-mix(in srgb, ${tkn('colors.sidebar.background')} 35%, transparent));

  & > span {
    width: 4.25rem;
    height: 4.25rem;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${tkn('colors.landing.onAccent')};
    background: ${tkn('colors.brand.primary')};
    box-shadow:
      0 0 0 10px color-mix(in srgb, ${tkn('colors.surface.primary')} 45%, transparent),
      0 18px 40px -12px color-mix(in srgb, ${tkn('colors.brand.primary')} 70%, transparent);
    animation: ${breathe} 2.4s ease-in-out infinite;
  }

  ${REDUCED} {
    & > span {
      animation: none;
    }
  }
`;

export const DemoCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  text-align: left;
  position: relative;
`;

export const DemoBullets = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
`;

export const DemoBullet = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  line-height: 1.6;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

export const DemoActions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};
  position: relative;

  @media (max-width: 940px) {
    align-items: stretch;
  }
`;

export const DemoNote = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  color: ${tkn('colors.text.tertiary')};
`;

/* =========================================================================
 * Pricing
 * ========================================================================= */

export const PricingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(17.5rem, 1fr));
  gap: ${tkn('spacing.lg')};
  align-items: stretch;
`;

/** Row holding the "show all plans" expander under the pricing grid. */
export const PricingExpandRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${tkn('spacing.lg')};
`;

/**
 * Expander that reveals the rest of the catalog in place. The full plan list
 * lives behind auth at /billing, so a visitor has to be able to see every tier
 * without leaving this page.
 */
export const PricingExpandButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding: 0.625rem 1.25rem;
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  border-radius: 999px;
  background: ${tkn('colors.surface.primary')};
  color: ${tkn('colors.brand.primary')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  font-weight: 600;
  cursor: pointer;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease;

  &:hover {
    border-color: ${tkn('colors.landing.cardBorderHover')};
    box-shadow: ${tkn('colors.landing.shadowSoft')};
  }

  &:focus-visible {
    outline: 2px solid ${tkn('colors.brand.primary')};
    outline-offset: 2px;
  }
`;

export const PricingCard = styled.div<{ $highlight?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.xl')} ${tkn('spacing.lg')} ${tkn('spacing.lg')};
  border-radius: 1.4rem;
  border: 1.5px solid transparent;
  background: ${(p) =>
    p.$highlight
      ? `linear-gradient(${tkn('colors.surface.primary')(p)}, ${tkn('colors.surface.primary')(p)}) padding-box, linear-gradient(${tkn('colors.brand.primary')(p)}, ${tkn('colors.brand.primary')(p)}) border-box`
      : `linear-gradient(${tkn('colors.surface.primary')(p)}, ${tkn('colors.surface.primary')(p)}) padding-box, linear-gradient(${tkn('colors.landing.cardBorder')(p)}, ${tkn('colors.landing.cardBorder')(p)}) border-box`};
  box-shadow: ${(p) =>
    p.$highlight
      ? `0 40px 80px -40px color-mix(in srgb, ${tkn('colors.brand.primary')(p)} 55%, transparent)`
      : tkn('colors.landing.shadowSoft')(p)};
  transform: ${(p) => (p.$highlight ? 'translateY(-6px)' : 'none')};
  text-align: left;
  transition: transform 300ms ease, box-shadow 300ms ease;

  &:hover {
    transform: translateY(${(p) => (p.$highlight ? '-10px' : '-4px')});
  }
`;

export const PlanBadge = styled.span`
  position: absolute;
  top: -0.8rem;
  left: ${tkn('spacing.lg')};
  padding: 0.3rem 0.85rem;
  border-radius: 999px;
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.landing.onAccent')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: 700;
  letter-spacing: 0.02em;
  box-shadow: 0 8px 20px -8px color-mix(in srgb, ${tkn('colors.brand.primary')} 80%, transparent);
`;

export const PlanName = styled.h3`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.cardMd};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const PlanPrice = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
`;

/** Pricing figure — the headline face, tabular digits. */
export const PlanAmount = styled.span`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.price};
  font-weight: 700; /* sellerboard's "bold" is a literal 700; our app's own bold token has since softened to 600 */
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: ${tkn('colors.landing.heroText')};
`;

export const PlanPeriod = styled.span`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  color: ${tkn('colors.text.tertiary')};
`;

export const PlanDesc = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  line-height: 1.6;
  color: ${tkn('colors.landing.heroTextMuted')};
  min-height: 2.75rem;
`;

export const PlanFeatures = styled.ul`
  margin: ${tkn('spacing.sm')} 0 ${tkn('spacing.lg')};
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  flex: 1;
`;

/** `$strong` is the card's lead promise (unlimited automatic orders and tracking) — full ink, heavier weight. */
export const PlanFeature = styled.li<{ $strong?: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  line-height: 1.55;
  font-weight: ${(p) => (p.$strong ? tkn('typography.fontWeight.bold')(p) : 'inherit')};
  color: ${(p) => (p.$strong ? tkn('colors.landing.heroText')(p) : tkn('colors.landing.heroTextMuted')(p))};
`;

export const PlanCta = styled.button<{ $highlight?: boolean }>`
  width: 100%;
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  padding: 0.75rem 1.25rem;
  border-radius: ${tkn('radius.md')};
  transition:
    background 140ms ease,
    border-color 140ms ease,
    transform 140ms ease;
  background: ${(p) => (p.$highlight ? tkn('colors.brand.primary')(p) : 'transparent')};
  color: ${(p) => (p.$highlight ? tkn('colors.landing.onAccent')(p) : tkn('colors.landing.heroText')(p))};
  border: 1px solid
    ${(p) => (p.$highlight ? tkn('colors.brand.primary')(p) : tkn('colors.landing.heroBorder')(p))};

  &:hover {
    transform: translateY(-1px);
    background: ${(p) => (p.$highlight ? tkn('colors.brand.primaryHover')(p) : tkn('colors.landing.chipBg')(p))};
    border-color: ${(p) =>
      p.$highlight ? tkn('colors.brand.primaryHover')(p) : tkn('colors.landing.cardBorderHover')(p)};
  }
`;

export const BillingNote = styled.p`
  margin: ${tkn('spacing.lg')} auto 0;
  text-align: center;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  color: ${tkn('colors.text.tertiary')};
`;

export const CatalogError = styled.p`
  margin: 0 auto ${tkn('spacing.lg')};
  text-align: center;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  color: ${tkn('colors.text.tertiary')};
`;

/* =========================================================================
 * FAQ
 * ========================================================================= */

export const FaqList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const FaqItem = styled.div<{ $open: boolean }>`
  border-radius: ${tkn('radius.lg')};
  border: 1px solid
    ${(p) => (p.$open ? tkn('colors.landing.chipBorder')(p) : tkn('colors.landing.cardBorder')(p))};
  background: ${tkn('colors.surface.primary')};
  overflow: hidden;
  transition: border-color 160ms ease;
`;

export const FaqQuestion = styled.button<{ $open: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.cardSm};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${(p) => (p.$open ? tkn('colors.brand.primary')(p) : tkn('colors.landing.heroText')(p))};

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const FaqAnswer = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${(p) => (p.$open ? '1fr' : '0fr')};
  transition: grid-template-rows 240ms cubic-bezier(0.22, 1, 0.36, 1);
`;

export const FaqAnswerText = styled.div`
  overflow: hidden;

  & > p {
    margin: 0;
    padding: 0 ${tkn('spacing.lg')} ${tkn('spacing.md')};
    font-family: ${FONT_BODY};
    font-size: ${TYPE.body};
    line-height: 1.75;
    color: ${tkn('colors.landing.heroTextMuted')};
  }
`;

/* =========================================================================
 * Final CTA
 * ========================================================================= */

export const CtaBanner = styled.div`
  position: relative;
  overflow: hidden;
  isolation: isolate;
  border-radius: 1.75rem;
  padding: 4.5rem ${tkn('spacing.xxl')};
  text-align: center;
  background: ${tkn('colors.sidebar.background')};
  border: 1px solid ${tkn('colors.sidebar.divider')};
  box-shadow: 0 50px 100px -50px color-mix(in srgb, ${tkn('colors.brand.primary')} 60%, transparent);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.md')};

  /* Aurora + dot texture, same language as the hero. */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background:
      radial-gradient(40rem 20rem at 15% 0%, color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 45%, transparent), transparent 70%),
      radial-gradient(34rem 20rem at 90% 100%, color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 30%, transparent), transparent 70%),
      radial-gradient(color-mix(in srgb, ${tkn('colors.sidebar.text')} 12%, transparent) 1px, transparent 1.4px) 0 0 / 24px 24px;
  }

  @media (max-width: 900px) {
    padding: ${tkn('spacing.xxl')} ${tkn('spacing.lg')};
  }
`;

export const CtaTitle = styled.h2`
  margin: 0;
  max-width: 40rem;
  font-family: ${FONT_HEADING};
  font-size: clamp(1.9rem, 3.6vw, 2.9rem);
  line-height: 1.12;
  letter-spacing: -0.018em;
  font-weight: 800;
  color: ${tkn('colors.sidebar.text')};
  text-wrap: balance;
`;

export const CtaSub = styled.p`
  margin: 0;
  max-width: 38rem;
  font-family: ${FONT_BODY};
  font-size: 1.0625rem;
  line-height: 1.65;
  color: ${tkn('colors.sidebar.textMuted')};
`;

/** Inverted primary: white pill on the gradient band. */
export const CtaButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: ${tkn('spacing.xs')};
  background: ${tkn('colors.landing.accentAmber')};
  border: none;
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: 1.0625rem;
  font-weight: 700;
  color: ${tkn('colors.sidebar.background')};
  padding: 1rem 2rem;
  border-radius: 0.8rem;
  box-shadow: 0 14px 34px -10px color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 70%, transparent);
  transition: transform 180ms ease;

  &:hover {
    transform: translateY(-2px);
  }
`;

/* =========================================================================
 * Footer
 * ========================================================================= */

export const Footer = styled.footer`
  background: ${tkn('colors.sidebar.background')};
  border-top: 1px solid ${tkn('colors.sidebar.divider')};
  padding: ${tkn('spacing.xxl')} ${tkn('spacing.xl')} ${tkn('spacing.lg')};

  @media (max-width: 900px) {
    padding: ${tkn('spacing.xl')} ${tkn('spacing.md')} ${tkn('spacing.lg')};
  }
`;

export const FooterInner = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 2fr);
  gap: ${tkn('spacing.xxl')};

  @media (max-width: 820px) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.xl')};
  }
`;

export const FooterBrand = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};
`;

export const FooterDescription = styled.p`
  margin: 0;
  max-width: 22rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  line-height: 1.65;
  color: ${tkn('colors.sidebar.textMuted')};
`;

export const FooterColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: ${tkn('spacing.lg')};
`;

export const FooterColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.625rem;
`;

export const FooterColTitle = styled.h4`
  margin: 0 0 0.25rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.sidebar.text')};
`;

export const FooterLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  color: ${tkn('colors.sidebar.textMuted')};
  transition: color 140ms ease;

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const FooterContactText = styled.address`
  margin: 0;
  font-style: normal;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  line-height: 1.6;
  overflow-wrap: anywhere;
  color: ${tkn('colors.sidebar.textMuted')};
`;

export const FooterContactLink = styled.a`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  overflow-wrap: anywhere;
  color: ${tkn('colors.sidebar.textMuted')};
  text-decoration: none;
  transition: color 140ms ease;

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const FooterDivider = styled.div`
  max-width: ${CONTENT_MAX};
  margin: ${tkn('spacing.xl')} auto ${tkn('spacing.md')};
  height: 1px;
  background: ${tkn('colors.sidebar.divider')};
`;

export const FooterBottom = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const Copyright = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  color: ${tkn('colors.sidebar.textMuted')};
`;

/* ── About ─────────────────────────────────────────── */

export const AboutLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: ${tkn('spacing.xxl')};
  align-items: center;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.xl')};
  }
`;

export const AboutText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const AboutTitle = styled(SectionTitle)`
  text-align: left;
`;

export const AboutLead = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.lead};
  line-height: 1.6;
  font-weight: 600;
  color: ${tkn('colors.landing.heroText')};
`;

export const AboutCompany = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.xs')};
  font-family: ${FONT_BODY};
  font-size: 0.875rem;
  line-height: 1.5;
  color: ${tkn('colors.landing.heroTextMuted')};

  svg {
    flex-shrink: 0;
    margin-top: 0.15rem;
    color: ${tkn('colors.brand.primary')};
  }
`;

export const AboutFacts = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const AboutFact = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};
  padding: 1.35rem 1.5rem;
  border-radius: ${tkn('radius.xl')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};

  h3 {
    font-size: 1.0625rem;
    margin-bottom: 0.3rem;
  }
`;

export const AboutFactIcon = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: ${tkn('radius.lg')};
  background: color-mix(in srgb, ${tkn('colors.brand.primary')} 10%, transparent);
  color: ${tkn('colors.brand.primary')};
`;
