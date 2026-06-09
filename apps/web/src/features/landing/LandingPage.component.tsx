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

export const LandingPageComponent = ({
  currentLocale,
  onLocaleChange,
  onNavigateLogin,
  onNavigateRegister,
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
  }, []);

  return (
    <S.Page>
      {/* ── Navbar ────────────────────────────────────── */}
      <S.Navbar>
        <S.NavLeft>
          <Logo size={100} />
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
        </S.NavRight>
      </S.Navbar>

      {/* ── Hero ──────────────────────────────────────── */}
      <S.HeroSection>
        <S.HeroMesh>
          <S.HeroGradientOrb
            $x="-10%"
            $y="-20%"
            $color="rgba(66, 99, 235, 0.4)"
          />
          <S.HeroGradientOrb
            $x="60%"
            $y="20%"
            $color="rgba(59, 130, 246, 0.3)"
          />
          <S.HeroGradientOrb
            $x="30%"
            $y="60%"
            $color="rgba(37, 99, 235, 0.2)"
          />
          <S.HeroGrid />
        </S.HeroMesh>
        <S.HeroContent>
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
        </S.HeroContent>
      </S.HeroSection>

      {/* ── Social Proof ──────────────────────────────── */}
      <S.SocialProofSection>
        <S.SocialProofLabel>{t('translation:landing.socialProof.label', { count: 2500 })}</S.SocialProofLabel>
        <S.BadgeRow>
          <S.TrustBadge>
            <Icon name="bolt" size={14} />
            {t('translation:landing.socialProof.badges.automation')}
          </S.TrustBadge>
          <S.TrustBadge>
            <Icon name="check-circle" size={14} />
            {t('translation:landing.socialProof.badges.uptime')}
          </S.TrustBadge>
          <S.TrustBadge>
            <Icon name="globe" size={14} />
            {t('translation:landing.socialProof.badges.support')}
          </S.TrustBadge>
        </S.BadgeRow>
      </S.SocialProofSection>

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
      <S.Section data-reveal="how-it-works" id="how-it-works" style={{ background: 'transparent' }}>
        <S.RevealWrapper $visible={revealState['how-it-works'] ?? false}>
          <S.SectionHeader>
            <S.SectionTitle>{t('translation:landing.howItWorks.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.howItWorks.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHeader>
        </S.RevealWrapper>
        <S.RevealWrapper $visible={revealState['how-it-works'] ?? false}>
          <S.StepsRow>
            <S.StepCard>
              <S.StepNumber>1</S.StepNumber>
              <S.StepTitle>{t('translation:landing.howItWorks.step1.title')}</S.StepTitle>
              <S.StepDesc>{t('translation:landing.howItWorks.step1.description')}</S.StepDesc>
            </S.StepCard>
            <S.StepCard>
              <S.StepNumber>2</S.StepNumber>
              <S.StepTitle>{t('translation:landing.howItWorks.step2.title')}</S.StepTitle>
              <S.StepDesc>{t('translation:landing.howItWorks.step2.description')}</S.StepDesc>
            </S.StepCard>
            <S.StepCard>
              <S.StepNumber>3</S.StepNumber>
              <S.StepTitle>{t('translation:landing.howItWorks.step3.title')}</S.StepTitle>
              <S.StepDesc>{t('translation:landing.howItWorks.step3.description')}</S.StepDesc>
            </S.StepCard>
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
            <S.ProductSettingsCard>
              <S.ProductName>{t('translation:landing.perProduct.productA.name')}</S.ProductName>
              <S.SettingRow>
                <S.SettingLabel>{t('translation:landing.perProduct.labels.margin')}</S.SettingLabel>
                <S.SettingValue>{t('translation:landing.perProduct.productA.margin')}</S.SettingValue>
              </S.SettingRow>
              <S.SettingRow>
                <S.SettingLabel>{t('translation:landing.perProduct.labels.stock')}</S.SettingLabel>
                <S.SettingValue>{t('translation:landing.perProduct.productA.stock')}</S.SettingValue>
              </S.SettingRow>
              <S.SettingRow>
                <S.SettingLabel>{t('translation:landing.perProduct.labels.template')}</S.SettingLabel>
                <S.SettingValue>{t('translation:landing.perProduct.productA.template')}</S.SettingValue>
              </S.SettingRow>
            </S.ProductSettingsCard>

            <S.ProductSettingsCard>
              <S.ProductName>{t('translation:landing.perProduct.productB.name')}</S.ProductName>
              <S.SettingRow>
                <S.SettingLabel>{t('translation:landing.perProduct.labels.margin')}</S.SettingLabel>
                <S.SettingValue>{t('translation:landing.perProduct.productB.margin')}</S.SettingValue>
              </S.SettingRow>
              <S.SettingRow>
                <S.SettingLabel>{t('translation:landing.perProduct.labels.stock')}</S.SettingLabel>
                <S.SettingValue>{t('translation:landing.perProduct.productB.stock')}</S.SettingValue>
              </S.SettingRow>
              <S.SettingRow>
                <S.SettingLabel>{t('translation:landing.perProduct.labels.template')}</S.SettingLabel>
                <S.SettingValue>{t('translation:landing.perProduct.productB.template')}</S.SettingValue>
              </S.SettingRow>
            </S.ProductSettingsCard>

            <S.ProductSettingsCard>
              <S.ProductName>{t('translation:landing.perProduct.productC.name')}</S.ProductName>
              <S.SettingRow>
                <S.SettingLabel>{t('translation:landing.perProduct.labels.margin')}</S.SettingLabel>
                <S.SettingValue>{t('translation:landing.perProduct.productC.margin')}</S.SettingValue>
              </S.SettingRow>
              <S.SettingRow>
                <S.SettingLabel>{t('translation:landing.perProduct.labels.stock')}</S.SettingLabel>
                <S.SettingValue>{t('translation:landing.perProduct.productC.stock')}</S.SettingValue>
              </S.SettingRow>
              <S.SettingRow>
                <S.SettingLabel>{t('translation:landing.perProduct.labels.template')}</S.SettingLabel>
                <S.SettingValue>{t('translation:landing.perProduct.productC.template')}</S.SettingValue>
              </S.SettingRow>
            </S.ProductSettingsCard>
          </S.PerProductGrid>
        </S.RevealWrapper>
      </S.PerProductSection>

      {/* ── Pricing ───────────────────────────────────── */}
      <S.Section data-reveal="pricing" id="pricing">
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
      </S.Section>

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
              <S.FAQItem key={key}>
                <S.FAQQuestion type="button" $isOpen={openFaq === index} onClick={() => toggleFaq(index)}>
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
        <S.FooterContent>
          <Logo size={80} />
          <S.FooterLinks>
            <S.FooterLink type="button">{t('translation:landing.footer.privacy')}</S.FooterLink>
            <S.FooterLink type="button">{t('translation:landing.footer.terms')}</S.FooterLink>
            <S.FooterLink type="button">{t('translation:landing.footer.support')}</S.FooterLink>
          </S.FooterLinks>
        </S.FooterContent>
        <S.FooterCopyright>{t('translation:landing.footer.copyright', { year: new Date().getFullYear() })}</S.FooterCopyright>
      </S.Footer>
    </S.Page>
  );
};
