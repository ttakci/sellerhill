import { Dropdown, Icon, type IconName, Logo, ThemeToggle } from '@repo/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './LandingPage.style';
import type { LandingPageProps } from './LandingPage.types';

const FEATURES: { key: string; icon: IconName }[] = [
  { key: 'asinListing', icon: 'rocket' },
  { key: 'priceStock', icon: 'sync' },
  { key: 'autoOrder', icon: 'shopping-cart' },
  { key: 'tracking', icon: 'local-shipping' },
  { key: 'buyerMessages', icon: 'message-circle' },
  { key: 'multiStore', icon: 'storefront' },
];

const PROFIT_POINTS: { key: string; icon: IconName }[] = [
  { key: 'confirmed', icon: 'shield-check' },
  { key: 'estimated', icon: 'triangle-info' },
  { key: 'honest', icon: 'eye' },
  { key: 'pnl', icon: 'chart-line' },
];

const PILLARS = ['p1', 'p2', 'p3'] as const;
const STEPS = ['step1', 'step2', 'step3'] as const;
const PRODUCTS = ['productA', 'productB', 'productC'] as const;
const PRODUCT_SETTINGS = ['margin', 'stock', 'template'] as const;
const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6'] as const;
const DEMO_BULLETS = ['b1', 'b2', 'b3'] as const;
const FALLBACK_PLANS = ['starter', 'growth', 'scale'] as const;

/**
 * Hero chart shape. Fixed, not random: the preview must render identically on
 * every visit, and the tallest bar is the profit series so the eye lands on the
 * thing the page is actually about.
 */
const CHART_BARS = [38, 52, 44, 61, 49, 72, 58, 83, 66, 91];
const CHART_ACCENT_INDEX = 7;

export const LandingPageComponent = ({
  currentLocale,
  scrolled,
  mobileMenuOpen,
  pricingPlans,
  pricingCatalogError,
  onLocaleChange,
  onNavigateLogin,
  onNavigateRegister,
  onOpenDemo,
  onToggleMobileMenu,
  onCloseMobileMenu,
}: LandingPageProps): React.ReactElement => {
  const { t } = useTranslation('translation');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [revealState, setRevealState] = useState<Record<string, boolean>>({});

  const toggleFaq = useCallback((index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  }, []);

  // Scroll-reveal — purely visual, so it lives in the presentation layer.
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
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' }
    );
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
    { id: 'profit', label: t('translation:landing.navbar.profit') },
    { id: 'how-it-works', label: t('translation:landing.navbar.howItWorks') },
    { id: 'pricing', label: t('translation:landing.navbar.pricing') },
    { id: 'faq', label: t('translation:landing.navbar.faq') },
  ];

  const seen = (id: string): boolean => revealState[id] ?? false;

  return (
    <S.Page>
      {/* ── Navbar ─────────────────────────────────────── */}
      <S.Navbar $scrolled={scrolled}>
        <S.NavInner>
          {/*
            The horizontal wordmark, as in the app shell. The default layout is
            the tall mark-plus-tagline built for the 280px auth panels; at
            navbar height it collapses into an illegible smudge.
          */}
          <S.NavBrand type="button" onClick={() => scrollTo('top')} aria-label="SellerHill">
            <Logo layout="nav" height={32} />
          </S.NavBrand>
          <S.NavLinks>
            {navLinks.map((link) => (
              <S.NavLink key={link.id} type="button" onClick={() => scrollTo(link.id)}>
                {link.label}
              </S.NavLink>
            ))}
            <S.NavLink type="button" onClick={onOpenDemo}>
              {t('translation:landing.navbar.demo')}
            </S.NavLink>
          </S.NavLinks>
          <S.NavActions>
            <S.UtilityGroup>
              <Dropdown
                align="right"
                width="6.25rem"
                trigger={
                  <S.LanguageTrigger>
                    <S.LanguageText>{currentLocale.slice(0, 2)}</S.LanguageText>
                    <Icon name="chevron-down" size={12} />
                  </S.LanguageTrigger>
                }
                items={[
                  { label: t('translation:languages.en'), onClick: () => onLocaleChange('en') },
                  { label: t('translation:languages.tr'), onClick: () => onLocaleChange('tr') },
                ]}
              />
              <ThemeToggle />
            </S.UtilityGroup>
            <S.LoginButton type="button" onClick={onNavigateLogin}>
              {t('translation:landing.navbar.login')}
            </S.LoginButton>
            <S.NavCta type="button" onClick={onNavigateRegister}>
              {t('translation:landing.navbar.getStarted')}
              <Icon name="arrow-right" size={15} />
            </S.NavCta>
            <S.Hamburger $open={mobileMenuOpen} type="button" onClick={onToggleMobileMenu} aria-label="Menu">
              <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={20} />
            </S.Hamburger>
          </S.NavActions>
        </S.NavInner>
      </S.Navbar>

      {/* ── Mobile menu ────────────────────────────────── */}
      <S.MobileMenuOverlay $open={mobileMenuOpen} onClick={onCloseMobileMenu} />
      <S.MobileMenu $open={mobileMenuOpen}>
        <S.MobileMenuHead>
          <Logo layout="nav" height={28} />
          <S.MobileClose type="button" onClick={onCloseMobileMenu} aria-label="Close">
            <Icon name="x" size={20} />
          </S.MobileClose>
        </S.MobileMenuHead>
        <S.MobileLinks>
          {navLinks.map((link) => (
            <S.MobileLink key={link.id} type="button" onClick={() => scrollTo(link.id)}>
              {link.label}
            </S.MobileLink>
          ))}
          <S.MobileLink type="button" onClick={onOpenDemo}>
            {t('translation:landing.navbar.demo')}
          </S.MobileLink>
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
        <S.HeroFade />
        <S.HeroInner>
          <S.HeroContent>
            <S.Eyebrow>
              <S.EyebrowDot />
              {t('translation:landing.hero.badge')}
            </S.Eyebrow>
            <S.HeroTitle>{t('translation:landing.hero.headline')}</S.HeroTitle>
            <S.HeroSubtitle>{t('translation:landing.hero.subheading')}</S.HeroSubtitle>
            <S.HeroCtas>
              <S.PrimaryButton $lg type="button" onClick={onNavigateRegister}>
                {t('translation:landing.hero.ctaPrimary')}
                <Icon name="arrow-right" size={17} />
              </S.PrimaryButton>
              <S.GhostButton $lg type="button" onClick={onOpenDemo}>
                <Icon name="play-arrow" size={16} />
                {t('translation:landing.hero.ctaSecondary')}
              </S.GhostButton>
            </S.HeroCtas>
            <S.HeroNote>{t('translation:landing.hero.note')}</S.HeroNote>
          </S.HeroContent>

          {/*
            A legible rendering of the real dashboard rather than grey
            placeholder blocks. The third order row shows an em dash on
            purpose: an unknown cost is never printed as a number, and that
            behaviour is the argument the rest of the page makes.
          */}
          <S.HeroPreview>
            <S.PreviewFrame>
              <S.PreviewBar>
                <S.PreviewDot $c="error" />
                <S.PreviewDot $c="warning" />
                <S.PreviewDot $c="success" />
                <S.PreviewUrl>app.sellerhill.com/dashboard</S.PreviewUrl>
              </S.PreviewBar>
              <S.PreviewBody>
                <S.PreviewRail>
                  <S.PreviewRailItem $active />
                  <S.PreviewRailItem />
                  <S.PreviewRailItem />
                  <S.PreviewRailItem />
                  <S.PreviewRailItem />
                </S.PreviewRail>
                <S.PreviewMain>
                  <S.PreviewPeriod>{t('translation:landing.heroPreview.periodLabel')}</S.PreviewPeriod>
                  <S.PreviewKpis>
                    <S.PreviewKpi $accent>
                      <S.PreviewKpiLabel>{t('translation:landing.heroPreview.netProfit')}</S.PreviewKpiLabel>
                      <S.PreviewKpiValue>$3,186.40</S.PreviewKpiValue>
                      <S.PreviewKpiFoot $tone="success">
                        <Icon name="shield-check" size={12} />
                        {t('translation:landing.heroPreview.confirmed')}
                      </S.PreviewKpiFoot>
                    </S.PreviewKpi>
                    <S.PreviewKpi>
                      <S.PreviewKpiLabel>{t('translation:landing.heroPreview.sales')}</S.PreviewKpiLabel>
                      <S.PreviewKpiValue>$18,420.50</S.PreviewKpiValue>
                      <S.PreviewKpiFoot $tone="success">
                        <Icon name="trending-up" size={12} />
                        +12.4%
                      </S.PreviewKpiFoot>
                    </S.PreviewKpi>
                    <S.PreviewKpi>
                      <S.PreviewKpiLabel>{t('translation:landing.heroPreview.orders')}</S.PreviewKpiLabel>
                      <S.PreviewKpiValue>214</S.PreviewKpiValue>
                      <S.PreviewKpiFoot>
                        {t('translation:landing.heroPreview.margin')} 17.3%
                      </S.PreviewKpiFoot>
                    </S.PreviewKpi>
                  </S.PreviewKpis>

                  <S.PreviewChart aria-hidden="true">
                    {CHART_BARS.map((h, i) => (
                      <S.PreviewChartBar key={i} $h={`${h}%`} $accent={i === CHART_ACCENT_INDEX} />
                    ))}
                  </S.PreviewChart>

                  <S.PreviewTable>
                    <S.PreviewTableHead>
                      <span>{t('translation:landing.heroPreview.recentTitle')}</span>
                      <span />
                      <span>{t('translation:landing.heroPreview.profitColumn')}</span>
                    </S.PreviewTableHead>
                    <S.PreviewRow>
                      <S.PreviewRowTitle>{t('translation:landing.heroPreview.products.a')}</S.PreviewRowTitle>
                      <S.PreviewBadge $tone="success">
                        {t('translation:landing.heroPreview.states.purchased')}
                      </S.PreviewBadge>
                      <S.PreviewRowValue>$14.20</S.PreviewRowValue>
                    </S.PreviewRow>
                    <S.PreviewRow>
                      <S.PreviewRowTitle>{t('translation:landing.heroPreview.products.b')}</S.PreviewRowTitle>
                      <S.PreviewBadge $tone="info">
                        {t('translation:landing.heroPreview.states.shipped')}
                      </S.PreviewBadge>
                      <S.PreviewRowValue>$8.75</S.PreviewRowValue>
                    </S.PreviewRow>
                    <S.PreviewRow>
                      <S.PreviewRowTitle>{t('translation:landing.heroPreview.products.c')}</S.PreviewRowTitle>
                      <S.PreviewBadge $tone="warning">
                        {t('translation:landing.heroPreview.states.actionRequired')}
                      </S.PreviewBadge>
                      <S.PreviewRowValue
                        $muted
                        title={t('translation:landing.heroPreview.pending')}
                      >
                        —
                      </S.PreviewRowValue>
                    </S.PreviewRow>
                  </S.PreviewTable>
                </S.PreviewMain>
              </S.PreviewBody>
            </S.PreviewFrame>
          </S.HeroPreview>
        </S.HeroInner>
      </S.Hero>

      {/* ── Flow strip + pillars ───────────────────────── */}
      <S.FlowStrip>
        <S.FlowLabel>{t('translation:landing.flow.title')}</S.FlowLabel>
        <S.FlowRow>
          <S.FlowChip>
            <Icon name="package-open" size={16} />
            {t('translation:landing.flow.source')}
          </S.FlowChip>
          <S.FlowArrow>
            <Icon name="arrow-right" size={17} />
          </S.FlowArrow>
          <S.FlowChip $accent>
            <Icon name="bolt" size={16} />
            {t('translation:landing.flow.engine')}
          </S.FlowChip>
          <S.FlowArrow>
            <Icon name="arrow-right" size={17} />
          </S.FlowArrow>
          <S.FlowChip>
            <Icon name="storefront" size={16} />
            {t('translation:landing.flow.destination')}
          </S.FlowChip>
        </S.FlowRow>
      </S.FlowStrip>

      <S.Pillars data-reveal="pillars">
        {PILLARS.map((key, i) => (
          <S.Reveal key={key} $visible={seen('pillars')} $delay={i}>
            <S.Pillar>
              <S.PillarTitle>{t(`translation:landing.pillars.${key}.title`)}</S.PillarTitle>
              <S.PillarText>{t(`translation:landing.pillars.${key}.description`)}</S.PillarText>
            </S.Pillar>
          </S.Reveal>
        ))}
      </S.Pillars>

      {/* ── Features ───────────────────────────────────── */}
      <S.Section $alt id="features" data-reveal="features">
        <S.Reveal $visible={seen('features')}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.features.sectionEyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.features.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.features.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={seen('features')} $delay={1}>
          <S.FeaturesGrid>
            {FEATURES.map((f) => (
              <S.FeatureCard key={f.key}>
                <S.FeatureIconWrap>
                  <Icon name={f.icon} size={20} color="brand.primary" />
                </S.FeatureIconWrap>
                <S.FeatureTitle>{t(`translation:landing.features.${f.key}.title`)}</S.FeatureTitle>
                <S.FeatureDesc>{t(`translation:landing.features.${f.key}.description`)}</S.FeatureDesc>
              </S.FeatureCard>
            ))}
          </S.FeaturesGrid>
        </S.Reveal>
      </S.Section>

      {/* ── Profit — the differentiator ────────────────── */}
      <S.Section id="profit" data-reveal="profit">
        <S.Reveal $visible={seen('profit')}>
          <S.SplitLayout>
            <S.SplitCopy>
              <S.SplitEyebrow>{t('translation:landing.profit.sectionEyebrow')}</S.SplitEyebrow>
              <S.SplitTitle>{t('translation:landing.profit.sectionTitle')}</S.SplitTitle>
              <S.SplitSubtitle>{t('translation:landing.profit.sectionSubtitle')}</S.SplitSubtitle>
              <S.ProfitList>
                {PROFIT_POINTS.map((point) => (
                  <S.ProfitItem key={point.key}>
                    <S.ProfitItemIcon>
                      <Icon name={point.icon} size={15} />
                    </S.ProfitItemIcon>
                    <div>
                      <S.ProfitItemTitle>
                        {t(`translation:landing.profit.${point.key}.title`)}
                      </S.ProfitItemTitle>
                      <S.ProfitItemText>
                        {t(`translation:landing.profit.${point.key}.description`)}
                      </S.ProfitItemText>
                    </div>
                  </S.ProfitItem>
                ))}
              </S.ProfitList>
            </S.SplitCopy>

            <S.ProfitPanel>
              <S.ProfitPanelTitle>{t('translation:landing.profit.panel.title')}</S.ProfitPanelTitle>
              <S.ProfitTier $tone="confirmed">
                <S.ProfitTierLabel>
                  <S.ProfitTierName>
                    {t('translation:landing.profit.panel.confirmedLabel')}
                  </S.ProfitTierName>
                </S.ProfitTierLabel>
                <S.ProfitTierValue>$3,186.40</S.ProfitTierValue>
              </S.ProfitTier>
              <S.ProfitTier $tone="estimated">
                <S.ProfitTierLabel>
                  <S.ProfitTierName>
                    {t('translation:landing.profit.panel.estimatedLabel')}
                  </S.ProfitTierName>
                </S.ProfitTierLabel>
                <S.ProfitTierValue>$742.10</S.ProfitTierValue>
              </S.ProfitTier>
              <S.ProfitTier $tone="unknown">
                <S.ProfitTierLabel>
                  <S.ProfitTierName>
                    {t('translation:landing.profit.panel.unknownLabel')}
                  </S.ProfitTierName>
                </S.ProfitTierLabel>
                <S.ProfitTierValue $muted>—</S.ProfitTierValue>
              </S.ProfitTier>
              <S.ProfitFootnote>{t('translation:landing.profit.panel.footnote')}</S.ProfitFootnote>
            </S.ProfitPanel>
          </S.SplitLayout>
        </S.Reveal>
      </S.Section>

      {/* ── Per-product control ────────────────────────── */}
      <S.Section $alt data-reveal="per-product">
        <S.Reveal $visible={seen('per-product')}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.perProduct.sectionEyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.perProduct.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.perProduct.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={seen('per-product')} $delay={1}>
          <S.ProductGrid>
            {PRODUCTS.map((product) => (
              <S.ProductCard key={product}>
                <S.ProductName>{t(`translation:landing.perProduct.${product}.name`)}</S.ProductName>
                <S.ProductSettings>
                  {PRODUCT_SETTINGS.map((setting) => (
                    <S.SettingRow key={setting}>
                      <S.SettingLabel>
                        {t(`translation:landing.perProduct.labels.${setting}`)}
                      </S.SettingLabel>
                      <S.SettingValue>
                        {t(`translation:landing.perProduct.${product}.${setting}`)}
                      </S.SettingValue>
                    </S.SettingRow>
                  ))}
                </S.ProductSettings>
              </S.ProductCard>
            ))}
          </S.ProductGrid>
        </S.Reveal>
      </S.Section>

      {/* ── How it works ───────────────────────────────── */}
      <S.Section id="how-it-works" data-reveal="how-it-works">
        <S.Reveal $visible={seen('how-it-works')}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.howItWorks.sectionEyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.howItWorks.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.howItWorks.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={seen('how-it-works')} $delay={1}>
          <S.Steps>
            {STEPS.map((step, i) => (
              <S.StepCard key={step}>
                <S.StepNumber>{i + 1}</S.StepNumber>
                <S.StepTitle>{t(`translation:landing.howItWorks.${step}.title`)}</S.StepTitle>
                <S.StepDesc>{t(`translation:landing.howItWorks.${step}.description`)}</S.StepDesc>
              </S.StepCard>
            ))}
          </S.Steps>
        </S.Reveal>
      </S.Section>

      {/* ── Demo band ──────────────────────────────────── */}
      <S.Section data-reveal="demo">
        <S.Reveal $visible={seen('demo')}>
          <S.DemoBand>
            <S.DemoCopy>
              <S.SplitEyebrow>{t('translation:landing.demo.sectionEyebrow')}</S.SplitEyebrow>
              <S.SplitTitle>{t('translation:landing.demo.sectionTitle')}</S.SplitTitle>
              <S.SplitSubtitle>{t('translation:landing.demo.sectionSubtitle')}</S.SplitSubtitle>
              <S.DemoBullets>
                {DEMO_BULLETS.map((b) => (
                  <S.DemoBullet key={b}>
                    <Icon name="check-circle" size={16} color="semantic.success" />
                    <span>{t(`translation:landing.demo.bullets.${b}`)}</span>
                  </S.DemoBullet>
                ))}
              </S.DemoBullets>
            </S.DemoCopy>
            <S.DemoActions>
              <S.PrimaryButton $lg type="button" onClick={onOpenDemo}>
                <Icon name="play-arrow" size={17} />
                {t('translation:landing.demo.button')}
              </S.PrimaryButton>
              <S.DemoNote>{t('translation:landing.demo.note')}</S.DemoNote>
            </S.DemoActions>
          </S.DemoBand>
        </S.Reveal>
      </S.Section>

      {/* ── Pricing ────────────────────────────────────── */}
      <S.Section $alt id="pricing" data-reveal="pricing">
        <S.Reveal $visible={seen('pricing')}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.pricing.sectionEyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.pricing.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.pricing.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        {pricingCatalogError ? (
          <S.CatalogError>{t('translation:landing.pricing.catalogError')}</S.CatalogError>
        ) : null}
        <S.Reveal $visible={seen('pricing')} $delay={1}>
          <S.PricingGrid>
            {pricingPlans.length > 0
              ? pricingPlans.map((plan) => {
                  const features = t(`translation:landing.pricing.${plan.slug}.features`, {
                    returnObjects: true,
                  }) as string[];
                  return (
                    <S.PricingCard key={plan.slug} $highlight={plan.isHighlighted}>
                      {plan.isHighlighted ? (
                        <S.PlanBadge>{t('translation:landing.pricing.mostPopular')}</S.PlanBadge>
                      ) : null}
                      <S.PlanName>{t(`translation:landing.pricing.${plan.slug}.name`)}</S.PlanName>
                      <S.PlanPrice>
                        <S.PlanAmount>{plan.priceDisplay}</S.PlanAmount>
                        <S.PlanPeriod>{t(`translation:landing.pricing.${plan.periodKey}`)}</S.PlanPeriod>
                      </S.PlanPrice>
                      <S.PlanDesc>{t(`translation:landing.pricing.${plan.slug}.description`)}</S.PlanDesc>
                      <S.PlanFeatures>
                        <S.PlanFeature>
                          <Icon name="check-circle" size={15} color="semantic.success" />
                          <span>{plan.listingsDisplay}</span>
                        </S.PlanFeature>
                        {Array.isArray(features)
                          ? features.map((feat) => (
                              <S.PlanFeature key={feat}>
                                <Icon name="check-circle" size={15} color="semantic.success" />
                                <span>{feat}</span>
                              </S.PlanFeature>
                            ))
                          : null}
                      </S.PlanFeatures>
                      <S.PlanCta type="button" $highlight={plan.isHighlighted} onClick={onNavigateRegister}>
                        {t(`translation:landing.pricing.${plan.slug}.cta`)}
                      </S.PlanCta>
                    </S.PricingCard>
                  );
                })
              : FALLBACK_PLANS.map((plan) => {
                  const features = t(`translation:landing.pricing.catalogFallback.${plan}.features`, {
                    returnObjects: true,
                  }) as string[];
                  const highlight = plan === 'growth';
                  return (
                    <S.PricingCard key={plan} $highlight={highlight}>
                      {highlight ? (
                        <S.PlanBadge>
                          {t('translation:landing.pricing.catalogFallback.growth.badge')}
                        </S.PlanBadge>
                      ) : null}
                      <S.PlanName>
                        {t(`translation:landing.pricing.catalogFallback.${plan}.name`)}
                      </S.PlanName>
                      <S.PlanPrice>
                        <S.PlanAmount>
                          {t(`translation:landing.pricing.catalogFallback.${plan}.price`)}
                        </S.PlanAmount>
                        <S.PlanPeriod>
                          {t(`translation:landing.pricing.catalogFallback.${plan}.period`)}
                        </S.PlanPeriod>
                      </S.PlanPrice>
                      <S.PlanDesc>
                        {t(`translation:landing.pricing.catalogFallback.${plan}.description`)}
                      </S.PlanDesc>
                      <S.PlanFeatures>
                        {Array.isArray(features)
                          ? features.map((feat) => (
                              <S.PlanFeature key={feat}>
                                <Icon name="check-circle" size={15} color="semantic.success" />
                                <span>{feat}</span>
                              </S.PlanFeature>
                            ))
                          : null}
                      </S.PlanFeatures>
                      <S.PlanCta type="button" $highlight={highlight} onClick={onNavigateRegister}>
                        {t(`translation:landing.pricing.catalogFallback.${plan}.cta`)}
                      </S.PlanCta>
                    </S.PricingCard>
                  );
                })}
          </S.PricingGrid>
        </S.Reveal>
        <S.BillingNote>{t('translation:landing.pricing.billingNote')}</S.BillingNote>
      </S.Section>

      {/* ── FAQ ────────────────────────────────────────── */}
      <S.Section $narrow id="faq" data-reveal="faq">
        <S.Reveal $visible={seen('faq')}>
          <S.SectionHead>
            <S.SectionTitle>{t('translation:landing.faq.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.faq.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={seen('faq')} $delay={1}>
          <S.FaqList>
            {FAQ_KEYS.map((key, index) => {
              const isOpen = openFaq === index;
              return (
                <S.FaqItem key={key} $open={isOpen}>
                  <S.FaqQuestion
                    type="button"
                    $open={isOpen}
                    aria-expanded={isOpen}
                    onClick={() => toggleFaq(index)}
                  >
                    <span>{t(`translation:landing.faq.${key}.question`)}</span>
                    <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={17} />
                  </S.FaqQuestion>
                  <S.FaqAnswer $open={isOpen}>
                    <S.FaqAnswerText>
                      <p>{t(`translation:landing.faq.${key}.answer`)}</p>
                    </S.FaqAnswerText>
                  </S.FaqAnswer>
                </S.FaqItem>
              );
            })}
          </S.FaqList>
        </S.Reveal>
      </S.Section>

      {/* ── Final CTA ──────────────────────────────────── */}
      <S.Section $narrow data-reveal="cta">
        <S.Reveal $visible={seen('cta')}>
          <S.CtaBanner>
            <S.CtaTitle>{t('translation:landing.ctaBanner.variant2.headline')}</S.CtaTitle>
            <S.CtaSub>{t('translation:landing.ctaBanner.variant2.subheading')}</S.CtaSub>
            <S.CtaButton type="button" onClick={onNavigateRegister}>
              {t('translation:landing.ctaBanner.variant2.button')}
              <Icon name="arrow-right" size={17} />
            </S.CtaButton>
          </S.CtaBanner>
        </S.Reveal>
      </S.Section>

      {/* ── Footer ─────────────────────────────────────── */}
      <S.Footer>
        <S.FooterInner>
          <S.FooterBrand>
            <Logo layout="nav" height={30} />
            <S.FooterDescription>{t('translation:landing.footer.description')}</S.FooterDescription>
            <S.UtilityGroup>
              <Dropdown
                align="right"
                width="6.25rem"
                trigger={
                  <S.LanguageTrigger>
                    <S.LanguageText>{currentLocale.slice(0, 2)}</S.LanguageText>
                    <Icon name="chevron-down" size={12} />
                  </S.LanguageTrigger>
                }
                items={[
                  { label: t('translation:languages.en'), onClick: () => onLocaleChange('en') },
                  { label: t('translation:languages.tr'), onClick: () => onLocaleChange('tr') },
                ]}
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
              <S.FooterLink type="button" onClick={() => scrollTo('profit')}>
                {t('translation:landing.footer.links.profit')}
              </S.FooterLink>
              <S.FooterLink type="button" onClick={() => scrollTo('pricing')}>
                {t('translation:landing.footer.links.pricing')}
              </S.FooterLink>
              <S.FooterLink type="button" onClick={onOpenDemo}>
                {t('translation:landing.footer.links.demo')}
              </S.FooterLink>
            </S.FooterColumn>
            <S.FooterColumn>
              <S.FooterColTitle>{t('translation:landing.footer.company')}</S.FooterColTitle>
              <S.FooterLink type="button">{t('translation:landing.footer.companyLinks.about')}</S.FooterLink>
              <S.FooterLink type="button">{t('translation:landing.footer.companyLinks.blog')}</S.FooterLink>
              <S.FooterLink type="button">
                {t('translation:landing.footer.companyLinks.contact')}
              </S.FooterLink>
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
          <S.Copyright>
            {t('translation:landing.footer.copyright', { year: new Date().getFullYear() })}
          </S.Copyright>
        </S.FooterBottom>
      </S.Footer>
    </S.Page>
  );
};
