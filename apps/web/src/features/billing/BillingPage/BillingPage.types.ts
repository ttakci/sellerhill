import type {
  BillingInterval,
  BillingSubscriptionStatus,
  BillingSummaryDto,
} from '@repo/shared';

export interface BillingUsageRow {
  /** Short text inside the ring, e.g. "100%". Separate from `ofDisplay` so the
   *  ring shows proportion and the text beside it shows the real figures. */
  ringLabel: string;
  labelKey: string;
  usedDisplay: string;
  ofDisplay: string;
  barValue: number;
  barVariant: 'default' | 'success' | 'warning' | 'error';
  barAriaLabel: string;
}

export interface BillingPlanCard {
  planId: string;
  slug: string;
  priceDisplay: string;
  listingsLimitDisplay: string;
  trackingConversionsLimitDisplay: string;
  amazonOrdersLimitDisplay: string;
  isCurrent: boolean;
}

export interface BillingUsageCellViewProps {
  row: BillingUsageRow;
}

export interface BillingPlanCardViewProps {
  /** True when a Stripe subscription already exists, so the CTA switches the
   *  plan rather than starting a new one. */
  hasProviderSubscription: boolean;
  plan: BillingPlanCard;
  compareInterval: BillingInterval;
  providerUnconfigured: boolean;
  checkoutPlanId: string | null;
  onCheckout: (planId: string) => void;
}

/** One buyable top-up pack, pre-formatted for display. */
export interface BillingAddonCard {
  slug: string;
  /** e.g. "100 conversions" — already localized and number-formatted. */
  quantityDisplay: string;
  priceDisplay: string;
  isPurchasable: boolean;
}

export interface BillingPageComponentProps {
  isInitialLoading: boolean;
  isUnavailable: boolean;
  onRetry: () => void;
  transition: BillingSummaryDto['transition'] | null;
  enforcementEnabled: boolean;
  providerUnconfigured: boolean;
  subscriptionStatus: BillingSubscriptionStatus | null;
  currentPlanSlug: string | null;
  usageRows: BillingUsageRow[];
  plans: BillingPlanCard[];
  compareInterval: BillingInterval;
  checkoutPlanId: string | null;
  isPortalLoading: boolean;
  onCheckout: (planId: string) => void;
  /** True when a Stripe subscription exists — see BillingSummaryDto. */
  hasProviderSubscription: boolean;
  /**
   * The one muted line under the plan name, already assembled and localized.
   * Built in the container because what belongs on it depends on the kind of
   * plan: a trial has no billing interval and does not renew, so "Monthly
   * billing · Next renewal" was wrong on both counts for one.
   */
  planMetaLine: string | null;
  isPlansOpen: boolean;
  onOpenPlans: () => void;
  onClosePlans: () => void;
  addons: BillingAddonCard[];
  addonSlugInFlight: string | null;
  onBuyAddon: (addonSlug: string) => void;
  onManage: () => void;
  /** "Next payment: {date} · {amount}", already localized — null when there is
   *  no upcoming Stripe invoice (a trialing seller, or no subscription yet).
   *  The existing trial-end meta line covers that case, so this renders
   *  nothing rather than an em dash beside a label. */
  nextChargeLine: string | null;
  /** "Switches to {plan} on {date}" for a downgrade scheduled at period end,
   *  already localized — null when nothing is scheduled. */
  scheduledChangeLine: string | null;
  onCancelScheduledChange: () => void;
  isCancellingChange: boolean;
}
