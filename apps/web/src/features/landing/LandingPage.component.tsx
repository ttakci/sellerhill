import { Icon, type LocaleOption, LanguageSwitcher, Logo, ThemeToggle } from '@repo/ui';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './LandingPage.style';
import type { LandingPageProps } from './LandingPage.types';

const LOCALE_OPTIONS: LocaleOption[] = [
  { code: 'en', displayName: 'English' },
  { code: 'tr', displayName: 'Türkçe' },
];

type FeatureKey = 'asinListing' | 'stockPriceSync' | 'autoOrder' | 'manualOrder' | 'tracking';
const FEATURES: { key: FeatureKey; icon: string }[] = [
  { key: 'asinListing', icon: 'plus' },
  { key: 'stockPriceSync', icon: 'sync' },
  { key: 'autoOrder', icon: 'shopping-cart' },
  { key: 'manualOrder', icon: 'edit' },
  { key: 'tracking', icon: 'local-shipping' },
];

const STEPS = ['step1', 'step2', 'step3'] as const;
const PRODUCTS = ['productA', 'productB', 'productC'] as const;
const PRODUCT_SETTINGS = ['margin', 'stock', 'template'] as const;
const STAT_KEYS = ['sellers', 'orders', 'uptime', 'marketplaces'] as const;
const TESTIMONIAL_KEYS = ['t1', 't2', 't3'] as const;
const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;
const PLANS = ['starter', 'pro', 'enterprise'] as const;

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
  const observerRef = useRef<IntersectionObserver | null>(null);

  const toggleFaq = useCallback((index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  }, []);

  // Scroll-reveal animation — purely visual, lives in the presentation layer.
  useEffect(() => {
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
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    observerRef.current = observer;
    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollTo = useCallback(
    (id: string) => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      onCloseMobileMenu();
    },
    [onCloseMobileMenu]
  );

  const navLinks = [
    { id: 'features', label: t('translation:landing.navbar.features') },
    { id: 'how-it-works', label: t('translation:landing.navbar.howItWorks') },
    { id: 'pricing', label: t('translation:landing.navbar.pricing') },
    { id: 'faq', label: t('translation:landing.navbar.faq') },
  ];

  return (
    <S.Page>
      {/* ── Navbar ─────────────────────────────────────── */}
      <S.Navbar $scrolled={scrolled}>
        <S.NavInner>
          <S.NavBrand type="button" onClick={() => scrollTo('top')}>
            <Logo size={44} />
          </S.NavBrand>
          <S.NavLinks>
            {navLinks.map((link) => (
              <S.NavLink key={link.id} type="button" onClick={() => scrollTo(link.id)}>
                {link.label}
              </S.NavLink>
            ))}
          </S.NavLinks>
          <S.NavActions>
            <S.UtilityGroup>
              <LanguageSwitcher
                currentLocale={currentLocale}
                locales={LOCALE_OPTIONS}
                onLocaleChange={(code) => onLocaleChange(code as 'en' | 'tr')}
                variant="compact"
              />
              <ThemeToggle />
            </S.UtilityGroup>
            <S.LoginButton type="button" onClick={onNavigateLogin}>
              {t('translation:landing.navbar.login')}
            </S.LoginButton>
            <S.NavCta type="button" onClick={onNavigateRegister}>
              {t('translation:landing.navbar.getStarted')}
              <Icon name="arrow-right" size={16} />
            </S.NavCta>
            <S.Hamburger $open={mobileMenuOpen} type="button" onClick={onToggleMobileMenu} aria-label="Menu">
              <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={22} />
            </S.Hamburger>
          </S.NavActions>
        </S.NavInner>
      </S.Navbar>

      {/* ── Mobile menu ────────────────────────────────── */}
      <S.MobileMenuOverlay $open={mobileMenuOpen} onClick={onCloseMobileMenu} />
      <S.MobileMenu $open={mobileMenuOpen}>
        <S.MobileMenuHead>
          <Logo size={36} />
          <S.MobileClose type="button" onClick={onCloseMobileMenu} aria-label="Close">
            <Icon name="x" size={22} />
          </S.MobileClose>
        </S.MobileMenuHead>
        <S.MobileLinks>
          {navLinks.map((link) => (
            <S.MobileLink key={link.id} type="button" onClick={() => scrollTo(link.id)}>
              {link.label}
            </S.MobileLink>
          ))}
        </S.MobileLinks>
        <S.MobileCtas>
          <S.LoginButton $block type="button" onClick={onNavigateLogin}>
            {t('translation:landing.navbar.login')}
          </S.LoginButton>
          <S.NavCta $block type="button" onClick={onNavigateRegister}>
            {t('translation:landing.navbar.getStarted')}
          </S.NavCta>
        </S.MobileCtas>
      </S.MobileMenu>

      {/* ── Hero ───────────────────────────────────────── */}
      <S.Hero id="top">
        <S.HeroGlow />
        <S.HeroInner>
          <S.HeroContent>
            <S.Eyebrow>
              <S.EyebrowDot />
              {t('translation:landing.hero.badge')}
            </S.Eyebrow>
            <S.HeroTitle>{t('translation:landing.hero.headline')}</S.HeroTitle>
            <S.HeroSubtitle>{t('translation:landing.hero.subheading')}</S.HeroSubtitle>
            <S.HeroCtas>
              <S.PrimaryButton type="button" onClick={onNavigateRegister}>
                {t('translation:landing.hero.ctaPrimary')}
                <Icon name="arrow-right" size={18} />
              </S.PrimaryButton>
              <S.GhostButton type="button" onClick={() => scrollTo('how-it-works')}>
                <Icon name="play-arrow" size={16} />
                {t('translation:landing.hero.ctaSecondary')}
              </S.GhostButton>
            </S.HeroCtas>
            <S.HeroNote>{t('translation:landing.hero.note')}</S.HeroNote>
          </S.HeroContent>

          <S.HeroPreview>
            <S.DashboardMock>
              <S.MockBar>
                <S.MockDot $c="error" />
                <S.MockDot $c="warning" />
                <S.MockDot $c="success" />
                <S.MockUrl>app.zonds.io/dashboard</S.MockUrl>
              </S.MockBar>
              <S.MockBody>
                <S.MockSidebar>
                  <S.MockSideItem $active />
                  <S.MockSideItem />
                  <S.MockSideItem />
                  <S.MockSideItem $active />
                  <S.MockSideItem />
                </S.MockSidebar>
                <S.MockMain>
                  <S.MockKpis>
                    <S.MockKpi />
                    <S.MockKpi />
                    <S.MockKpi />
                  </S.MockKpis>
                  <S.MockChart>
                    {[34, 52, 40, 68, 48, 80, 60, 92, 72].map((h, i) => (
                      <S.MockBar2 key={i} $h={`${h}%`} />
                    ))}
                  </S.MockChart>
                  <S.MockTable>
                    <S.MockRow />
                    <S.MockRow />
                    <S.MockRow />
                  </S.MockTable>
                </S.MockMain>
              </S.MockBody>
            </S.DashboardMock>
          </S.HeroPreview>
        </S.HeroInner>
      </S.Hero>

      {/* ── Platform strip ─────────────────────────────── */}
      <S.Platforms>
        <S.PlatformLabel>{t('translation:landing.logos.title')}</S.PlatformLabel>
        <S.PlatformFlow>
          <S.PlatformChip>
            <Icon name="brand-amazon" size={26} />
            <span>Amazon</span>
          </S.PlatformChip>
          <S.PlatformArrow>
            <Icon name="arrow-right" size={18} />
          </S.PlatformArrow>
          <S.PlatformChip>
            <Icon name="brand-ebay" size={26} />
            <span>eBay</span>
          </S.PlatformChip>
        </S.PlatformFlow>
      </S.Platforms>

      {/* ── Features ───────────────────────────────────── */}
      <S.Section id="features" data-reveal="features">
        <S.Reveal $visible={revealState['features'] ?? false}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.features.sectionEyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.features.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.features.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={revealState['features'] ?? false} $delay={1}>
          <S.FeaturesGrid>
            {FEATURES.map((f) => (
              <S.FeatureCard key={f.key}>
                <S.FeatureIconWrap>
                  <Icon name={f.icon} size={22} color="brand.primary" />
                </S.FeatureIconWrap>
                <S.FeatureTitle>{t(`translation:landing.features.${f.key}.title`)}</S.FeatureTitle>
                <S.FeatureDesc>{t(`translation:landing.features.${f.key}.description`)}</S.FeatureDesc>
              </S.FeatureCard>
            ))}
            <S.FeatureCard $highlight>
              <S.FeatureHeadRow>
                <S.FeatureIconWrap $highlight>
                  <Icon name="rule" size={22} color="landing.heroText" />
                </S.FeatureIconWrap>
                <S.FeatureBadge>{t('translation:landing.features.perProduct.badge')}</S.FeatureBadge>
              </S.FeatureHeadRow>
              <S.FeatureTitleLarge>{t('translation:landing.features.perProduct.title')}</S.FeatureTitleLarge>
              <S.FeatureDesc>{t('translation:landing.features.perProduct.description')}</S.FeatureDesc>
            </S.FeatureCard>
          </S.FeaturesGrid>
        </S.Reveal>
      </S.Section>

      {/* ── How it works ───────────────────────────────── */}
      <S.Section $alt id="how-it-works" data-reveal="how-it-works">
        <S.Reveal $visible={revealState['how-it-works'] ?? false}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.howItWorks.sectionEyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.howItWorks.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.howItWorks.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={revealState['how-it-works'] ?? false} $delay={1}>
          <S.Steps>
            {STEPS.map((step, i) => (
              <S.StepCard key={step}>
                <S.StepNumber>{i + 1}</S.StepNumber>
                <S.StepTitle>{t(`translation:landing.howItWorks.${step}.title`)}</S.StepTitle>
                <S.StepDesc>{t(`translation:landing.howItWorks.${step}.description`)}</S.StepDesc>
                {i < STEPS.length - 1 && (
                  <S.StepConnector>
                    <Icon name="arrow-right" size={18} />
                  </S.StepConnector>
                )}
              </S.StepCard>
            ))}
          </S.Steps>
        </S.Reveal>
      </S.Section>

      {/* ── Per-product deep dive ──────────────────────── */}
      <S.Section data-reveal="per-product">
        <S.Reveal $visible={revealState['per-product'] ?? false}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.perProduct.sectionEyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.perProduct.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.perProduct.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={revealState['per-product'] ?? false} $delay={1}>
          <S.ProductGrid>
            {PRODUCTS.map((product) => (
              <S.ProductCard key={product}>
                <S.ProductName>{t(`translation:landing.perProduct.${product}.name`)}</S.ProductName>
                <S.ProductSettings>
                  {PRODUCT_SETTINGS.map((setting) => (
                    <S.SettingRow key={setting}>
                      <S.SettingLabel>{t(`translation:landing.perProduct.labels.${setting}`)}</S.SettingLabel>
                      <S.SettingValue>{t(`translation:landing.perProduct.${product}.${setting}`)}</S.SettingValue>
                    </S.SettingRow>
                  ))}
                </S.ProductSettings>
              </S.ProductCard>
            ))}
          </S.ProductGrid>
        </S.Reveal>
      </S.Section>

      {/* ── CTA banner (1) ──────────────────────────────── */}
      <S.Section $narrow data-reveal="cta1">
        <S.Reveal $visible={revealState['cta1'] ?? false}>
          <S.CtaBanner>
            <S.CtaGlow />
            <S.CtaTitle>{t('translation:landing.ctaBanner.variant1.headline')}</S.CtaTitle>
            <S.CtaSub>{t('translation:landing.ctaBanner.variant1.subheading')}</S.CtaSub>
            <S.PrimaryButton $lg type="button" onClick={onNavigateRegister}>
              {t('translation:landing.ctaBanner.variant1.button')}
              <Icon name="arrow-right" size={18} />
            </S.PrimaryButton>
          </S.CtaBanner>
        </S.Reveal>
      </S.Section>

      {/* ── Stats band ─────────────────────────────────── */}
      <S.StatsBand data-reveal="stats">
        {STAT_KEYS.map((key) => (
          <S.Reveal key={key} $visible={revealState['stats'] ?? false}>
            <S.StatItem>
              <S.StatValue>{t(`translation:landing.stats.${key}.value`)}</S.StatValue>
              <S.StatLabel>{t(`translation:landing.stats.${key}.label`)}</S.StatLabel>
            </S.StatItem>
          </S.Reveal>
        ))}
      </S.StatsBand>

      {/* ── Testimonials ───────────────────────────────── */}
      <S.Section data-reveal="testimonials">
        <S.Reveal $visible={revealState['testimonials'] ?? false}>
          <S.SectionHead>
            <S.SectionTitle>{t('translation:landing.testimonials.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.testimonials.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={revealState['testimonials'] ?? false} $delay={1}>
          <S.Testimonials>
            {TESTIMONIAL_KEYS.map((key) => {
              const rating = parseInt(t(`translation:landing.testimonials.${key}.rating`), 10) || 5;
              return (
                <S.TestimonialCard key={key}>
                  <S.Stars>
                    {Array.from({ length: rating }, (_, i) => (
                      <Icon key={i} name="star" size={16} color="semantic.warning" />
                    ))}
                  </S.Stars>
                  <S.TestimonialText>{t(`translation:landing.testimonials.${key}.text`)}</S.TestimonialText>
                  <S.TestimonialAuthor>
                    <S.TestimonialAvatar>
                      {t(`translation:landing.testimonials.${key}.name`).charAt(0)}
                    </S.TestimonialAvatar>
                    <S.TestimonialMeta>
                      <S.TestimonialName>{t(`translation:landing.testimonials.${key}.name`)}</S.TestimonialName>
                      <S.TestimonialRole>{t(`translation:landing.testimonials.${key}.role`)}</S.TestimonialRole>
                    </S.TestimonialMeta>
                  </S.TestimonialAuthor>
                </S.TestimonialCard>
              );
            })}
          </S.Testimonials>
        </S.Reveal>
      </S.Section>

      {/* ── Pricing ────────────────────────────────────── */}
      <S.Section $alt id="pricing" data-reveal="pricing">
        <S.Reveal $visible={revealState['pricing'] ?? false}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.pricing.sectionEyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.pricing.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.pricing.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={revealState['pricing'] ?? false} $delay={1}>
          <S.PricingGrid>
            {PLANS.map((plan) => {
              const features = t(`translation:landing.pricing.${plan}.features`, { returnObjects: true }) as string[];
              return (
                <S.PricingCard key={plan} $highlight={plan === 'pro'}>
                  {plan === 'pro' ? (
                    <S.PlanBadge>{t('translation:landing.pricing.pro.badge')}</S.PlanBadge>
                  ) : null}
                  <S.PlanName>{t(`translation:landing.pricing.${plan}.name`)}</S.PlanName>
                  <S.PlanPrice>
                    <S.PlanAmount>{t(`translation:landing.pricing.${plan}.price`)}</S.PlanAmount>
                    <S.PlanPeriod>{t(`translation:landing.pricing.${plan}.period`)}</S.PlanPeriod>
                  </S.PlanPrice>
                  <S.PlanDesc>{t(`translation:landing.pricing.${plan}.description`)}</S.PlanDesc>
                  <S.PlanFeatures>
                    {features.map((feat) => (
                      <S.PlanFeature key={feat}>
                        <Icon name="check-circle" size={16} color="semantic.success" />
                        <span>{feat}</span>
                      </S.PlanFeature>
                    ))}
                  </S.PlanFeatures>
                  <S.PlanCta type="button" $highlight={plan === 'pro'} onClick={onNavigateRegister}>
                    {t(`translation:landing.pricing.${plan}.cta`)}
                  </S.PlanCta>
                </S.PricingCard>
              );
            })}
          </S.PricingGrid>
        </S.Reveal>
        <S.BillingNote>{t('translation:landing.pricing.billingNote')}</S.BillingNote>
      </S.Section>

      {/* ── FAQ ────────────────────────────────────────── */}
      <S.Section id="faq" data-reveal="faq">
        <S.Reveal $visible={revealState['faq'] ?? false}>
          <S.SectionHead>
            <S.SectionTitle>{t('translation:landing.faq.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.faq.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={revealState['faq'] ?? false} $delay={1}>
          <S.FaqList>
            {FAQ_KEYS.map((key, index) => {
              const isOpen = openFaq === index;
              return (
                <S.FaqItem key={key} $open={isOpen}>
                  <S.FaqQuestion type="button" $open={isOpen} onClick={() => toggleFaq(index)}>
                    <span>{t(`translation:landing.faq.${key}.question`)}</span>
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} />
                  </S.FaqQuestion>
                  <S.FaqAnswer $open={isOpen}>
                    <S.FaqAnswerText>{t(`translation:landing.faq.${key}.answer`)}</S.FaqAnswerText>
                  </S.FaqAnswer>
                </S.FaqItem>
              );
            })}
          </S.FaqList>
        </S.Reveal>
      </S.Section>

      {/* ── Final CTA banner ───────────────────────────── */}
      <S.Section $narrow data-reveal="cta2">
        <S.Reveal $visible={revealState['cta2'] ?? false}>
          <S.CtaBanner $dark>
            <S.CtaGlow $strong />
            <S.CtaTitle>{t('translation:landing.ctaBanner.variant2.headline')}</S.CtaTitle>
            <S.CtaSub>{t('translation:landing.ctaBanner.variant2.subheading')}</S.CtaSub>
            <S.PrimaryButton $lg type="button" onClick={onNavigateRegister}>
              {t('translation:landing.ctaBanner.variant2.button')}
              <Icon name="arrow-right" size={18} />
            </S.PrimaryButton>
          </S.CtaBanner>
        </S.Reveal>
      </S.Section>

      {/* ── Footer ─────────────────────────────────────── */}
      <S.Footer>
        <S.FooterInner>
          <S.FooterBrand>
            <Logo size={36} />
            <S.FooterDescription>{t('translation:landing.footer.description')}</S.FooterDescription>
            <S.UtilityGroup>
              <LanguageSwitcher
                currentLocale={currentLocale}
                locales={LOCALE_OPTIONS}
                onLocaleChange={(code) => onLocaleChange(code as 'en' | 'tr')}
                variant="compact"
              />
              <ThemeToggle />
            </S.UtilityGroup>
          </S.FooterBrand>
          <S.FooterColumns>
            <S.FooterColumn>
              <S.FooterColTitle>{t('translation:landing.footer.product')}</S.FooterColTitle>
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
              <S.FooterColTitle>{t('translation:landing.footer.company')}</S.FooterColTitle>
              <S.FooterLink type="button">{t('translation:landing.footer.companyLinks.about')}</S.FooterLink>
              <S.FooterLink type="button">{t('translation:landing.footer.companyLinks.blog')}</S.FooterLink>
              <S.FooterLink type="button">{t('translation:landing.footer.companyLinks.careers')}</S.FooterLink>
              <S.FooterLink type="button">{t('translation:landing.footer.companyLinks.contact')}</S.FooterLink>
            </S.FooterColumn>
            <S.FooterColumn>
              <S.FooterColTitle>{t('translation:landing.footer.legal')}</S.FooterColTitle>
              <S.FooterLink type="button">{t('translation:landing.footer.legalLinks.privacy')}</S.FooterLink>
              <S.FooterLink type="button">{t('translation:landing.footer.legalLinks.terms')}</S.FooterLink>
              <S.FooterLink type="button">{t('translation:landing.footer.legalLinks.cookies')}</S.FooterLink>
            </S.FooterColumn>
          </S.FooterColumns>
        </S.FooterInner>
        <S.FooterDivider />
        <S.FooterBottom>
          <S.Copyright>{t('translation:landing.footer.copyright', { year: new Date().getFullYear() })}</S.Copyright>
        </S.FooterBottom>
      </S.Footer>
    </S.Page>
  );
};
