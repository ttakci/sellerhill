// packages/shared/src/domain/billing/billing.wire.ts
//
// Billing wire DTOs — the HTTP response shapes for the customer-facing billing
// endpoints. These are the single source of truth consumed by BOTH the backend
// controller (`apps/api/src/modules/billing/billing.types.ts` re-exports them)
// and the frontend RTK Query API (`apps/web/src/features/billing/api/billing.api.ts`).
//
// Lifted from the backend-local `billing.types.ts` so the frontend does not
// duplicate these contracts. The webhook-internal `ParsedPaddleEvent` stays
// backend-only (the frontend never parses raw webhook payloads).
//
// Money is BIGINT micro-units (1/1,000,000 of the major unit). $39.00 =
// 39_000_000. Currency is always 'USD' at phase 1. See billing.types.ts for
// the limit sentinel semantics (-1 = unlimited, 0 = disabled, N = quota).

import {
  BillingInterval,
  type BillingLimitKey,
  type BillingPlanWithPricingDto,
  type BillingSubscriptionDto,
  type BillingUsagePeriodDto,
} from './billing.types';
import { type PlanChangeDirection } from './plan-change';

/**
 * The billing provider a record belongs to. Stored as
 * `billing_customers.provider` / `billing_webhook_inbox.provider`.
 *
 * Stripe is the ONLY payment provider — there is no provider-selection
 * concept and no second implementation to switch between. (Stripe's own test
 * mode covers local dev and the test environment, so a stand-in "local
 * provider" would never be exercised; a Paddle implementation existed here
 * until 2026-08-16 and was removed — recoverable from git if ever needed.)
 *
 * `local` is NOT a provider implementation. It is the state of a customer row
 * that has never reached checkout: every user starts as `local` (see
 * `ensureLocalCustomer` / `startTrialOnce`) and flips to `stripe` the first
 * time a checkout session is created for them. It is also what the catalog /
 * summary DTOs report when no `STRIPE_SECRET_KEY` is configured, so the FE can
 * hide the checkout button instead of surfacing a 409 after the click.
 */
export enum BillingProvider {
  LOCAL = 'local',
  STRIPE = 'stripe',
}

/**
 * Public catalog response — the list of active plans with their current
 * (effective) prices and limits. Returned by `GET /billing/catalog` with no
 * authentication. This is the shape the plan-picker UI consumes.
 */
export interface BillingCatalogDto {
  /** Active plans, ordered by displayOrder ascending, each with current pricing. */
  plans: BillingPlanWithPricingDto[];
  /** Default currency code for display (phase 1: USD). */
  currency: string;
  /** Whether billing enforcement is on. When false, all users have full
   *  access — the catalog is informational only. Exposed so the FE can label
   *  plans as "current / no card required" rather than "subscribe". */
  enforcementEnabled: boolean;
  /** The provider backing checkout, or 'local' when unconfigured. Exposed so
   *  the FE can hide the checkout button when no real provider is wired. */
  provider: BillingProvider;
}

/**
 * High-level billing state the FE renders against. Surfaced on
 * {@link BillingSummaryDto.transition}.
 *  - `full_access` — enforcement off; user has full access (no subscription
 *    required). No subscription row is synthesized.
 *  - `active` — enforcement on and the user has an active/trialing
 *    subscription.
 *  - `no_subscription` — enforcement on and the user has no subscription
 *    (or only ended/canceled rows).
 *  - `past_due` — enforcement on and the user's subscription is past_due.
 */
export type BillingSummaryTransition = 'full_access' | 'active' | 'no_subscription' | 'past_due';

/**
 * Summary of the authenticated user's billing state. Returned by
 * `GET /billing/summary`.
 *
 * When `BILLING_ENFORCEMENT_ENABLED=false` (the default), the backend reports
 * `enforcementEnabled: false` and a `transition: 'full_access'` status with NO
 * fake subscription row — the absence of a subscription is the truthful state,
 * and the FE renders a "full access (transition)" banner instead of a plan
 * label. When enforcement is on and the user has no subscription, `transition`
 * is `'no_subscription'`.
 */
/**
 * Usage against one metered dimension, computed live.
 *
 * `limitValue` follows the foundation's sentinels: `null` = the plan declares
 * no limit for this dimension, `-1` = explicitly unlimited, `0` = disabled (and
 * also what a suspended account reports).
 */
export interface BillingQuotaUsageDto {
  limitKey: BillingLimitKey;
  used: number;
  /**
   * The effective ceiling: the plan's limit PLUS any credits bought for the
   * current month. This is the number the gate enforces, so it is the number
   * the seller must be shown — reporting the plan limit alone would tell
   * somebody who just topped up that they are still at 100%.
   */
  limitValue: number | null;
  /** Of `limitValue`, how much came from purchased credits. 0 when none. */
  creditValue: number;
}

/**
 * A buyable pack of extra monthly quota.
 *
 * Only the tracking-conversion meter is sold this way. Listings are a level
 * (wanting more is a plan upgrade), and the automatic-order ceiling is an
 * anti-abuse guard on the Playwright pool — selling past it would be selling
 * the one resource money cannot buy more of.
 */
export interface BillingQuotaAddonDto {
  id: string;
  /** Stable machine key, e.g. 'conversions-100'. */
  slug: string;
  /** The meter this raises. */
  limitKey: BillingLimitKey;
  /** Allowance granted by one purchase. */
  quantity: number;
  amountMicros: number;
  currency: string;
  /**
   * False when the pack has not been mirrored to Stripe yet
   * (`pnpm --filter api stripe:sync-catalog`). The FE shows it disabled rather
   * than letting the seller click into a 409.
   */
  isPurchasable: boolean;
}

export interface BillingSummaryDto {
  /** The user's subscription, if any. Null when no subscription row exists. */
  subscription: BillingSubscriptionDto | null;
  /** The plan of the subscription (expanded for display), or null. */
  plan: BillingPlanWithPricingDto | null;
  /** Current usage periods for the subscription (open periods only). Empty
   *  array when there is no subscription. */
  usagePeriods: BillingUsagePeriodDto[];
  /**
   * Top-up packs on offer, or an empty array when none apply.
   *
   * Deliberately empty unless the seller has actually reached a meter's limit:
   * a credit is scoped to the current calendar month, so offering one to
   * somebody with allowance left would sell them something they cannot use.
   * The offer appearing IS the signal that they are constrained.
   */
  quotaAddons: BillingQuotaAddonDto[];
  /**
   * Live usage against each metered dimension.
   *
   * Separate from `usagePeriods` because that table's `used_qty` column is a
   * ledger field nothing ever increments — reading quota pressure from it
   * reported every seller at zero. These numbers are computed at read time from
   * what actually exists (ACTIVE listings, this month's reservations, this
   * month's conversions), so they cannot drift from what the gate refuses.
   */
  quotas: BillingQuotaUsageDto[];
  /**
   * True when a Stripe subscription exists, so choosing a plan must change it
   * in place rather than open a new checkout. Without this the FE cannot tell
   * the two apart, and the wrong one creates a SECOND subscription — Stripe
   * allows that, and the customer is then billed for both.
   */
  hasProviderSubscription: boolean;
  /** Whether billing enforcement is on. Mirrors the catalog flag. */
  enforcementEnabled: boolean;
  /** The provider backing checkout, or 'local' when unconfigured. */
  provider: BillingProvider;
  /** High-level state the FE renders against — see {@link BillingSummaryTransition}. */
  transition: BillingSummaryTransition;
}

/**
 * Checkout session response. Returned by `POST /billing/checkout`. When the
 * provider is configured (Paddle), contains a provider checkout URL the FE
 * redirects to. When the provider is NOT configured (`local` fail-safe), the
 * endpoint returns 409 `billing.errors.providerNotConfigured` so the FE can
 * surface "checkout not available" rather than silently no-op.
 */
export interface BillingCheckoutDto {
  /** The provider that produced the checkout session. */
  provider: BillingProvider;
  /** Provider-side checkout URL to redirect the browser to (Paddle). Null for
   *  the local provider — but the local provider never returns this DTO; it
   *  throws before reaching here. */
  checkoutUrl: string | null;
  /** Provider-side transaction/session id (Paddle `txn_...` / `checkout_id`). */
  providerSessionId: string | null;
  /** The plan the checkout is for (echoed for FE confirmation). */
  planId: string;
  /** The interval the checkout is for. */
  interval: BillingInterval;
}

/**
 * Portal session response. Returned by `GET /billing/portal`. When the
 * provider is configured (Paddle), contains a provider portal URL for the
 * customer to manage their subscription/billing. When the provider is NOT
 * configured, the endpoint returns 409 `billing.errors.providerNotConfigured`.
 */
export interface BillingPortalDto {
  /** The provider that produced the portal session. */
  provider: BillingProvider;
  /** Provider-side portal URL to redirect the browser to (Paddle). */
  portalUrl: string | null;
}

/**
 * What a plan change will actually cost, from Stripe's own arithmetic.
 *
 * Not an estimate we computed: it comes from `invoices.createPreview`, so it
 * carries tax, discounts and proration exactly as they will be billed.
 */
export interface BillingPlanChangePreviewDto {
  direction: PlanChangeDirection;
  /** Charged immediately for an upgrade; 0 for a downgrade (nothing moves now). */
  amountDueMicros: number;
  currency: string;
  /** ISO date the change takes effect — now for an upgrade, period end for a
   *  downgrade. */
  effectiveAt: string;
  /** The recurring amount from the next full period onward. */
  nextInvoiceAmountMicros: number | null;
  nextInvoiceAt: string | null;
}

/** The card Stripe actually charges — the customer's DEFAULT payment method,
 *  never an arbitrary one from the attached list. */
export interface BillingPaymentMethodDto {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  /** True within CARD_EXPIRY_WARNING_DAYS of expiry, or already expired. */
  expiringSoon: boolean;
}

/** A downgrade waiting for the current period to end. */
export interface BillingScheduledChangeDto {
  planSlug: string;
  effectiveAt: string;
}

/**
 * Live-from-Stripe billing detail. Deliberately NOT part of
 * BillingSummaryDto: AppLayout calls the summary on every page load, and
 * provider latency does not belong on that path.
 *
 * Every field is nullable because each is independently unavailable — a
 * trialing seller has no card and no upcoming invoice, and that is normal, not
 * an error.
 */
export interface BillingDetailsDto {
  paymentMethod: BillingPaymentMethodDto | null;
  nextChargeAmountMicros: number | null;
  nextChargeCurrency: string | null;
  nextChargeAt: string | null;
  scheduledChange: BillingScheduledChangeDto | null;
}
