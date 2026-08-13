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

/** Pick the highlighted "popular" plan (heuristic: lowest displayOrder non-free plan). */
function pickHighlightedSlug(slugs: string[]): string | null {
  return slugs.find((s) => s !== 'free') ?? null;
}

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
    const freeLabel = t('translation:billing.billing.plans.free.name');
    const slugs = catalog.plans.map((p) => p.slug);
    const highlightedSlug = pickHighlightedSlug(slugs);
    return catalog.plans.map((plan) => {
      const monthlyPrice = plan.prices[BillingInterval.MONTHLY];
      const annualPrice = plan.prices[BillingInterval.ANNUAL];
      const priceDisplayMonthly = monthlyPrice
        ? formatLandingPrice(monthlyPrice.amountMicros, monthlyPrice.currency, freeLabel)
        : freeLabel;

      let priceDisplayAnnual: string | null = null;
      let priceDisplayAnnualPerMonth: string | null = null;
      let annualSavingsMonths: number | null = null;
      if (annualPrice) {
        priceDisplayAnnual = formatLandingPrice(annualPrice.amountMicros, annualPrice.currency, freeLabel);
        priceDisplayAnnualPerMonth = formatLandingPrice(
          Math.round(annualPrice.amountMicros / 12),
          annualPrice.currency,
          freeLabel
        );
        if (monthlyPrice && monthlyPrice.amountMicros > 0) {
          const yearOfMonthly = monthlyPrice.amountMicros * 12;
          annualSavingsMonths = Math.max(
            0,
            Math.round(((yearOfMonthly - annualPrice.amountMicros) / monthlyPrice.amountMicros) * 10) / 10
          );
        }
      }

      const listingsLimit = plan.limits[BillingLimitKey.LISTINGS_PER_MONTH]?.limitValue ?? 0;
      return {
        slug: plan.slug,
        priceDisplayMonthly,
        priceDisplayAnnual,
        priceDisplayAnnualPerMonth,
        annualSavingsMonths,
        listingsDisplay: formatListingsLine(listingsLimit, t),
        isHighlighted: plan.slug === highlightedSlug,
      };
    });
  }, [catalog, t]);

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
        pricingCatalogError={isCatalogError}
        onLocaleChange={handleLocaleChange}
        onNavigateLogin={handleNavigateLogin}
        onNavigateRegister={handleNavigateRegister}
        onOpenDemo={handleOpenDemo}
        onToggleMobileMenu={handleToggleMobileMenu}
        onCloseMobileMenu={handleCloseMobileMenu}
      />
      <TawkToWidget />
    </EmotionThemeProvider>
  );
};

export default LandingPageContainer;
