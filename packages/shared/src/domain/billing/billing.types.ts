// packages/shared/src/domain/billing/billing.types.ts
//
// Billing foundation (phase 1) — subscription billing domain contracts.
//
// These types mirror the DB schema in migration `052_create_billing_foundation.sql`.
// All plan/price/limit data is DB-parametric: the application reads effective
// rows at runtime. The enums here are the canonical machine values; the DB
// stores them as VARCHAR (limit_key) or as native PG enums that match these
// string values exactly.
//
// Conventions (mirror the FinOps domain):
//   - Money is BIGINT micro-units (1/1,000,000 of the major unit). $39.00 =
//     39_000_000. Never use floating-point for money.
//   - Currency is always 'USD' at phase 1.
//   - Effective-date windows: `effectiveFrom` is inclusive, `effectiveTo` is
//     exclusive; NULL `effectiveTo` = open-ended (current price).
//   - Limit values: -1 = unlimited, 0 = feature disabled, N = quota.

/**
 * Currency used for all billing storage. Costs/prices are always stored in
 * micro-units (1/1,000,000 of the major unit) as BIGINT.
 */
export const BILLING_DEFAULT_CURRENCY = 'USD';

/**
 * Number of microseconds per major currency unit. Use this to convert between
 * decimal dollars and micro-units in application code.
 */
export const BILLING_MICROS_PER_UNIT = 1_000_000;

/**
 * Sentinel limit value meaning "unlimited". Stored as -1 in
 * `billing_plan_limits.limit_value` and `billing_usage_periods.limit_value_snapshot`.
 */
export const BILLING_UNLIMITED = -1;

/**
 * Sentinel limit value meaning "feature disabled". Stored as 0.
 */
export const BILLING_DISABLED = 0;

/**
 * Billing interval for a price or subscription. Stored as the
 * `billing_price_interval` / `billing_subscription_interval` PG enum, whose
 * string values match these enum members exactly.
 */
export enum BillingInterval {
  MONTHLY = 'monthly',
  ANNUAL = 'annual',
}

/**
 * Status of a billing customer. Stored as the `billing_customer_status` PG
 * enum. `active` customers can hold subscriptions; `locked` cannot (billing
 * failure); `deleted` is a soft-delete tombstone for audit.
 */
export enum BillingCustomerStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
  DELETED = 'deleted',
}

/**
 * Status of a subscription. Stored as the `billing_subscription_status` PG
 * enum. Terminal states are `canceled` (cancelled but within the paid period)
 * and `ended` (period over, no renewal).
 */
export enum BillingSubscriptionStatus {
  TRIALING = 'trialing',
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELED = 'canceled',
  ENDED = 'ended',
}

/**
 * Status of a usage period. `open` = current period accumulating usage;
 * `closed` = period ended, awaiting finalization; `finalized` = usage locked
 * and invoiced.
 */
export enum BillingUsagePeriodStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  FINALIZED = 'finalized',
}

/**
 * Status of a listing/AO reservation ledger row. `reserved` = counts against
 * the quota; `released` = no longer counts (listing deleted / order refunded);
 * `overage` = counted but exceeds the quota and is billed as overage.
 */
export enum BillingReservationStatus {
  RESERVED = 'reserved',
  RELEASED = 'released',
  OVERAGE = 'overage',
}

/**
 * Status of a webhook inbox row. `received` = just landed; `processing` =
 * worker picked it up; `processed` = applied successfully; `failed` =
 * processing errored (retriable up to a limit).
 */
export enum BillingWebhookStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed',
}

/**
 * Canonical phase-1 limit keys. The DB stores limit_key as VARCHAR so new
 * metered dimensions can be added without a migration, but the application
 * only knows about these keys. Add new keys here first — never as a raw
 * string in feature code.
 */
export enum BillingLimitKey {
  /** Maximum active listings per billing period. */
  LISTINGS_PER_MONTH = 'listings_per_month',
  /** Maximum Amazon orders (auto-fulfill + manual link) per billing period. */
  AMAZON_ORDERS_PER_MONTH = 'amazon_orders_per_month',
}

/**
 * A billing plan. Mirrors `billing_plans`. Plans are DB-parametric: `isActive`
 * and `displayOrder` are read at runtime, not hardcoded.
 */
export interface BillingPlanDto {
  id: string;
  /** Stable machine key (e.g. 'starter'). Never changes once live. */
  slug: string;
  /** Display name (fallback; i18n keys live in the frontend). */
  name: string;
  description: string | null;
  /** Whether the plan is purchasable today. */
  isActive: boolean;
  /** Sort order in plan pickers (ascending). */
  displayOrder: number;
  /** Optional provider-side product id (Stripe prod_...). */
  providerProductId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A price for a plan at a given interval. Mirrors `billing_plan_prices`.
 * Effective-dated so historical prices are preserved.
 */
export interface BillingPlanPriceDto {
  id: string;
  planId: string;
  interval: BillingInterval;
  /** Price in micro-units (1/1,000,000 of USD). $39.00 = 39_000_000. */
  amountMicros: number;
  currency: string;
  /** Inclusive start of the effective window (ISO date). */
  effectiveFrom: string;
  /** Exclusive end of the effective window; null = open-ended (current). */
  effectiveTo: string | null;
  /** Optional provider-side price id (Stripe price_...). */
  providerPriceId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A limit value for a plan. Mirrors `billing_plan_limits`.
 */
export interface BillingPlanLimitDto {
  id: string;
  planId: string;
  /** Machine key — see {@link BillingLimitKey}. */
  limitKey: string;
  /** -1 = unlimited, 0 = disabled, N = quota. */
  limitValue: number;
  /** Optional human-readable unit ('listings', 'orders', ...). */
  unit: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A plan with its current prices and limits expanded. This is the shape the
 * plan-picker UI consumes — the application resolves the effective price per
 * interval and the limit set at read time.
 */
export interface BillingPlanWithPricingDto extends BillingPlanDto {
  /** Current (effective) prices keyed by interval. */
  prices: Partial<Record<BillingInterval, BillingPlanPriceDto>>;
  /** Current limits keyed by limit_key. */
  limits: Partial<Record<BillingLimitKey, BillingPlanLimitDto>>;
}

/**
 * A billing customer. Mirrors `billing_customers`. 1:1 with `users`.
 */
export interface BillingCustomerDto {
  id: string;
  /** Null once the owning user has been hard-deleted — the billing record survives for audit (ON DELETE SET NULL). */
  userId: string | null;
  /** Provider-side customer id (Stripe cus_...). Null for local-only phase-1. */
  providerCustomerId: string | null;
  /** Provider key ('stripe' | 'local' | ...). 'local' for phase-1. */
  provider: string;
  status: BillingCustomerStatus;
  billingEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A subscription. Mirrors `billing_subscriptions`.
 */
export interface BillingSubscriptionDto {
  id: string;
  customerId: string;
  planId: string;
  status: BillingSubscriptionStatus;
  interval: BillingInterval;
  /** Inclusive start of the current paid period. */
  currentPeriodStart: string;
  /** Exclusive end of the current paid period. */
  currentPeriodEnd: string;
  /** When the subscription was cancelled (if applicable). */
  canceledAt: string | null;
  /** When the subscription ended (terminal). */
  endedAt: string | null;
  /**
   * Exclusive end of the free trial, or null when this subscription is not (and
   * never was) a trial. A real column rather than a `metadata` key because the
   * trial-expiry job scans it from an index.
   *
   * Note the FE distinguishes "trialing" from "paid" via {@link status}, NOT via
   * `BillingSummaryDto.transition` — `deriveSummaryTransition` deliberately maps
   * trialing → `active` because that is the correct ACCESS level, and quota
   * enforcement depends on that mapping.
   */
  trialEndsAt: string | null;
  /** Optional provider-side subscription id (Stripe sub_...). */
  providerSubscriptionId: string | null;
  /** Free-form metadata (promo code, etc.). */
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * A usage period. Mirrors `billing_usage_periods`. One row per
 * (subscription, limit_key, period).
 */
export interface BillingUsagePeriodDto {
  id: string;
  subscriptionId: string;
  /** Machine key — see {@link BillingLimitKey}. */
  limitKey: string;
  /** Inclusive period start. */
  periodStart: string;
  /** Exclusive period end. */
  periodEnd: string;
  /** Quantity consumed so far this period. */
  usedQty: number;
  /** Snapshot of the limit value at period start. -1 = unlimited. */
  limitValueSnapshot: number;
  status: BillingUsagePeriodStatus;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * A listing reservation ledger row. Mirrors `billing_listing_reservations`.
 */
export interface BillingListingReservationDto {
  id: string;
  subscriptionId: string;
  listingId: string;
  usagePeriodId: string | null;
  status: BillingReservationStatus;
  providerLineId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * An Amazon-order reservation ledger row. Mirrors `billing_ao_reservations`.
 */
export interface BillingAoReservationDto {
  id: string;
  subscriptionId: string;
  ebayOrderId: string;
  usagePeriodId: string | null;
  status: BillingReservationStatus;
  providerLineId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * A webhook inbox row. Mirrors `billing_webhook_inbox`. Append-only.
 */
export interface BillingWebhookDto {
  id: string;
  provider: string;
  /** Provider-side event id (Stripe evt_...). Used for idempotency. */
  providerEventId: string | null;
  eventType: string;
  /** Raw provider payload, stored verbatim. */
  payload: Record<string, unknown>;
  status: BillingWebhookStatus;
  processingStartedAt: string | null;
  processedAt: string | null;
  error: string | null;
  attempts: number;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Query params for listing subscriptions (admin/customer facing).
 */
export interface BillingSubscriptionsQuery {
  customerId?: string;
  userId?: string;
  status?: BillingSubscriptionStatus;
  planId?: string;
  /** Filter to subscriptions whose current period contains this instant. */
  activeAt?: string;
}

/**
 * Result of a reservation attempt — whether the reservation was created, and
 * if not, why. Returned by the reservation service to the caller.
 */
export interface BillingReservationResult {
  /** Whether the reservation was created (quota allowed). */
  reserved: boolean;
  /** When false, the reason the reservation was rejected. */
  reason?: 'quota_exceeded' | 'no_active_subscription' | 'no_open_period' | 'already_reserved';
  /** The reservation row, when created. */
  reservation?: BillingListingReservationDto | BillingAoReservationDto;
  /** The usage period the reservation counted against, when created. */
  usagePeriod?: BillingUsagePeriodDto;
}
