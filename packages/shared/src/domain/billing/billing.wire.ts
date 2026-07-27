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
  type BillingPlanWithPricingDto,
  type BillingSubscriptionDto,
  type BillingUsagePeriodDto,
} from './billing.types';

/**
 * The billing provider the backend talks to. Stored as
 * `billing_customers.provider` / `billing_webhook_inbox.provider`. Phase 2
 * ships the Paddle provider; the `local` provider is the config-unavailable
 * fail-safe (no real checkout, used when Paddle env is absent).
 */
export enum BillingProvider {
  LOCAL = 'local',
  PADDLE = 'paddle',
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
export interface BillingSummaryDto {
  /** The user's subscription, if any. Null when no subscription row exists. */
  subscription: BillingSubscriptionDto | null;
  /** The plan of the subscription (expanded for display), or null. */
  plan: BillingPlanWithPricingDto | null;
  /** Current usage periods for the subscription (open periods only). Empty
   *  array when there is no subscription. */
  usagePeriods: BillingUsagePeriodDto[];
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
