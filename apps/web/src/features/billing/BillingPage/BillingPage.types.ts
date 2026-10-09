import type {
  BillingInterval,
  BillingPlanChangePreviewDto,
  BillingSubscriptionStatus,
  BillingSummaryDto,
} from '@repo/shared';

// Single definition lives beside the shared builder that produces it, so the
// Billing page and the profile-dropdown shortcut share one shape. Imported for
// use below AND re-exported so existing `./BillingPage.types` consumers keep
// resolving it.
import type { BillingUsageRow } from '../utils/usageRows.types';

export type { BillingUsageRow };

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

export interface BillingPlanCard {
  planId: string;
  slug: string;
  priceDisplay: string;
  /** The card's lead line: "Unlimited automatic orders and shipment tracking" (a finite limit falls back to "label: N"). */
  amazonOrdersLine: string;
  /** "N active listings · add and remove without limit" — the limit is a level, so ending a listing frees its slot. */
  listingsLine: string;
  trackingConversionsLimitDisplay: string;
  /** Best Sellers products the plan lets the seller view per billing period. */
  bestSellersLimitDisplay: string;
  isCurrent: boolean;
}

/** Ink of one value in the summary card's label / value lists. */
export type BillingFactTone = 'default' | 'brand' | 'positive' | 'warning' | 'negative';

/** One label / value row of the summary card, already localized. */
export interface BillingSummaryFact {
  label: string;
  value: string;
  tone?: BillingFactTone;
}

/** The big figure on the right of the summary card (next charge, access end, trial end). */
export interface BillingSummaryHeadline {
  label: string;
  value: string;
  /** A muted line under the figure — the next charge's date. */
  caption: string | null;
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
  usageRows: BillingUsageRow[];
  plans: BillingPlanCard[];
  compareInterval: BillingInterval;
  checkoutPlanId: string | null;
  isPortalLoading: boolean;
  onCheckout: (planId: string) => void;
  /** True when a Stripe subscription exists — see BillingSummaryDto. */
  hasProviderSubscription: boolean;
  /** The hero's heading: the current plan's name (or "no subscription"). */
  planTitle: string;
  /** The plan's one-line description under the heading. */
  planDescription: string | null;
  /** Fact rows under the heading: interval, renewal date, payment card. */
  summaryFacts: BillingSummaryFact[];
  /** Lead figure of the hero strip; null when there is no date or amount worth headlining. */
  summaryHeadline: BillingSummaryHeadline | null;
  isPlansOpen: boolean;
  onOpenPlans: () => void;
  onClosePlans: () => void;
  addons: BillingAddonCard[];
  /**
   * The top-up card's one-line explanation, assembled in the container from
   * the dimension(s) the offered packs raise — a conversions pack and a Best
   * Sellers pack need different sentences, and a seller may be offered both.
   */
  addonsSubtitle: string;
  addonSlugInFlight: string | null;
  onBuyAddon: (addonSlug: string) => void;
  onManage: () => void;
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
  /** The saved card expires soon — a notice asks the seller to replace it. */
  paymentExpiringSoon: boolean;
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
  /** Downgrade-only warning that listings beyond the new plan's limit stop
   *  being automated — see `PlanChangeConfirmProps.listingLimitWarning`. */
  planChangeListingLimitWarning: string | null;
  /** True while the confirmed change is being applied (`POST
   *  /billing/change-plan`) — drives the confirm button's spinner. */
  isChangingPlan: boolean;
  onConfirmPlanChange: () => void;
  onCancelPlanChange: () => void;
}
