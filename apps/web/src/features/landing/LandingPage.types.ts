import type { SupportedLocale } from '@repo/shared';

/**
 * One pricing card rendered on the landing page. Price + limit values come
 * from the public billing catalog (no hardcoded prices/limits); marketing
 * copy (name, description, features, cta) comes from i18n keyed by slug.
 */
export interface LandingPricingPlan {
  /** Stable machine slug from the catalog (e.g. 'starter', 'growth', 'scale'). */
  slug: string;
  /** Pre-formatted price display string (e.g. "$39" or "Free"). */
  priceDisplay: string;
  /** Period label key suffix ('perMonth' | 'perYear'). */
  periodKey: 'perMonth' | 'perYear';
  /** Pre-formatted listings limit string (e.g. "Up to 1,500 listings" or "Unlimited listings"). */
  listingsDisplay: string;
  /** True when this plan is the highlighted "popular" one (heuristic). */
  isHighlighted: boolean;
}

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
