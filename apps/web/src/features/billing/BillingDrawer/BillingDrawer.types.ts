// apps/web/src/features/billing/BillingDrawer/BillingDrawer.types.ts
//
// Types for the BillingDrawer — the strict 4-file split per frontend-rules:
// types live here, logic in the container, markup in the component, styled in
// the style file. The component receives ONLY pre-formatted display strings —
// no Intl.NumberFormat, no micros math, no formatters in the component.

import type {
  BillingCatalogDto,
  BillingInterval,
  BillingPlanWithPricingDto,
  BillingSummaryDto,
  BillingSubscriptionStatus,
  BillingUsagePeriodDto,
} from '@repo/shared';

/**
 * One rendered usage row in the drawer — already formatted for display. The
 * container converts micros/limits into display strings via the shared
 * formatCurrency/formatCompactNumber utils; the component just renders them.
 */
export interface BillingUsageRow {
  /** i18n key for the row label (under `billing.billing.limits.<key>.label`). */
  labelKey: string;
  /** Pre-formatted "used" display string (e.g. "1,204"). */
  usedDisplay: string;
  /** Pre-formatted limit display string (e.g. "2,500" or "Unlimited" or "Not included"). */
  limitDisplay: string;
  /** Pre-formatted "used of limit" inline string (e.g. "1,204 of 2,500"). */
  ofDisplay: string;
  /** Progress bar value 0–100 (0 when unlimited/disabled). */
  barValue: number;
  /** Progress bar variant derived from utilization. */
  barVariant: 'default' | 'success' | 'warning' | 'error';
  /** Accessible label for the progress bar. */
  barAriaLabel: string;
}

/**
 * One rendered plan comparison card — already formatted for display. The
 * container resolves the effective price + limits and formats them.
 */
export interface BillingPlanCard {
  planId: string;
  /** Stable slug (e.g. 'starter') — used as the i18n key suffix. */
  slug: string;
  /** Pre-formatted price display string (e.g. "$49" or "Free" or "—"). */
  priceDisplay: string;
  /** Pre-formatted listings limit string. */
  listingsLimitDisplay: string;
  /** Pre-formatted amazon-orders limit string. */
  amazonOrdersLimitDisplay: string;
  /** True when this is the user's current plan. */
  isCurrent: boolean;
  /** True when this plan is the highlighted "popular" one (displayOrder heuristic). */
  isHighlighted: boolean;
}

/**
 * Props the container passes into the presentational component. All values are
 * plain primitives/strings — no RTK Query hooks, no formatters — so the
 * component stays pure JSX.
 */
export interface BillingDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;

  // Transition / enforcement state — drives the top banner.
  /** High-level state from the summary: full_access | active | no_subscription | past_due. */
  transition: BillingSummaryDto['transition'] | null;
  /** Whether billing enforcement is on (mirrors the catalog flag). */
  enforcementEnabled: boolean;
  /** True when no real provider is wired (provider === 'local'). */
  providerUnconfigured: boolean;

  // Current subscription (null when no subscription row).
  subscriptionStatus: BillingSubscriptionStatus | null;
  /** Current plan slug (for the i18n label) — null when no subscription. */
  currentPlanSlug: string | null;
  /** Current interval i18n key suffix ('monthly' | 'annual') — null when no subscription. */
  currentIntervalKey: string | null;
  /** Pre-formatted next renewal date string — null when no subscription. */
  currentPeriodEndDisplay: string | null;

  // Usage rows (empty array when no subscription / no open periods).
  usageRows: BillingUsageRow[];

  // Plan comparison grid.
  plans: BillingPlanCard[];
  /** Selected compare interval (monthly | annual). */
  compareInterval: BillingInterval;
  onSelectCompareInterval: (interval: BillingInterval) => void;

  // Actions.
  /** Upgrade/switch to a plan — gated by providerUnconfigured in the container. */
  onCheckout: (planId: string) => void;
  /** Open the Paddle customer portal — gated by providerUnconfigured. */
  onManage: () => void;
  /** True when a checkout or portal request is in flight. */
  isActionLoading: boolean;
}

/**
 * Public props for the drawer entrypoint (container). The SettingsHubPage
 * renders `<BillingDrawer isOpen={...} onClose={...} />` and the container
 * wires RTK Query internally.
 */
export interface BillingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Re-export the shared types the container consumes so feature code has a
// single import surface for billing wire contracts.
export type {
  BillingCatalogDto,
  BillingInterval,
  BillingPlanWithPricingDto,
  BillingSummaryDto,
  BillingUsagePeriodDto,
};
