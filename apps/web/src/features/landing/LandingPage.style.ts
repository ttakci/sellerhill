import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/* ── Animations ────────────────────────────────────────── */

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(1.5rem); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-0.5rem); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 0.4; }
  50% { opacity: 0.7; }
`;

/* ── Page ──────────────────────────────────────────────── */

export const Page = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: ${tkn('colors.background.primary')};
  position: relative;
  overflow-x: hidden;
`;

/* ── Navbar ────────────────────────────────────────────── */

export const Navbar = styled.nav<{ $scrolled: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
  background: ${({ $scrolled }) =>
    $scrolled ? 'rgba(248, 250, 252, 0.92)' : 'transparent'};
  backdrop-filter: ${({ $scrolled }) => ($scrolled ? 'blur(20px)' : 'none')};
  border-bottom: 1px solid ${({ $scrolled, theme }) =>
    $scrolled ? theme.colors.border.secondary : 'transparent'};
  transition: background 0.3s ease, border-color 0.3s ease, backdrop-filter 0.3s ease;

  [data-theme='dark'] & {
    background: ${({ $scrolled }) =>
      $scrolled ? 'rgba(15, 23, 42, 0.92)' : 'transparent'};
    border-bottom-color: ${({ $scrolled, theme }) =>
      $scrolled ? theme.colors.border.secondary : 'transparent'};
  }

  @media (max-width: 768px) {
    padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  }
`;

export const NavLeft = styled.div`
  display: flex;
  align-items: center;
`;

export const NavCenter = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};

  @media (max-width: 768px) {
    display: none;
  }
`;

export const NavRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};

  @media (max-width: 768px) {
    gap: ${tkn('spacing.sm')};
  }
`;

export const NavLink = styled.button`
  background: none;
  border: none;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
  cursor: pointer;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.md')};
  transition: color ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.text.primary')};
  }
`;

export const NavCTA = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.lg')};
  border-radius: ${tkn('radius.lg')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const NavCTAPrimary = styled(NavCTA)`
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.text.inverse')};
  border: none;

  &:hover {
    background: ${tkn('colors.brand.primaryHover')};
    box-shadow: ${tkn('shadows.md')};
  }
`;

export const NavCTASecondary = styled(NavCTA)`
  background: transparent;
  color: ${tkn('colors.text.primary')};
  border: 1px solid ${tkn('colors.border.primary')};

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    color: ${tkn('colors.brand.primary')};
  }

  @media (max-width: 640px) {
    display: none;
  }
`;

export const ToggleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const HamburgerButton = styled.button<{ $open: boolean }>`
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: ${tkn('spacing.xs')};
  color: ${tkn('colors.text.primary')};

  @media (max-width: 768px) {
    display: flex;
    align-items: center;
    justify-content: center;
  }
`;

/* ── Mobile Menu ───────────────────────────────────────── */

export const MobileMenuOverlay = styled.div<{ $open: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0, 0, 0, 0.5);
  opacity: ${({ $open }) => ($open ? 1 : 0)};
  pointer-events: ${({ $open }) => ($open ? 'auto' : 'none')};
  transition: opacity 0.3s ease;
`;

export const MobileMenu = styled.div<{ $open: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 201;
  width: 80%;
  max-width: 20rem;
  background: ${tkn('colors.surface.primary')};
  display: flex;
  flex-direction: column;
  padding: ${tkn('spacing.xl')};
  transform: translateX(${({ $open }) => ($open ? '0' : '100%')});
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: ${tkn('shadows.xl')};
  gap: ${tkn('spacing.lg')};
  overflow-y: auto;
`;

export const MobileMenuClose = styled.button`
  align-self: flex-end;
  background: none;
  border: none;
  cursor: pointer;
  color: ${tkn('colors.text.primary')};
  padding: ${tkn('spacing.xs')};
`;

export const MobileNavLinks = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const MobileNavLink = styled.button`
  background: none;
  border: none;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.primary')};
  cursor: pointer;
  padding: ${tkn('spacing.sm')} 0;
  text-align: left;
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
`;

export const MobileCTAGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.md')};
`;

/* ── Hero ──────────────────────────────────────────────── */

export const HeroSection = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 8rem ${tkn('spacing.xl')} ${tkn('spacing.xxxl')};
  min-height: 100vh;
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 6rem ${tkn('spacing.md')} ${tkn('spacing.xxl')};
    min-height: auto;
  }
`;

export const HeroMesh = styled.div`
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
`;

export const HeroGradientOrb = styled.div<{ $x: string; $y: string; $color: string }>`
  position: absolute;
  width: 40rem;
  height: 40rem;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  filter: blur(8rem);
  opacity: 0.35;
  left: ${({ $x }) => $x};
  top: ${({ $y }) => $y};
  animation: ${pulse} 8s ease-in-out infinite;
`;

export const HeroGrid = styled.div`
  position: absolute;
  inset: 0;
  background-size: 3.75rem 3.75rem;
  background-image: linear-gradient(to right, ${tkn('colors.border.secondary')} 1px, transparent 1px),
    linear-gradient(to bottom, ${tkn('colors.border.secondary')} 1px, transparent 1px);
  opacity: 0.4;
  mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
  -webkit-mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%);
`;

export const HeroContent = styled.div`
  position: relative;
  z-index: 1;
  max-width: 48rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.xl')};
`;

export const HeroBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')} ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.full')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
  animation: ${fadeInUp} 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0s both;
  box-shadow: ${tkn('shadows.sm')};
`;

export const HeroBadgeIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.semanticTint.info')};
  color: ${tkn('colors.brand.primary')};
`;

export const HeroHeadline = styled.h1`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(2.5rem, 6vw, 4rem);
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  line-height: ${tkn('typography.lineHeight.tight')};
  letter-spacing: ${tkn('typography.letterSpacing.tighter')};
  margin: 0;
  animation: ${fadeInUp} 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both;
`;

export const HeroSubheading = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: clamp(1rem, 2vw, ${tkn('typography.fontSize.lg')});
  color: ${tkn('colors.text.secondary')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  margin: 0;
  max-width: 36rem;
  animation: ${fadeInUp} 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both;
`;

export const HeroCTAGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  animation: ${fadeInUp} 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both;

  @media (max-width: 480px) {
    flex-direction: column;
    width: 100%;
  }
`;

export const PrimaryCTA = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.text.inverse')};
  border: none;
  border-radius: ${tkn('radius.lg')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.brand.primaryHover')};
    box-shadow: 0 0 0 4px rgba(66, 99, 235, 0.15);
    transform: translateY(-1px);
  }

  &:active {
    transform: translateY(0);
  }
`;

export const SecondaryCTA = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
  background: transparent;
  color: ${tkn('colors.text.primary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    color: ${tkn('colors.brand.primary')};
  }
`;

export const HeroStatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xxl')};
  margin-top: ${tkn('spacing.lg')};
  animation: ${fadeInUp} 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.5s both;

  @media (max-width: 640px) {
    flex-wrap: wrap;
    gap: ${tkn('spacing.lg')};
    justify-content: center;
  }
`;

export const HeroStat = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;

export const HeroStatValue = styled.span`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
`;

export const HeroStatLabel = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
`;

/* ── Dashboard Mockup ──────────────────────────────────── */

export const DashboardMockup = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 56rem;
  margin-top: ${tkn('spacing.xxxl')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.xl')};
  overflow: hidden;
  box-shadow: ${tkn('shadows.xl')};
  animation: ${fadeInUp} 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.6s both, ${float} 6s ease-in-out infinite;
  opacity: 0.9;

  [data-theme='dark'] & {
    box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.5);
  }
`;

export const MockupTitleBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background: ${tkn('colors.surface.secondary')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
`;

export const MockupDot = styled.div<{ $color: string }>`
  width: 0.625rem;
  height: 0.625rem;
  border-radius: 50%;
  background: ${({ $color }) => $color};
`;

export const MockupBody = styled.div`
  display: flex;
  min-height: 14rem;
`;

export const MockupSidebar = styled.div`
  width: 10rem;
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.sidebar.background')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};

  @media (max-width: 640px) {
    display: none;
  }
`;

export const MockupSidebarItem = styled.div<{ $active?: boolean }>`
  height: 0.5rem;
  border-radius: ${tkn('radius.sm')};
  background: ${({ $active }) =>
    $active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'};
  width: ${({ $active }) => ($active ? '80%' : '60%')};
`;

export const MockupContent = styled.div`
  flex: 1;
  padding: ${tkn('spacing.md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const MockupCardRow = styled.div`
  display: flex;
  gap: ${tkn('spacing.md')};

  @media (max-width: 480px) {
    flex-direction: column;
  }
`;

export const MockupCard = styled.div`
  flex: 1;
  height: 3rem;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.semanticTint.info')};
  border: 1px solid ${tkn('colors.semanticTintBorder.info')};
`;

export const MockupChart = styled.div`
  flex: 1;
  height: 5rem;
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.surface.secondary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  padding: ${tkn('spacing.sm')};
  gap: ${tkn('spacing.xs')};
`;

export const MockupBar = styled.div<{ $height: string }>`
  width: 1.5rem;
  height: ${({ $height }) => $height};
  border-radius: ${tkn('radius.sm')} ${tkn('radius.sm')} 0 0;
  background: ${tkn('colors.brand.primary')};
  opacity: 0.6;
`;

/* ── Platforms ─────────────────────────────────────────── */

export const PlatformsSection = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.xl')};
  padding: ${tkn('spacing.xxl')} ${tkn('spacing.xl')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};

  @media (max-width: 768px) {
    padding: ${tkn('spacing.xl')} ${tkn('spacing.md')};
  }
`;

export const PlatformsTitle = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
  margin: 0;
`;

export const PlatformLogos = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xxl')};

  @media (max-width: 640px) {
    gap: ${tkn('spacing.xl')};
  }
`;

export const PlatformLogo = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.tertiary')};
  opacity: 0.5;
  transition: opacity ${tkn('transitions.fast')};

  &:hover {
    opacity: 0.8;
  }
`;

/* ── Section wrappers ──────────────────────────────────── */

export const Section = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.xl')};
  position: relative;
  width: 100%;
  box-sizing: border-box;

  @media (max-width: 768px) {
    padding: ${tkn('spacing.xxl')} ${tkn('spacing.md')};
  }
`;

export const SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${tkn('spacing.sm')};
  max-width: 36rem;
  margin-bottom: ${tkn('spacing.xxl')};
`;

export const SectionTitle = styled.h2`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(1.5rem, 3vw, ${tkn('typography.fontSize.3xl')});
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
  letter-spacing: ${tkn('typography.letterSpacing.tight')};
`;

export const SectionSubtitle = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.md')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
  line-height: ${tkn('typography.lineHeight.relaxed')};
`;

/* ── Features Grid ─────────────────────────────────────── */

export const FeaturesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.lg')};
  max-width: 72rem;
  width: 100%;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

export const FeatureCard = styled.div<{ $highlight?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.xl')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.xl')};
  transition: all ${tkn('transitions.normal')};
  position: relative;
  overflow: hidden;

  ${({ $highlight }) =>
    $highlight &&
    css`
      grid-column: 1 / -1;

      @media (min-width: 769px) {
        flex-direction: row;
        align-items: flex-start;
      }
    `}

  &:hover {
    box-shadow: ${tkn('shadows.lg')}, 0 0 0 1px ${tkn('colors.landing.cardGlow')};
    transform: translateY(-2px);
    border-color: ${tkn('colors.brand.primary')};
  }
`;

export const FeatureIconWrap = styled.div<{ $highlight?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: ${tkn('radius.lg')};
  background: ${({ $highlight }) =>
    $highlight ? tkn('colors.brand.primary') : tkn('colors.semanticTint.info')};
  color: ${({ $highlight }) =>
    $highlight ? tkn('colors.text.inverse') : tkn('colors.brand.primary')};
  flex-shrink: 0;
`;

export const FeatureContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  flex: 1;
`;

export const FeatureBadge = styled.span`
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.sm')};
  background: ${tkn('colors.semanticTint.info')};
  color: ${tkn('colors.brand.primary')};
  border-radius: ${tkn('radius.full')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
`;

export const FeatureTitle = styled.h3`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const FeatureDesc = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
  line-height: ${tkn('typography.lineHeight.relaxed')};
`;

/* ── How It Works ──────────────────────────────────────── */

export const StepsRow = styled.div`
  display: flex;
  gap: ${tkn('spacing.xl')};
  max-width: 64rem;
  width: 100%;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    top: 2.5rem;
    left: calc(16.67% + 1.5rem);
    right: calc(16.67% + 1.5rem);
    height: 2px;
    background: ${tkn('colors.border.primary')};
    z-index: 0;

    @media (max-width: 768px) {
      display: none;
    }
  }

  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${tkn('spacing.lg')};
  }
`;

export const StepCard = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.xl')};
  position: relative;
  z-index: 1;
`;

export const StepNumber = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 5rem;
  height: 5rem;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.semanticTint.info')};
  color: ${tkn('colors.brand.primary')};
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.xxxl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  border: 3px solid ${tkn('colors.surface.primary')};
  box-shadow: 0 0 0 2px ${tkn('colors.brand.primary')};
`;

export const StepTitle = styled.h3`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.lg')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const StepDesc = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
  line-height: ${tkn('typography.lineHeight.relaxed')};
  max-width: 16rem;
`;

/* ── Per-Product Deep Dive ─────────────────────────────── */

export const PerProductSection = styled(Section)`
  background: ${tkn('colors.landing.sectionAlt')};

  [data-theme='dark'] & {
    background: ${tkn('colors.surface.secondary')};
  }
`;

export const PerProductGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.lg')};
  max-width: 56rem;
  width: 100%;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

export const ProductSettingsCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.xl')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.xl')};
  transition: all ${tkn('transitions.normal')};

  &:hover {
    box-shadow: ${tkn('shadows.lg')};
    transform: translateY(-2px);
  }
`;

export const ProductName = styled.div`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  padding-bottom: ${tkn('spacing.sm')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
`;

export const SettingRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const SettingLabel = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
`;

export const SettingValue = styled.span`
  font-family: ${tkn('typography.fontFamily.mono')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.brand.primary')};
`;

/* ── Stats Section ─────────────────────────────────────── */

export const StatsSection = styled.section`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.xxxl')};
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.xl')};
  background: ${tkn('colors.landing.statsBg')};
  width: 100%;
  box-sizing: border-box;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: ${tkn('spacing.xxl')};
    padding: ${tkn('spacing.xxl')} ${tkn('spacing.md')};
  }
`;

export const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  text-align: center;
`;

export const StatValue = styled.div`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(2rem, 4vw, ${tkn('typography.fontSize.3xl')});
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: #FFFFFF;
  letter-spacing: ${tkn('typography.letterSpacing.tight')};
`;

export const StatLabel = styled.div`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: rgba(255, 255, 255, 0.6);
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
`;

/* ── Testimonials ──────────────────────────────────────── */

export const TestimonialsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.lg')};
  max-width: 72rem;
  width: 100%;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    max-width: 28rem;
  }
`;

export const TestimonialCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.xl')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.xl')};
  transition: all ${tkn('transitions.normal')};

  &:hover {
    box-shadow: ${tkn('shadows.lg')};
    transform: translateY(-2px);
  }
`;

export const TestimonialStars = styled.div`
  display: flex;
  gap: ${tkn('spacing.2xs')};
  color: ${tkn('colors.semantic.warning')};
`;

export const TestimonialText = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
  line-height: ${tkn('typography.lineHeight.relaxed')};
  font-style: italic;
`;

export const TestimonialAuthor = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  margin-top: auto;
  padding-top: ${tkn('spacing.md')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
`;

export const TestimonialName = styled.span`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
`;

export const TestimonialRole = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
`;

/* ── Pricing ───────────────────────────────────────────── */

export const PricingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${tkn('spacing.lg')};
  max-width: 60rem;
  width: 100%;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    max-width: 24rem;
  }
`;

export const PricingCard = styled.div<{ $highlight?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.xl')};
  background: ${tkn('colors.surface.primary')};
  border: 2px solid ${({ $highlight }) => ($highlight ? tkn('colors.brand.primary') : tkn('colors.border.secondary'))};
  border-radius: ${tkn('radius.xl')};
  position: relative;
  transition: all ${tkn('transitions.normal')};

  &:hover {
    box-shadow: ${tkn('shadows.xl')};
    transform: translateY(-2px);
  }

  ${({ $highlight, theme }) =>
    $highlight &&
    css`
      box-shadow: ${theme.shadows.xl};

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, #4263EB, #6366F1, #818CF8);
        border-radius: ${theme.radius.xl} ${theme.radius.xl} 0 0;
      }
    `}
`;

export const PlanBadge = styled.span`
  position: absolute;
  top: -0.75rem;
  left: 50%;
  transform: translateX(-50%);
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.md')};
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.text.inverse')};
  border-radius: ${tkn('radius.full')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
  white-space: nowrap;
`;

export const PlanName = styled.h3`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const PlanPrice = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${tkn('spacing.xs')};
`;

export const PlanAmount = styled.span`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.3xl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
`;

export const PlanPeriod = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.tertiary')};
`;

export const PlanDesc = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
`;

export const PlanFeatures = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const PlanFeature = styled.li`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
`;

export const PlanCTA = styled.button<{ $highlight?: boolean }>`
  width: 100%;
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};
  margin-top: auto;

  ${({ $highlight, theme }) =>
    $highlight
      ? css`
          background: ${theme.colors.brand.primary};
          color: ${theme.colors.text.inverse};
          border: none;

          &:hover {
            background: ${theme.colors.brand.primaryHover};
            box-shadow: 0 0 0 4px rgba(66, 99, 235, 0.15);
          }
        `
      : css`
          background: transparent;
          color: ${theme.colors.text.primary};
          border: 1px solid ${theme.colors.border.primary};

          &:hover {
            border-color: ${theme.colors.brand.primary};
            color: ${theme.colors.brand.primary};
          }
        `}
`;

/* ── FAQ ─────────────────────────────────────────────────── */

export const FAQGrid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  max-width: 48rem;
  width: 100%;
`;

export const FAQItem = styled.div<{ $isOpen: boolean }>`
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.xl')};
  overflow: hidden;
  background: ${tkn('colors.surface.primary')};
  transition: border-color ${tkn('transitions.fast')};

  ${({ $isOpen, theme }) =>
    $isOpen &&
    css`
      border-color: ${theme.colors.brand.primary};
      border-left: 3px solid ${theme.colors.brand.primary};
    `}
`;

export const FAQQuestion = styled.button<{ $isOpen: boolean }>`
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.lg')} ${tkn('spacing.xl')};
  background: none;
  border: none;
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  text-align: left;
  cursor: pointer;
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.surface.secondary')};
  }
`;

export const FAQAnswer = styled.div<{ $isOpen: boolean }>`
  max-height: ${({ $isOpen }) => ($isOpen ? '30rem' : '0')};
  overflow: hidden;
  transition: all ${tkn('transitions.normal')};

  ${({ $isOpen, theme }) =>
    $isOpen &&
    css`
      padding: 0 ${theme.spacing.xl} ${theme.spacing.lg};
    `}
`;

export const FAQAnswerText = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  margin: 0;
  line-height: ${tkn('typography.lineHeight.relaxed')};
`;

/* ── CTA Banner ──────────────────────────────────────────── */

export const CTABanner = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.xl')};
  background: ${tkn('colors.landing.heroGradient')};
  width: 100%;
  box-sizing: border-box;
`;

export const CTABannerHeadline = styled.h2`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(1.5rem, 3vw, ${tkn('typography.fontSize.3xl')});
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: #FFFFFF;
  margin: 0;
  letter-spacing: ${tkn('typography.letterSpacing.tight')};
`;

export const CTABannerSub = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.md')};
  color: rgba(255, 255, 255, 0.85);
  margin: 0;
  max-width: 36rem;
`;

export const CTABannerButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.xxl')};
  background: #FFFFFF;
  color: ${tkn('colors.brand.primary')};
  border: none;
  border-radius: ${tkn('radius.lg')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.xl')};
    transform: translateY(-1px);
    background: #F8FAFC;
  }
`;

/* ── Footer ──────────────────────────────────────────────── */

export const Footer = styled.footer`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xxl')};
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.xl')} ${tkn('spacing.xl')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
  width: 100%;
  box-sizing: border-box;
  background: ${tkn('colors.landing.sectionAlt')};

  [data-theme='dark'] & {
    background: ${tkn('colors.surface.secondary')};
  }

  @media (max-width: 768px) {
    padding: ${tkn('spacing.xxl')} ${tkn('spacing.md')} ${tkn('spacing.md')};
  }
`;

export const FooterGrid = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1fr 1fr;
  gap: ${tkn('spacing.xl')};
  max-width: 72rem;
  width: 100%;
  margin: 0 auto;

  @media (max-width: 768px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

export const FooterBrand = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const FooterDescription = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.tertiary')};
  margin: 0;
  line-height: ${tkn('typography.lineHeight.relaxed')};
  max-width: 20rem;
`;

export const FooterColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const FooterColumnTitle = styled.h4`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const FooterLink = styled.button`
  background: none;
  border: none;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.tertiary')};
  cursor: pointer;
  padding: 0;
  text-align: left;

  &:hover {
    color: ${tkn('colors.text.secondary')};
  }
`;

export const FooterDivider = styled.div`
  width: 100%;
  max-width: 72rem;
  margin: 0 auto;
  height: 1px;
  background: ${tkn('colors.border.secondary')};
`;

export const FooterBottom = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  max-width: 72rem;
  width: 100%;
  margin: 0 auto;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${tkn('spacing.md')};
    text-align: center;
  }
`;

export const FooterCopyright = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.tertiary')};
  margin: 0;
`;

/* ── Scroll reveal ──────────────────────────────────────── */

export const RevealWrapper = styled.div<{ $visible: boolean }>`
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transform: translateY(${({ $visible }) => ($visible ? '0' : '1.5rem')});
  transition: opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
`;
