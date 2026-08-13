import type { SupportedLocale } from '@repo/shared';

/**
 * One pricing card rendered on the landing page. Price + limit values come
 * from the public billing catalog (no hardcoded prices/limits); marketing
 * copy (name, description, features, cta) comes from i18n keyed by slug.
 *
 * Both billing intervals are carried so the page can offer a monthly/annual
 * toggle (sellerboard-style) without a second network round trip — the
 * annual figures are real catalog prices (`BillingInterval.ANNUAL`), not a
 * computed discount.
 */
export interface LandingPricingPlan {
  /** Stable machine slug from the catalog (e.g. 'starter', 'growth', 'scale'). */
  slug: string;
  /** Pre-formatted monthly price display string (e.g. "$39" or "Free"). */
  priceDisplayMonthly: string;
  /** Pre-formatted full annual charge (e.g. "$390"). Null when the catalog has no annual price for this plan. */
  priceDisplayAnnual: string | null;
  /** Pre-formatted annual price divided by 12 (e.g. "$32.50"), for "billed annually" framing. */
  priceDisplayAnnualPerMonth: string | null;
  /** Whole months free when paying annually vs. monthly × 12 (0 when there's no discount, null when annual pricing is unavailable). */
  annualSavingsMonths: number | null;
  /** Pre-formatted listings limit string (e.g. "Up to 1,500 listings" or "Unlimited listings"). */
  listingsDisplay: string;
  /** True when this plan is the highlighted "popular" one (heuristic). */
  isHighlighted: boolean;
}

/** Which billing interval the pricing grid is currently displaying. */
export type LandingBillingInterval = 'monthly' | 'annual';

export interface LandingPageProps {
  currentLocale: string;
  scrolled: boolean;
  mobileMenuOpen: boolean;
  /** Catalog-driven pricing plans (empty when the catalog call failed → use fallback). */
  pricingPlans: LandingPricingPlan[];
  /** True when the public catalog call failed and the landing should render the i18n fallback. */
  pricingCatalogError: boolean;
  onLocaleChange: (locale: SupportedLocale) => void;
  onNavigateLogin: () => void;
  onNavigateRegister: () => void;
  /**
   * Enters the sign-up-free demo. Deliberately a full document navigation, not
   * a router push — demo mode is resolved once at boot, so entering (and
   * leaving) it always starts from a clean store and RTK Query cache.
   */
  onOpenDemo: () => void;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
}
