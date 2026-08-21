// apps/api/src/modules/billing/billing-helpers.ts
//
// Pure helpers for the billing module. No NestJS deps, no DB — unit-testable in
// the minimal Jest harness (mirrors profit-calculation.ts / order-matcher.ts).
// Exported for the provider/service/processor layers.

import {
  BillingInterval,
  BillingLimitKey,
  BillingSubscriptionStatus,
  type BillingPlanDto,
  type BillingPlanLimitDto,
  type BillingPlanPriceDto,
  type BillingPlanWithPricingDto,
  type BillingSubscriptionsQuery,
  type BillingUsagePeriodDto,
} from '@repo/shared';

import { BillingProvider, type BillingSummaryDto } from './billing.types';

// ---------------------------------------------------------------------------
// Config resolution (pure — reads env, returns typed config)
// ---------------------------------------------------------------------------

export interface BillingConfig {
  enforcementEnabled: boolean;
  /** `stripe` when a secret key is configured, else `local` — see
   *  {@link BillingProvider}. This is a derived status for the wire DTOs, NOT
   *  a choice between implementations: Stripe is the only payment provider. */
  provider: BillingProvider;
  /** The app's own frontend base URL — used to build Stripe Checkout's
   *  success_url/cancel_url and the Billing Portal's return_url. Same env var
   *  (with the same default) already used by ebay.controller.ts's OAuth
   *  redirects and auth.service.ts. */
  frontendUrl: string;
  stripeSecretKey: string | null;
  stripeWebhookSecret: string | null;
  webhookStaleMinutes: number;
  webhookMaxAttempts: number;
}

/**
 * Resolve billing config from env. Pure — called once at module init and on
 * each request that needs fresh values. This is the single seam that decides
 * whether checkout/portal can run.
 *
 * There is no provider selection: Stripe is the only payment provider, and
 * its own test mode covers local dev and the test environment (that is why no
 * stand-in "local provider" exists — it would never be exercised). `provider`
 * is purely a derived status for the catalog/summary DTOs: `stripe` once a
 * secret key is present, `local` while it is not, so the FE can hide the
 * checkout button rather than surface a 409 after the click.
 */
export function resolveBillingConfig(env: NodeJS.ProcessEnv = process.env): BillingConfig {
  const stripeSecretKey = env.STRIPE_SECRET_KEY ? String(env.STRIPE_SECRET_KEY) : null;
  return {
    enforcementEnabled: parseBoolean(env.BILLING_ENFORCEMENT_ENABLED, false),
    provider: stripeSecretKey ? BillingProvider.STRIPE : BillingProvider.LOCAL,
    frontendUrl: env.FRONTEND_URL || 'http://localhost:5173',
    stripeSecretKey,
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ? String(env.STRIPE_WEBHOOK_SECRET) : null,
    webhookStaleMinutes: parseNumber(env.BILLING_WEBHOOK_STALE_MINUTES, 1440),
    webhookMaxAttempts: parseNumber(env.BILLING_WEBHOOK_MAX_ATTEMPTS, 5),
  };
}

/**
 * True when Stripe is configured and checkout/portal can actually run.
 * Callers (BillingService) gate on this so an unconfigured deployment returns
 * a clean 409 instead of a provider error.
 */
export function isProviderConfigured(config: BillingConfig): boolean {
  return Boolean(config.stripeSecretKey);
}

function parseBoolean(raw: string | undefined, def: boolean): boolean {
  if (raw === undefined || raw === '') {return def;}
  return String(raw).toLowerCase() === 'true' || String(raw) === '1';
}

function parseNumber(raw: string | undefined, def: number): number {
  if (raw === undefined || raw === '') {return def;}
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

// ---------------------------------------------------------------------------
// Plan/pricing expansion (pure mappers)
// ---------------------------------------------------------------------------

interface PlanRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  provider_product_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PriceRow {
  id: string;
  plan_id: string;
  interval: string;
  amount_micros: string | number;
  currency: string;
  effective_from: Date | string;
  effective_to: Date | string | null;
  provider_price_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface LimitRow {
  id: string;
  plan_id: string;
  limit_key: string;
  limit_value: string | number;
  unit: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export function mapPlanRow(row: PlanRow): BillingPlanDto {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    isActive: row.is_active,
    displayOrder: row.display_order,
    providerProductId: row.provider_product_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapPriceRow(row: PriceRow): BillingPlanPriceDto {
  return {
    id: row.id,
    planId: row.plan_id,
    interval: row.interval as BillingInterval,
    amountMicros: Number(row.amount_micros),
    currency: row.currency,
    effectiveFrom: toIso(row.effective_from),
    effectiveTo: row.effective_to === null ? null : toIso(row.effective_to),
    providerPriceId: row.provider_price_id,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export function mapLimitRow(row: LimitRow): BillingPlanLimitDto {
  return {
    id: row.id,
    planId: row.plan_id,
    limitKey: row.limit_key,
    limitValue: Number(row.limit_value),
    unit: row.unit,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * Expand a plan with its prices and limits. Effective prices are resolved per
 * interval: the price whose effective_from <= today and (effective_to is null
 * OR effective_to > today). If multiple prices are effective (shouldn't happen
 * due to the partial unique index), the most recent effective_from wins.
 */
export function expandPlan(
  plan: BillingPlanDto,
  prices: BillingPlanPriceDto[],
  limits: BillingPlanLimitDto[],
  now: Date = new Date(),
): BillingPlanWithPricingDto {
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const planPrices = prices.filter((p) => p.planId === plan.id);
  const planLimits = limits.filter((l) => l.planId === plan.id);

  const effectivePrices: Partial<Record<BillingInterval, BillingPlanPriceDto>> = {};
  for (const interval of [BillingInterval.MONTHLY, BillingInterval.ANNUAL]) {
    const candidates = planPrices
      .filter((p) => p.interval === interval)
      .filter((p) => p.effectiveFrom <= today && (p.effectiveTo === null || p.effectiveTo > today))
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
    if (candidates.length > 0) {
      effectivePrices[interval] = candidates[0];
    }
  }

  const limitsByKey = planLimits.reduce<Partial<Record<BillingLimitKey, BillingPlanLimitDto>>>(
    (acc, l) => {
      acc[l.limitKey as BillingLimitKey] = l;
      return acc;
    },
    {},
  );

  return {
    ...plan,
    prices: effectivePrices,
    limits: limitsByKey,
  };
}

// ---------------------------------------------------------------------------
// Summary transition derivation (pure)
// ---------------------------------------------------------------------------

/**
 * Derive the `transition` field for BillingSummaryDto. When enforcement is
 * off, the user always gets `full_access` — NO fake subscription is synthesized
 * (the absence of a subscription is the truthful state). When enforcement is
 * on, the transition reflects the actual subscription status.
 */
export function deriveSummaryTransition(
  enforcementEnabled: boolean,
  subscriptionStatus: BillingSubscriptionStatus | null,
): BillingSummaryDto['transition'] {
  if (!enforcementEnabled) {
    return 'full_access';
  }
  if (subscriptionStatus === null) {
    return 'no_subscription';
  }
  if (subscriptionStatus === BillingSubscriptionStatus.PAST_DUE) {
    return 'past_due';
  }
  if (
    subscriptionStatus === BillingSubscriptionStatus.ACTIVE ||
    subscriptionStatus === BillingSubscriptionStatus.TRIALING
  ) {
    return 'active';
  }
  // canceled / ended — treat as no active entitlement
  return 'no_subscription';
}

// ---------------------------------------------------------------------------
// Stale-event protection (pure)
// ---------------------------------------------------------------------------

/**
 * True when an event's occurredAt is older than the stale TTL. Events with no
 * occurredAt are never considered stale (we can't prove they're old). A stale
 * TTL of 0 disables the check.
 */
export function isStaleEvent(occurredAt: string | null, staleMinutes: number, now: Date = new Date()): boolean {
  if (staleMinutes <= 0) {return false;}
  if (!occurredAt) {return false;}
  const occurred = Date.parse(occurredAt);
  if (Number.isNaN(occurred)) {return false;}
  const ageMs = now.getTime() - occurred;
  return ageMs > staleMinutes * 60_000;
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function toIso(value: Date | string): string {
  if (value instanceof Date) {return value.toISOString();}
  return String(value);
}

/**
 * Build the SQL WHERE clause + params for a subscriptions query (admin-facing
 * list). Pure so it can be unit-tested without a DB.
 */
export function buildSubscriptionsQuery(
  query: BillingSubscriptionsQuery,
): { where: string; params: (string | number)[] } {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (query.customerId) {
    params.push(query.customerId);
    conditions.push(`customer_id = $${params.length}`);
  }
  if (query.userId) {
    params.push(query.userId);
    conditions.push(`customer_id IN (SELECT id FROM billing_customers WHERE user_id = $${params.length})`);
  }
  if (query.status) {
    params.push(query.status);
    conditions.push(`status = $${params.length}`);
  }
  if (query.planId) {
    params.push(query.planId);
    conditions.push(`plan_id = $${params.length}`);
  }
  if (query.activeAt) {
    params.push(query.activeAt);
    conditions.push(`current_period_start <= $${params.length} AND current_period_end > $${params.length}`);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// Re-exported for tests / typing convenience.
export type { BillingUsagePeriodDto };
