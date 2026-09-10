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
  border: ${(p) => (p.$block ? `1px solid ${tkn('colors.landing.heroBorder')(p)}` : 'none')};
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
  /*
   * The top padding has to clear the fixed navbar (~82px: 1.375rem × 2 plus the
   * 38px logo) and then leave a deliberate gap. 9.5rem left ~70px of empty navy
   * above the eyebrow, which read as a gap rather than as breathing room;
   * 7.5rem leaves ~38px, and 6.5rem ~30px against the shorter mobile navbar.
   */
  padding: 7.5rem ${tkn('spacing.xl')} ${SECTION_Y};
  overflow: hidden;

  @media (max-width: 980px) {
    padding: 6.5rem ${tkn('spacing.md')} ${SECTION_Y_SM};
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

  /* The Audio Spectrum effect */
  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-repeat: no-repeat;
    opacity: 0.5;
    filter: blur(1.5px);
    
    background-image:
      /* Left cluster (behind text) */
      linear-gradient(to top, transparent, #518567, transparent),
      linear-gradient(to top, transparent, #8cb89f, transparent),
      linear-gradient(to top, transparent, #d4a055, transparent),
      linear-gradient(to top, transparent, #518567, transparent),
      linear-gradient(to top, transparent, #8cb89f, transparent),
      linear-gradient(to top, transparent, #518567, transparent),
      linear-gradient(to top, transparent, #8cb89f, transparent),
      linear-gradient(to top, transparent, #d4a055, transparent),
      linear-gradient(to top, transparent, #518567, transparent),
      /* Right cluster (above tablet) */
      linear-gradient(to top, transparent, #8cb89f, transparent),
      linear-gradient(to top, transparent, #518567, transparent),
      linear-gradient(to top, transparent, #d4a055, transparent),
      linear-gradient(to top, transparent, #8cb89f, transparent),
      linear-gradient(to top, transparent, #518567, transparent),
      linear-gradient(to top, transparent, #8cb89f, transparent),
      linear-gradient(to top, transparent, #d4a055, transparent),
      linear-gradient(to top, transparent, #518567, transparent);

    background-size:
      /* Left heights */
      4px 8%, 4px 14%, 4px 9%, 4px 18%, 4px 12%, 4px 7%, 4px 11%, 4px 6%, 4px 9%,
      /* Right heights */
      4px 10%, 4px 16%, 4px 12%, 4px 20%, 4px 14%, 4px 8%, 4px 18%, 4px 10%;
      
    background-position:
      /* Left X/Y */
      30% 65%, 31% 65%, 32% 65%, 33% 65%, 34% 65%, 35% 65%, 36% 65%, 37% 65%, 38% 65%,
      /* Right X/Y */
      62% 25%, 63% 25%, 64% 25%, 65% 25%, 66% 25%, 67% 25%, 68% 25%, 69% 25%;
  }
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

/**
 * The Hero's category line ("Amazon → eBay automation"), above the headline, so
 * a visitor who already knows AutoDS/Easync/Yaballe places the product in the
 * first second rather than inferring it from the subheading. It sits on the dark
 * navy `sidebar.background`, so it uses `sidebar.hover` / `accentAmber` rather
 * than the light chip tokens. This is the only eyebrow left on the page — the
 * section-level ones repeated their own navbar label and were removed.
 */
export const HeroEyebrow = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.4rem 0.95rem;
  border-radius: 999px;
  background: ${tkn('colors.sidebar.hover')};
  border: 1px solid ${tkn('colors.sidebar.divider')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  letter-spacing: 0.03em;
  color: ${tkn('colors.landing.accentAmber')};
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

/**
 * Trust microcopy under the primary CTA — two muted lines only. The trial
 * headline lives in `S.HeroOfferCard` on the screenshot; the price is there too.
 */
export const HeroNote = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin-top: ${tkn('spacing.xs')};
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
 * sellerboard's own dashboard screenshot. \`PreviewFrame\`/\`PreviewImage\`
 * below are shared with the Features and Profit sections further down the
 * page — every screenshot on the site sits in the same matted frame.
 * ========================================================================= */

export const HeroPreview = styled.div`
  position: relative;
  /* Own stacking context, so the \`z-index: -1\` glow below sits behind the
   * frame but cannot escape to behind the whole hero. */
  isolation: isolate;
  width: 100%;
  max-width: 40rem;
  margin-top: -2.75rem;
  
  /* 3D Transform to make the dashboard look like it's turning */
  transform: perspective(1500px) rotateY(-10deg) rotateX(4deg) translateZ(0);
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1);
  
  &:hover {
    transform: perspective(1500px) rotateY(-4deg) rotateX(2deg) translateZ(0);
  }

  /*
   * A large, soft glow bleeding out from behind the frame so the screenshot
   * reads as floating over the navy and catching light — the premium cue
   * sellerboard's own hero has and ours did not. Purely ambient: no shape the
   * eye can resolve, behind the frame (\`z-index: -1\`), and it never reaches the
   * price badge / float card at \`z-index: 2\`.
   */
  &::before {
    content: '';
    position: absolute;
    inset: -20% -16% -26% -16%;
    z-index: -1;
    pointer-events: none;
    background:
      /* Existing glows */
      radial-gradient(38% 40% at 16% 88%, color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 32%, transparent) 0%, transparent 70%),
      radial-gradient(42% 46% at 30% 30%, ${tkn('colors.landing.heroGlow')} 0%, transparent 72%),
      radial-gradient(46% 44% at 76% 66%, ${tkn('colors.landing.heroGlowAlt')} 0%, transparent 74%),
      linear-gradient(122deg, transparent 38%, color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 16%, transparent) 47%, transparent 55%),
      linear-gradient(122deg, transparent 62%, color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 12%, transparent) 70%, transparent 77%);
    filter: blur(30px);
    opacity: 0.9;
  }

  @media (max-width: 980px) {
    max-width: 30rem;
    margin: 0 auto;
    transform: none;
    
    &:hover {
      transform: none;
    }

    &::before {
      opacity: 0.5;
    }
  }
`;

/**
 * The floating stat-card overlay — a real crop of one KPI card from the same
 * demo screenshot (never a second, fabricated set of numbers), clipped to a
 * rounded rect. Sits over the LEFT edge, mid-height: the top-right corner is
 * now the offer module's spot (see `HeroOfferCard`).
 */
export const HeroFloatCard = styled.div`
  position: absolute;
  top: 40%;
  left: -2.25rem;
  transform: translateY(-50%);
  width: 10.25rem;
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  z-index: 2;

  @media (max-width: 1080px) {
    display: none;
  }
`;

export const HeroFloatImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
`;

/* =========================================================================
 * Premium offer module — the price + trial merged into ONE frosted-glass card
 * with a metallic-orange rim, floating over the screenshot's top-right corner
 * (2026-09-09, per the reference mock). Replaces the two separate blue/amber
 * badges. `HeroFloatCard` (the real KPI crop) moved to the left edge to make
 * room. Hidden ≤1080px — the CTA + `HeroNoteLine`s carry the offer there.
 * ========================================================================= */

export const HeroOfferCard = styled.div`
  position: absolute;
  top: 0;
  right: -8rem;
  transform: translateY(-30%) translateZ(80px); /* 30% above the top frame, 70% below */
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  width: 22rem; /* Wider placard style */
  padding: 0 1.5rem 1.5rem; /* No top padding, tag will float over the edge */
  border-radius: 1.5rem;
  
  /* Extremely glassy background with an intense orange/gold glowing rim */
  background:
    linear-gradient(
      135deg, 
      rgba(30, 35, 50, 0.4) 0%, 
      rgba(15, 20, 35, 0.6) 100%
    ) padding-box,
    linear-gradient(
      135deg,
      #ffc77d 0%,
      #c46b27 25%,
      rgba(196, 107, 39, 0.2) 50%,
      #c46b27 75%,
      #ffc77d 100%
    ) border-box;
  border: 2px solid transparent;
  
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  
  box-shadow:
    0 30px 60px -15px rgba(0, 0, 0, 0.8),
    0 0 40px -5px rgba(255, 160, 50, 0.4),
    inset 0 1px 2px rgba(255, 255, 255, 0.4),
    inset 0 -1px 2px rgba(0, 0, 0, 0.5);

  @media (max-width: 1080px) {
    display: none;
  }
`;

/** The intense glowing orange/gold tag popping out of the top */
export const HeroOfferTag = styled.span`
  display: inline-block;
  margin-top: -1.25rem; /* Float over the top edge */
  margin-bottom: 1.25rem;
  padding: 0.5rem 1.5rem;
  border-radius: 2rem; /* Pill shape */
  white-space: nowrap;

  /* Intense 3D glowing orange gradient (Restored to solid color) */
  background: linear-gradient(180deg, #ffc060 0%, #d46b1a 100%);
  border: 1px solid #ffe8b5;
  border-bottom-color: #8c3f05;
  
  box-shadow: 
    0 12px 24px -6px rgba(212, 107, 26, 0.8),
    inset 0 2px 4px rgba(255, 255, 255, 0.6),
    inset 0 -2px 4px rgba(0, 0, 0, 0.3);
  
  font-family: ${FONT_HEADING};
  font-size: 1rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  color: #ffffff;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
`;

export const HeroOfferPrice = styled.span`
  display: inline-flex;
  align-items: baseline;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
`;

export const HeroOfferAmount = styled.span`
  font-family: ${FONT_HEADING};
  font-size: 4.5rem;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.03em;
  
  /* Very bright glowing white/gold text */
  background: linear-gradient(180deg, #ffffff 0%, #ffe4b5 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  color: #ffe4b5; /* fallback */
  
  /* Intense drop shadow on the text itself */
  filter: drop-shadow(0 4px 16px rgba(255, 200, 100, 0.6));
`;

export const HeroOfferPer = styled.span`
  font-family: ${FONT_HEADING};
  font-size: 1.5rem;
  font-weight: 800;
  color: #ffe4b5;
  text-shadow: 0 2px 8px rgba(255, 200, 100, 0.4);
`;

export const HeroOfferCaption = styled.span`
  margin-top: 0.5rem;
  font-family: ${FONT_BODY};
  font-size: 0.8125rem;
  font-weight: ${tkn('typography.fontWeight.medium')};
  line-height: 1.3;
  color: rgba(255, 255, 255, 0.7);
`;

/**
 * Frosted-glass frame for the hero screenshot (2026-09-09, per the reference
 * mock). Not the opaque white mat that was rejected earlier — a thin translucent
 * rim with a blue→amber gradient hairline and a soft blue/amber neon outer glow,
 * so the real screenshot reads as sitting inside a lit glass panel on the navy.
 * The Features screenshots sit in `FeatureMedia`, the Profit tabs in the capped
 * `ProfitPreviewFrame` further down — neither carries this glass treatment.
 */
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
        color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 92%, transparent) 0%,
        color-mix(in srgb, ${tkn('colors.landing.onAccent')} 34%, transparent) 46%,
        color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 85%, transparent) 100%
      )
      border-box;
  border: 1.5px solid transparent;
  backdrop-filter: blur(12px);
  box-shadow:
    ${tkn('colors.landing.shadowStrong')},
    0 40px 90px -34px rgba(0, 0, 0, 0.6),
    0 0 64px -14px color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 60%, transparent),
    0 30px 70px -28px color-mix(in srgb, ${tkn('colors.landing.accentAmber')} 50%, transparent);

  /* A brighter blue neon bloom hugging the bottom-left, per the reference mock. */
  &::after {
    content: '';
    position: absolute;
    left: -8%;
    bottom: -12%;
    width: 55%;
    height: 45%;
    z-index: -1;
    pointer-events: none;
    background: radial-gradient(
      closest-side,
      color-mix(in srgb, ${tkn('colors.landing.accentBlue')} 45%, transparent),
      transparent
    );
    filter: blur(26px);
  }
`;

export const HeroPreviewImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
  border-radius: ${tkn('radius.xl')};
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

/** Matches sellerboard's h2 exactly: Montserrat 700, 48px, 1.17 line-height. */
export const SectionTitle = styled.h2`
  margin: 0;
  max-width: 42rem;
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
  max-width: 42rem;
  font-family: ${FONT_BODY};
  font-size: ${TYPE.lead};
  line-height: 1.65;
  color: ${tkn('colors.landing.heroTextMuted')};
  text-wrap: pretty;
`;

/* =========================================================================
 * Features — Timeline Spine & Zigzag Showcase
 * ========================================================================= */

/** Subtle dashed timeline stem descending from the section header into the timeline spine */
export const SectionTimelineStem = styled.div`
  width: 0;
  height: 4rem;
  margin: ${tkn('spacing.lg')} auto -${tkn('spacing.md')};
  border-left: 2px dashed color-mix(in srgb, ${tkn('colors.brand.primary')} 45%, transparent);
  mask-image: linear-gradient(180deg, transparent 0%, black 25%, black 100%);
  -webkit-mask-image: linear-gradient(180deg, transparent 0%, black 25%, black 100%);

  @media (max-width: 980px) {
    display: none;
  }
`;

/**
 * Zigzag list container with a continuous vertical timeline spine
 * running down the exact horizontal center on desktop.
 */
export const FeatureZigzagList = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 5.5rem;
  margin-top: 0;

  /* Continuous vertical spine connecting all steps */
  &::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 0;
    bottom: 3rem;
    width: 0;
    transform: translateX(-50%);
    border-left: 2px dashed color-mix(in srgb, ${tkn('colors.brand.primary')} 45%, transparent);
    mask-image: linear-gradient(180deg, black 0%, black calc(100% - 3rem), transparent 100%);
    -webkit-mask-image: linear-gradient(180deg, black 0%, black calc(100% - 3rem), transparent 100%);
    z-index: 0;
  }

  @media (max-width: 980px) {
    gap: 4rem;
    margin-top: 1.5rem;

    &::before {
      display: none;
    }
  }
`;

export const FeatureRow = styled.div<{ $reversed?: boolean }>`
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: ${tkn('spacing.xl')};

  ${(p) =>
    p.$reversed &&
    `
    > :nth-of-type(1) {
      grid-column: 3;
      grid-row: 1;
    }
    > :nth-of-type(2) {
      grid-column: 2;
      grid-row: 1;
    }
    > :nth-of-type(3) {
      grid-column: 1;
      grid-row: 1;
    }
  `}

  @media (max-width: 980px) {
    display: flex;
    flex-direction: column;
    gap: ${tkn('spacing.lg')};

    > :nth-of-type(1) {
      order: 1;
    }
    > :nth-of-type(2) {
      display: none;
    }
    > :nth-of-type(3) {
      order: 2;
    }
  }
`;

/** Minimal precision dot sitting quietly on the timeline spine */
export const FeatureTimelineNode = styled.div`
  position: relative;
  z-index: 1;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${tkn('colors.brand.primary')};
  box-shadow:
    0 0 0 4px ${tkn('colors.surface.primary')},
    0 0 0 6px color-mix(in srgb, ${tkn('colors.brand.primary')} 28%, transparent);
  flex-shrink: 0;

  @media (max-width: 980px) {
    display: none;
  }
`;

export const FeatureCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  text-align: left;

  @media (max-width: 980px) {
    order: 2;
  }
`;

export const FeatureBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.85rem;
  border-radius: 999px;
  background: color-mix(in srgb, ${tkn('colors.brand.primary')} 8%, transparent);
  border: 1px solid color-mix(in srgb, ${tkn('colors.brand.primary')} 18%, transparent);
  color: ${tkn('colors.brand.primary')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: ${tkn('typography.fontWeight.bold')};
  letter-spacing: 0.04em;
  width: fit-content;
`;

export const FeatureTitle = styled.h3`
  margin: 0;
  font-family: ${FONT_HEADING};
  font-size: 1.85rem;
  font-weight: 800;
  color: ${tkn('colors.landing.heroText')};
  line-height: 1.25;
  letter-spacing: -0.02em;

  @media (max-width: 640px) {
    font-size: 1.5rem;
  }
`;

export const FeatureDetailText = styled.p`
  margin: 0;
  font-family: ${FONT_BODY};
  font-size: 1rem;
  line-height: 1.7;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

export const FeatureKeyPoint = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.85rem 1.15rem;
  border-radius: ${tkn('radius.lg')};
  background: color-mix(in srgb, ${tkn('colors.brand.primary')} 4%, ${tkn('colors.surface.primary')});
  border: 1px solid color-mix(in srgb, ${tkn('colors.brand.primary')} 14%, transparent);
  color: ${tkn('colors.landing.heroText')};
  font-family: ${FONT_BODY};
  font-size: 0.9375rem;
  font-weight: 500;
  line-height: 1.5;

  svg {
    flex-shrink: 0;
    margin-top: 2px;
    color: ${tkn('colors.brand.primary')};
  }
`;

/**
 * Thin matted frame around the feature screenshot — deliberately the same
 * language as `PreviewFrame` (a hairline mount, a few px of surface, layered
 * soft shadow), not a chunky card. The mat is ~3px so the product fills the
 * frame; depth comes from three stacked shadows (a tight contact line, a soft
 * ambient wash, one wide brand-tinted lift) rather than one blunt drop shadow.
 */
export const FeatureMedia = styled.div`
  position: relative;
  border-radius: ${tkn('radius.2xl')};
  padding: ${tkn('spacing.xs+')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  box-shadow:
    0 1px 2px color-mix(in srgb, ${tkn('colors.text.primary')} 8%, transparent),
    ${tkn('colors.landing.shadowSoft')},
    0 26px 60px -30px color-mix(in srgb, ${tkn('colors.brand.primary')} 22%, transparent);
  transition:
    transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
    box-shadow 0.35s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    transform: translateY(-3px);
    box-shadow:
      0 1px 2px color-mix(in srgb, ${tkn('colors.text.primary')} 10%, transparent),
      ${tkn('colors.landing.shadowStrong')},
      0 34px 72px -32px color-mix(in srgb, ${tkn('colors.brand.primary')} 28%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }
`;

export const FeatureMediaImage = styled.img`
  display: block;
  width: 100%;
  height: auto;
  border-radius: ${tkn('radius.xl')};
  border: 1px solid ${tkn('colors.border.secondary')};
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
  object-position: top;
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
 * Setting Groups — one store, three groups, three template silhouettes
 *
 * The old version was three text tables ("Valentine's Day → Seasonal margin →
 * 2 units"), which named the feature without showing it. This shows it: one
 * store frame holding three mini listing previews, each drawn from a visibly
 * different template and carrying its own margin.
 * ========================================================================= */

export const StoreShowcase = styled.div`
  border-radius: ${tkn('radius.2xl')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  overflow: hidden;
`;

export const StoreShowcaseBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  background: ${tkn('colors.surface.secondary')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: ${tkn('colors.text.tertiary')};

  svg {
    color: ${tkn('colors.brand.primary')};
  }
`;

/** A 1px gap on a divider-coloured field draws the seams between groups. */
export const GroupShowcaseGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  background: ${tkn('colors.border.secondary')};

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const GroupShowcaseCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
`;

export const GroupShowcaseHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.xs')};
`;

export const GroupShowcaseName = styled.span`
  font-family: ${FONT_BODY};
  font-size: ${TYPE.small};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const GroupMarginBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  border-radius: ${tkn('radius.sm')};
  background: color-mix(in srgb, ${tkn('colors.brand.primary')} 12%, transparent);
  color: ${tkn('colors.brand.primary')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  white-space: nowrap;
`;

/** Fixed height so all three template silhouettes line up regardless of shape. */
export const TemplateMock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  height: 9.5rem;
  padding: ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  border: 1px solid ${tkn('colors.border.secondary')};
  background: color-mix(in srgb, ${tkn('colors.brand.primary')} 3%, ${tkn('colors.surface.secondary')});
  overflow: hidden;
`;

export const MockImage = styled.div<{ $tall?: boolean; $sm?: boolean }>`
  border-radius: ${tkn('radius.sm')};
  background: color-mix(in srgb, ${tkn('colors.brand.primary')} 16%, ${tkn('colors.surface.primary')});
  flex: ${(p) => (p.$tall ? '1 1 auto' : '0 0 auto')};
  width: ${(p) => (p.$sm ? '3.25rem' : '100%')};
  height: ${(p) => (p.$sm ? '3.25rem' : 'auto')};
  min-height: ${(p) => (p.$sm ? 'auto' : '2.5rem')};
`;

export const MockLine = styled.div<{ $w?: string; $strong?: boolean }>`
  height: ${(p) => (p.$strong ? '0.7rem' : '0.5rem')};
  width: ${(p) => p.$w ?? '100%'};
  border-radius: ${tkn('radius.sm')};
  background: ${(p) =>
    p.$strong
      ? `color-mix(in srgb, ${tkn('colors.brand.primary')(p)} 40%, ${tkn('colors.surface.primary')(p)})`
      : `color-mix(in srgb, ${tkn('colors.text.tertiary')(p)} 28%, transparent)`};
`;

export const MockSpecRow = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
  align-items: flex-start;
`;

export const MockSpecLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  flex: 1 1 auto;
  padding-top: 0.15rem;
`;

export const MockGallery = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.4rem;
  flex: 1 1 auto;

  & > span {
    border-radius: ${tkn('radius.sm')};
    background: color-mix(in srgb, ${tkn('colors.brand.primary')} 15%, ${tkn('colors.surface.primary')});
  }
`;

export const GroupShowcaseFoot = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;

export const GroupChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.5rem;
  border-radius: ${tkn('radius.sm')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  background: ${tkn('colors.landing.chipBg')};
  font-family: ${FONT_BODY};
  font-size: ${TYPE.micro};
  color: ${tkn('colors.text.secondary')};

  svg {
    color: ${tkn('colors.text.tertiary')};
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
