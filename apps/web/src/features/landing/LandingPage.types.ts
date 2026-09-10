import type { SupportedLocale } from '@repo/shared';

/**
 * One pricing card rendered on the landing page. Price + limit values come
 * from the public billing catalog (no hardcoded prices/limits); marketing
 * copy (name, description, features, cta) comes from i18n keyed by slug.
 *
 * Monthly is the only interval: the catalog carries no annual prices (the
 * monthly figures were set at what the annual rate would have been), so the
 * page shows one price per plan and no interval toggle.
 */
export interface LandingPricingPlan {
  /** Stable machine slug from the catalog (e.g. 'starter', 'growth', 'pro'). */
  slug: string;
  /** Pre-formatted monthly price display string (e.g. "$44.99" or "Free"). */
  priceDisplayMonthly: string;
  /** Pre-formatted listings limit string (e.g. "Up to 2,000 listings" or "Unlimited listings"). */
  listingsDisplay: string;
  /**
   * Pre-formatted monthly tracking-conversion limit — the METERED dimension the
   * plans are priced on, since a conversion is what costs real money per
   * shipment. Automatic orders carry a much higher ceiling and are not the
   * thing a buyer is choosing between tiers on, so the card shows this instead.
   */
  trackingConversionsDisplay: string;
  /** Pre-formatted monthly automatic-order ceiling. */
  amazonOrdersDisplay: string;
  /** True when this plan is the highlighted "popular" one. */
  isHighlighted: boolean;
  /**
   * True for the handful of plans shown before the visitor expands the grid.
   * The catalog has twelve tiers; showing all of them up front turns a
   * comparison into a price list, so the page leads with one plan per band and
   * keeps the rest behind a "show all plans" control on the same page — /billing
   * sits behind auth, so it cannot serve as the "see everything" destination.
   */
  isFeatured: boolean;
}

export interface LandingPageProps {
  currentLocale: string;
  scrolled: boolean;
  mobileMenuOpen: boolean;
  /** Catalog-driven pricing plans (empty when the catalog call failed → use fallback). */
  pricingPlans: LandingPricingPlan[];
  /**
   * Pre-formatted "plans from $X" amount for the hero price badge — the catalog's
   * cheapest paid monthly tier, or the literal `$19.99` fallback when the catalog
   * call failed.
   */
  startingPriceDisplay: string;
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
  /**
   * Opens the privacy policy, optionally scrolled to one of its sections.
   * The footer's "Cookies" entry passes the cookies section rather than
   * linking to a separate cookie policy — there is one document, and section
   * 13 of it is the cookie disclosure.
   */
  onNavigatePrivacy: (sectionId?: string) => void;
  /** Opens the terms of service. */
  onNavigateTerms: () => void;
  onToggleMobileMenu: () => void;
  onCloseMobileMenu: () => void;
}
