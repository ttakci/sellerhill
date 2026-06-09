import { css, keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(1.5rem); }
  to { opacity: 1; transform: translateY(0); }
`;

export const Page = styled.div`
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: ${tkn('colors.background.primary')};
  position: relative;
  overflow-x: hidden;
`;

/* ── Navbar ─────────────────────────────────────────────── */

export const Navbar = styled.nav`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
  background: rgba(248, 250, 252, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  transition: background ${tkn('transitions.normal')};

  [data-theme='dark'] & {
    background: rgba(15, 23, 42, 0.85);
  }

  @media (max-width: 768px) {
    padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  }
`;

export const NavLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xl')};
`;

export const NavCenter = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.lg')};

  @media (max-width: 768px) {
    display: none;
  }
`;

export const NavRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
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
  border-radius: ${tkn('radius.md')};
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
`;

export const ToggleGroup = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

/* ── Hero ───────────────────────────────────────────────── */

export const HeroSection = styled.section`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.xl')} ${tkn('spacing.xxl')};
  padding-top: 7rem;
  min-height: 90vh;
  overflow: hidden;

  @media (max-width: 768px) {
    padding: 6rem ${tkn('spacing.md')} ${tkn('spacing.xl')};
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
  animation: ${fadeInUp} 1s ease-out both;
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

export const HeroHeadline = styled.h1`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(2rem, 5vw, 3.5rem);
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

/* ── Social Proof ───────────────────────────────────────── */

export const SocialProofSection = styled.section`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.xl')} ${tkn('spacing.xl')} ${tkn('spacing.xxl')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  animation: ${fadeInUp} 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both;
`;

export const SocialProofLabel = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.wider')};
  margin: 0;
`;

export const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.lg')};
  flex-wrap: wrap;
  justify-content: center;
`;

export const TrustBadge = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.full')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
  white-space: nowrap;
`;

/* ── Section wrappers ───────────────────────────────────── */

export const Section = styled.section<{ $pad?: boolean }>`
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

/* ── Features Grid ──────────────────────────────────────── */

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
  border: 1px solid ${({ $highlight }) => ($highlight ? tkn('colors.brand.primary') : tkn('colors.border.secondary'))};
  border-radius: ${tkn('radius.xl')};
  transition: all ${tkn('transitions.normal')};
  position: relative;
  overflow: hidden;

  ${({ $highlight, theme }) =>
    $highlight &&
    css`
      grid-column: 1 / -1;

      @media (min-width: 769px) {
        flex-direction: row;
        align-items: flex-start;
      }

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: linear-gradient(90deg, ${theme.colors.brand.primary}, ${theme.colors.brand.primaryHover});
      }
    `}

  &:hover {
    box-shadow: ${tkn('shadows.lg')};
    transform: translateY(-2px);
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

/* ── How It Works ───────────────────────────────────────── */

export const StepsRow = styled.div`
  display: flex;
  gap: ${tkn('spacing.xl')};
  max-width: 64rem;
  width: 100%;

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
`;

export const StepNumber = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.semanticTint.info')};
  color: ${tkn('colors.brand.primary')};
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
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
`;

/* ── Per-Product Deep Dive ──────────────────────────────── */

export const PerProductSection = styled(Section)`
  background: ${tkn('colors.surface.secondary')};
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

/* ── Pricing ────────────────────────────────────────────── */

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

export const FAQItem = styled.div`
  border: 1px solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.xl')};
  overflow: hidden;
  background: ${tkn('colors.surface.primary')};
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
  padding: ${({ $isOpen, theme }) => ($isOpen ? `0 ${theme.spacing.xl} ${theme.spacing.lg}` : '0')};
  max-height: ${({ $isOpen }) => ($isOpen ? '20rem' : '0')};
  overflow: hidden;
  transition: all ${tkn('transitions.normal')};
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
  background: ${tkn('colors.sidebar.background')};
  width: 100%;
  box-sizing: border-box;
`;

export const CTABannerHeadline = styled.h2`
  font-family: ${tkn('typography.fontFamily.heading')};
  font-size: clamp(1.5rem, 3vw, ${tkn('typography.fontSize.3xl')});
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.sidebar.text')};
  margin: 0;
  letter-spacing: ${tkn('typography.letterSpacing.tight')};
`;

export const CTABannerSub = styled.p`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.md')};
  color: ${tkn('colors.sidebar.textMuted')};
  margin: 0;
`;

export const CTABannerButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.xxl')};
  background: ${tkn('colors.text.inverse')};
  color: ${tkn('colors.sidebar.background')};
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
  }
`;

/* ── Footer ──────────────────────────────────────────────── */

export const Footer = styled.footer`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.xxl')} ${tkn('spacing.xl')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
  width: 100%;
  box-sizing: border-box;
`;

export const FooterContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  max-width: 72rem;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: ${tkn('spacing.md')};
  }
`;

export const FooterLinks = styled.div`
  display: flex;
  gap: ${tkn('spacing.lg')};
  flex-wrap: wrap;
  justify-content: center;
`;

export const FooterLink = styled.button`
  background: none;
  border: none;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.tertiary')};
  cursor: pointer;
  padding: 0;

  &:hover {
    color: ${tkn('colors.text.secondary')};
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
