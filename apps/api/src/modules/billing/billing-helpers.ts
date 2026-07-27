// apps/api/src/modules/billing/billing-helpers.ts
//
// Pure helpers for the billing module. No NestJS deps, no DB — unit-testable in
// the minimal Jest harness (mirrors profit-calculation.ts / order-matcher.ts).
// Exported for the provider/service/processor layers.

import { createHmac, timingSafeEqual } from 'node:crypto';

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

import {
  BillingProvider,
  type BillingSummaryDto,
  type ParsedPaddleEvent,
} from './billing.types';

// ---------------------------------------------------------------------------
// Config resolution (pure — reads env, returns typed config)
// ---------------------------------------------------------------------------

export interface BillingConfig {
  enforcementEnabled: boolean;
  provider: BillingProvider;
  paddleApiKey: string | null;
  paddleWebhookSecret: string | null;
  paddleEnvironment: 'sandbox' | 'production';
  paddleCheckoutBaseUrl: string;
  paddleApiBaseUrl: string;
  webhookStaleMinutes: number;
  webhookMaxAttempts: number;
}

/**
 * Resolve billing config from env. Pure — called once at module init and on
 * each request that needs fresh values. The provider is `paddle` only when
 * both an API key and webhook secret are present; otherwise `local` (the
 * fail-safe). This is the single seam that decides whether checkout/portal
 * can run.
 */
export function resolveBillingConfig(env: NodeJS.ProcessEnv = process.env): BillingConfig {
  const enforcementEnabled = parseBoolean(env.BILLING_ENFORCEMENT_ENABLED, false);
  const paddleApiKey = env.PADDLE_API_KEY ? String(env.PADDLE_API_KEY) : null;
  const paddleWebhookSecret = env.PADDLE_WEBHOOK_SECRET ? String(env.PADDLE_WEBHOOK_SECRET) : null;
  // A provider is "configured" when we can both verify webhooks AND call the
  // API. Requiring both avoids a half-configured state where checkout works
  // but webhooks silently 401, or vice versa.
  const provider: BillingProvider =
    paddleApiKey && paddleWebhookSecret ? BillingProvider.PADDLE : BillingProvider.LOCAL;
  return {
    enforcementEnabled,
    provider,
    paddleApiKey,
    paddleWebhookSecret,
    paddleEnvironment: (env.PADDLE_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
    paddleCheckoutBaseUrl: env.PADDLE_CHECKOUT_BASE_URL || 'https://checkout.paddle.com',
    paddleApiBaseUrl: env.PADDLE_API_BASE_URL || 'https://api.paddle.com',
    webhookStaleMinutes: parseNumber(env.BILLING_WEBHOOK_STALE_MINUTES, 1440),
    webhookMaxAttempts: parseNumber(env.BILLING_WEBHOOK_MAX_ATTEMPTS, 5),
  };
}

/**
 * True when a real billing provider is configured (Paddle env present). The
 * `local` provider is the fail-safe — checkout/portal/webhook-processing
 * gate on this.
 */
export function isProviderConfigured(config: BillingConfig): boolean {
  return config.provider !== BillingProvider.LOCAL;
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
// Paddle webhook signature verification (pure, uses node:crypto)
// ---------------------------------------------------------------------------

/**
 * Paddle signs webhooks with an HMAC-SHA256 tag transmitted in the
 * `Paddle-Signature` header as `ts=<unix-seconds>;h1=<hex-hmac>`. The tag is
 * computed over `<ts>:<raw-body>`. This helper verifies the tag in constant
 * time and rejects tags older than the tolerance window (replay protection).
 *
 * Returns true iff the signature is valid AND the timestamp is within
 * `toleranceSeconds` of `now`. Returns false on any mismatch, missing header,
 * or malformed header — callers MUST treat false as a 401.
 *
 * Spec: https://developer.paddle.com/webhooks/overview/verify-a-webhook
 */
export function verifyPaddleSignature(
  signatureHeader: string | undefined,
  rawBody: string,
  secret: string,
  toleranceSeconds = 300,
  now: Date = new Date(),
): boolean {
  if (!signatureHeader || !secret) {return false;}
  const parts = parseSignatureHeader(signatureHeader);
  if (!parts) {return false;}
  const { ts, h1 } = parts;

  // Replay protection: reject timestamps outside the tolerance window.
  const tsSeconds = Number(ts);
  if (!Number.isFinite(tsSeconds)) {return false;}
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (Math.abs(nowSeconds - tsSeconds) > toleranceSeconds) {return false;}

  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex');
  return constantTimeEqual(expected, h1);
}

interface ParsedSignature {
  ts: string;
  h1: string;
}

export function parseSignatureHeader(header: string): ParsedSignature | null {
  // Format: ts=<unix>;h1=<hex>
  let ts: string | null = null;
  let h1: string | null = null;
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (trimmed.startsWith('ts=')) {ts = trimmed.slice(3);}
    else if (trimmed.startsWith('h1=')) {h1 = trimmed.slice(3);}
  }
  if (ts === null || h1 === null) {return null;}
  return { ts, h1 };
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {return false;}
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Paddle event parsing (pure)
// ---------------------------------------------------------------------------

/**
 * Extract the idempotency/event id, type, and occurred-at from a Paddle
 * webhook payload. Paddle's shape:
 *   { event_id: 'evt_...', event_type: 'subscription.created', occurred_at: '...', data: {...} }
 * All fields are optional in the raw payload; we coerce to null when missing.
 */
export function parsePaddleEvent(payload: unknown): ParsedPaddleEvent {
  const obj = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const eventId = typeof obj.event_id === 'string' ? obj.event_id : null;
  const eventType = typeof obj.event_type === 'string' ? obj.event_type : 'unknown';
  const occurredAt = typeof obj.occurred_at === 'string' ? obj.occurred_at : null;
  return {
    eventId,
    eventType,
    occurredAt,
    payload: obj ,
  };
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
