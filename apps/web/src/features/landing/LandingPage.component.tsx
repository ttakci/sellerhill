import { Dropdown, Icon, type IconName, Logo, TabNav } from '@repo/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './LandingPage.style';
import type { LandingPageProps } from './LandingPage.types';

/**
 * Screenshots are real captures from the sign-up-free demo account (never
 * mockups) — see `apps/web/public/landing-screens/`. Reused across the
 * features tabs and the profit tabs so the whole page draws from one small,
 * honest set of images instead of a screenshot per claim.
 */
const SCREEN = {
  dashboardPnl: '/landing-screens/dashboard-pnl.jpg',
  orders: '/landing-screens/orders.jpg',
  orderDetail: '/landing-screens/order-detail.jpg',
  listings: '/landing-screens/listings.jpg',
  listingDetail: '/landing-screens/listing-detail.jpg',
  buyerMessages: '/landing-screens/buyer-messages.jpg',
  stores: '/landing-screens/stores.jpg',
  heroDashboard: '/landing-screens/hero-dashboard.jpg',
  heroKpiCard: '/landing-screens/hero-kpi-card.jpg',
} as const;

/**
 * Each tab shows the screen that actually does the thing it claims.
 *
 * This used to be four images across six tabs — `orders.jpg` answered
 * "automatic orders", "tracking updates" AND "automated buyer messages", and
 * "multiple eBay stores" showed the dashboard. A visitor clicking "buyer
 * messages" and getting an order list reads it as stock filler and stops
 * trusting the rest of the screenshots, which is the opposite of why the page
 * uses real captures at all. Every pairing below is now the screen a seller
 * would actually be looking at for that feature.
 */
const FEATURES: { key: string; icon: IconName; image: string }[] = [
  { key: 'asinListing', icon: 'rocket', image: SCREEN.listings },
  { key: 'priceStock', icon: 'sync', image: SCREEN.listingDetail },
  { key: 'autoOrder', icon: 'shopping-cart', image: SCREEN.orders },
  { key: 'tracking', icon: 'local-shipping', image: SCREEN.orderDetail },
  { key: 'buyerMessages', icon: 'message-circle', image: SCREEN.buyerMessages },
  { key: 'multiStore', icon: 'storefront', image: SCREEN.stores },
];

/**
 * The end-to-end pipeline, named step by step. The page used to show three
 * chips (supplier → SellerHill → eBay), which said "we sit in the middle" but
 * not what we actually do there — and a visitor comparing us to AutoDS/Easync
 * is looking for exactly this list. Ends on real profit, so the differentiator
 * reads as the last stage of the automation rather than a separate product.
 */
const FLOW_STEPS: { key: string; icon: IconName }[] = [
  { key: 'asin', icon: 'barcode' },
  { key: 'listing', icon: 'storefront' },
  { key: 'aiTitle', icon: 'sparkles' },
  { key: 'sync', icon: 'sync' },
  { key: 'order', icon: 'shopping-cart' },
  { key: 'tracking', icon: 'local-shipping' },
  { key: 'messages', icon: 'message-circle' },
  { key: 'profit', icon: 'circle-dollar-sign' },
];

const PROFIT_TAB_IDS = ['overview', 'pnl', 'perOrder'] as const;
type ProfitTabId = (typeof PROFIT_TAB_IDS)[number];

/**
 * `actuals` leads because it is the claim the whole section rests on — both
 * sides of the subtraction are real transactions. Confirmed/estimated is the
 * qualifier on that claim, not the claim itself.
 */
const PROFIT_POINTS: { key: string; icon: IconName }[] = [
  { key: 'actuals', icon: 'circle-dollar-sign' },
  { key: 'confirmed', icon: 'shield-check' },
  { key: 'estimated', icon: 'triangle-info' },
  { key: 'pnl', icon: 'chart-line' },
];

/** The worked example behind the ladder. `$` figures are illustrative, not live data. */
const PROFIT_CALC_ROWS: { key: string; value: string; strong?: boolean; total?: boolean }[] = [
  { key: 'sale', value: '$59.99' },
  { key: 'fees', value: '−$9.20' },
  { key: 'net', value: '$50.79', strong: true },
  { key: 'cost', value: '−$32.45' },
  { key: 'profit', value: '$18.34', total: true },
];

const PILLARS = ['p1', 'p2', 'p3'] as const;
const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;
/** Setting Groups — a reusable bundle of listing settings, applied to many products. */
const SETTING_GROUPS = ['groupA', 'groupB', 'groupC'] as const;
const GROUP_SETTINGS = ['pricing', 'stock', 'template'] as const;
const FAQ_KEYS = [
  'q1',
  'q2',
  'q3',
  'q4',
  'q5',
  'q6',
  'q7',
  'q8',
  'q9',
  'q10',
  'q11',
  'q12',
] as const;
const DEMO_BULLETS = ['b1', 'b2', 'b3'] as const;
const FALLBACK_PLANS = ['nano', 'starter', 'growth', 'pro'] as const;

/**
 * Capabilities every plan includes. The catalog meters exactly two things —
 * active listings and monthly automatic orders — and gates no feature behind a
 * tier, so one shared list is the honest rendering. A per-plan "everything in
 * X, plus…" ladder would be inventing feature tiers that the product does not
 * enforce, and would need twelve copies to drift out of sync.
 */
const INCLUDED_FEATURE_KEYS = [
  'sync',
  'autoOrder',
  'tracking',
  'messages',
  'profit',
  'multiStore',
  'support',
] as const;

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
  const { t } = useTranslation(['translation', 'billing']);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [revealState, setRevealState] = useState<Record<string, boolean>>({});
  const [activeFeatureKey, setActiveFeatureKey] = useState<string>(FEATURES[0].key);
  const [activeProfitTab, setActiveProfitTab] = useState<ProfitTabId>('overview');
  const [showAllPlans, setShowAllPlans] = useState(false);

  const toggleFaq = useCallback((index: number) => {
    setOpenFaq((prev) => (prev === index ? null : index));
  }, []);

  const includedFeatures = INCLUDED_FEATURE_KEYS.map((key) =>
    t(`translation:landing.pricing.included.${key}`)
  );
  const featuredPlans = pricingPlans.filter((plan) => plan.isFeatured);
  // Fall back to the whole catalog if no slug matched — a catalog rename must
  // not empty the pricing section.
  const collapsedPlans = featuredPlans.length > 0 ? featuredPlans : pricingPlans;
  const visiblePlans = showAllPlans ? pricingPlans : collapsedPlans;
  const hasHiddenPlans = collapsedPlans.length < pricingPlans.length;

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
            The full badge + wordmark artwork. `layout="wordmark"` is the
            icon-less lettermark used in the app shell's dark sidebar; the
            landing keeps the badge, and its mobile menu panel is a near-white
            surface where the wordmark's white "SELLER" would vanish.
          */}
          <S.NavBrand type="button" onClick={() => scrollTo('top')} aria-label="SellerHill">
            <Logo layout="full" height={38} />
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
              <Icon name="user" size={18} />
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
          {/* Panel is a near-white surface — keep the full artwork, not the icon-less wordmark. */}
          <Logo layout="full" height={32} />
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
            <S.HeroEyebrow>{t('translation:landing.hero.eyebrow')}</S.HeroEyebrow>
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
          {FLOW_STEPS.map((step, i) => (
            <React.Fragment key={step.key}>
              {i > 0 ? (
                <S.FlowArrow>
                  <Icon name="arrow-right" size={17} />
                </S.FlowArrow>
              ) : null}
              {/* Real profit is the last stage and the differentiator, so it carries the accent. */}
              <S.FlowChip $accent={step.key === 'profit'}>
                <Icon name={step.icon} size={16} />
                {t(`translation:landing.flow.steps.${step.key}`)}
              </S.FlowChip>
            </React.Fragment>
          ))}
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

              <S.FeaturePreviewFrame>
                <S.PreviewImage
                  src={activeFeature.image}
                  alt={t(`translation:landing.features.${activeFeature.key}.title`)}
                  loading="lazy"
                />
              </S.FeaturePreviewFrame>
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
                  {/*
                    The worked sum, in the order a seller thinks about it. It is
                    the fastest way to show that the profit figure comes from
                    two real transactions rather than an assumed margin.
                  */}
                  <S.ProfitCalc>
                    {PROFIT_CALC_ROWS.map((row) => (
                      <S.ProfitCalcRow key={row.key} $strong={row.strong} $total={row.total}>
                        <S.ProfitCalcLabel $strong={row.strong || row.total}>
                          {t(`translation:landing.profit.panel.rows.${row.key}`)}
                        </S.ProfitCalcLabel>
                        <S.ProfitCalcValue $strong={row.strong} $total={row.total}>
                          {row.value}
                        </S.ProfitCalcValue>
                      </S.ProfitCalcRow>
                    ))}
                  </S.ProfitCalc>
                  <S.ProfitFormula>{t('translation:landing.profit.panel.formula')}</S.ProfitFormula>
                  <S.ProfitPanelTitle>
                    {t('translation:landing.profit.panel.monthTitle')}
                  </S.ProfitPanelTitle>
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
                  {/*
                    "Per order" shows the order DETAIL, not the order list: that
                    screen renders the section's own formula as real UI — order
                    earnings − total Amazon cost = net profit — which the list
                    only summarises.
                  */}
                  <S.PreviewImage
                    src={activeProfitTab === 'pnl' ? SCREEN.dashboardPnl : SCREEN.orderDetail}
                    alt={t(`translation:landing.profit.tabs.${activeProfitTab}`)}
                    loading="lazy"
                  />
                </S.PreviewFrame>
              )}
            </div>
          </S.SplitLayout>
        </S.Reveal>
      </S.Section>

      {/* ── Setting Groups ─────────────────────────────── */}
      <S.Section $alt data-reveal="setting-groups">
        <S.Reveal $visible={seen('setting-groups')}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.settingGroups.sectionEyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.settingGroups.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>
              {t('translation:landing.settingGroups.sectionSubtitle')}
            </S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={seen('setting-groups')} $delay={1}>
          <S.ProductGrid>
            {SETTING_GROUPS.map((group) => (
              <S.ProductCard key={group}>
                <S.ProductName>
                  {t(`translation:landing.settingGroups.${group}.name`)}
                </S.ProductName>
                <S.ProductSettings>
                  {GROUP_SETTINGS.map((setting) => (
                    <S.SettingRow key={setting}>
                      <S.SettingLabel>
                        {t(`translation:landing.settingGroups.labels.${setting}`)}
                      </S.SettingLabel>
                      <S.SettingValue>
                        {t(`translation:landing.settingGroups.${group}.${setting}`)}
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
              ? visiblePlans.map((plan) => {
                  return (
                    <S.PricingCard key={plan.slug} $highlight={plan.isHighlighted}>
                      {plan.isHighlighted ? (
                        <S.PlanBadge>{t('translation:landing.pricing.mostPopular')}</S.PlanBadge>
                      ) : null}
                      <S.PlanName>{t(`billing:billing.plans.${plan.slug}.name`)}</S.PlanName>
                      <S.PlanPrice>
                        <S.PlanAmount>{plan.priceDisplayMonthly}</S.PlanAmount>
                        <S.PlanPeriod>{t('translation:landing.pricing.perMonth')}</S.PlanPeriod>
                      </S.PlanPrice>
                      <S.PlanDesc>{t(`billing:billing.plans.${plan.slug}.description`)}</S.PlanDesc>
                      <S.PlanFeatures>
                        <S.PlanFeature>
                          <Icon name="check-circle" size={15} color="semantic.success" />
                          <span>{plan.listingsDisplay}</span>
                        </S.PlanFeature>
                        <S.PlanFeature>
                          <Icon name="check-circle" size={15} color="semantic.success" />
                          <span>{plan.trackingConversionsDisplay}</span>
                        </S.PlanFeature>
                        <S.PlanFeature>
                          <Icon name="check-circle" size={15} color="semantic.success" />
                          <span>{plan.amazonOrdersDisplay}</span>
                        </S.PlanFeature>
                        {includedFeatures.map((feat) => (
                          <S.PlanFeature key={feat}>
                            <Icon name="check-circle" size={15} color="semantic.success" />
                            <span>{feat}</span>
                          </S.PlanFeature>
                        ))}
                      </S.PlanFeatures>
                      <S.PlanCta type="button" $highlight={plan.isHighlighted} onClick={onNavigateRegister}>
                        {t('translation:landing.pricing.planCta')}
                      </S.PlanCta>
                    </S.PricingCard>
                  );
                })
              : FALLBACK_PLANS.map((plan) => {
                  const highlight = plan === 'growth';
                  return (
                    <S.PricingCard key={plan} $highlight={highlight}>
                      {highlight ? (
                        <S.PlanBadge>{t('translation:landing.pricing.mostPopular')}</S.PlanBadge>
                      ) : null}
                      <S.PlanName>{t(`billing:billing.plans.${plan}.name`)}</S.PlanName>
                      <S.PlanPrice>
                        <S.PlanAmount>
                          {t(`translation:landing.pricing.catalogFallback.${plan}.price`)}
                        </S.PlanAmount>
                        <S.PlanPeriod>{t('translation:landing.pricing.perMonth')}</S.PlanPeriod>
                      </S.PlanPrice>
                      <S.PlanDesc>{t(`billing:billing.plans.${plan}.description`)}</S.PlanDesc>
                      <S.PlanFeatures>
                        <S.PlanFeature>
                          <Icon name="check-circle" size={15} color="semantic.success" />
                          <span>
                            {t(`translation:landing.pricing.catalogFallback.${plan}.listings`)}
                          </span>
                        </S.PlanFeature>
                        <S.PlanFeature>
                          <Icon name="check-circle" size={15} color="semantic.success" />
                          <span>
                            {t(`translation:landing.pricing.catalogFallback.${plan}.conversions`)}
                          </span>
                        </S.PlanFeature>
                        <S.PlanFeature>
                          <Icon name="check-circle" size={15} color="semantic.success" />
                          <span>
                            {t(`translation:landing.pricing.catalogFallback.${plan}.orders`)}
                          </span>
                        </S.PlanFeature>
                        {includedFeatures.map((feat) => (
                          <S.PlanFeature key={feat}>
                            <Icon name="check-circle" size={15} color="semantic.success" />
                            <span>{feat}</span>
                          </S.PlanFeature>
                        ))}
                      </S.PlanFeatures>
                      <S.PlanCta type="button" $highlight={highlight} onClick={onNavigateRegister}>
                        {t('translation:landing.pricing.planCta')}
                      </S.PlanCta>
                    </S.PricingCard>
                  );
                })}
          </S.PricingGrid>
        </S.Reveal>
        {hasHiddenPlans ? (
          <S.PricingExpandRow>
            <S.PricingExpandButton type="button" onClick={() => setShowAllPlans((prev) => !prev)}>
              {showAllPlans
                ? t('translation:landing.pricing.showFewerPlans')
                : t('translation:landing.pricing.showAllPlans', { count: pricingPlans.length })}
              <Icon name={showAllPlans ? 'chevron-up' : 'chevron-down'} size={16} />
            </S.PricingExpandButton>
          </S.PricingExpandRow>
        ) : null}
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
            <Logo layout="full" height={34} />
            <S.FooterDescription>{t('translation:landing.footer.description')}</S.FooterDescription>
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
