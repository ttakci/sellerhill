import { Dropdown, Icon, type IconName, Logo, TabNav } from '@repo/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  BUSINESS_CONTACT,
  SPEC_PLACEHOLDER,
  SPEC_SAMPLES,
  SYNC_TIMES,
} from './LandingPage.constants';
import * as S from './LandingPage.style';
import type { LandingPageProps } from './LandingPage.types';

/**
 * Screenshots are real captures from the sign-up-free demo account (never
 * mockups) — see `apps/web/public/landing-screens/`. Captured once per locale
 * under `en/` and `tr/` (the app inside the screenshot IS the product, so a
 * Turkish visitor must see the Turkish UI); both folders hold the same file
 * names, so only the folder varies.
 */
const SCREEN_NAMES = {
  dashboardPnl: 'dashboard-pnl',
  dashboardChart: 'dashboard-chart',
  orderDetail: 'order-detail',
  listingDetail: 'listing-detail',
  heroDashboard: 'hero-dashboard',
  heroKpiCard: 'hero-kpi-card',
  actionCenter: 'action-center',
  settingGroups: 'setting-groups',
  itemSpecifics: 'item-specifics',
  mobileDashboard: 'mobile-dashboard',
  mobileActions: 'mobile-actions',
  mobileOrders: 'mobile-orders',
} as const;

type ScreenKey = keyof typeof SCREEN_NAMES;

/** Only `tr` and `en` are captured; anything else falls back to the English set. */
const screenSrc = (key: ScreenKey, locale: string): string =>
  `/landing-screens/${locale.toLowerCase().startsWith('tr') ? 'tr' : 'en'}/${SCREEN_NAMES[key]}.jpg`;

/**
 * Listing-template previews. These are NOT app UI — they are what a buyer sees
 * on eBay.com, rendered from the real catalog (migration `073`) by the same
 * `renderListingTemplate` the publish path uses, so one English set serves
 * both locales. Product photos are the CC0 / public-domain demo images.
 */
const TEMPLATE_PREVIEWS = [
  { key: 'generalStore', file: 'general-store' },
  { key: 'techGadgets', file: 'tech-gadgets' },
  { key: 'homeDecor', file: 'home-decor' },
  { key: 'kitchenDining', file: 'kitchen-dining' },
  { key: 'fitnessSports', file: 'fitness-sports' },
  { key: 'outdoorSurvival', file: 'outdoor-survival' },
] as const;

type TemplateKey = (typeof TEMPLATE_PREVIEWS)[number]['key'];

const templateSrc = (file: string): string => `/landing-screens/templates/${file}.jpg`;

/** The three example groups on the dark Setting Groups card. Figures match the demo account's groups. */
const GROUP_CHIPS = [
  { chip: 'chipA', margin: 30, buffer: 1, icon: 'sparkles' },
  { chip: 'chipB', margin: 20, buffer: 2, icon: 'truck' },
  { chip: 'chipC', margin: 16, buffer: 3, icon: 'bolt' },
] as const satisfies readonly { chip: string; margin: number; buffer: number; icon: IconName }[];

const GROUP_PARAMS: { key: string; icon: IconName }[] = [
  { key: 'margin', icon: 'percent' },
  { key: 'template', icon: 'layers' },
  { key: 'stock', icon: 'inventory' },
  { key: 'fees', icon: 'receipt' },
  { key: 'content', icon: 'edit-note' },
];

const GROUP_EXAMPLES: { key: string; icon: IconName }[] = [
  { key: 'seasonal', icon: 'calendar' },
  { key: 'category', icon: 'truck' },
  { key: 'electronics', icon: 'bolt' },
];

/** Real screens, each paired with the claim it proves. */
const SHOWCASE: { key: string; screen: ScreenKey }[] = [
  { key: 'actionCenter', screen: 'actionCenter' },
  { key: 'itemSpecifics', screen: 'itemSpecifics' },
  { key: 'orders', screen: 'orderDetail' },
  { key: 'priceStock', screen: 'listingDetail' },
];

const PROFIT_TAB_IDS = ['overview', 'chart', 'pnl', 'perOrder'] as const;
type ProfitTabId = (typeof PROFIT_TAB_IDS)[number];

const PROFIT_TAB_SCREEN: Record<ProfitTabId, ScreenKey> = {
  overview: 'heroDashboard',
  chart: 'dashboardChart',
  pnl: 'dashboardPnl',
  perOrder: 'orderDetail',
};

const PROFIT_POINTS: { key: string; icon: IconName }[] = [
  { key: 'actuals', icon: 'circle-dollar-sign' },
  { key: 'confirmed', icon: 'shield-check' },
  { key: 'estimated', icon: 'triangle-info' },
  { key: 'pnl', icon: 'chart-line' },
];

const PROOF_KEYS = ['sync', 'specifics', 'templates', 'trial'] as const;

const MOBILE_SCREENS: { key: string; screen: ScreenKey; raised?: boolean }[] = [
  { key: 'actions', screen: 'mobileActions' },
  { key: 'dashboard', screen: 'mobileDashboard', raised: true },
  { key: 'orders', screen: 'mobileOrders' },
];

const TRUST_ITEMS: { key: string; icon: IconName }[] = [
  { key: 'card', icon: 'wallet-cards' },
  { key: 'session', icon: 'lock-keyhole' },
  { key: 'policy', icon: 'file-text' },
];

const STANDARD_ITEMS: { key: string; icon: IconName }[] = [
  { key: 'bulkAsin', icon: 'barcode' },
  { key: 'aiTitle', icon: 'sparkles' },
  { key: 'autoOrder', icon: 'shopping-cart' },
  { key: 'tracking', icon: 'truck' },
  { key: 'messages', icon: 'message-circle' },
  { key: 'multiStore', icon: 'storefront' },
  { key: 'import', icon: 'upload' },
  { key: 'blacklist', icon: 'block' },
];

/** The capability strip under the proof bar — reuses existing labels, no new copy. */
const MARQUEE_ITEMS: { key: string; icon: IconName }[] = [
  { key: 'translation:landing.navbar.menu.groups', icon: 'layers' },
  { key: 'translation:landing.why.sync.title', icon: 'sync' },
  { key: 'translation:landing.navbar.menu.specifics', icon: 'list-alt' },
  { key: 'translation:landing.navbar.menu.templates', icon: 'file-text' },
  { key: 'translation:landing.navbar.menu.actions', icon: 'bell-ring' },
  { key: 'translation:landing.standard.items.autoOrder.title', icon: 'shopping-cart' },
  { key: 'translation:landing.standard.items.tracking.title', icon: 'truck' },
  { key: 'translation:landing.standard.items.blacklist.title', icon: 'block' },
  { key: 'translation:landing.standard.items.aiTitle.title', icon: 'sparkles' },
  { key: 'translation:landing.standard.items.messages.title', icon: 'message-circle' },
  { key: 'translation:landing.standard.items.multiStore.title', icon: 'storefront' },
  { key: 'translation:landing.navbar.menu.mobile', icon: 'smartphone' },
];

const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5'] as const;
const FAQ_KEYS = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q11', 'q12'] as const;
const DEMO_BULLETS = ['b1', 'b2', 'b3'] as const;
const FALLBACK_PLANS = ['nano', 'starter', 'growth'] as const;

/**
 * Capabilities every plan includes. The catalog meters only listings, orders
 * and conversions and gates no feature behind a tier, so one shared list is
 * the honest rendering — and it is the "every feature in every plan" argument
 * the pricing copy makes.
 */
const INCLUDED_FEATURE_KEYS = [
  'groups',
  'sync',
  'specifics',
  'autoOrder',
  'actions',
  'profit',
  'multiStore',
  'support',
] as const;

/** Feature-menu entries in the navbar: each scrolls to its own anchor. */
const FEATURE_MENU: { key: string; target: string; icon: IconName }[] = [
  { key: 'why', target: 'why', icon: 'star' },
  { key: 'groups', target: 'groups', icon: 'layers' },
  { key: 'templates', target: 'templates', icon: 'file-text' },
  { key: 'actions', target: 'showcase-actionCenter', icon: 'bell-ring' },
  { key: 'specifics', target: 'showcase-itemSpecifics', icon: 'list-alt' },
  { key: 'mobile', target: 'mobile', icon: 'smartphone' },
  { key: 'trust', target: 'trust', icon: 'shield-check' },
];

export const LandingPageComponent = ({
  currentLocale,
  scrolled,
  mobileMenuOpen,
  pricingPlans,
  startingPriceDisplay,
  pricingCatalogError,
  onLocaleChange,
  onNavigateLogin,
  onNavigateRegister,
  onOpenDemo,
  onNavigatePrivacy,
  onNavigateTerms,
  onToggleMobileMenu,
  onCloseMobileMenu,
}: LandingPageProps): React.ReactElement => {
  const { t } = useTranslation(['translation', 'billing']);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [revealState, setRevealState] = useState<Record<string, boolean>>({});
  const [activeProfitTab, setActiveProfitTab] = useState<ProfitTabId>('overview');
  const [activeTemplate, setActiveTemplate] = useState<TemplateKey>('generalStore');
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
  const activeTemplateFile =
    TEMPLATE_PREVIEWS.find((tpl) => tpl.key === activeTemplate)?.file ?? TEMPLATE_PREVIEWS[0].file;

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
      { threshold: 0.08, rootMargin: '0px 0px -6% 0px' }
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
    { id: 'templates', label: t('translation:landing.navbar.templates') },
    { id: 'profit', label: t('translation:landing.navbar.profit') },
    { id: 'pricing', label: t('translation:landing.navbar.pricing') },
    { id: 'faq', label: t('translation:landing.navbar.faq') },
  ];

  const seen = (id: string): boolean => revealState[id] ?? false;

  return (
    <S.Page>
      {/* ── Navbar ─────────────────────────────────────── */}
      <S.Navbar $scrolled={scrolled}>
        <S.NavInner>
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
              items={FEATURE_MENU.map((item) => ({
                label: t(`translation:landing.navbar.menu.${item.key}`),
                icon: item.icon,
                onClick: () => scrollTo(item.target),
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
          <S.MobileLink type="button" onClick={() => scrollTo('why')}>
            {t('translation:landing.navbar.menu.why')}
          </S.MobileLink>
          <S.MobileLink type="button" onClick={() => scrollTo('groups')}>
            {t('translation:landing.navbar.menu.groups')}
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
        <S.HeroGlowWarm />
        <S.HeroInner>
          <S.HeroContent>
            <S.HeroEyebrow>
              <S.LiveDot />
              {t('translation:landing.hero.eyebrow')}
            </S.HeroEyebrow>
            <S.HeroTitle>
              {t('translation:landing.hero.headline')}{' '}
              <S.HeroTitleAccent>{t('translation:landing.hero.headlineAccent')}</S.HeroTitleAccent>
            </S.HeroTitle>
            <S.HeroSubtitle>{t('translation:landing.hero.subheading')}</S.HeroSubtitle>
            <S.HeroCtas>
              <S.PrimaryButton $lg $accent type="button" onClick={onNavigateRegister}>
                {t('translation:landing.hero.ctaPrimary')}
                <Icon name="arrow-right" size={17} />
              </S.PrimaryButton>
              <S.GhostButton $lg $onDark type="button" onClick={onOpenDemo}>
                <S.PlayBadge>
                  <Icon name="play-arrow" size={14} />
                </S.PlayBadge>
                {t('translation:landing.hero.ctaSecondary')}
              </S.GhostButton>
            </S.HeroCtas>
            {/* Below 1080px the floating offer card is hidden; the offer rides here instead. */}
            <S.MobileOffer>
              <S.MobileOfferTag>{t('translation:landing.hero.trialTitle')}</S.MobileOfferTag>
              <S.MobileOfferPrice>
                {startingPriceDisplay}
                {t('translation:landing.hero.priceBadge.per')}
              </S.MobileOfferPrice>
            </S.MobileOffer>
            <S.HeroTrust>
              {(['trialNoCard', 'trialCancelAnytime', 'trialMobile'] as const).map((key) => (
                <S.HeroTrustItem key={key}>
                  <Icon name="check-circle" size={15} />
                  {t(`translation:landing.hero.${key}`)}
                </S.HeroTrustItem>
              ))}
            </S.HeroTrust>
          </S.HeroContent>

          <S.HeroPreview>
            <S.HeroTilt>
              <S.HeroPreviewGlass>
                <S.HeroPreviewImage
                  src={screenSrc('heroDashboard', currentLocale)}
                  alt="SellerHill dashboard"
                />
              </S.HeroPreviewGlass>
              <S.HeroFloatCard>
                <S.HeroFloatImage src={screenSrc('heroKpiCard', currentLocale)} alt="" />
              </S.HeroFloatCard>
              <S.HeroToast>
                <S.HeroToastIcon>
                  <Icon name="package-check" size={18} />
                </S.HeroToastIcon>
                <span>
                  <S.HeroToastTitle>{t('translation:landing.hero.toast.title')}</S.HeroToastTitle>
                  <S.HeroToastText>{t('translation:landing.hero.toast.text')}</S.HeroToastText>
                </span>
              </S.HeroToast>
            </S.HeroTilt>
            {/* The offer: amount from the catalog's cheapest tier (see the container). */}
            <S.HeroOfferCard>
              <S.HeroOfferInner>
                <S.HeroOfferTag>
                  <Icon name="sparkles" size={13} />
                  {t('translation:landing.hero.trialTitle')}
                </S.HeroOfferTag>
                <S.HeroOfferPrice>
                  <S.HeroOfferAmount>{startingPriceDisplay}</S.HeroOfferAmount>
                  <S.HeroOfferPer>{t('translation:landing.hero.priceBadge.per')}</S.HeroOfferPer>
                </S.HeroOfferPrice>
                <S.HeroOfferCaption>{t('translation:landing.hero.priceBadge.caption')}</S.HeroOfferCaption>
                <S.HeroOfferRule />
                <S.HeroOfferPoints>
                  <span>
                    <Icon name="check" size={12} />
                    {t('translation:landing.hero.trialNoCard')}
                  </span>
                  <span>
                    <Icon name="check" size={12} />
                    {t('translation:landing.hero.trialCancelAnytime')}
                  </span>
                </S.HeroOfferPoints>
              </S.HeroOfferInner>
            </S.HeroOfferCard>
          </S.HeroPreview>
        </S.HeroInner>
      </S.Hero>

      {/* ── Proof bar ──────────────────────────────────── */}
      <S.ProofWrap>
        <S.ProofBar>
          {PROOF_KEYS.map((key) => (
            <S.ProofItem key={key}>
              <S.ProofValue>{t(`translation:landing.proof.${key}.value`)}</S.ProofValue>
              <S.ProofLabel>{t(`translation:landing.proof.${key}.label`)}</S.ProofLabel>
            </S.ProofItem>
          ))}
        </S.ProofBar>
      </S.ProofWrap>

      {/* ── Capability marquee (duplicated once so the loop is seamless) ── */}
      <S.MarqueeBand aria-hidden="true">
        <S.MarqueeTrack>
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, index) => (
            <S.MarqueeItem key={`${item.key}-${index}`}>
              <Icon name={item.icon} size={16} />
              {t(item.key)}
            </S.MarqueeItem>
          ))}
        </S.MarqueeTrack>
      </S.MarqueeBand>

      {/* ── Why SellerHill — the differentiators ──────── */}
      <S.Section id="why" data-reveal="why">
        <S.Reveal $visible={seen('why')}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.why.eyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.why.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.why.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={seen('why')} $delay={1}>
          <S.Bento>
            <S.BentoCard $span={2} $dark>
              <S.BentoTop>
                <S.BentoIcon $dark>
                  <Icon name="layers" size={20} />
                </S.BentoIcon>
                <S.ExclusiveBadge>
                  <Icon name="star" size={12} />
                  {t('translation:landing.why.exclusive')}
                </S.ExclusiveBadge>
              </S.BentoTop>
              <S.BentoTitle $dark>{t('translation:landing.why.groups.title')}</S.BentoTitle>
              <S.BentoText $dark>{t('translation:landing.why.groups.description')}</S.BentoText>
              <S.BentoVisual>
                <S.GroupRows>
                  {GROUP_CHIPS.map((group) => (
                    <S.GroupRow key={group.chip}>
                      <S.GroupRowName>
                        <Icon name={group.icon} size={14} />
                        {t(`translation:landing.why.groups.${group.chip}`)}
                      </S.GroupRowName>
                      <S.GroupRowStats>
                        <S.GroupStat>
                          {t('translation:landing.why.groups.margin', { value: group.margin })}
                        </S.GroupStat>
                        <S.GroupStat>
                          {t('translation:landing.why.groups.buffer', { value: group.buffer })}
                        </S.GroupStat>
                      </S.GroupRowStats>
                    </S.GroupRow>
                  ))}
                </S.GroupRows>
              </S.BentoVisual>
            </S.BentoCard>

            <S.BentoCard>
              <S.BentoIcon>
                <Icon name="sync" size={20} />
              </S.BentoIcon>
              <S.BentoTitle>{t('translation:landing.why.sync.title')}</S.BentoTitle>
              <S.BentoText>{t('translation:landing.why.sync.description')}</S.BentoText>
              <S.BentoVisual>
                <S.SyncRail>
                  {SYNC_TIMES.map((time) => (
                    <S.SyncTick key={time}>{time}</S.SyncTick>
                  ))}
                </S.SyncRail>
                <S.VisualCaption>{t('translation:landing.why.sync.caption')}</S.VisualCaption>
              </S.BentoVisual>
            </S.BentoCard>

            <S.BentoCard>
              <S.BentoIcon>
                <Icon name="list-alt" size={20} />
              </S.BentoIcon>
              <S.BentoTitle>{t('translation:landing.why.specifics.title')}</S.BentoTitle>
              <S.BentoText>{t('translation:landing.why.specifics.description')}</S.BentoText>
              <S.BentoVisual>
                <S.SpecTable>
                  <S.SpecCell $head>&nbsp;</S.SpecCell>
                  <S.SpecCell $head>{t('translation:landing.why.specifics.others')}</S.SpecCell>
                  <S.SpecCell $head>{t('translation:landing.why.specifics.us')}</S.SpecCell>
                  {SPEC_SAMPLES.map((spec) => (
                    <React.Fragment key={spec.name}>
                      <S.SpecCell>{spec.name}</S.SpecCell>
                      <S.SpecCell $muted>{SPEC_PLACEHOLDER}</S.SpecCell>
                      <S.SpecCell $good>
                        <Icon name="check" size={12} />
                        {spec.value}
                      </S.SpecCell>
                    </React.Fragment>
                  ))}
                </S.SpecTable>
              </S.BentoVisual>
            </S.BentoCard>

            <S.BentoCard>
              <S.BentoIcon>
                <Icon name="bell-ring" size={20} />
              </S.BentoIcon>
              <S.BentoTitle>{t('translation:landing.why.actions.title')}</S.BentoTitle>
              <S.BentoText>{t('translation:landing.why.actions.description')}</S.BentoText>
              <S.BentoVisual>
                <S.ActionRows>
                  <S.ActionRow>
                    <S.SeverityDot $level="critical" />
                    <span>{t('translation:landing.why.actions.rowA')}</span>
                    <S.ActionCount>2</S.ActionCount>
                  </S.ActionRow>
                  <S.ActionRow>
                    <S.SeverityDot $level="warning" />
                    <span>{t('translation:landing.why.actions.rowB')}</span>
                    <S.ActionCount>3</S.ActionCount>
                  </S.ActionRow>
                  <S.ActionRow>
                    <S.SeverityDot $level="info" />
                    <span>{t('translation:landing.why.actions.rowC')}</span>
                    <S.ActionCount>1</S.ActionCount>
                  </S.ActionRow>
                </S.ActionRows>
              </S.BentoVisual>
            </S.BentoCard>

            <S.BentoCard>
              <S.BentoIcon>
                <Icon name="eye-off" size={20} />
              </S.BentoIcon>
              <S.BentoTitle>{t('translation:landing.why.supplier.title')}</S.BentoTitle>
              <S.BentoText>{t('translation:landing.why.supplier.description')}</S.BentoText>
              <S.BentoVisual>
                <S.ChipRow>
                  <S.Chip>
                    <Icon name="image" size={13} />
                    {t('translation:landing.why.supplier.chipImages')}
                  </S.Chip>
                  <S.Chip>
                    <Icon name="truck" size={13} />
                    {t('translation:landing.why.supplier.chipTracking')}
                  </S.Chip>
                  <S.Chip>
                    <Icon name="block" size={13} />
                    {t('translation:landing.why.supplier.chipBlacklist')}
                  </S.Chip>
                </S.ChipRow>
              </S.BentoVisual>
            </S.BentoCard>

            <S.BentoCard $span={3}>
              <S.PriceStrip>
                <S.PriceStripCopy>
                  <S.BentoIcon>
                    <Icon name="badge-percent" size={20} />
                  </S.BentoIcon>
                  <div>
                    <S.BentoTitle>{t('translation:landing.why.price.title')}</S.BentoTitle>
                    <S.BentoText>{t('translation:landing.why.price.description')}</S.BentoText>
                  </div>
                </S.PriceStripCopy>
                <S.PrimaryButton type="button" onClick={() => scrollTo('pricing')}>
                  {t('translation:landing.why.price.cta')}
                  <Icon name="arrow-right" size={16} />
                </S.PrimaryButton>
              </S.PriceStrip>
            </S.BentoCard>
          </S.Bento>
        </S.Reveal>
      </S.Section>

      {/* ── Setting Groups spotlight ───────────────────── */}
      <S.Section $alt id="groups" data-reveal="groups">
        <S.Reveal $visible={seen('groups')}>
          <S.GroupsLayout>
            <S.SplitHead>
              <S.Eyebrow>{t('translation:landing.groups.eyebrow')}</S.Eyebrow>
              <S.SplitTitle>{t('translation:landing.groups.sectionTitle')}</S.SplitTitle>
              <S.SplitSubtitle>{t('translation:landing.groups.sectionSubtitle')}</S.SplitSubtitle>
              <S.ParamGrid>
                {GROUP_PARAMS.map((param) => (
                  <S.ParamItem key={param.key}>
                    <S.ParamIcon>
                      <Icon name={param.icon} size={16} />
                    </S.ParamIcon>
                    <div>
                      <S.ParamTitle>{t(`translation:landing.groups.params.${param.key}.title`)}</S.ParamTitle>
                      <S.ParamText>{t(`translation:landing.groups.params.${param.key}.description`)}</S.ParamText>
                    </div>
                  </S.ParamItem>
                ))}
              </S.ParamGrid>
            </S.SplitHead>
            <S.ScreenFrame>
              <S.ScreenImage
                src={screenSrc('settingGroups', currentLocale)}
                alt={t('translation:landing.groups.screenCaption')}
                $maxHeight="34rem"
                loading="lazy"
              />
              <S.ScreenCaption>{t('translation:landing.groups.screenCaption')}</S.ScreenCaption>
            </S.ScreenFrame>
          </S.GroupsLayout>
        </S.Reveal>
        <S.Reveal $visible={seen('groups')} $delay={1}>
          <S.ExamplesTitle>{t('translation:landing.groups.examplesTitle')}</S.ExamplesTitle>
          <S.ExampleGrid>
            {GROUP_EXAMPLES.map((example) => (
              <S.ExampleCard key={example.key}>
                <S.ParamIcon>
                  <Icon name={example.icon} size={16} />
                </S.ParamIcon>
                <div>
                  <S.ExampleName>{t(`translation:landing.groups.examples.${example.key}.name`)}</S.ExampleName>
                  <S.ExampleNote>{t(`translation:landing.groups.examples.${example.key}.note`)}</S.ExampleNote>
                </div>
              </S.ExampleCard>
            ))}
          </S.ExampleGrid>
        </S.Reveal>
      </S.Section>

      {/* ── Listing templates ──────────────────────────── */}
      <S.Section id="templates" data-reveal="templates">
        <S.Reveal $visible={seen('templates')}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.templates.eyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.templates.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.templates.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={seen('templates')} $delay={1}>
          <S.TemplatesLayout>
            <div>
              <S.TemplateTabs role="tablist" aria-label={t('translation:landing.templates.eyebrow')}>
                {TEMPLATE_PREVIEWS.map((tpl) => (
                  <S.TemplateTab
                    key={tpl.key}
                    type="button"
                    role="tab"
                    aria-selected={activeTemplate === tpl.key}
                    $active={activeTemplate === tpl.key}
                    onClick={() => setActiveTemplate(tpl.key)}
                  >
                    {t(`translation:landing.templates.names.${tpl.key}`)}
                    <Icon name="chevron-right" size={16} />
                  </S.TemplateTab>
                ))}
              </S.TemplateTabs>
              <S.TemplatePoints>
                {(['editable', 'mobile', 'clean', 'specs'] as const).map((key) => (
                  <S.TemplatePoint key={key}>
                    <Icon name="check-circle" size={16} />
                    <span>{t(`translation:landing.templates.points.${key}`)}</span>
                  </S.TemplatePoint>
                ))}
              </S.TemplatePoints>
            </div>
            <S.TemplatePreview>
              <S.TemplateImage
                key={activeTemplateFile}
                src={templateSrc(activeTemplateFile)}
                alt={t(`translation:landing.templates.names.${activeTemplate}`)}
                loading="lazy"
              />
              <S.PreviewBadge>{t('translation:landing.templates.previewNote')}</S.PreviewBadge>
            </S.TemplatePreview>
          </S.TemplatesLayout>
        </S.Reveal>
      </S.Section>

      {/* ── Showcase — real screens ────────────────────── */}
      <S.Section $alt id="showcase" data-reveal="showcase">
        <S.Reveal $visible={seen('showcase')}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.showcase.eyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.showcase.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.showcase.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.ShowcaseList>
          {SHOWCASE.map((row, index) => (
            <S.Reveal key={row.key} $visible={seen('showcase')} $delay={1}>
              <S.ShowcaseRow id={`showcase-${row.key}`} $reversed={index % 2 === 1}>
                <S.ShowcaseCopy>
                  <S.ShowcaseTitle>{t(`translation:landing.showcase.${row.key}.title`)}</S.ShowcaseTitle>
                  <S.ShowcaseText>{t(`translation:landing.showcase.${row.key}.detail`)}</S.ShowcaseText>
                  <S.KeyPoint>
                    <Icon name="check-circle" size={17} />
                    <span>{t(`translation:landing.showcase.${row.key}.point`)}</span>
                  </S.KeyPoint>
                </S.ShowcaseCopy>
                <S.ScreenFrame>
                  <S.ScreenImage
                    src={screenSrc(row.screen, currentLocale)}
                    alt={t(`translation:landing.showcase.${row.key}.title`)}
                    loading="lazy"
                  />
                </S.ScreenFrame>
              </S.ShowcaseRow>
            </S.Reveal>
          ))}
        </S.ShowcaseList>
      </S.Section>

      {/* ── Profit ─────────────────────────────────────── */}
      <S.Section id="profit" data-reveal="profit">
        <S.Reveal $visible={seen('profit')}>
          <S.SplitLayout>
            <S.SplitCopy>
              <S.SplitTitle>{t('translation:landing.profit.sectionTitle')}</S.SplitTitle>
              <S.SplitSubtitle>{t('translation:landing.profit.sectionSubtitle')}</S.SplitSubtitle>
              <S.ProfitList>
                {PROFIT_POINTS.map((point) => (
                  <S.ProfitItem key={point.key}>
                    <S.ProfitItemIcon>
                      <Icon name={point.icon} size={15} />
                    </S.ProfitItemIcon>
                    <div>
                      <S.ProfitItemTitle>{t(`translation:landing.profit.${point.key}.title`)}</S.ProfitItemTitle>
                      <S.ProfitItemText>{t(`translation:landing.profit.${point.key}.description`)}</S.ProfitItemText>
                    </div>
                  </S.ProfitItem>
                ))}
              </S.ProfitList>
            </S.SplitCopy>
            <div>
              <S.ProfitTabsWrap>
                <TabNav
                  variant="pill"
                  ariaLabel={t('translation:landing.profit.sectionTitle')}
                  value={activeProfitTab}
                  onChange={(id) => setActiveProfitTab(id as ProfitTabId)}
                  items={PROFIT_TAB_IDS.map((id) => ({
                    id,
                    label: t(`translation:landing.profit.tabs.${id}`),
                  }))}
                />
              </S.ProfitTabsWrap>
              {/* One capped frame, four real screens: the image swaps in place. */}
              <S.ProfitPreviewFrame>
                <S.ProfitPreviewImage
                  key={activeProfitTab}
                  src={screenSrc(PROFIT_TAB_SCREEN[activeProfitTab], currentLocale)}
                  alt={t(`translation:landing.profit.tabs.${activeProfitTab}`)}
                  loading="lazy"
                />
              </S.ProfitPreviewFrame>
            </div>
          </S.SplitLayout>
        </S.Reveal>
      </S.Section>

      {/* ── Mobile ─────────────────────────────────────── */}
      <S.DarkSection id="mobile" data-reveal="mobile">
        <S.HeroGlow />
        <S.Reveal $visible={seen('mobile')}>
          <S.MobileLayout>
            <S.SplitHead>
              <S.DarkEyebrow>{t('translation:landing.mobile.eyebrow')}</S.DarkEyebrow>
              <S.DarkTitle>{t('translation:landing.mobile.sectionTitle')}</S.DarkTitle>
              <S.DarkText>{t('translation:landing.mobile.sectionSubtitle')}</S.DarkText>
              <S.DarkBullets>
                {DEMO_BULLETS.map((key) => (
                  <S.DarkBullet key={key}>
                    <Icon name="check-circle" size={16} />
                    <span>{t(`translation:landing.mobile.bullets.${key}`)}</span>
                  </S.DarkBullet>
                ))}
              </S.DarkBullets>
            </S.SplitHead>
            <S.Phones>
              {MOBILE_SCREENS.map((phone) => (
                <S.Phone key={phone.key} $raised={phone.raised}>
                  <S.PhoneBezel>
                    <S.PhoneScreen
                      src={screenSrc(phone.screen, currentLocale)}
                      alt={t(`translation:landing.mobile.screens.${phone.key}`)}
                      loading="lazy"
                    />
                  </S.PhoneBezel>
                  <S.PhoneLabel>{t(`translation:landing.mobile.screens.${phone.key}`)}</S.PhoneLabel>
                </S.Phone>
              ))}
            </S.Phones>
          </S.MobileLayout>
        </S.Reveal>
      </S.DarkSection>

      {/* ── Trust & privacy ────────────────────────────── */}
      <S.Section id="trust" data-reveal="trust">
        <S.Reveal $visible={seen('trust')}>
          <S.SectionHead>
            <S.Eyebrow>{t('translation:landing.trust.eyebrow')}</S.Eyebrow>
            <S.SectionTitle>{t('translation:landing.trust.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.trust.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={seen('trust')} $delay={1}>
          <S.TrustGrid>
            {TRUST_ITEMS.map((item) => (
              <S.TrustCard key={item.key}>
                <S.TrustIcon>
                  <Icon name={item.icon} size={20} />
                </S.TrustIcon>
                <S.BentoTitle>{t(`translation:landing.trust.${item.key}.title`)}</S.BentoTitle>
                <S.BentoText>{t(`translation:landing.trust.${item.key}.description`)}</S.BentoText>
              </S.TrustCard>
            ))}
          </S.TrustGrid>
          <S.TrustLinks>
            <S.TextLink type="button" onClick={() => onNavigatePrivacy()}>
              {t('translation:landing.trust.privacyLink')}
              <Icon name="arrow-right" size={15} />
            </S.TextLink>
            <S.TextLink type="button" onClick={onNavigateTerms}>
              {t('translation:landing.trust.termsLink')}
              <Icon name="arrow-right" size={15} />
            </S.TextLink>
          </S.TrustLinks>
        </S.Reveal>
      </S.Section>

      {/* ── Standard features ──────────────────────────── */}
      <S.Section $alt data-reveal="standard">
        <S.Reveal $visible={seen('standard')}>
          <S.SectionHead>
            <S.SectionTitle>{t('translation:landing.standard.sectionTitle')}</S.SectionTitle>
            <S.SectionSubtitle>{t('translation:landing.standard.sectionSubtitle')}</S.SectionSubtitle>
          </S.SectionHead>
        </S.Reveal>
        <S.Reveal $visible={seen('standard')} $delay={1}>
          <S.StandardGrid>
            {STANDARD_ITEMS.map((item) => (
              <S.StandardItem key={item.key}>
                <S.StandardIcon>
                  <Icon name={item.icon} size={18} />
                </S.StandardIcon>
                <S.ParamTitle>{t(`translation:landing.standard.items.${item.key}.title`)}</S.ParamTitle>
                <S.ParamText>{t(`translation:landing.standard.items.${item.key}.description`)}</S.ParamText>
              </S.StandardItem>
            ))}
          </S.StandardGrid>
        </S.Reveal>
      </S.Section>

      {/* ── How it works ───────────────────────────────── */}
      <S.Section id="how-it-works" data-reveal="how-it-works">
        <S.Reveal $visible={seen('how-it-works')}>
          <S.SectionHead>
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
              <S.DemoPreview type="button" onClick={onOpenDemo} aria-label={t('translation:landing.demo.button')}>
                <img src={screenSrc('actionCenter', currentLocale)} alt="" loading="lazy" />
                <S.DemoPlay>
                  <span>
                    <Icon name="play-arrow" size={26} color="landing.onAccent" />
                  </span>
                </S.DemoPlay>
              </S.DemoPreview>
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
            <S.Eyebrow>{t('translation:landing.pricing.eyebrow')}</S.Eyebrow>
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
              <S.FooterLink type="button" onClick={() => scrollTo('why')}>
                {t('translation:landing.footer.links.features')}
              </S.FooterLink>
              <S.FooterLink type="button" onClick={() => scrollTo('templates')}>
                {t('translation:landing.footer.links.templates')}
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
              <S.FooterColTitle>{t('translation:landing.footer.companyLinks.contact')}</S.FooterColTitle>
              <S.FooterContactText>
                {BUSINESS_CONTACT.legalName}
                {BUSINESS_CONTACT.addressLines.map((line) => (
                  <React.Fragment key={line}>
                    <br />
                    {line}
                  </React.Fragment>
                ))}
              </S.FooterContactText>
              <S.FooterContactLink href={BUSINESS_CONTACT.phoneHref}>
                {BUSINESS_CONTACT.phoneDisplay}
              </S.FooterContactLink>
              <S.FooterContactLink href={BUSINESS_CONTACT.emailHref}>
                {BUSINESS_CONTACT.email}
              </S.FooterContactLink>
            </S.FooterColumn>
            <S.FooterColumn>
              <S.FooterColTitle>{t('translation:landing.footer.legal')}</S.FooterColTitle>
              <S.FooterLink type="button" onClick={() => onNavigatePrivacy()}>
                {t('translation:landing.footer.legalLinks.privacy')}
              </S.FooterLink>
              <S.FooterLink type="button" onClick={onNavigateTerms}>
                {t('translation:landing.footer.legalLinks.terms')}
              </S.FooterLink>
              <S.FooterLink type="button" onClick={() => onNavigatePrivacy('cookies')}>
                {t('translation:landing.footer.legalLinks.cookies')}
              </S.FooterLink>
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
