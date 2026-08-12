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
  font-family: ${tkn('typography.fontFamily.body')};
  overflow-x: hidden;
`;

/* =========================================================================
 * Navbar
 * ========================================================================= */

export const Navbar = styled.header<{ $scrolled: boolean }>`
  position: fixed;
  inset: 0 0 auto 0;
  z-index: 50;
  background: ${(p) =>
    p.$scrolled ? `color-mix(in srgb, ${tkn('colors.landing.heroBg')(p)} 78%, transparent)` : 'transparent'};
  backdrop-filter: ${(p) => (p.$scrolled ? 'saturate(160%) blur(16px)' : 'none')};
  -webkit-backdrop-filter: ${(p) => (p.$scrolled ? 'saturate(160%) blur(16px)' : 'none')};
  border-bottom: 1px solid ${(p) => (p.$scrolled ? tkn('colors.landing.heroBorder')(p) : 'transparent')};
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
  gap: ${tkn('spacing.lg')};

  @media (max-width: 1080px) {
    padding: 0.75rem ${tkn('spacing.md')};
  }
`;

export const NavBrand = styled.button`
  display: flex;
  align-items: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
`;

export const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 0.125rem;

  @media (max-width: 960px) {
    display: none;
  }
`;

export const NavLink = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.landing.heroTextMuted')};
  padding: 0.5rem 0.75rem;
  border-radius: ${tkn('radius.md')};
  transition:
    color 140ms ease,
    background 140ms ease;

  &:hover {
    color: ${tkn('colors.landing.heroText')};
    background: ${tkn('colors.landing.chipBg')};
  }
`;

export const NavActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const UtilityGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

/**
 * Locale trigger. Deliberately identical to the one in the app header
 * (`AppShell.style.ts` → `LanguageSelectTrigger`): a visitor who signs up
 * should meet the same control, not a second dialect of the same idea.
 */
export const LanguageTrigger = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  cursor: pointer;
  padding: ${tkn('spacing.2xs')} 0.375rem;
  border-radius: ${tkn('radius.sm')};
  color: ${tkn('colors.landing.heroTextMuted')};
  transition: background 140ms ease;

  &:hover {
    background: ${tkn('colors.landing.chipBg')};

    & > span,
    & svg {
      color: ${tkn('colors.brand.primary')};
    }
  }
`;

export const LanguageText = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.landing.heroTextMuted')};
  text-transform: uppercase;
  transition: color 140ms ease;
`;

export const LoginButton = styled.button<{ $block?: boolean }>`
  background: none;
  border: 1px solid ${tkn('colors.landing.heroBorder')};
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
  padding: 0.5rem 1rem;
  border-radius: ${tkn('radius.md')};
  transition:
    border-color 140ms ease,
    background 140ms ease;
  ${(p) => (p.$block ? 'width: 100%;' : '')}

  &:hover {
    border-color: ${tkn('colors.landing.cardBorderHover')};
    background: ${tkn('colors.landing.chipBg')};
  }

  @media (max-width: 960px) {
    display: ${(p) => (p.$block ? 'block' : 'none')};
  }
`;

export const NavCta = styled.button<{ $block?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  background: ${tkn('colors.brand.primary')};
  border: none;
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
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
  border: 1px solid ${tkn('colors.landing.heroBorder')};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.landing.heroText')};
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
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.base')};
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

export const Hero = styled.section`
  position: relative;
  padding: 8.5rem ${tkn('spacing.xl')} ${SECTION_Y};
  overflow: hidden;

  @media (max-width: 900px) {
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

/** A soft floor under the hero so it melts into the page instead of stopping. */
export const HeroFade = styled.div`
  position: absolute;
  inset: auto 0 0 0;
  height: 14rem;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, ${tkn('colors.landing.heroBg')});
`;

export const HeroInner = styled.div`
  position: relative;
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${tkn('spacing.xl')};
`;

export const HeroContent = styled.div`
  max-width: 52rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.lg')};
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
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  letter-spacing: 0.03em;
  color: ${tkn('colors.brand.primary')};
`;

export const EyebrowDot = styled.span`
  width: 0.375rem;
  height: 0.375rem;
  border-radius: 50%;
  background: ${tkn('colors.semantic.success')};
`;

export const HeroTitle = styled.h1`
  margin: 0;
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(2.15rem, 4.6vw, 3.5rem);
  line-height: 1.05;
  letter-spacing: -0.032em;
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.landing.heroText')};
  text-wrap: balance;
`;

export const HeroSubtitle = styled.p`
  margin: 0;
  max-width: 40rem;
  font-size: clamp(${tkn('typography.fontSize.base')}, 1.5vw, ${tkn('typography.fontSize.lg')});
  line-height: 1.65;
  color: ${tkn('colors.landing.heroTextMuted')};
  text-wrap: pretty;
`;

export const HeroCtas = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: ${tkn('spacing.sm')};
`;

export const PrimaryButton = styled.button<{ $lg?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  background: ${tkn('colors.brand.primary')};
  border: none;
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${(p) => (p.$lg ? tkn('typography.fontSize.base')(p) : tkn('typography.fontSize.sm')(p))};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.onAccent')};
  padding: ${(p) => (p.$lg ? '0.95rem 1.85rem' : '0.75rem 1.5rem')};
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  transition:
    background 160ms ease,
    transform 160ms cubic-bezier(0.22, 1, 0.36, 1),
    box-shadow 160ms ease;

  &:hover {
    background: ${tkn('colors.brand.primaryHover')};
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
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${(p) => (p.$lg ? tkn('typography.fontSize.base')(p) : tkn('typography.fontSize.sm')(p))};
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

export const HeroNote = styled.p`
  margin: 0;
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
`;

/* =========================================================================
 * Hero product preview
 *
 * A faithful, legible rendering of the real dashboard — labels and figures,
 * not grey placeholder boxes. The last row deliberately shows an em dash for
 * an unknown profit, because that behaviour is the page's whole argument.
 * ========================================================================= */

export const HeroPreview = styled.div`
  position: relative;
  width: 100%;
  max-width: 62rem;
  perspective: 1600px;
`;

export const PreviewFrame = styled.div`
  border-radius: ${tkn('radius.xl')};
  border: 1px solid ${tkn('colors.landing.heroBorder')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowStrong')};
  overflow: hidden;
  text-align: left;
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

export const PreviewBody = styled.div`
  display: grid;
  grid-template-columns: 3.25rem 1fr;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

export const PreviewRail = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: ${tkn('spacing.md')} 0;
  align-items: center;
  background: ${tkn('colors.sidebar.background')};

  @media (max-width: 720px) {
    display: none;
  }
`;

export const PreviewRailItem = styled.span<{ $active?: boolean }>`
  width: 1.5rem;
  height: 0.375rem;
  border-radius: 999px;
  background: ${(p) =>
    p.$active ? tkn('colors.brand.primary')(p) : tkn('colors.sidebar.textMuted')(p)};
  opacity: ${(p) => (p.$active ? 1 : 0.35)};
`;

export const PreviewMain = styled.div`
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const PreviewPeriod = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: ${tkn('colors.text.tertiary')};
`;

export const PreviewKpis = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
  gap: ${tkn('spacing.sm')};
`;

export const PreviewKpi = styled.div<{ $accent?: boolean }>`
  padding: 0.875rem;
  border-radius: ${tkn('radius.lg')};
  border: 1px solid ${(p) => (p.$accent ? tkn('colors.landing.chipBorder')(p) : tkn('colors.border.secondary')(p))};
  background: ${(p) => (p.$accent ? tkn('colors.landing.chipBg')(p) : tkn('colors.surface.secondary')(p))};
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  min-width: 0;
`;

export const PreviewKpiLabel = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.secondary')};
`;

export const PreviewKpiValue = styled.span`
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-variant-numeric: tabular-nums;
  color: ${tkn('colors.text.primary')};
  letter-spacing: -0.015em;
`;

export const PreviewKpiFoot = styled.span<{ $tone?: 'success' | 'muted' }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${(p) =>
    p.$tone === 'success' ? tkn('colors.semantic.success')(p) : tkn('colors.text.tertiary')(p)};
`;

export const PreviewChart = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.375rem;
  height: 5.5rem;
  padding: ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.lg')};
  border: 1px solid ${tkn('colors.border.secondary')};
  background: ${tkn('colors.surface.secondary')};
`;

export const PreviewChartBar = styled.span<{ $h: string; $accent?: boolean }>`
  flex: 1;
  height: ${(p) => p.$h};
  min-width: 0.25rem;
  border-radius: 3px 3px 0 0;
  background: ${(p) =>
    p.$accent
      ? tkn('colors.dashboard.seriesProfit')(p)
      : tkn('colors.brand.primary')(p)};
  opacity: ${(p) => (p.$accent ? 0.9 : 0.28)};
`;

export const PreviewTable = styled.div`
  display: flex;
  flex-direction: column;
  border-radius: ${tkn('radius.lg')};
  border: 1px solid ${tkn('colors.border.secondary')};
  overflow: hidden;
`;

export const PreviewTableHead = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 4.5rem;
  gap: ${tkn('spacing.sm')};
  padding: 0.5rem 0.75rem;
  background: ${tkn('colors.surface.secondary')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: ${tkn('colors.text.tertiary')};

  & > :last-child {
    text-align: right;
  }
`;

export const PreviewRow = styled.div`
  display: grid;
  grid-template-columns: 1fr auto 4.5rem;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid ${tkn('colors.border.secondary')};

  &:last-of-type {
    border-bottom: none;
  }
`;

export const PreviewRowTitle = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.primary')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const PreviewBadge = styled.span<{ $tone: 'success' | 'info' | 'warning' }>`
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 999px;
  white-space: nowrap;
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${(p) => tkn(`colors.semantic.${p.$tone}` as 'colors.semantic.success')(p)};
  background: ${(p) => tkn(`colors.semanticTint.${p.$tone}` as 'colors.semanticTint.success')(p)};
`;

export const PreviewRowValue = styled.span<{ $muted?: boolean }>`
  text-align: right;
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-variant-numeric: tabular-nums;
  color: ${(p) => (p.$muted ? tkn('colors.text.tertiary')(p) : tkn('colors.text.primary')(p))};
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
  font-size: ${tkn('typography.fontSize.xs')};
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
  font-size: ${tkn('typography.fontSize.sm')};
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
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const PillarText = styled.p`
  margin: 0;
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: 1.62;
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

export const SectionTitle = styled.h2`
  margin: 0;
  max-width: 40rem;
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(1.55rem, 2.7vw, 2.15rem);
  line-height: 1.16;
  letter-spacing: -0.022em;
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.landing.heroText')};
  text-wrap: balance;
`;

export const SectionSubtitle = styled.p`
  margin: 0;
  max-width: 40rem;
  font-size: ${tkn('typography.fontSize.base')};
  line-height: 1.65;
  color: ${tkn('colors.landing.heroTextMuted')};
  text-wrap: pretty;
`;

/* =========================================================================
 * Features
 * ========================================================================= */

export const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(17.5rem, 1fr));
  gap: ${tkn('spacing.lg')};
`;

export const FeatureCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.lg')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('colors.landing.shadowSoft')};
  transition:
    border-color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;

  &:hover {
    border-color: ${tkn('colors.landing.cardBorderHover')};
    transform: translateY(-2px);
    box-shadow: ${tkn('colors.landing.shadowSoft')};
  }
`;

export const FeatureIconWrap = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.landing.chipBg')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  margin-bottom: 0.25rem;
`;

export const FeatureTitle = styled.h3`
  margin: 0;
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const FeatureDesc = styled.p`
  margin: 0;
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: 1.65;
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

export const SplitTitle = styled.h2`
  margin: 0;
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(1.5rem, 2.5vw, 2.05rem);
  line-height: 1.18;
  letter-spacing: -0.022em;
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.landing.heroText')};
  text-wrap: balance;
`;

export const SplitSubtitle = styled.p`
  margin: 0;
  font-size: ${tkn('typography.fontSize.base')};
  line-height: 1.65;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

export const SplitEyebrow = styled.span`
  display: inline-flex;
  align-self: flex-start;
  padding: 0.375rem 0.875rem;
  border-radius: 999px;
  background: ${tkn('colors.landing.chipBg')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  font-size: ${tkn('typography.fontSize.xs')};
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
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.base')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const ProfitItemText = styled.p`
  margin: 0;
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: 1.62;
  color: ${tkn('colors.landing.heroTextMuted')};
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
  font-size: ${tkn('typography.fontSize.xs')};
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
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
`;

export const ProfitTierValue = styled.span<{ $muted?: boolean }>`
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.015em;
  white-space: nowrap;
  color: ${(p) => (p.$muted ? tkn('colors.text.tertiary')(p) : tkn('colors.text.primary')(p))};
`;

export const ProfitFootnote = styled.p`
  margin: 0;
  font-size: ${tkn('typography.fontSize.xs')};
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
  font-size: ${tkn('typography.fontSize.sm')};
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
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
`;

export const SettingValue = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
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
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  margin-bottom: 0.25rem;
`;

export const StepTitle = styled.h3`
  margin: 0;
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const StepDesc = styled.p`
  margin: 0;
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: 1.65;
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
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: 1.55;
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
  font-size: ${tkn('typography.fontSize.xs')};
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
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  letter-spacing: 0.02em;
`;

export const PlanName = styled.h3`
  margin: 0;
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const PlanPrice = styled.div`
  display: flex;
  align-items: baseline;
  gap: 0.25rem;
`;

export const PlanAmount = styled.span`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: 2.15rem;
  font-weight: ${tkn('typography.fontWeight.bold')};
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
  color: ${tkn('colors.landing.heroText')};
`;

export const PlanPeriod = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.tertiary')};
`;

export const PlanDesc = styled.p`
  margin: 0;
  font-size: ${tkn('typography.fontSize.sm')};
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
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: 1.5;
  color: ${tkn('colors.landing.heroTextMuted')};
`;

export const PlanCta = styled.button<{ $highlight?: boolean }>`
  width: 100%;
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
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
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
`;

export const CatalogError = styled.p`
  margin: 0 auto ${tkn('spacing.lg')};
  text-align: center;
  font-size: ${tkn('typography.fontSize.sm')};
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
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.base')};
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
    font-size: ${tkn('typography.fontSize.sm')};
    line-height: 1.68;
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
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(1.45rem, 2.5vw, 2rem);
  line-height: 1.18;
  letter-spacing: -0.022em;
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.landing.onAccent')};
  text-wrap: balance;
`;

export const CtaSub = styled.p`
  margin: 0;
  max-width: 36rem;
  font-size: ${tkn('typography.fontSize.base')};
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
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.base')};
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
  font-size: ${tkn('typography.fontSize.sm')};
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
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const FooterLink = styled.button`
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  text-align: left;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
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
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
`;
