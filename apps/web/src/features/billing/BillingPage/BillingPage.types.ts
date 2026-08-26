import type {
  BillingInterval,
  BillingPaymentMethodDto,
  BillingPlanChangePreviewDto,
  BillingSubscriptionStatus,
  BillingSummaryDto,
} from '@repo/shared';

/**
 * The change the seller has previewed but not yet confirmed. Holding the
 * preview here (rather than re-fetching on confirm) guarantees the figure
 * they agreed to in `PlanChangeConfirm` is the figure `changePlan` applies —
 * `planSlug` is captured at the same moment as `planId` so the confirm
 * dialog's plan name can never resolve to a different plan than the preview
 * it is showing.
 */
export interface BillingPendingPlanChange {
  planId: string;
  planSlug: string;
  preview: BillingPlanChangePreviewDto;
}

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
  /** True when the subscription is scheduled to cancel at period end — see
   *  `cancelsAtPeriodEndLine`. The status badge derives from BOTH this and
   *  `subscriptionStatus`: `subscriptionStatus` stays `active` in our own
   *  tables until Stripe's period actually ends (a portal cancellation
   *  writes nothing to our tables — only `cancelAtPeriodEnd`, read live from
   *  Stripe, changes), so without this flag the badge kept reading plain
   *  "Active" for a subscription that is already winding down. */
  cancelAtPeriodEnd: boolean;
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
   *  no upcoming Stripe invoice (a trialing seller, or no subscription yet),
   *  OR when the subscription is set to cancel at period end (there is no
   *  real next payment to show — see `cancelsAtPeriodEndLine`). The existing
   *  trial-end meta line covers the trial case, so this renders nothing
   *  rather than an em dash beside a label. */
  nextChargeLine: string | null;
  /** "Cancels on {date} — no further charges after this period", already
   *  localized — null unless the seller cancelled via the Stripe Billing
   *  Portal (`cancel_at_period_end`). Read live from Stripe on every load, so
   *  this reflects a portal cancellation immediately, with nothing written to
   *  our own tables. */
  cancelsAtPeriodEndLine: string | null;
  /** "Switches to {plan} on {date}" for a downgrade scheduled at period end,
   *  already localized — null when nothing is scheduled. */
  scheduledChangeLine: string | null;
  onCancelScheduledChange: () => void;
  isCancellingChange: boolean;
  /** The customer's default Stripe payment method, from `GET /billing/details`.
   *  Null for a trialing seller (no Stripe customer yet) — a normal state, not
   *  an empty one, so the card renders nothing rather than a placeholder. */
  paymentMethod: BillingPaymentMethodDto | null;
  /**
   * True once the seller has picked a plan to switch to (on an EXISTING
   * subscription) and its Stripe proration preview has come back — drives
   * the confirm dialog. False while previewing (the plan card's own spinner,
   * via `checkoutPlanId`, covers that wait) and after cancel/confirm.
   */
  isPlanChangeOpen: boolean;
  /** Fully assembled, localized confirmation message for the previewed
   *  change — see `PlanChangeConfirmProps.body`. Null until a preview has
   *  come back. */
  planChangeBody: string | null;
  /** True while the confirmed change is being applied (`POST
   *  /billing/change-plan`) — drives the confirm button's spinner. */
  isChangingPlan: boolean;
  onConfirmPlanChange: () => void;
  onCancelPlanChange: () => void;
}
