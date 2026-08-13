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
 * reads tokens rather than literals — the landing carries its own theme
 * toggle, so a hardcoded colour would simply break in dark mode.
 * ========================================================================= */

const CONTENT_MAX = '1180px';
const NARROW_MAX = '900px';

/** Section rhythm. One value, so no section invents its own vertical spacing. */
const SECTION_Y = '7.5rem';
const SECTION_Y_SM = '4.5rem';

/*
 * Sellerboard's own fonts, loaded as extra families in `index.html` alongside
 * the app's Inter/Lexend (see the Google Fonts `<link>` there) — landing is
 * the one surface that deliberately does NOT use the app's type system.
 * Montserrat Bold is sellerboard's headline face (h1 56px, h2 48px, h3 40px);
 * Poppins is everything else (body, nav, buttons, card titles, the pricing
 * figure). Sizes below are copied from sellerboard.com/tr's live computed
 * styles, not our app's own (smaller) type scale — do not "fix" them to
 * match `typographyTokens`, that would undo the point of this file.
 */
const FONT_HEADING =
  "'Montserrat', Verdana, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const FONT_BODY =
  "'Poppins', Verdana, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** Sellerboard-matched type scale (px, as rem @ 16px root). */
const TYPE = {
  h1: '3.5rem' /* 56px */,
  h2: '3rem' /* 48px */,
  h3: '2.5rem' /* 40px */,
  cardLg: '1.5rem' /* 24px */,
  cardMd: '1.25rem' /* 20px */,
  cardSm: '1.125rem' /* 18px */,
  price: '2rem' /* 32px */,
  lead: '1.25rem' /* 20px */,
  body: '1rem' /* 16px */,
  small: '0.875rem' /* 14px */,
  micro: '0.8125rem' /* 13px */,
};

export const Reveal = styled.div<{ $visible: boolean; $delay?: number }>`
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? '0' : '18px')})
    scale(${(p) => (p.$visible ? '1' : '0.985')});
  filter: blur(${(p) => (p.$visible ? '0' : '2px')});
  transition:
    opacity 700ms cubic-bezier(0.16, 1, 0.3, 1),
    transform 700ms cubic-bezier(0.16, 1, 0.3, 1),
    filter 700ms cubic-bezier(0.16, 1, 0.3, 1);
  transition-delay: ${(p) => (p.$delay ? `${p.$delay * 80}ms` : '0ms')};
  will-change: opacity, transform, filter;

  @media (prefers-reduced-motion: reduce) {
    opacity: 1;
    transform: none;
    filter: none;
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
  padding: 0.875rem ${tkn('spacing.xl')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};

  @media (max-width: 1080px) {
    padding: 0.75rem ${tkn('spacing.md')};
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
 * Scrolls horizontally instead of wrapping when the row is tight — same
 * principle as \`TabNav\`. Flexbox's default \`flex-shrink: 1\` on the nav
 * buttons let the browser compress them below their text's natural width
 * (with \`white-space\` left at its default \`normal\`), which wrapped
 * "Nasıl çalışır" and "Giriş yap" onto two lines instead of just tightening
 * the row. \`min-width: 0\` is required for a flex child to be allowed to
 * shrink/scroll at all — without it this ignores overflow and pushes the
 * pinned \`NavActions\` off the row instead.
 */
export const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 0.125rem;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;

  &::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: 960px) {
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
  font-size: ${TYPE.small};
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
  font-size: ${TYPE.small};
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
  font-size: ${TYPE.small};
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
  gap: ${tkn('spacing.2xs')};
  background: none;
  border: ${(p) => (p.$block ? `1px solid ${tkn('colors.landing.heroBorder')(p)}` : 'none')};
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
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

  @media (max-width: 960px) {
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
  font-size: ${TYPE.small};
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

  @media (max-width: 960px) {
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

  @media (max-width: 960px) {
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

export const MobileMenu = styled.div<{ $open: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 61;
  width: min(20rem, 86vw);
  background: ${tkn('colors.landing.heroBg')};
  border-left: 1px solid ${tkn('colors.landing.heroBorder')};
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  transform: translateX(${(p) => (p.$open ? '0' : '100%')});
  transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
`;

export const MobileMenuHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const MobileClose = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  background: none;
  border: 1px solid ${tkn('colors.landing.heroBorder')};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.landing.heroText')};
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
  cursor: pointer;
  text-align: left;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.landing.heroText')};
  padding: 0.75rem;
  border-radius: ${tkn('radius.md')};

  &:hover {
    background: ${tkn('colors.landing.chipBg')};
  }
`;

export const MobileCtas = styled.div`
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

/* =========================================================================
 * Hero
 * ========================================================================= */

/**
 * Sellerboard-format hero: a full-bleed dark-navy band (the "üst taraf mavi"
 * — top part blue), fading into the page's own light background at the
 * bottom ("alt beyaz" — bottom white). \`colors.sidebar.background\` is
 * reused rather than a new landing token — same deep blue in the light
 * theme / near-black in the dark theme as the app's own sidebar, so the
 * hero and the real product screenshot floating inside it read as one
 * consistent brand colour instead of two unrelated blues.
 */
export const Hero = styled.section`
  position: relative;
  background: ${tkn('colors.sidebar.background')};
  padding: 9.5rem ${tkn('spacing.xl')} ${SECTION_Y};
  overflow: hidden;

  @media (max-width: 980px) {
    padding: 7.5rem ${tkn('spacing.md')} ${SECTION_Y_SM};
  }
`;

/**
 * Layered colour wash behind the hero.
 *
 * This replaced a visible square grid (two repeating 1px linear-gradients).
 * A ruled grid is a stock landing-page motif and at this scale it read as
 * graph paper sitting behind the headline — the single most amateur thing on
 * the page. Offset radial washes give depth without drawing anything the eye
 * can resolve as a pattern. The fourth, cooler wash at the bottom-right keeps
 * the preview frame from sitting on a flat field.
 */
export const HeroGlow = styled.div`
  position: absolute;
  inset: -38% -16% auto -16%;
  height: 62rem;
  pointer-events: none;
  background:
    radial-gradient(48rem 32rem at 16% 14%, ${tkn('colors.landing.heroGlow')} 0%, transparent 70%),
    radial-gradient(44rem 30rem at 84% 6%, ${tkn('colors.landing.heroGlowAlt')} 0%, transparent 72%),
    radial-gradient(36rem 26rem at 72% 48%, ${tkn('colors.landing.heroGlowAlt')} 0%, transparent 68%),
    radial-gradient(64rem 28rem at 48% 46%, ${tkn('colors.landing.heroGlow')} 0%, transparent 78%);
  opacity: 0.95;
`;

/** Left content / right screenshot split — sellerboard's asymmetric hero, not a centered block. */
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
    gap: ${tkn('spacing.xl')};
  }
`;

export const HeroContent = styled.div`
  max-width: 34rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};
`;

export const Eyebrow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  align-self: center;
  padding: 0.4rem 0.95rem;
  border-radius: 999px;
  background: ${tkn('colors.landing.chipBg')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  letter-spacing: 0.03em;
  color: ${tkn('colors.brand.primary')};
`;

/** Matches sellerboard's h1 exactly: Montserrat 700, 56px, 1.14 line-height. */
export const HeroTitle = styled.h1`
  margin: 0;
  font-family: ${FONT_HEADING};
  font-size: clamp(2.5rem, 4.2vw, ${TYPE.h1});
  line-height: 1.14;
  letter-spacing: -0.02em;
  font-weight: 700; /* sellerboard's "bold" is a literal 700; our app's own bold token has since softened to 600 */
  color: ${tkn('colors.sidebar.text')};
  text-wrap: balance;
`;

/** Matches sellerboard's lead paragraph: Poppins 400, 20px, 1.6 line-height. */
export const HeroSubtitle = styled.p`
  margin: 0;
  max-width: 30rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.lead};
  line-height: 1.6;
  color: ${tkn('colors.sidebar.textMuted')};
  text-wrap: pretty;
`;

export const HeroCtas = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: ${tkn('spacing.sm')};
`;

/**
 * \`$accent\` swaps to an amber-fill/navy-text pill — used for the Hero's
 * primary CTA. Matches sellerboard's own orange primary button, and reuses
 * the exact amber \`HillAccent\` is set in ("hill" in the SellerHill
 * wordmark) so the CTA and the logo read as the same brand color. A
 * blue-on-blue button would otherwise barely separate from the dark-navy
 * hero. Every other usage sits on a light surface, where the default
 * blue-fill/white-text reads normally.
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
  font-size: ${(p) => (p.$lg ? TYPE.cardSm : TYPE.body)};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${(p) => (p.$accent ? tkn('colors.sidebar.background')(p) : tkn('colors.landing.onAccent')(p))};
  padding: ${(p) => (p.$lg ? '0.95rem 1.85rem' : '0.75rem 1.5rem')};
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  transition:
    background 160ms ease,
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 160ms ease;

  &:hover {
    background: ${(p) =>
      p.$accent ? tkn('colors.landing.accentAmber')(p) : tkn('colors.brand.primaryHover')(p)};
    transform: translateY(-2px);
    box-shadow: ${tkn('colors.landing.shadowStrong')};
  }

  &:active {
    transform: translateY(0);
  }
`;

export const GhostButton = styled.button<{ $lg?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: color-mix(in srgb, ${tkn('colors.surface.primary')} 88%, transparent);
  border: 1px solid ${tkn('colors.landing.heroBorder')};
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: ${(p) => (p.$lg ? TYPE.cardSm : TYPE.body)};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
  padding: ${(p) => (p.$lg ? '0.95rem 1.85rem' : '0.75rem 1.5rem')};
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  backdrop-filter: blur(8px);
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

/** Mirrors sellerboard's trial note under the primary CTA: a bold title line + muted detail lines below it. */
export const HeroNote = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: ${tkn('spacing.xs')};
`;

export const HeroNoteTitle = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.sidebar.text')};
`;

export const HeroNoteLine = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  color: ${tkn('colors.sidebar.textMuted')};
`;

/* =========================================================================
 * Hero product preview — a real screenshot (from the sign-up-free demo
 * account), not a hand-drawn mockup, floating on the dark hero exactly like
 * sellerboard's own dashboard screenshot. \`PreviewFrame\`/\`PreviewBar\`/
 * \`PreviewDot\`/\`PreviewUrl\`/\`PreviewImage\` below are shared with the
 * Features and Profit sections further down the page — every screenshot on
 * the site reads as one consistent browser-chrome "window".
 * ========================================================================= */

export const HeroPreview = styled.div`
  position: relative;
  width: 100%;
  max-width: 40rem;
  margin-top: -2.75rem;

  @media (max-width: 980px) {
    max-width: 30rem;
    margin: 0 auto;
  }
`;

/**
 * The floating stat-card overlay — sellerboard's "Month to date" card
 * overlapping the top-right corner of its dashboard screenshot. Ours is a
 * real crop of one KPI card from the same demo screenshot (never a second,
 * fabricated set of numbers), clipped to a rounded rect so the crop's own
 * square corners disappear under this wrapper's radius.
 */
export const HeroFloatCard = styled.div`
  position: absolute;
  top: -1.75rem;
  right: -1.25rem;
  width: 12.5rem;
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  z-index: 2;

  @media (max-width: 980px) {
    display: none;
  }
`;

export const HeroFloatImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
`;

export const PreviewFrame = styled.div`
  border-radius: ${tkn('radius.xl')};
  border: 1px solid ${tkn('colors.landing.heroBorder')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  overflow: hidden;
  text-align: left;
`;

/**
 * A real product screenshot (from the sign-up-free demo account) inside the
 * same browser-chrome frame as the hand-drawn hero preview — reused by the
 * profit and features sections so every screenshot on the page reads as one
 * consistent "window", not a mixed bag of raw images.
 */
export const PreviewImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
`;

export const PreviewBar = styled.div`
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 0.875rem;
  background: ${tkn('colors.background.tertiary')};
  border-bottom: 1px solid ${tkn('colors.landing.heroBorder')};
`;

export const PreviewDot = styled.span<{ $c: 'error' | 'warning' | 'success' }>`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${(p) => tkn(`colors.semantic.${p.$c}` as 'colors.semantic.error')(p)};
  opacity: 0.65;
`;

export const PreviewUrl = styled.span`
  margin-left: 0.5rem;
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
  font-family: ${tkn('typography.fontFamily.mono')};
`;

/* =========================================================================
 * Flow strip + pillars
 * ========================================================================= */

export const FlowStrip = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  padding: 0 ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.md')};

  @media (max-width: 900px) {
    padding: 0 ${tkn('spacing.md')};
  }
`;

export const FlowLabel = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: ${tkn('colors.text.tertiary')};
`;

export const FlowRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
`;

export const FlowChip = styled.div<{ $accent?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1.125rem;
  border-radius: 999px;
  border: 1px solid
    ${(p) => (p.$accent ? tkn('colors.landing.chipBorder')(p) : tkn('colors.landing.heroBorder')(p))};
  background: ${(p) => (p.$accent ? tkn('colors.landing.chipBg')(p) : tkn('colors.surface.primary')(p))};
  color: ${(p) => (p.$accent ? tkn('colors.brand.primary')(p) : tkn('colors.landing.heroText')(p))};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
`;

export const FlowArrow = styled.span`
  display: inline-flex;
  color: ${tkn('colors.text.tertiary')};
`;

export const Pillars = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  padding: ${SECTION_Y_SM} ${tkn('spacing.xl')} 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: ${tkn('spacing.lg')};

  @media (max-width: 900px) {
    padding: ${tkn('spacing.xxl')} ${tkn('spacing.md')} 0;
  }
`;

export const Pillar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-left: ${tkn('spacing.md')};
  border-left: 2px solid ${tkn('colors.brand.primary')};
`;

export const PillarTitle = styled.h3`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.cardMd};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const PillarText = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  line-height: 1.75;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

/* =========================================================================
 * Generic section
 * ========================================================================= */

export const Section = styled.section<{ $alt?: boolean; $narrow?: boolean }>`
  padding: ${SECTION_Y} ${tkn('spacing.xl')};
  background: ${(p) => (p.$alt ? tkn('colors.landing.sectionAlt')(p) : 'transparent')};
  border-top: 1px solid ${(p) => (p.$alt ? tkn('colors.landing.heroBorder')(p) : 'transparent')};
  border-bottom: 1px solid ${(p) => (p.$alt ? tkn('colors.landing.heroBorder')(p) : 'transparent')};

  & > * {
    max-width: ${(p) => (p.$narrow ? NARROW_MAX : CONTENT_MAX)};
    margin-inline: auto;
  }

  @media (max-width: 900px) {
    padding: ${SECTION_Y_SM} ${tkn('spacing.md')};
  }
`;

export const SectionHead = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.xxl')};
`;

/** Matches sellerboard's h2 exactly: Montserrat 700, 48px, 1.17 line-height. */
export const SectionTitle = styled.h2`
  margin: 0;
  max-width: 40rem;
  font-family: ${FONT_HEADING};
  font-size: clamp(2rem, 3.6vw, ${TYPE.h2});
  line-height: 1.17;
  letter-spacing: -0.015em;
  font-weight: 700; /* sellerboard's "bold" is a literal 700; our app's own bold token has since softened to 600 */
  color: ${tkn('colors.landing.heroText')};
  text-wrap: balance;
`;

export const SectionSubtitle = styled.p`
  margin: 0;
  max-width: 40rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.lead};
  line-height: 1.65;
  color: ${tkn('colors.landing.heroTextMuted')};
  text-wrap: pretty;
`;

/* =========================================================================
 * Features
 * ========================================================================= */

/**
 * Sellerboard-style tabbed deep-dive: a vertical list of features on the
 * left, a detail panel (copy + a real screenshot from the demo account) on
 * the right — replaces the old static 6-card grid, which could only show a
 * one-line description per feature.
 */
export const FeatureTabsLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 17.5rem) minmax(0, 1fr);
  gap: ${tkn('spacing.xl')};
  align-items: start;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const FeatureTabList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;

  @media (max-width: 900px) {
    flex-direction: row;
    flex-wrap: wrap;
  }
`;

export const FeatureTabButton = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  width: 100%;
  text-align: left;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  border: 1px solid ${(p) => (p.$active ? tkn('colors.brand.primary')(p) : 'transparent')};
  background: ${(p) => (p.$active ? tkn('colors.landing.chipBg')(p) : 'transparent')};
  cursor: pointer;
  transition:
    background 140ms ease,
    border-color 140ms ease;

  &:hover {
    background: ${tkn('colors.landing.chipBg')};
  }

  @media (max-width: 900px) {
    width: auto;
  }
`;

export const FeatureTabIconWrap = styled.span<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border-radius: ${tkn('radius.md')};
  background: ${(p) => (p.$active ? tkn('colors.brand.primary')(p) : tkn('colors.surface.primary')(p))};
  border: 1px solid
    ${(p) => (p.$active ? tkn('colors.brand.primary')(p) : tkn('colors.landing.chipBorder')(p))};
  color: ${(p) => (p.$active ? tkn('colors.landing.onAccent')(p) : tkn('colors.brand.primary')(p))};
`;

export const FeatureTabLabel = styled.span<{ $active: boolean }>`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  font-weight: ${(p) =>
    p.$active ? tkn('typography.fontWeight.semibold')(p) : tkn('typography.fontWeight.medium')(p)};
  color: ${(p) => (p.$active ? tkn('colors.landing.heroText')(p) : tkn('colors.landing.heroTextMuted')(p))};
`;

export const FeatureDetail = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const FeatureDetailHead = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};
`;

export const FeatureDetailIconWrap = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  flex-shrink: 0;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.landing.chipBg')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
`;

export const FeatureDetailBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
`;

export const FeatureDetailTitle = styled.h3`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.cardLg};
  font-weight: 700; /* sellerboard's "bold" is a literal 700; our app's own bold token has since softened to 600 */
  color: ${tkn('colors.landing.heroText')};
`;

export const FeatureDetailText = styled.p`
  margin: 0;
  max-width: 38rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  line-height: 1.75;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

/* =========================================================================
 * Profit section — the differentiator, so it gets a real split layout
 * ========================================================================= */

export const SplitLayout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: ${tkn('spacing.xxl')};
  align-items: center;

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

/** Matches sellerboard's sub-hero h3 (e.g. "Doğru kâr panosuyla tanışın"): Montserrat 700, 40px. */
export const SplitTitle = styled.h2`
  margin: 0;
  font-family: ${FONT_HEADING};
  font-size: clamp(1.75rem, 3vw, ${TYPE.h3});
  line-height: 1.15;
  letter-spacing: -0.015em;
  font-weight: 700; /* sellerboard's "bold" is a literal 700; our app's own bold token has since softened to 600 */
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

export const SplitEyebrow = styled.span`
  display: inline-flex;
  align-self: flex-start;
  padding: 0.375rem 0.875rem;
  border-radius: 999px;
  background: ${tkn('colors.landing.chipBg')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.brand.primary')};
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

/** The visual proof: three tiers, one of them deliberately unresolved. */
export const ProfitPanel = styled.div`
  border-radius: ${tkn('radius.xl')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const ProfitPanelTitle = styled.span`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${tkn('colors.text.tertiary')};
`;

export const ProfitTier = styled.div<{ $tone: 'confirmed' | 'estimated' | 'unknown' }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  border: 1px solid
    ${(p) =>
      p.$tone === 'confirmed' ? tkn('colors.semantic.success')(p) : tkn('colors.border.secondary')(p)};
  background: ${(p) =>
    p.$tone === 'confirmed'
      ? tkn('colors.semanticTint.success')(p)
      : tkn('colors.surface.secondary')(p)};
  opacity: ${(p) => (p.$tone === 'unknown' ? 0.75 : 1)};
`;

export const ProfitTierLabel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
`;

export const ProfitTierName = styled.span`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
`;

/** A figure, like sellerboard's price display — Poppins bold, not the Montserrat headline face. */
export const ProfitTierValue = styled.span<{ $muted?: boolean }>`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.cardLg};
  font-weight: 700; /* sellerboard's "bold" is a literal 700; our app's own bold token has since softened to 600 */
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.015em;
  white-space: nowrap;
  color: ${(p) => (p.$muted ? tkn('colors.text.tertiary')(p) : tkn('colors.text.primary')(p))};
`;

export const ProfitFootnote = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  line-height: 1.55;
  color: ${tkn('colors.text.tertiary')};
`;

/* =========================================================================
 * Per-product control
 * ========================================================================= */

export const ProductGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr));
  gap: ${tkn('spacing.lg')};
`;

export const ProductCard = styled.div`
  border-radius: ${tkn('radius.lg')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  overflow: hidden;
`;

export const ProductName = styled.div`
  padding: ${tkn('spacing.md')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  background: ${tkn('colors.surface.secondary')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.cardSm};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const ProductSettings = styled.div`
  padding: 0.5rem ${tkn('spacing.md')} ${tkn('spacing.sm')};
`;

export const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: 0.625rem 0;
  border-bottom: 1px solid ${tkn('colors.border.secondary')};

  &:last-of-type {
    border-bottom: none;
  }
`;

export const SettingLabel = styled.span`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  color: ${tkn('colors.text.secondary')};
`;

export const SettingValue = styled.span`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-variant-numeric: tabular-nums;
  color: ${tkn('colors.text.primary')};
  text-align: right;
`;

/* =========================================================================
 * Steps
 * ========================================================================= */

export const Steps = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: ${tkn('spacing.lg')};
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
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.landing.onAccent')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  font-weight: 700; /* sellerboard's "bold" is a literal 700; our app's own bold token has since softened to 600 */
  margin-bottom: 0.25rem;
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
  border-radius: ${tkn('radius.xl')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  background: ${tkn('colors.landing.chipBg')};
  padding: ${tkn('spacing.xxl')};
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: ${tkn('spacing.xxl')};
  align-items: center;

  @media (max-width: 940px) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.lg')};
    padding: ${tkn('spacing.xl')} ${tkn('spacing.lg')};
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
  gap: ${tkn('spacing.sm')};
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

export const PricingToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.xl')};
`;

export const PricingSavingsBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem;
  border-radius: 999px;
  background: ${tkn('colors.semanticTint.success')};
  color: ${tkn('colors.semantic.success')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  white-space: nowrap;
`;

export const PlanPeriodNote = styled.span`
  display: block;
  margin-top: 0.125rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  color: ${tkn('colors.text.tertiary')};
`;

export const PricingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(17.5rem, 1fr));
  gap: ${tkn('spacing.lg')};
  align-items: stretch;
`;

export const PricingCard = styled.div<{ $highlight?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.xl')} ${tkn('spacing.lg')} ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.xl')};
  border: 1px solid
    ${(p) => (p.$highlight ? tkn('colors.brand.primary')(p) : tkn('colors.landing.cardBorder')(p))};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${(p) => (p.$highlight ? tkn('colors.landing.shadowStrong')(p) : tkn('colors.landing.shadowSoft')(p))};
  text-align: left;
`;

export const PlanBadge = styled.span`
  position: absolute;
  top: -0.75rem;
  left: ${tkn('spacing.lg')};
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.landing.onAccent')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  letter-spacing: 0.02em;
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

/** Matches sellerboard's price figure ("15$"): Poppins bold, 32px — not the Montserrat headline face. */
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

export const PlanFeature = styled.li`
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.body};
  line-height: 1.55;
  color: ${tkn('colors.landing.heroTextMuted')};
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
  border-radius: ${tkn('radius.xl')};
  padding: ${tkn('spacing.xxl')};
  text-align: center;
  background: ${tkn('colors.landing.heroGradient')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.md')};

  @media (max-width: 900px) {
    padding: ${tkn('spacing.xl')} ${tkn('spacing.lg')};
  }
`;

export const CtaTitle = styled.h2`
  margin: 0;
  max-width: 34rem;
  font-family: ${FONT_HEADING};
  font-size: clamp(1.75rem, 3vw, ${TYPE.h3});
  line-height: 1.18;
  letter-spacing: -0.015em;
  font-weight: 700; /* sellerboard's "bold" is a literal 700; our app's own bold token has since softened to 600 */
  color: ${tkn('colors.landing.onAccent')};
  text-wrap: balance;
`;

export const CtaSub = styled.p`
  margin: 0;
  max-width: 36rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.lead};
  line-height: 1.6;
  color: ${tkn('colors.landing.onAccent')};
  opacity: 0.88;
`;

/** Inverted primary: white pill on the gradient band. */
export const CtaButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  margin-top: ${tkn('spacing.xs')};
  background: ${tkn('colors.landing.onAccent')};
  border: none;
  cursor: pointer;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.cardSm};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.brand.primary')};
  padding: 0.9rem 1.85rem;
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  transition:
    transform 140ms ease,
    box-shadow 140ms ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: ${tkn('colors.landing.shadowStrong')};
  }
`;

/* =========================================================================
 * Footer
 * ========================================================================= */

export const Footer = styled.footer`
  background: ${tkn('colors.landing.sectionDeep')};
  border-top: 1px solid ${tkn('colors.landing.heroBorder')};
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
  color: ${tkn('colors.landing.heroTextMuted')};
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
  color: ${tkn('colors.landing.heroText')};
`;

export const FooterLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  color: ${tkn('colors.landing.heroTextMuted')};
  transition: color 140ms ease;

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const FooterDivider = styled.div`
  max-width: ${CONTENT_MAX};
  margin: ${tkn('spacing.xl')} auto ${tkn('spacing.md')};
  height: 1px;
  background: ${tkn('colors.landing.heroBorder')};
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
  color: ${tkn('colors.text.tertiary')};
`;
