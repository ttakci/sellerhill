import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/* =========================================================================
 * Shared primitives
 * ========================================================================= */

const CONTENT_MAX = '1180px';
const NARROW_MAX = '940px';

const RevealBase = styled.div<{ $visible: boolean; $delay?: number }>`
  opacity: ${(p) => (p.$visible ? 1 : 0)};
  transform: translateY(${(p) => (p.$visible ? '0' : '26px')});
  transition:
    opacity ${tkn('transitions.slow')} cubic-bezier(0.22, 1, 0.36, 1),
    transform ${tkn('transitions.slow')} cubic-bezier(0.22, 1, 0.36, 1);
  transition-delay: ${(p) => (p.$delay ? `${p.$delay * 90}ms` : '0ms')};
  will-change: opacity, transform;
`;

/* =========================================================================
 * Page shell
 * ========================================================================= */

export const Page = styled.div`
  min-height: 100vh;
  background: ${tkn('colors.background.primary')};
  color: ${tkn('colors.text.primary')};
  font-family: ${tkn('typography.fontFamily.body')};
  overflow-x: hidden;
`;

/* =========================================================================
 * Navbar
 * ========================================================================= */

export const Navbar = styled.header<{ $scrolled: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 50;
  background: ${(p) =>
    p.$scrolled ? `color-mix(in srgb, ${tkn('colors.background.primary')(p)} 82%, transparent)` : 'transparent'};
  backdrop-filter: ${(p) => (p.$scrolled ? 'saturate(160%) blur(14px)' : 'none')};
  border-bottom: 1px solid ${(p) => (p.$scrolled ? tkn('colors.border.secondary')(p) : 'transparent')};
  transition:
    background ${tkn('transitions.normal')},
    backdrop-filter ${tkn('transitions.normal')},
    border-color ${tkn('transitions.normal')};
`;

export const NavInner = styled.nav`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.lg')};

  @media (max-width: 1080px) {
    padding: ${tkn('spacing.md')};
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
  gap: ${tkn('spacing.xs')};

  @media (max-width: 900px) {
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
  color: ${tkn('colors.text.secondary')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  transition: color ${tkn('transitions.fast')}, background ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.text.primary')};
    background: ${tkn('colors.surface.secondary')};
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

export const LoginButton = styled.button<{ $block?: boolean }>`
  background: none;
  border: 1px solid ${tkn('colors.border.primary')};
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.lg')};
  min-width: 5.5rem;
  border-radius: ${tkn('radius.lg')};
  transition:
    border-color ${tkn('transitions.fast')},
    background ${tkn('transitions.fast')},
    color ${tkn('transitions.fast')};
  ${(p) => (p.$block ? 'width: 100%; justify-content: center;' : '')}

  &:hover {
    border-color: ${tkn('colors.landing.cardBorderHover')};
    background: ${tkn('colors.surface.secondary')};
    color: ${tkn('colors.brand.primary')};
  }

  @media (max-width: 900px) {
    display: ${(p) => (p.$block ? 'block' : 'none')};
  }
`;

export const NavCta = styled.button<{ $block?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.xs')};
  background: ${tkn('colors.brand.primary')};
  border: none;
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.lg')};
  min-width: 7.5rem;
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.sm')};
  transition:
    background ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};
  ${(p) => (p.$block ? 'width: 100%;' : '')}

  &:hover {
    background: ${tkn('colors.brand.primaryHover')};
    transform: translateY(-1px);
    box-shadow: ${tkn('shadows.md')};
  }

  @media (max-width: 900px) {
    display: ${(p) => (p.$block ? 'inline-flex' : 'none')};
  }
`;

export const Hamburger = styled.button<{ $open: boolean }>`
  display: none;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid ${tkn('colors.border.primary')};
  cursor: pointer;
  color: ${tkn('colors.text.primary')};
  width: 40px;
  height: 40px;
  border-radius: ${tkn('radius.lg')};
  transition: border-color ${tkn('transitions.fast')}, background ${tkn('transitions.fast')};

  &:hover {
    border-color: ${tkn('colors.landing.cardBorderHover')};
    background: ${tkn('colors.surface.secondary')};
  }

  @media (max-width: 900px) {
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
  backdrop-filter: blur(4px);
  opacity: ${(p) => (p.$open ? 1 : 0)};
  pointer-events: ${(p) => (p.$open ? 'auto' : 'none')};
  transition: opacity ${tkn('transitions.normal')};
`;

export const MobileMenu = styled.aside<{ $open: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 61;
  width: min(86vw, 360px);
  background: ${tkn('colors.surface.primary')};
  border-left: 1px solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.xl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.lg')};
  transform: translateX(${(p) => (p.$open ? '0' : '100%')});
  transition: transform ${tkn('transitions.normal')};
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
  background: none;
  border: 1px solid ${tkn('colors.border.primary')};
  cursor: pointer;
  color: ${tkn('colors.text.primary')};
  width: 40px;
  height: 40px;
  border-radius: ${tkn('radius.lg')};
`;

export const MobileLinks = styled.nav`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const MobileLink = styled.button`
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.primary')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.lg')};

  &:hover {
    background: ${tkn('colors.surface.secondary')};
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
  background: ${tkn('colors.background.primary')};
  color: ${tkn('colors.text.primary')};
  padding: 140px ${tkn('spacing.xl')} ${tkn('spacing.xxxl')};
  overflow: hidden;
  isolation: isolate;

  @media (max-width: 768px) {
    padding: 120px ${tkn('spacing.md')} ${tkn('spacing.xxl')};
  }
`;

/* Single, restrained brand tint — replaces the old multi-orb / grid-mesh look. */
export const HeroGlow = styled.div`
  position: absolute;
  top: -25%;
  right: -10%;
  width: 70vw;
  height: 70vw;
  max-width: 900px;
  max-height: 900px;
  z-index: 0;
  pointer-events: none;
  background: radial-gradient(circle at center, ${tkn('colors.landing.heroGlow')} 0%, transparent 62%);
  filter: blur(8px);
  opacity: 0.45;
`;

export const HeroInner = styled.div`
  position: relative;
  z-index: 1;
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  gap: ${tkn('spacing.xxxl')};
  align-items: center;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.xxl')};
    text-align: center;
  }
`;

export const HeroContent = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;

  @media (max-width: 980px) {
    align-items: center;
  }
`;

export const Eyebrow = styled.span<{ $onDark?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
  text-transform: uppercase;
  color: ${tkn('colors.brand.primary')};
  background: ${tkn('colors.brand.secondary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.full')};
`;

export const EyebrowDot = styled.span`
  width: 7px;
  height: 7px;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.brand.primary')};
`;

export const HeroTitle = styled.h1`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(2.4rem, 5.2vw, ${tkn('typography.fontSize.6xl')});
  line-height: ${tkn('typography.lineHeight.tight')};
  letter-spacing: ${tkn('typography.letterSpacing.tighter')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  margin: ${tkn('spacing.lg')} 0 ${tkn('spacing.md')};
  color: ${tkn('colors.text.primary')};
`;

export const HeroSubtitle = styled.p`
  font-size: clamp(${tkn('typography.fontSize.md')}, 2vw, ${tkn('typography.fontSize.xl')});
  line-height: ${tkn('typography.lineHeight.relaxed')};
  color: ${tkn('colors.text.secondary')};
  max-width: 560px;
  margin: 0 0 ${tkn('spacing.xl')};

  @media (max-width: 980px) {
    margin-left: auto;
    margin-right: auto;
  }
`;

export const HeroCtas = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.md')};
  align-items: center;

  @media (max-width: 980px) {
    justify-content: center;
  }
`;

export const PrimaryButton = styled.button<{ $lg?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.sm')};
  background: ${tkn('colors.brand.primary')};
  border: none;
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${(p) => (p.$lg ? tkn('typography.fontSize.md')(p) : tkn('typography.fontSize.sm')(p))};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.landing.heroText')};
  padding: ${(p) =>
    p.$lg
      ? `${tkn('spacing.md')(p)} ${tkn('spacing.xxl')(p)}`
      : `${tkn('spacing.md')(p)} ${tkn('spacing.xl')(p)}`};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.md')};
  transition:
    background ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.brand.primaryHover')};
    transform: translateY(-1px);
    box-shadow: ${tkn('shadows.lg')};
  }
`;

export const GhostButton = styled.button<{ $onDark?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.xs')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.border.primary')};
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
  border-radius: ${tkn('radius.lg')};
  transition:
    border-color ${tkn('transitions.fast')},
    background ${tkn('transitions.fast')},
    color ${tkn('transitions.fast')};

  &:hover {
    border-color: ${tkn('colors.landing.cardBorderHover')};
    background: ${tkn('colors.surface.secondary')};
    color: ${tkn('colors.brand.primary')};
  }
`;

export const HeroNote = styled.p`
  margin-top: ${tkn('spacing.md')};
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
`;

/* ---- Dashboard mockup (theme-adaptive surface card) ---- */

export const HeroPreview = styled.div`
  position: relative;
  z-index: 1;

  @media (max-width: 980px) {
    max-width: 620px;
    width: 100%;
    margin: 0 auto;
  }
`;

export const DashboardMock = styled.div`
  position: relative;
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.2xl')};
  box-shadow: ${tkn('shadows.xl')};
  overflow: hidden;
  font-family: ${tkn('typography.fontFamily.body')};
`;

export const MockBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  background: ${tkn('colors.surface.secondary')};
`;

export const MockDot = styled.span<{ $c: 'error' | 'warning' | 'success' }>`
  width: 10px;
  height: 10px;
  border-radius: ${tkn('radius.full')};
  background: ${(p) => {
    const map = {
      error: tkn('colors.semantic.error'),
      warning: tkn('colors.semantic.warning'),
      success: tkn('colors.semantic.success'),
    };
    return map[p.$c](p);
  }};
`;

export const MockUrl = styled.span`
  margin-left: ${tkn('spacing.md')};
  font-size: ${tkn('typography.fontSize.2xs')};
  color: ${tkn('colors.text.tertiary')};
`;

export const MockBody = styled.div`
  display: grid;
  grid-template-columns: 64px 1fr;
  min-height: 340px;
`;

export const MockSidebar = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.sm')};
  border-right: 1px solid ${tkn('colors.border.secondary')};
`;

export const MockSideItem = styled.span<{ $active?: boolean }>`
  height: 28px;
  border-radius: ${tkn('radius.md')};
  background: ${(p) => (p.$active ? tkn('colors.brand.secondary')(p) : 'transparent')};
  border: 1px solid ${(p) => (p.$active ? tkn('colors.border.secondary')(p) : 'transparent')};
`;

export const MockMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')};
`;

export const MockKpis = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.md')};
`;

export const MockKpi = styled.div`
  height: 64px;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.background.tertiary')};
  border: 1px solid ${tkn('colors.border.secondary')};
`;

export const MockChart = styled.div`
  display: flex;
  align-items: flex-end;
  gap: ${tkn('spacing.sm')};
  height: 120px;
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.background.tertiary')};
  border: 1px solid ${tkn('colors.border.secondary')};
`;

export const MockBar2 = styled.span<{ $h: string }>`
  flex: 1;
  height: ${(p) => p.$h};
  border-radius: ${tkn('radius.sm')} ${tkn('radius.sm')} 0 0;
  background: ${tkn('colors.brand.primary')};
  opacity: 0.85;
`;

export const MockTable = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const MockRow = styled.div`
  height: 22px;
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.background.tertiary')};
`;

/* =========================================================================
 * Platform strip
 * ========================================================================= */

export const Platforms = styled.div`
  background: ${tkn('colors.background.primary')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  padding: ${tkn('spacing.xxl')} ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.lg')};

  @media (max-width: 768px) {
    padding: ${tkn('spacing.xl')} ${tkn('spacing.md')};
  }
`;

export const PlatformLabel = styled.p`
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
  text-transform: uppercase;
  color: ${tkn('colors.text.tertiary')};
  margin: 0;
`;

export const PlatformFlow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.lg')};
`;

export const PlatformChip = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  color: ${tkn('colors.text.secondary')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-size: ${tkn('typography.fontSize.lg')};
  opacity: 0.9;
`;

export const PlatformArrow = styled.div`
  color: ${tkn('colors.brand.primary')};
`;

/* =========================================================================
 * Generic section
 * ========================================================================= */

export const Section = styled.section<{ $alt?: boolean; $narrow?: boolean }>`
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.xl')};
  background: ${(p) => (p.$alt ? tkn('colors.landing.sectionAlt')(p) : 'transparent')};

  @media (max-width: 768px) {
    padding: ${tkn('spacing.xxl')} ${tkn('spacing.md')};
  }
`;

export const Reveal = RevealBase;

export const SectionHead = styled.div`
  max-width: 720px;
  margin: 0 auto ${tkn('spacing.xxxl')};
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const SectionTitle = styled.h2`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(${tkn('typography.fontSize.xxl')}, 4vw, ${tkn('typography.fontSize.4xl')});
  line-height: ${tkn('typography.lineHeight.tight')};
  letter-spacing: ${tkn('typography.letterSpacing.tight')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const SectionSubtitle = styled.p`
  font-size: ${tkn('typography.fontSize.md')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
`;

/* =========================================================================
 * Features (bento)
 * ========================================================================= */

export const FeaturesGrid = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.lg')};

  @media (max-width: 900px) {
    grid-template-columns: repeat(2, 1fr);
  }
  @media (max-width: 560px) {
    grid-template-columns: 1fr;
  }
`;

export const FeatureCard = styled.div<{ $highlight?: boolean }>`
  position: relative;
  background: ${(p) =>
    p.$highlight
      ? `linear-gradient(135deg, color-mix(in srgb, ${tkn('colors.brand.primary')(p)} 6%, ${tkn('colors.surface.primary')(p)}), ${tkn('colors.surface.primary')(p)})`
      : tkn('colors.surface.primary')(p)};
  border: 1px solid ${(p) => (p.$highlight ? tkn('colors.landing.cardBorderHover')(p) : tkn('colors.landing.cardBorder')(p))};
  border-radius: ${tkn('radius.2xl')};
  padding: ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  box-shadow: ${tkn('shadows.sm')};
  transition:
    transform ${tkn('transitions.normal')},
    border-color ${tkn('transitions.normal')},
    box-shadow ${tkn('transitions.normal')};

  &:hover {
    transform: translateY(-2px);
    border-color: ${tkn('colors.landing.cardBorderHover')};
    box-shadow: ${tkn('shadows.lg')};
  }
`;

export const FeatureHeadRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const FeatureIconWrap = styled.div<{ $highlight?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: ${tkn('radius.lg')};
  background: ${(p) => (p.$highlight ? tkn('colors.brand.primary')(p) : tkn('colors.landing.chipBg')(p))};
  border: 1px solid ${(p) => (p.$highlight ? 'transparent' : tkn('colors.landing.chipBorder')(p))};
`;

export const FeatureBadge = styled.span`
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
  text-transform: uppercase;
  color: ${tkn('colors.brand.primary')};
  background: ${tkn('colors.landing.chipBg')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.full')};
`;

export const FeatureTitle = styled.h3`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const FeatureTitleLarge = styled.h3`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(${tkn('typography.fontSize.xl')}, 2.6vw, ${tkn('typography.fontSize.xxxl')});
  line-height: ${tkn('typography.lineHeight.tight')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const FeatureDesc = styled.p`
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
`;

/* =========================================================================
 * How it works
 * ========================================================================= */

export const Steps = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.xl')};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const StepCard = styled.div`
  position: relative;
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  border-radius: ${tkn('radius.2xl')};
  padding: ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  box-shadow: ${tkn('shadows.sm')};
`;

export const StepNumber = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.landing.heroText')};
  font-family: ${tkn('typography.fontFamily.heading')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  font-size: ${tkn('typography.fontSize.lg')};
`;

export const StepTitle = styled.h3`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: ${tkn('spacing.sm')} 0 0;
`;

export const StepDesc = styled.p`
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
`;

export const StepConnector = styled.div`
  position: absolute;
  right: -${tkn('spacing.xl')};
  top: calc(${tkn('spacing.xl')} + 10px);
  color: ${tkn('colors.brand.primary')};
  opacity: 0.5;

  @media (max-width: 768px) {
    display: none;
  }
`;

/* =========================================================================
 * Per-product deep dive
 * ========================================================================= */

export const ProductGrid = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.lg')};

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const ProductCard = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  border-radius: ${tkn('radius.2xl')};
  padding: ${tkn('spacing.xl')};
  box-shadow: ${tkn('shadows.sm')};
  transition:
    transform ${tkn('transitions.normal')},
    border-color ${tkn('transitions.normal')};

  &:hover {
    transform: translateY(-2px);
    border-color: ${tkn('colors.landing.cardBorderHover')};
  }
`;

export const ProductName = styled.div`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  padding-bottom: ${tkn('spacing.md')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
`;

export const ProductSettings = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding-top: ${tkn('spacing.md')};
`;

export const SettingRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const SettingLabel = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
`;

export const SettingValue = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  background: ${tkn('colors.landing.chipBg')};
  border: 1px solid ${tkn('colors.landing.chipBorder')};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
`;

/* =========================================================================
 * CTA banner
 * ========================================================================= */

export const CtaBanner = styled.div<{ $dark?: boolean }>`
  position: relative;
  max-width: ${NARROW_MAX};
  margin: 0 auto;
  overflow: hidden;
  isolation: isolate;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.xxl')};
  border-radius: ${tkn('radius.2xl')};
  background: ${(p) =>
    p.$dark
      ? tkn('colors.landing.heroBg')(p)
      : `linear-gradient(135deg, color-mix(in srgb, ${tkn('colors.brand.primary')(p)} 8%, ${tkn('colors.surface.primary')(p)}), ${tkn('colors.surface.primary')(p)})`};
  border: 1px solid ${(p) => (p.$dark ? tkn('colors.landing.heroBorder')(p) : tkn('colors.landing.cardBorderHover')(p))};
  color: ${(p) => (p.$dark ? tkn('colors.landing.heroText')(p) : tkn('colors.text.primary')(p))};
  box-shadow: ${tkn('shadows.lg')};

  @media (max-width: 768px) {
    padding: ${tkn('spacing.xxl')} ${tkn('spacing.lg')};
  }
`;

export const CtaGlow = styled.div<{ $strong?: boolean }>`
  position: absolute;
  z-index: -1;
  width: ${(p) => (p.$strong ? '420px' : '300px')};
  height: ${(p) => (p.$strong ? '420px' : '300px')};
  top: -40%;
  left: 50%;
  transform: translateX(-50%);
  background: radial-gradient(circle, ${tkn('colors.landing.heroGlow')} 0%, transparent 70%);
  filter: blur(50px);
  opacity: ${(p) => (p.$strong ? 0.9 : 0.5)};
`;

export const CtaTitle = styled.h3`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(${tkn('typography.fontSize.xxl')}, 4vw, ${tkn('typography.fontSize.4xl')});
  line-height: ${tkn('typography.lineHeight.tight')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  margin: 0;
`;

export const CtaSub = styled.p`
  font-size: ${tkn('typography.fontSize.md')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  opacity: 0.8;
  max-width: 560px;
  margin: 0;
`;

/* =========================================================================
 * Stats band
 * ========================================================================= */

export const StatsBand = styled.div`
  background: ${tkn('colors.landing.statsBg')};
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: ${tkn('spacing.xl')};
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  padding: ${tkn('spacing.xxl')} ${tkn('spacing.xl')};

  @media (max-width: 768px) {
    grid-template-columns: repeat(2, 1fr);
    gap: ${tkn('spacing.lg')};
    padding: ${tkn('spacing.xl')} ${tkn('spacing.md')};
  }
`;

export const StatItem = styled.div`
  text-align: center;
`;

export const StatValue = styled.div`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(${tkn('typography.fontSize.xxl')}, 3.4vw, ${tkn('typography.fontSize.4xl')});
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.landing.heroText')};
`;

export const StatLabel = styled.div`
  margin-top: ${tkn('spacing.xs')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.landing.heroTextMuted')};
`;

/* =========================================================================
 * Testimonials
 * ========================================================================= */

export const Testimonials = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.lg')};

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

export const TestimonialCard = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.landing.cardBorder')};
  border-radius: ${tkn('radius.2xl')};
  padding: ${tkn('spacing.xl')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-shadow: ${tkn('shadows.sm')};
  transition:
    transform ${tkn('transitions.normal')},
    box-shadow ${tkn('transitions.normal')};

  &:hover {
    transform: translateY(-2px);
    box-shadow: ${tkn('shadows.lg')};
  }
`;

export const Stars = styled.div`
  display: flex;
  gap: 2px;
`;

export const TestimonialText = styled.p`
  font-size: ${tkn('typography.fontSize.md')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const TestimonialAuthor = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  margin-top: auto;
`;

export const TestimonialAvatar = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.landing.heroText')};
  font-family: ${tkn('typography.fontFamily.heading')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  font-size: ${tkn('typography.fontSize.md')};
`;

export const TestimonialMeta = styled.div`
  display: flex;
  flex-direction: column;
`;

export const TestimonialName = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
`;

export const TestimonialRole = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.secondary')};
`;

/* =========================================================================
 * Pricing
 * ========================================================================= */

export const PricingGrid = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.lg')};
  align-items: stretch;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    max-width: 460px;
  }
`;

export const PricingCard = styled.div<{ $highlight?: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${(p) => (p.$highlight ? tkn('colors.landing.cardBorderHover')(p) : tkn('colors.landing.cardBorder')(p))};
  border-radius: ${tkn('radius.2xl')};
  padding: ${tkn('spacing.xl')};
  box-shadow: ${(p) => (p.$highlight ? tkn('shadows.xl')(p) : tkn('shadows.sm')(p))};
  ${(p) => (p.$highlight ? `transform: translateY(-6px);` : '')}
  transition: transform ${tkn('transitions.normal')};

  @media (max-width: 900px) {
    transform: none;
  }
`;

export const PlanBadge = styled.span`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
  text-transform: uppercase;
  color: ${tkn('colors.landing.heroText')};
  background: ${tkn('colors.brand.primary')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.full')};
`;

export const PlanName = styled.div`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.secondary')};
`;

export const PlanPrice = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${tkn('spacing.xs')};
`;

export const PlanAmount = styled.span`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.4xl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
`;

export const PlanPeriod = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.tertiary')};
`;

export const PlanDesc = styled.p`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
  min-height: 40px;
`;

export const PlanFeatures = styled.ul`
  list-style: none;
  padding: 0;
  margin: ${tkn('spacing.sm')} 0 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const PlanFeature = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.sm')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.primary')};
  line-height: ${tkn('typography.lineHeight.normal')};
`;

export const PlanCta = styled.button<{ $highlight?: boolean }>`
  margin-top: ${tkn('spacing.sm')};
  background: ${(p) => (p.$highlight ? tkn('colors.brand.primary')(p) : tkn('colors.surface.secondary')(p))};
  color: ${(p) => (p.$highlight ? tkn('colors.landing.heroText')(p) : tkn('colors.text.primary')(p))};
  border: 1px solid ${(p) => (p.$highlight ? 'transparent' : tkn('colors.border.primary')(p))};
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.lg')};
  transition:
    transform ${tkn('transitions.fast')},
    background ${tkn('transitions.fast')},
    border-color ${tkn('transitions.fast')};

  &:hover {
    transform: translateY(-2px);
    ${(p) => (p.$highlight ? `background: ${tkn('colors.brand.primaryHover')(p)};` : `border-color: ${tkn('colors.landing.cardBorderHover')(p)};`)}
  }
`;

export const BillingNote = styled.p`
  text-align: center;
  margin-top: ${tkn('spacing.xl')};
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
`;

/* =========================================================================
 * FAQ
 * ========================================================================= */

export const FaqList = styled.div`
  max-width: ${NARROW_MAX};
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const FaqItem = styled.div<{ $open: boolean }>`
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${(p) => (p.$open ? tkn('colors.landing.cardBorderHover')(p) : tkn('colors.landing.cardBorder')(p))};
  border-radius: ${tkn('radius.xl')};
  overflow: hidden;
  transition: border-color ${tkn('transitions.fast')};
`;

export const FaqQuestion = styled.button<{ $open: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  padding: ${tkn('spacing.lg')} ${tkn('spacing.xl')};

  @media (max-width: 560px) {
    padding: ${tkn('spacing.md')};
    font-size: ${tkn('typography.fontSize.sm')};
  }
`;

export const FaqAnswer = styled.div<{ $open: boolean }>`
  max-height: ${(p) => (p.$open ? '400px' : '0')};
  overflow: hidden;
  transition: max-height ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
`;

export const FaqAnswerText = styled.p`
  padding: 0 ${tkn('spacing.xl')} ${tkn('spacing.lg')};
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;

  @media (max-width: 560px) {
    padding: 0 ${tkn('spacing.md')} ${tkn('spacing.md')};
  }
`;

/* =========================================================================
 * Footer
 * ========================================================================= */

export const Footer = styled.footer`
  background: ${tkn('colors.landing.sectionDeep')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.xl')} ${tkn('spacing.xl')};

  @media (max-width: 768px) {
    padding: ${tkn('spacing.xxl')} ${tkn('spacing.md')} ${tkn('spacing.lg')};
  }
`;

export const FooterInner = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.4fr 2fr;
  gap: ${tkn('spacing.xxxl')};

  @media (max-width: 768px) {
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
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
  max-width: 340px;
`;

export const FooterColumns = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.xl')};

  @media (max-width: 560px) {
    grid-template-columns: repeat(2, 1fr);
  }
`;

export const FooterColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const FooterColTitle = styled.h4`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
  text-transform: uppercase;
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const FooterLink = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 0;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  transition: color ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const FooterDivider = styled.div`
  max-width: ${CONTENT_MAX};
  margin: ${tkn('spacing.xxl')} auto ${tkn('spacing.lg')};
  height: 1px;
  background: ${tkn('colors.border.secondary')};
`;

export const FooterBottom = styled.div`
  max-width: ${CONTENT_MAX};
  margin: 0 auto;
`;

export const Copyright = styled.p`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
  margin: 0;
  text-align: center;
`;
