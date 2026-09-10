import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import {
  BILLING_DISABLED,
  BILLING_MICROS_PER_UNIT,
  BILLING_UNLIMITED,
  BillingInterval,
  BillingLimitKey,
  type SupportedLocale,
} from '@repo/shared';
import { formatCurrency, lightTheme } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { LandingPageComponent } from './LandingPage.component';
import type { LandingPricingPlan } from './LandingPage.types';

import { useGetBillingCatalogQuery } from '@/features/billing/api/billing.api';
import { enterDemoMode } from '@/features/demo';
import { TawkToWidget } from '@/features/support-widget/TawkToWidget';
import { storeLocalePreference } from '@/utils/locale';

/** Format a micros price into a display string for the landing. $0 → "Free". */
function formatLandingPrice(micros: number, currency: string, freeLabel: string): string {
  if (micros === 0) {
    return freeLabel;
  }
  const major = micros / BILLING_MICROS_PER_UNIT;
  return formatCurrency(major, 'en-US', currency, major % 1 === 0 ? 0 : 2);
}

/** Format the listings limit line. -1 → unlimited, 0 → not included, N → "Up to N listings". */
function formatListingsLine(
  limit: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (limit === BILLING_UNLIMITED) {
    return t('translation:landing.pricing.unlimitedListings');
  }
  if (limit === BILLING_DISABLED || limit <= 0) {
    return t('translation:landing.pricing.notIncluded');
  }
  return t('translation:landing.pricing.upToListings', { limit: new Intl.NumberFormat('en-US').format(limit) });
}

/** Format the monthly tracking-conversion limit line. */
function formatConversionsLine(
  limit: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (limit === BILLING_UNLIMITED) {
    return t('translation:landing.pricing.unlimitedConversions');
  }
  if (limit === BILLING_DISABLED || limit <= 0) {
    return t('translation:landing.pricing.notIncluded');
  }
  return t('translation:landing.pricing.upToConversions', {
    limit: new Intl.NumberFormat('en-US').format(limit),
  });
}

/** Format the monthly automatic-order ceiling line. */
function formatAmazonOrdersLine(
  limit: number,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (limit === BILLING_UNLIMITED) {
    return t('translation:landing.pricing.unlimitedOrders');
  }
  if (limit === BILLING_DISABLED || limit <= 0) {
    return t('translation:landing.pricing.notIncluded');
  }
  return t('translation:landing.pricing.upToOrders', { limit: new Intl.NumberFormat('en-US').format(limit) });
}

/**
 * The plans shown before the visitor expands the grid: the three cheapest paid
 * tiers, so the collapsed section reads as "here is where the ladder starts"
 * rather than the full twelve-row price list. The rest are one click away via
 * the expander. Derived from the catalog's own monthly prices (below), never a
 * hardcoded slug list, so a catalog re-price can never leave it stale.
 */
const COLLAPSED_PLAN_COUNT = 3;

/** The plan carrying the "most popular" badge. */
const HIGHLIGHTED_PLAN_SLUG = 'growth';

export const LandingPageContainer = (): React.ReactElement => {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [currentLocale, setCurrentLocale] = useState(i18n.language);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Public billing catalog — no auth required. Drives the landing pricing grid
  // so prices + limits are never hardcoded. When the call fails (API down, or
  // billing module not wired), the landing falls back to the static i18n plans.
  const { data: catalog, isError: isCatalogError } = useGetBillingCatalogQuery();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route changes / resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const pricingPlans: LandingPricingPlan[] = useMemo(() => {
    if (!catalog || catalog.plans.length === 0) {
      return [];
    }
    // `billing` is its own namespace, not a key inside `translation` — the old
    // `translation:billing.billing.…` form resolved to nothing and rendered the
    // raw key as the price label for any zero-priced plan.
    const freeLabel = t('billing:billing.plans.free.name');
    const cheapestPaidSlugs = new Set(
      [...catalog.plans]
        .map((plan) => ({
          slug: plan.slug,
          amountMicros:
            plan.prices[BillingInterval.MONTHLY]?.amountMicros ?? Number.POSITIVE_INFINITY,
        }))
        .filter((entry) => Number.isFinite(entry.amountMicros) && entry.amountMicros > 0)
        .sort((a, b) => a.amountMicros - b.amountMicros)
        .slice(0, COLLAPSED_PLAN_COUNT)
        .map((entry) => entry.slug)
    );
    return catalog.plans.map((plan) => {
      const monthlyPrice = plan.prices[BillingInterval.MONTHLY];
      const listingsLimit = plan.limits[BillingLimitKey.LISTINGS_PER_MONTH]?.limitValue ?? 0;
      const ordersLimit = plan.limits[BillingLimitKey.AMAZON_ORDERS_PER_MONTH]?.limitValue ?? 0;
      const conversionsLimit =
        plan.limits[BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH]?.limitValue ?? 0;
      return {
        slug: plan.slug,
        priceDisplayMonthly: monthlyPrice
          ? formatLandingPrice(monthlyPrice.amountMicros, monthlyPrice.currency, freeLabel)
          : freeLabel,
        listingsDisplay: formatListingsLine(listingsLimit, t),
        trackingConversionsDisplay: formatConversionsLine(conversionsLimit, t),
        amazonOrdersDisplay: formatAmazonOrdersLine(ordersLimit, t),
        isHighlighted: plan.slug === HIGHLIGHTED_PLAN_SLUG,
        isFeatured: cheapestPaidSlugs.has(plan.slug),
      };
    });
  }, [catalog, t]);

  /**
   * The "plans from $X" figure on the hero price badge. Derived from the
   * catalog's cheapest paid monthly tier so it can never drift from the pricing
   * section further down the page; the literal fallback matches the real
   * cheapest tier (Lite, $19.99) the same way `landing.pricing.catalogFallback`
   * has to stay aligned with the catalog.
   */
  const startingPriceDisplay = useMemo(() => {
    const FALLBACK = '$19.99';
    if (!catalog || catalog.plans.length === 0) {
      return FALLBACK;
    }
    let cheapest: { amountMicros: number; currency: string } | null = null;
    for (const plan of catalog.plans) {
      const monthly = plan.prices[BillingInterval.MONTHLY];
      if (!monthly || monthly.amountMicros <= 0) {
        continue;
      }
      if (!cheapest || monthly.amountMicros < cheapest.amountMicros) {
        cheapest = { amountMicros: monthly.amountMicros, currency: monthly.currency };
      }
    }
    return cheapest
      ? formatLandingPrice(cheapest.amountMicros, cheapest.currency, FALLBACK)
      : FALLBACK;
  }, [catalog]);

  const handleLocaleChange = useCallback(
    (locale: SupportedLocale) => {
      storeLocalePreference(locale);
      void i18n.changeLanguage(locale);
      setCurrentLocale(locale);
    },
    [i18n]
  );

  const handleNavigateLogin = useCallback(() => {
    setMobileMenuOpen(false);
    void navigate(`/${currentLocale}/login`);
  }, [navigate, currentLocale]);

  const handleNavigateRegister = useCallback(() => {
    setMobileMenuOpen(false);
    void navigate(`/${currentLocale}/register`);
  }, [navigate, currentLocale]);

  /*
   * A full document navigation, not a router push: demo mode is resolved once
   * at boot, so entering it has to start a new document for the store and the
   * RTK Query cache to come up in demo state together.
   */
  const handleOpenDemo = useCallback(() => {
    setMobileMenuOpen(false);
    enterDemoMode(`/${currentLocale}/dashboard`);
  }, [currentLocale]);

  const handleNavigatePrivacy = useCallback(
    (sectionId?: string) => {
      setMobileMenuOpen(false);
      void navigate(`/${currentLocale}/privacy${sectionId ? `#${sectionId}` : ''}`);
    },
    [navigate, currentLocale]
  );

  const handleNavigateTerms = useCallback(() => {
    setMobileMenuOpen(false);
    void navigate(`/${currentLocale}/terms`);
  }, [navigate, currentLocale]);

  const handleToggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleCloseMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  return (
    // The landing page is always light — no dark mode, no toggle. Nesting a
    // light-pinned EmotionThemeProvider here overrides the app-wide theme
    // context (which otherwise follows the visitor's OS/localStorage
    // preference) for every styled-component and Icon under it, without
    // touching the authenticated app's own light/dark support.
    <EmotionThemeProvider theme={lightTheme}>
      <LandingPageComponent
        currentLocale={currentLocale}
        scrolled={scrolled}
        mobileMenuOpen={mobileMenuOpen}
        pricingPlans={pricingPlans}
        startingPriceDisplay={startingPriceDisplay}
        pricingCatalogError={isCatalogError}
        onLocaleChange={handleLocaleChange}
        onNavigateLogin={handleNavigateLogin}
        onNavigateRegister={handleNavigateRegister}
        onOpenDemo={handleOpenDemo}
        onNavigatePrivacy={handleNavigatePrivacy}
        onNavigateTerms={handleNavigateTerms}
        onToggleMobileMenu={handleToggleMobileMenu}
        onCloseMobileMenu={handleCloseMobileMenu}
      />
      <TawkToWidget />
    </EmotionThemeProvider>
  );
};

export default LandingPageContainer;
