import { Dropdown, Icon, type IconName, Logo, SegmentedControl, TabNav } from '@repo/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './LandingPage.style';
import type { LandingBillingInterval, LandingPageProps } from './LandingPage.types';

/**
 * Screenshots are real captures from the sign-up-free demo account (never
 * mockups) — see `apps/web/public/landing-screens/`. Reused across the
 * features tabs and the profit tabs so the whole page draws from one small,
 * honest set of images instead of a screenshot per claim.
 */
const SCREEN = {
  dashboardCards: '/landing-screens/dashboard-cards.jpg',
  dashboardPnl: '/landing-screens/dashboard-pnl.jpg',
  orders: '/landing-screens/orders.jpg',
  listings: '/landing-screens/listings.jpg',
  heroDashboard: '/landing-screens/hero-dashboard.jpg',
  heroKpiCard: '/landing-screens/hero-kpi-card.jpg',
} as const;

const FEATURES: { key: string; icon: IconName; image: string }[] = [
  { key: 'asinListing', icon: 'rocket', image: SCREEN.listings },
  { key: 'priceStock', icon: 'sync', image: SCREEN.listings },
  { key: 'autoOrder', icon: 'shopping-cart', image: SCREEN.orders },
  { key: 'tracking', icon: 'local-shipping', image: SCREEN.orders },
  { key: 'buyerMessages', icon: 'message-circle', image: SCREEN.orders },
  { key: 'multiStore', icon: 'storefront', image: SCREEN.dashboardCards },
];

const PROFIT_TAB_IDS = ['overview', 'pnl', 'perOrder'] as const;
type ProfitTabId = (typeof PROFIT_TAB_IDS)[number];

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
  const [activeFeatureKey, setActiveFeatureKey] = useState<string>(FEATURES[0].key);
  const [activeProfitTab, setActiveProfitTab] = useState<ProfitTabId>('overview');
  const [billingInterval, setBillingInterval] = useState<LandingBillingInterval>('monthly');

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
    { id: 'profit', label: t('translation:landing.navbar.profit') },
    { id: 'how-it-works', label: t('translation:landing.navbar.howItWorks') },
    { id: 'pricing', label: t('translation:landing.navbar.pricing') },
    { id: 'faq', label: t('translation:landing.navbar.faq') },
  ];

  const seen = (id: string): boolean => revealState[id] ?? false;
  const activeFeature = FEATURES.find((f) => f.key === activeFeatureKey) ?? FEATURES[0];

  const openFeature = useCallback(
    (key: string) => {
      setActiveFeatureKey(key);
      scrollTo('features');
    },
    [scrollTo]
  );

  /** tawk.to's own bubble is already live on the landing (see TawkToWidget); this just opens it. */
  const openSupportChat = useCallback(() => {
    window.Tawk_API?.maximize?.();
  }, []);

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
            <Logo layout="wordmark" height={38} />
          </S.NavBrand>
          <S.NavLinks>
            <Dropdown
              align="left"
              width="15rem"
              trigger={
                <S.NavDropdownTrigger>
                  {t('translation:landing.navbar.features')}
                  <Icon name="chevron-down" size={12} />
                </S.NavDropdownTrigger>
              }
              items={FEATURES.map((f) => ({
                label: t(`translation:landing.features.${f.key}.title`),
                icon: f.icon,
                onClick: () => openFeature(f.key),
              }))}
            />
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
            <Dropdown
              align="right"
              width="8rem"
              trigger={
                <S.LanguageTrigger $onDark>
                  <S.LanguageText $onDark>{t(`translation:languages.${currentLocale}`)}</S.LanguageText>
                  <Icon name="chevron-down" size={12} />
                </S.LanguageTrigger>
              }
              items={[
                { label: t('translation:languages.en'), onClick: () => onLocaleChange('en') },
                { label: t('translation:languages.tr'), onClick: () => onLocaleChange('tr') },
              ]}
            />
            <S.LoginButton $onDark type="button" onClick={onNavigateLogin}>
              <Icon name="user" size={15} />
              {t('translation:landing.navbar.login')}
            </S.LoginButton>
            <S.NavCta type="button" onClick={onNavigateRegister}>
              {t('translation:landing.navbar.getStarted')}
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
          <Logo layout="wordmark" height={32} />
          <S.MobileClose type="button" onClick={onCloseMobileMenu} aria-label="Close">
            <Icon name="x" size={20} />
          </S.MobileClose>
        </S.MobileMenuHead>
        <S.MobileLinks>
          <S.MobileLink type="button" onClick={() => scrollTo('features')}>
            {t('translation:landing.navbar.features')}
          </S.MobileLink>
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
        <S.HeroInner>
          <S.HeroContent>
            <S.HeroTitle>{t('translation:landing.hero.headline')}</S.HeroTitle>
            <S.HeroSubtitle>{t('translation:landing.hero.subheading')}</S.HeroSubtitle>

            <S.HeroCtas>
              <S.PrimaryButton $lg $accent type="button" onClick={onNavigateRegister}>
                {t('translation:landing.hero.ctaPrimary')}
                <Icon name="arrow-right" size={17} />
              </S.PrimaryButton>
              <S.GhostButton $lg type="button" onClick={onOpenDemo}>
                <Icon name="play-arrow" size={16} />
                {t('translation:landing.hero.ctaSecondary')}
              </S.GhostButton>
            </S.HeroCtas>
            <S.HeroNote>
              <S.HeroNoteTitle>{t('translation:landing.hero.trialTitle')}</S.HeroNoteTitle>
              <S.HeroNoteLine>{t('translation:landing.hero.trialNoCard')}</S.HeroNoteLine>
              <S.HeroNoteLine>{t('translation:landing.hero.trialCancelAnytime')}</S.HeroNoteLine>
            </S.HeroNote>
          </S.HeroContent>

          {/*
            A real screenshot from the sign-up-free demo account (never a
            mockup), with a real cropped KPI card floating over its corner —
            sellerboard's own "Month to date" card treatment, built from the
            same screenshot rather than a second, invented set of numbers.
          */}
          <S.HeroPreview>
            <S.PreviewFrame>
              <S.PreviewBar>
                <S.PreviewDot $c="error" />
                <S.PreviewDot $c="warning" />
                <S.PreviewDot $c="success" />
                <S.PreviewUrl>app.sellerhill.com/dashboard</S.PreviewUrl>
              </S.PreviewBar>
              <S.PreviewImage src={SCREEN.heroDashboard} alt="SellerHill dashboard" loading="lazy" />
            </S.PreviewFrame>
            <S.HeroFloatCard>
              <S.HeroFloatImage src={SCREEN.heroKpiCard} alt="" loading="lazy" />
            </S.HeroFloatCard>
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
          <S.FeatureTabsLayout>
            <S.FeatureTabList>
              {FEATURES.map((f) => {
                const active = f.key === activeFeatureKey;
                return (
                  <S.FeatureTabButton
                    key={f.key}
                    type="button"
                    $active={active}
                    onClick={() => setActiveFeatureKey(f.key)}
                  >
                    <S.FeatureTabIconWrap $active={active}>
                      <Icon name={f.icon} size={17} />
                    </S.FeatureTabIconWrap>
                    <S.FeatureTabLabel $active={active}>
                      {t(`translation:landing.features.${f.key}.title`)}
                    </S.FeatureTabLabel>
                  </S.FeatureTabButton>
                );
              })}
            </S.FeatureTabList>

            <S.FeatureDetail>
              <S.FeatureDetailHead>
                <S.FeatureDetailIconWrap>
                  <Icon name={activeFeature.icon} size={24} color="brand.primary" />
                </S.FeatureDetailIconWrap>
                <S.FeatureDetailBody>
                  <S.FeatureDetailTitle>
                    {t(`translation:landing.features.${activeFeature.key}.title`)}
                  </S.FeatureDetailTitle>
                  <S.FeatureDetailText>
                    {t(`translation:landing.features.${activeFeature.key}.detail`)}
                  </S.FeatureDetailText>
                </S.FeatureDetailBody>
              </S.FeatureDetailHead>

              <S.PreviewFrame>
                <S.PreviewBar>
                  <S.PreviewDot $c="error" />
                  <S.PreviewDot $c="warning" />
                  <S.PreviewDot $c="success" />
                  <S.PreviewUrl>app.sellerhill.com</S.PreviewUrl>
                </S.PreviewBar>
                <S.PreviewImage
                  src={activeFeature.image}
                  alt={t(`translation:landing.features.${activeFeature.key}.title`)}
                  loading="lazy"
                />
              </S.PreviewFrame>
            </S.FeatureDetail>
          </S.FeatureTabsLayout>
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

            <div>
              <S.ProfitTabsWrap>
                <TabNav
                  variant="pill"
                  ariaLabel={t('translation:landing.profit.panel.title')}
                  value={activeProfitTab}
                  onChange={(id) => setActiveProfitTab(id as ProfitTabId)}
                  items={PROFIT_TAB_IDS.map((id) => ({
                    id,
                    label: t(`translation:landing.profit.tabs.${id}`),
                  }))}
                />
              </S.ProfitTabsWrap>

              {activeProfitTab === 'overview' ? (
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
              ) : (
                <S.PreviewFrame>
                  <S.PreviewBar>
                    <S.PreviewDot $c="error" />
                    <S.PreviewDot $c="warning" />
                    <S.PreviewDot $c="success" />
                    <S.PreviewUrl>
                      app.sellerhill.com/{activeProfitTab === 'pnl' ? 'dashboard' : 'orders'}
                    </S.PreviewUrl>
                  </S.PreviewBar>
                  <S.PreviewImage
                    src={activeProfitTab === 'pnl' ? SCREEN.dashboardPnl : SCREEN.orders}
                    alt={t(`translation:landing.profit.tabs.${activeProfitTab}`)}
                    loading="lazy"
                  />
                </S.PreviewFrame>
              )}
            </div>
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
        {pricingPlans.length > 0 ? (
          <S.PricingToggleRow>
            <SegmentedControl
              size="md"
              value={billingInterval}
              onChange={(value) => setBillingInterval(value as LandingBillingInterval)}
              options={[
                { value: 'monthly', label: t('translation:landing.pricing.interval.monthly') },
                { value: 'annual', label: t('translation:landing.pricing.interval.annual') },
              ]}
            />
            {billingInterval === 'annual' && pricingPlans[0]?.annualSavingsMonths ? (
              <S.PricingSavingsBadge>
                {t('translation:landing.pricing.interval.annualSavings', {
                  months: pricingPlans[0].annualSavingsMonths,
                })}
              </S.PricingSavingsBadge>
            ) : null}
          </S.PricingToggleRow>
        ) : null}
        <S.Reveal $visible={seen('pricing')} $delay={1}>
          <S.PricingGrid>
            {pricingPlans.length > 0
              ? pricingPlans.map((plan) => {
                  const features = t(`translation:landing.pricing.${plan.slug}.features`, {
                    returnObjects: true,
                  }) as string[];
                  const showAnnual = billingInterval === 'annual' && plan.priceDisplayAnnualPerMonth;
                  const amount = showAnnual ? plan.priceDisplayAnnualPerMonth : plan.priceDisplayMonthly;
                  return (
                    <S.PricingCard key={plan.slug} $highlight={plan.isHighlighted}>
                      {plan.isHighlighted ? (
                        <S.PlanBadge>{t('translation:landing.pricing.mostPopular')}</S.PlanBadge>
                      ) : null}
                      <S.PlanName>{t(`translation:landing.pricing.${plan.slug}.name`)}</S.PlanName>
                      <S.PlanPrice>
                        <S.PlanAmount>{amount}</S.PlanAmount>
                        <S.PlanPeriod>{t('translation:landing.pricing.perMonth')}</S.PlanPeriod>
                      </S.PlanPrice>
                      {showAnnual && plan.priceDisplayAnnual ? (
                        <S.PlanPeriodNote>
                          {t('translation:landing.pricing.interval.billedAnnually', {
                            price: plan.priceDisplayAnnual,
                          })}
                        </S.PlanPeriodNote>
                      ) : null}
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
            <Logo layout="wordmark" height={34} />
            <S.FooterDescription>{t('translation:landing.footer.description')}</S.FooterDescription>
            <Dropdown
              align="right"
              width="8rem"
              trigger={
                <S.LanguageTrigger>
                  <S.LanguageText>{t(`translation:languages.${currentLocale}`)}</S.LanguageText>
                  <Icon name="chevron-down" size={12} />
                </S.LanguageTrigger>
              }
              items={[
                { label: t('translation:languages.en'), onClick: () => onLocaleChange('en') },
                { label: t('translation:languages.tr'), onClick: () => onLocaleChange('tr') },
              ]}
            />
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
              <S.FooterLink type="button" onClick={openSupportChat}>
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
