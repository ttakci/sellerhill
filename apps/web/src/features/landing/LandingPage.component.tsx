import { Icon, type LocaleOption, LanguageSwitcher, Logo, ThemeToggle } from '@repo/ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './LandingPage.style';
import type { LandingPageProps } from './LandingPage.types';

const LOCALE_OPTIONS: LocaleOption[] = [
  { code: 'en', displayName: 'English' },
  { code: 'tr', displayName: 'Türkçe' },
];

const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;

const TESTIMONIAL_KEYS = ['t1', 't2', 't3'] as const;

export const LandingPageComponent = ({
  currentLocale,
  scrolled,
  mobileMenuOpen,
  onLocaleChange,
  onNavigateLogin,
  onNavigateRegister,
  onToggleMobileMenu,
  onCloseMobileMenu,
}: LandingPageProps): React.ReactElement => {
  const { t } = useTranslation('translation');
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [revealState, setRevealState] = useState<Record<string, boolean>>({});
  const observersRef = useRef<Map<Element, IntersectionObserver>>(new Map());

  const toggleFaq = useCallback((index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  }, []);

  useEffect(() => {
    const sections = document.querySelectorAll('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-reveal');
            if (id) {
              setRevealState((prev) => ({ ...prev, [id]: true }));
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.15 }
    );

    sections.forEach((section) => observer.observe(section));
    observersRef.current.set(document.body, observer);

    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    onCloseMobileMenu();
  }, [onCloseMobileMenu]);

  return (
    <S.Page>
      {/* ── Navbar ────────────────────────────────────── */}
      <S.Navbar $scrolled={scrolled}>
        <S.NavLeft>
          <Logo compact height={40} />
        </S.NavLeft>
        <S.NavCenter>
          <S.NavLink type="button" onClick={() => scrollTo('features')}>
            {t('translation:landing.navbar.features')}
          </S.NavLink>
          <S.NavLink type="button" onClick={() => scrollTo('how-it-works')}>
            {t('translation:landing.navbar.howItWorks')}
          </S.NavLink>
          <S.NavLink type="button" onClick={() => scrollTo('pricing')}>
            {t('translation:landing.navbar.pricing')}
          </S.NavLink>
          <S.NavLink type="button" onClick={() => scrollTo('faq')}>
            {t('translation:landing.navbar.faq')}
          </S.NavLink>
        </S.NavCenter>
        <S.NavRight>
          <S.ToggleGroup>
            <LanguageSwitcher
              currentLocale={currentLocale}
              locales={LOCALE_OPTIONS}
              onLocaleChange={(code) => onLocaleChange(code as 'en' | 'tr')}
              variant="compact"
            />
            <ThemeToggle />
          </S.ToggleGroup>
          <S.NavCTASecondary type="button" onClick={onNavigateLogin}>
            {t('translation:landing.navbar.login')}
          </S.NavCTASecondary>
          <S.NavCTAPrimary type="button" onClick={onNavigateRegister}>
            {t('translation:landing.navbar.getStarted')}
          </S.NavCTAPrimary>
          <S.HamburgerButton $open={mobileMenuOpen} type="button" onClick={onToggleMobileMenu}>
            <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={24} />
          </S.HamburgerButton>
        </S.NavRight>
      </S.Navbar>

      {/* ── Mobile Menu ───────────────────────────────── */}
      <S.MobileMenuOverlay $open={mobileMenuOpen} onClick={onCloseMobileMenu} />
      <S.MobileMenu $open={mobileMenuOpen}>
        <S.MobileMenuClose type="button" onClick={onCloseMobileMenu}>
          <Icon name="x" size={24} />
        </S.MobileMenuClose>
        <S.MobileNavLinks>
          <S.MobileNavLink type="button" onClick={() => scrollTo('features')}>
            {t('translation:landing.navbar.features')}
          </S.MobileNavLink>
          <S.MobileNavLink type="button" onClick={() => scrollTo('how-it-works')}>
            {t('translation:landing.navbar.howItWorks')}
          </S.MobileNavLink>
          <S.MobileNavLink type="button" onClick={() => scrollTo('pricing')}>
            {t('translation:landing.navbar.pricing')}
          </S.MobileNavLink>
          <S.MobileNavLink type="button" onClick={() => scrollTo('faq')}>
            {t('translation:landing.navbar.faq')}
          </S.MobileNavLink>
        </S.MobileNavLinks>
        <S.MobileCTAGroup>
          <S.NavCTASecondary type="button" onClick={onNavigateLogin}>
            {t('translation:landing.navbar.login')}
          </S.NavCTASecondary>
          <S.NavCTAPrimary type="button" onClick={onNavigateRegister}>
            {t('translation:landing.navbar.getStarted')}
          </S.NavCTAPrimary>
        </S.MobileCTAGroup>
      </S.MobileMenu>

      {/* ── Hero ──────────────────────────────────────── */}
      <S.HeroSection>
        <S.HeroMesh>
          <S.HeroGradientOrb $x="-10%" $y="-20%" $color="rgba(66, 99, 235, 0.4)" />
          <S.HeroGradientOrb $x="60%" $y="20%" $color="rgba(99, 102, 241, 0.3)" />
          <S.HeroGradientOrb $x="30%" $y="60%" $color="rgba(59, 130, 246, 0.2)" />
          <S.HeroGrid />
        </S.HeroMesh>
        <S.HeroContent>
          <S.HeroBadge>
            <S.HeroBadgeIcon>
              <Icon name="zap" size={12} />
            </S.HeroBadgeIcon>
            {t('translation:landing.hero.badge')}
          </S.HeroBadge>
          <S.HeroHeadline>{t('translation:landing.hero.headline')}</S.HeroHeadline>
          <S.HeroSubheading>{t('translation:landing.hero.subheading')}</S.HeroSubheading>
          <S.HeroCTAGroup>
            <S.PrimaryCTA type="button" onClick={onNavigateRegister}>
              {t('translation:landing.hero.ctaPrimary')}
              <Icon name="arrow-right" size={18} />
            </S.PrimaryCTA>
            <S.SecondaryCTA type="button" onClick={() => scrollTo('how-it-works')}>
              {t('translation:landing.hero.ctaSecondary')}
              <Icon name="chevron-down" size={16} />
            </S.SecondaryCTA>
          </S.HeroCTAGroup>
          <S.HeroStatsRow>
            <S.HeroStat>
              <S.HeroStatValue>{t('translation:landing.stats.sellers.value')}</S.HeroStatValue>
              <S.HeroStatLabel>{t('translation:landing.stats.sellers.label')}</S.HeroStatLabel>
            </S.HeroStat>
            <S.HeroStat>
              <S.HeroStatValue>{t('translation:landing.stats.orders.value')}</S.HeroStatValue>
              <S.HeroStatLabel>{t('translation:landing.stats.orders.label')}</S.HeroStatLabel>
            </S.HeroStat>
            <S.HeroStat>
              <S.HeroStatValue>{t('translation:landing.stats.uptime.value')}</S.HeroStatValue>
              <S.HeroStatLabel>{t('translation:landing.stats.uptime.label')}</S.HeroStatLabel>
            </S.HeroStat>
            <S.HeroStat>
              <S.HeroStatValue>{t('translation:landing.stats.countries.value')}</S.HeroStatValue>
              <S.HeroStatLabel>{t('translation:landing.stats.countries.label')}</S.HeroStatLabel>
            </S.HeroStat>
          </S.HeroStatsRow>
        </S.HeroContent>

        {/* ── Dashboard Mockup ──────────────────────── */}
        <S.DashboardMockup>
          <S.MockupTitleBar>
            <S.MockupDot $color="#EF4444" />
            <S.MockupDot $color="#F59E0B" />
            <S.MockupDot $color="#10B981" />
          </S.MockupTitleBar>
          <S.MockupBody>
            <S.MockupSidebar>
              <S.MockupSidebarItem $active />
              <S.MockupSidebarItem />
              <S.MockupSidebarItem />
              <S.MockupSidebarItem $active />
              <S.MockupSidebarItem />
            </S.MockupSidebar>
            <S.MockupContent>
              <S.MockupCardRow>
                <S.MockupCard />
                <S.MockupCard />
                <S.MockupCard />
              </S.MockupCardRow>
              <S.MockupChart>
                <S.MockupBar $height="30%" />
                <S.MockupBar $height="55%" />
                <S.MockupBar $height="40%" />
                <S.MockupBar $height="70%" />
                <S.MockupBar $height="50%" />
                <S.MockupBar $height="85%" />
                <S.MockupBar $height="60%" />
              </S.MockupChart>
            </S.MockupContent>
          </S.MockupBody>
        </S.DashboardMockup>
      </S.HeroSection>

      {/* ── Platforms ──────────────────────────────────── */}
      <S.PlatformsSection>
        <S.PlatformsTitle>{t('translation:landing.platforms.title')}</S.PlatformsTitle>
        <S.PlatformLogos>
          <S.PlatformLogo>
            <Icon name="brand-amazon" size={28} />
          </S.PlatformLogo>
          <S.PlatformLogo>
            <Icon name="brand-ebay" size={28} />
          </S.PlatformLogo>
        </S.PlatformLogos>
      </S.PlatformsSection>

      {/* ── Features ──────────────────────────────────── */}
      <S.Section data-reveal="features" id="features">
        <S.RevealWrapper $visible={revealState['features'] ?? false}>
          <S.SectionHeader>
            <S.SectionTitle>{t('translation:landing.features.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.features.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHeader>
        </S.RevealWrapper>
        <S.FeaturesGrid>
          <S.FeatureCard>
            <S.FeatureIconWrap>
              <Icon name="plus" size={20} color="brand.primary" />
            </S.FeatureIconWrap>
            <S.FeatureContent>
              <S.FeatureTitle>{t('translation:landing.features.asinListing.title')}</S.FeatureTitle>
              <S.FeatureDesc>{t('translation:landing.features.asinListing.description')}</S.FeatureDesc>
            </S.FeatureContent>
          </S.FeatureCard>

          <S.FeatureCard>
            <S.FeatureIconWrap>
              <Icon name="sync" size={20} color="brand.primary" />
            </S.FeatureIconWrap>
            <S.FeatureContent>
              <S.FeatureTitle>{t('translation:landing.features.stockPriceSync.title')}</S.FeatureTitle>
              <S.FeatureDesc>{t('translation:landing.features.stockPriceSync.description')}</S.FeatureDesc>
            </S.FeatureContent>
          </S.FeatureCard>

          <S.FeatureCard>
            <S.FeatureIconWrap>
              <Icon name="shopping-cart" size={20} color="brand.primary" />
            </S.FeatureIconWrap>
            <S.FeatureContent>
              <S.FeatureTitle>{t('translation:landing.features.autoOrder.title')}</S.FeatureTitle>
              <S.FeatureDesc>{t('translation:landing.features.autoOrder.description')}</S.FeatureDesc>
            </S.FeatureContent>
          </S.FeatureCard>

          <S.FeatureCard>
            <S.FeatureIconWrap>
              <Icon name="edit" size={20} color="brand.primary" />
            </S.FeatureIconWrap>
            <S.FeatureContent>
              <S.FeatureTitle>{t('translation:landing.features.manualOrder.title')}</S.FeatureTitle>
              <S.FeatureDesc>{t('translation:landing.features.manualOrder.description')}</S.FeatureDesc>
            </S.FeatureContent>
          </S.FeatureCard>

          <S.FeatureCard>
            <S.FeatureIconWrap>
              <Icon name="local-shipping" size={20} color="brand.primary" />
            </S.FeatureIconWrap>
            <S.FeatureContent>
              <S.FeatureTitle>{t('translation:landing.features.tracking.title')}</S.FeatureTitle>
              <S.FeatureDesc>{t('translation:landing.features.tracking.description')}</S.FeatureDesc>
            </S.FeatureContent>
          </S.FeatureCard>

          <S.FeatureCard $highlight>
            <S.FeatureIconWrap $highlight>
              <Icon name="rule" size={20} color="inverse" />
            </S.FeatureIconWrap>
            <S.FeatureContent>
              <S.FeatureBadge>{t('translation:landing.features.perProduct.badge')}</S.FeatureBadge>
              <S.FeatureTitle>{t('translation:landing.features.perProduct.title')}</S.FeatureTitle>
              <S.FeatureDesc>{t('translation:landing.features.perProduct.description')}</S.FeatureDesc>
            </S.FeatureContent>
          </S.FeatureCard>
        </S.FeaturesGrid>
      </S.Section>

      {/* ── How It Works ──────────────────────────────── */}
      <S.Section data-reveal="how-it-works" id="how-it-works">
        <S.RevealWrapper $visible={revealState['how-it-works'] ?? false}>
          <S.SectionHeader>
            <S.SectionTitle>{t('translation:landing.howItWorks.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.howItWorks.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHeader>
        </S.RevealWrapper>
        <S.RevealWrapper $visible={revealState['how-it-works'] ?? false}>
          <S.StepsRow>
            {(['step1', 'step2', 'step3'] as const).map((step, index) => (
              <S.StepCard key={step}>
                <S.StepNumber>{index + 1}</S.StepNumber>
                <S.StepTitle>{t(`translation:landing.howItWorks.${step}.title`)}</S.StepTitle>
                <S.StepDesc>{t(`translation:landing.howItWorks.${step}.description`)}</S.StepDesc>
              </S.StepCard>
            ))}
          </S.StepsRow>
        </S.RevealWrapper>
      </S.Section>

      {/* ── Per-Product Deep Dive ─────────────────────── */}
      <S.PerProductSection data-reveal="per-product">
        <S.RevealWrapper $visible={revealState['per-product'] ?? false}>
          <S.SectionHeader>
            <S.SectionTitle>{t('translation:landing.perProduct.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.perProduct.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHeader>
        </S.RevealWrapper>
        <S.RevealWrapper $visible={revealState['per-product'] ?? false}>
          <S.PerProductGrid>
            {(['productA', 'productB', 'productC'] as const).map((product) => (
              <S.ProductSettingsCard key={product}>
                <S.ProductName>{t(`translation:landing.perProduct.${product}.name`)}</S.ProductName>
                {(['margin', 'stock', 'template'] as const).map((setting) => (
                  <S.SettingRow key={setting}>
                    <S.SettingLabel>{t(`translation:landing.perProduct.labels.${setting}`)}</S.SettingLabel>
                    <S.SettingValue>{t(`translation:landing.perProduct.${product}.${setting}`)}</S.SettingValue>
                  </S.SettingRow>
                ))}
              </S.ProductSettingsCard>
            ))}
          </S.PerProductGrid>
        </S.RevealWrapper>
      </S.PerProductSection>

      {/* ── Stats ──────────────────────────────────────── */}
      <S.StatsSection data-reveal="stats">
        <S.RevealWrapper $visible={revealState['stats'] ?? false}>
          <S.StatItem>
            <S.StatValue>{t('translation:landing.stats.sellers.value')}</S.StatValue>
            <S.StatLabel>{t('translation:landing.stats.sellers.label')}</S.StatLabel>
          </S.StatItem>
        </S.RevealWrapper>
        <S.RevealWrapper $visible={revealState['stats'] ?? false}>
          <S.StatItem>
            <S.StatValue>{t('translation:landing.stats.orders.value')}</S.StatValue>
            <S.StatLabel>{t('translation:landing.stats.orders.label')}</S.StatLabel>
          </S.StatItem>
        </S.RevealWrapper>
        <S.RevealWrapper $visible={revealState['stats'] ?? false}>
          <S.StatItem>
            <S.StatValue>{t('translation:landing.stats.uptime.value')}</S.StatValue>
            <S.StatLabel>{t('translation:landing.stats.uptime.label')}</S.StatLabel>
          </S.StatItem>
        </S.RevealWrapper>
        <S.RevealWrapper $visible={revealState['stats'] ?? false}>
          <S.StatItem>
            <S.StatValue>{t('translation:landing.stats.countries.value')}</S.StatValue>
            <S.StatLabel>{t('translation:landing.stats.countries.label')}</S.StatLabel>
          </S.StatItem>
        </S.RevealWrapper>
      </S.StatsSection>

      {/* ── Testimonials ──────────────────────────────── */}
      <S.Section data-reveal="testimonials">
        <S.RevealWrapper $visible={revealState['testimonials'] ?? false}>
          <S.SectionHeader>
            <S.SectionTitle>{t('translation:landing.testimonials.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.testimonials.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHeader>
        </S.RevealWrapper>
        <S.RevealWrapper $visible={revealState['testimonials'] ?? false}>
          <S.TestimonialsGrid>
            {TESTIMONIAL_KEYS.map((key) => {
              const rating = parseInt(t(`translation:landing.testimonials.${key}.rating`), 10);
              return (
                <S.TestimonialCard key={key}>
                  <S.TestimonialStars>
                    {Array.from({ length: rating }, (_, i) => (
                      <Icon key={i} name="star" size={16} />
                    ))}
                  </S.TestimonialStars>
                  <S.TestimonialText>{t(`translation:landing.testimonials.${key}.text`)}</S.TestimonialText>
                  <S.TestimonialAuthor>
                    <S.TestimonialName>{t(`translation:landing.testimonials.${key}.name`)}</S.TestimonialName>
                    <S.TestimonialRole>{t(`translation:landing.testimonials.${key}.role`)}</S.TestimonialRole>
                  </S.TestimonialAuthor>
                </S.TestimonialCard>
              );
            })}
          </S.TestimonialsGrid>
        </S.RevealWrapper>
      </S.Section>

      {/* ── Pricing ───────────────────────────────────── */}
      <S.PerProductSection data-reveal="pricing" id="pricing">
        <S.RevealWrapper $visible={revealState['pricing'] ?? false}>
          <S.SectionHeader>
            <S.SectionTitle>{t('translation:landing.pricing.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.pricing.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHeader>
        </S.RevealWrapper>
        <S.RevealWrapper $visible={revealState['pricing'] ?? false}>
          <S.PricingGrid>
            {/* Starter */}
            <S.PricingCard>
              <S.PlanName>{t('translation:landing.pricing.starter.name')}</S.PlanName>
              <S.PlanPrice>
                <S.PlanAmount>{t('translation:landing.pricing.starter.price')}</S.PlanAmount>
                <S.PlanPeriod>{t('translation:landing.pricing.starter.period')}</S.PlanPeriod>
              </S.PlanPrice>
              <S.PlanDesc>{t('translation:landing.pricing.starter.description')}</S.PlanDesc>
              <S.PlanFeatures>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.starter.features.listings')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.starter.features.sync')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.starter.features.orders')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.starter.features.tracking')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.starter.features.support')}</S.PlanFeature>
              </S.PlanFeatures>
              <S.PlanCTA type="button" onClick={onNavigateRegister}>{t('translation:landing.pricing.starter.cta')}</S.PlanCTA>
            </S.PricingCard>

            {/* Pro */}
            <S.PricingCard $highlight>
              <S.PlanBadge>{t('translation:landing.pricing.pro.badge')}</S.PlanBadge>
              <S.PlanName>{t('translation:landing.pricing.pro.name')}</S.PlanName>
              <S.PlanPrice>
                <S.PlanAmount>{t('translation:landing.pricing.pro.price')}</S.PlanAmount>
                <S.PlanPeriod>{t('translation:landing.pricing.pro.period')}</S.PlanPeriod>
              </S.PlanPrice>
              <S.PlanDesc>{t('translation:landing.pricing.pro.description')}</S.PlanDesc>
              <S.PlanFeatures>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.pro.features.listings')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.pro.features.sync')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.pro.features.orders')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.pro.features.tracking')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.pro.features.settings')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.pro.features.support')}</S.PlanFeature>
              </S.PlanFeatures>
              <S.PlanCTA type="button" $highlight onClick={onNavigateRegister}>{t('translation:landing.pricing.pro.cta')}</S.PlanCTA>
            </S.PricingCard>

            {/* Enterprise */}
            <S.PricingCard>
              <S.PlanName>{t('translation:landing.pricing.enterprise.name')}</S.PlanName>
              <S.PlanPrice>
                <S.PlanAmount>{t('translation:landing.pricing.enterprise.price')}</S.PlanAmount>
                <S.PlanPeriod>{t('translation:landing.pricing.enterprise.period')}</S.PlanPeriod>
              </S.PlanPrice>
              <S.PlanDesc>{t('translation:landing.pricing.enterprise.description')}</S.PlanDesc>
              <S.PlanFeatures>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.enterprise.features.listings')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.enterprise.features.sync')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.enterprise.features.orders')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.enterprise.features.tracking')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.enterprise.features.settings')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.enterprise.features.api')}</S.PlanFeature>
                <S.PlanFeature><Icon name="check" size={14} color="semantic.success" /> {t('translation:landing.pricing.enterprise.features.support')}</S.PlanFeature>
              </S.PlanFeatures>
              <S.PlanCTA type="button" onClick={onNavigateRegister}>{t('translation:landing.pricing.enterprise.cta')}</S.PlanCTA>
            </S.PricingCard>
          </S.PricingGrid>
        </S.RevealWrapper>
      </S.PerProductSection>

      {/* ── FAQ ───────────────────────────────────────── */}
      <S.Section data-reveal="faq" id="faq">
        <S.RevealWrapper $visible={revealState['faq'] ?? false}>
          <S.SectionHeader>
            <S.SectionTitle>{t('translation:landing.faq.sectionTitle')}</S.SectionTitle>
          </S.SectionHeader>
        </S.RevealWrapper>
        <S.RevealWrapper $visible={revealState['faq'] ?? false}>
          <S.FAQGrid>
            {FAQ_KEYS.map((key, index) => (
              <S.FAQItem key={key} $isOpen={openFaq === index}>
                <S.FAQQuestion $isOpen={openFaq === index} type="button" onClick={() => toggleFaq(index)}>
                  <span>{t(`translation:landing.faq.${key}.question`)}</span>
                  <Icon name={openFaq === index ? 'chevron-up' : 'chevron-down'} size={18} />
                </S.FAQQuestion>
                <S.FAQAnswer $isOpen={openFaq === index}>
                  <S.FAQAnswerText>{t(`translation:landing.faq.${key}.answer`)}</S.FAQAnswerText>
                </S.FAQAnswer>
              </S.FAQItem>
            ))}
          </S.FAQGrid>
        </S.RevealWrapper>
      </S.Section>

      {/* ── CTA Banner ────────────────────────────────── */}
      <S.CTABanner>
        <S.CTABannerHeadline>{t('translation:landing.cta.headline')}</S.CTABannerHeadline>
        <S.CTABannerSub>{t('translation:landing.cta.subheading')}</S.CTABannerSub>
        <S.CTABannerButton type="button" onClick={onNavigateRegister}>
          {t('translation:landing.cta.button')}
          <Icon name="arrow-right" size={18} />
        </S.CTABannerButton>
      </S.CTABanner>

      {/* ── Footer ────────────────────────────────────── */}
      <S.Footer>
        <S.FooterGrid>
          <S.FooterBrand>
            <Logo compact height={32} />
            <S.FooterDescription>{t('translation:landing.footer.description')}</S.FooterDescription>
          </S.FooterBrand>
          <S.FooterColumn>
            <S.FooterColumnTitle>{t('translation:landing.footer.product')}</S.FooterColumnTitle>
            <S.FooterLink type="button" onClick={() => scrollTo('features')}>
              {t('translation:landing.footer.links.features')}
            </S.FooterLink>
            <S.FooterLink type="button" onClick={() => scrollTo('pricing')}>
              {t('translation:landing.footer.links.pricing')}
            </S.FooterLink>
            <S.FooterLink type="button" onClick={() => scrollTo('how-it-works')}>
              {t('translation:landing.footer.links.howItWorks')}
            </S.FooterLink>
            <S.FooterLink type="button" onClick={() => scrollTo('faq')}>
              {t('translation:landing.footer.links.faq')}
            </S.FooterLink>
          </S.FooterColumn>
          <S.FooterColumn>
            <S.FooterColumnTitle>{t('translation:landing.footer.company')}</S.FooterColumnTitle>
            <S.FooterLink type="button">{t('translation:landing.footer.companyLinks.about')}</S.FooterLink>
            <S.FooterLink type="button">{t('translation:landing.footer.companyLinks.blog')}</S.FooterLink>
            <S.FooterLink type="button">{t('translation:landing.footer.companyLinks.careers')}</S.FooterLink>
            <S.FooterLink type="button">{t('translation:landing.footer.companyLinks.contact')}</S.FooterLink>
          </S.FooterColumn>
          <S.FooterColumn>
            <S.FooterColumnTitle>{t('translation:landing.footer.legal')}</S.FooterColumnTitle>
            <S.FooterLink type="button">{t('translation:landing.footer.legalLinks.privacy')}</S.FooterLink>
            <S.FooterLink type="button">{t('translation:landing.footer.legalLinks.terms')}</S.FooterLink>
            <S.FooterLink type="button">{t('translation:landing.footer.legalLinks.cookies')}</S.FooterLink>
          </S.FooterColumn>
        </S.FooterGrid>
        <S.FooterDivider />
        <S.FooterBottom>
          <S.FooterCopyright>{t('translation:landing.footer.copyright', { year: new Date().getFullYear() })}</S.FooterCopyright>
        </S.FooterBottom>
      </S.Footer>
    </S.Page>
  );
};
