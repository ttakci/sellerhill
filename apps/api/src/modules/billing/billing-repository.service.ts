// apps/api/src/modules/billing/billing-repository.service.ts
//
// DB access for the billing module. Raw `pg` via DatabaseService — no ORM.
// Reads plans/prices/limits (catalog), the user's customer+subscription+
// usage-periods (summary), and writes webhook inbox rows + subscription
// state mutations (processor). All money is BIGINT micro-units; the mappers
// in billing-helpers.ts coerce to number.

import { Injectable, Logger } from '@nestjs/common';
import {
  BillingLimitKey,
  BillingSubscriptionStatus,
  BillingUsagePeriodStatus,
  BillingWebhookStatus,
  ListingStatus,
  TrackingConversionProvider,
  TRIAL_PLAN_SLUG,
  type BillingQuotaAddonDto,
  type BillingCustomerDto,
  type BillingPlanDto,
  type BillingPlanLimitDto,
  type BillingPlanPriceDto,
  type BillingPlanWithPricingDto,
  type BillingSubscriptionDto,
  type BillingUsagePeriodDto,
  type BillingWebhookDto,
} from '@repo/shared';
import { PoolClient } from 'pg';

import { DatabaseService, type QueryParam } from '../../common/database/database.service';

import {
  expandPlan,
  mapLimitRow,
  mapPlanRow,
  mapPriceRow,
  type BillingConfig,
} from './billing-helpers';
import type { ParsedStripeEvent } from './billing.types';
import { advisoryLockKey, billingCustomerLockKey, utcMonthBounds } from './quota-helpers';


interface PlanEntity {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  provider_product_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PriceEntity {
  id: string;
  plan_id: string;
  interval: string;
  amount_micros: string;
  currency: string;
  effective_from: Date;
  effective_to: Date | null;
  provider_price_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface LimitEntity {
  id: string;
  plan_id: string;
  limit_key: string;
  limit_value: string;
  unit: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CustomerEntity {
  id: string;
  user_id: string | null;
  provider_customer_id: string | null;
  provider: string;
  status: string;
  billing_email: string | null;
  trial_started_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface SubscriptionEntity {
  id: string;
  customer_id: string;
  plan_id: string;
  status: string;
  interval: string;
  current_period_start: Date;
  current_period_end: Date;
  canceled_at: Date | null;
  ended_at: Date | null;
  trial_ends_at: Date | null;
  provider_subscription_id: string | null;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface UsagePeriodEntity {
  id: string;
  subscription_id: string;
  limit_key: string;
  period_start: Date;
  period_end: Date;
  used_qty: string;
  limit_value_snapshot: string;
  status: string;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface QuotaAddonEntity {
  id: string;
  slug: string;
  limit_key: string;
  quantity: string;
  amount_micros: string;
  currency: string;
  is_active: boolean;
  display_order: number;
  provider_price_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface WebhookEntity {
  id: string;
  provider: string;
  provider_event_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  status: string;
  processing_started_at: Date | null;
  processed_at: Date | null;
  error: string | null;
  attempts: number;
  received_at: Date;
  created_at: Date;
  updated_at: Date;
}

@Injectable()
export class BillingRepositoryService {
  private readonly logger = new Logger(BillingRepositoryService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  // -------------------------------------------------------------------------
  // Catalog reads
  // -------------------------------------------------------------------------

  async findActivePlans(): Promise<BillingPlanDto[]> {
    const rows = await this.databaseService.query<PlanEntity>(
      `SELECT * FROM billing_plans WHERE is_active = TRUE ORDER BY display_order ASC, slug ASC`,
    );
    return rows.map(mapPlanRow);
  }

  async findPricesForPlans(
    planIds: string[],
    client?: PoolClient,
  ): Promise<BillingPlanPriceDto[]> {
    if (planIds.length === 0) {return [];}
    const rows = await this.run<PriceEntity>(
      `SELECT * FROM billing_plan_prices WHERE plan_id = ANY($1::uuid[]) ORDER BY effective_from DESC`,
      [planIds],
      client,
    );
    return rows.map(mapPriceRow);
  }

  async findLimitsForPlans(
    planIds: string[],
    client?: PoolClient,
  ): Promise<BillingPlanLimitDto[]> {
    if (planIds.length === 0) {return [];}
    const rows = await this.run<LimitEntity>(
      `SELECT * FROM billing_plan_limits WHERE plan_id = ANY($1::uuid[])`,
      [planIds],
      client,
    );
    return rows.map(mapLimitRow);
  }

  async findPlanById(id: string, client?: PoolClient): Promise<BillingPlanDto | null> {
    const rows = await this.run<PlanEntity>(
      `SELECT * FROM billing_plans WHERE id = $1`,
      [id],
      client,
    );
    return rows.length > 0 ? mapPlanRow(rows[0]) : null;
  }

  /**
   * Resolve a Stripe price id (a pending downgrade schedule's next phase,
   * from getBillingDetails) back to our plan slug. Only the slug — this is a
   * display lookup for /billing/details, not a full plan load.
   */
  async findPlanByProviderPriceId(providerPriceId: string): Promise<{ slug: string } | null> {
    const rows = await this.databaseService.query<{ slug: string }>(
      `SELECT p.slug FROM billing_plans p
         JOIN billing_plan_prices pr ON pr.plan_id = p.id
        WHERE pr.provider_price_id = $1
        LIMIT 1`,
      [providerPriceId],
    );
    return rows[0] ?? null;
  }

  /**
   * Load the full catalog (active plans + their prices + limits) and expand
   * each plan with its effective pricing. Single call site for the catalog
   * endpoint.
   */
  async loadCatalog(): Promise<BillingPlanWithPricingDto[]> {
    const plans = await this.findActivePlans();
    if (plans.length === 0) {return [];}
    const planIds = plans.map((p) => p.id);
    const [prices, limits] = await Promise.all([
      this.findPricesForPlans(planIds),
      this.findLimitsForPlans(planIds),
    ]);
    return plans.map((p) => expandPlan(p, prices, limits));
  }

  async loadPlanWithPricing(
    planId: string,
    client?: PoolClient,
  ): Promise<BillingPlanWithPricingDto | null> {
    const plan = await this.findPlanById(planId, client);
    if (!plan) {return null;}
    const [prices, limits] = await Promise.all([
      this.findPricesForPlans([planId], client),
      this.findLimitsForPlans([planId], client),
    ]);
    return expandPlan(plan, prices, limits);
  }

  // -------------------------------------------------------------------------
  // Customer + subscription reads (summary)
  // -------------------------------------------------------------------------

  async findCustomerByUserId(userId: string, client?: PoolClient): Promise<BillingCustomerDto | null> {
    const rows = await this.run<CustomerEntity>(
      `SELECT * FROM billing_customers WHERE user_id = $1`,
      [userId],
      client,
    );
    return rows.length > 0 ? this.mapCustomer(rows[0]) : null;
  }

  /**
   * Find the user's current subscription (the most recent row whose period
   * contains now, preferring active/trialing/past_due over canceled/ended).
   * Returns null when the user has no subscription at all.
   */
  async findCurrentSubscription(
    userId: string,
    client?: PoolClient,
  ): Promise<BillingSubscriptionDto | null> {
    const rows = await this.run<SubscriptionEntity>(
      `SELECT s.* FROM billing_subscriptions s
       JOIN billing_customers c ON c.id = s.customer_id
       WHERE c.user_id = $1
       ORDER BY
         -- A real Stripe subscription outranks a local-only trial row, whatever
         -- their statuses. This used to sort purely by status with 'trialing'
         -- first, so a trial row that was never closed masked the paid
         -- subscription underneath it and the FE kept opening new checkouts.
         (s.provider_subscription_id IS NULL) ASC,
         CASE s.status
           WHEN 'trialing' THEN 1
           WHEN 'active' THEN 2
           WHEN 'past_due' THEN 3
           WHEN 'canceled' THEN 4
           WHEN 'ended' THEN 5
         END ASC,
         s.current_period_end DESC`,
      [userId],
      client,
    );
    return rows.length > 0 ? this.mapSubscription(rows[0]) : null;
  }

  async findOpenUsagePeriods(subscriptionId: string): Promise<BillingUsagePeriodDto[]> {
    const rows = await this.databaseService.query<UsagePeriodEntity>(
      `SELECT * FROM billing_usage_periods
       WHERE subscription_id = $1 AND status = 'open'
       ORDER BY period_start DESC`,
      [subscriptionId],
    );
    return rows.map((p) => this.mapUsagePeriod(p));
  }

  /**
   * Open the current calendar month's usage period for a (subscription, limit)
   * if it is not open already, and close any period whose end has passed.
   *
   * THIS IS THE FIX FOR A DEAD TABLE. Nothing in the codebase had ever
   * INSERTed into `billing_usage_periods` — there was a SELECT and a
   * close-on-trial-expiry UPDATE and nothing else — so the table was always
   * empty. Two consequences followed silently, both invisible while
   * BILLING_ENFORCEMENT_ENABLED was off:
   *
   *   1. Monthly counts never reset. The AO count filtered on nothing, so
   *      reservations accumulated for the life of the subscription: a seller on
   *      100 orders/month was blocked permanently after their first 100 orders
   *      ever, not after 100 in a month.
   *   2. The Action Center's quota items iterate over the open periods, so they
   *      could never fire — the seller got no warning before the wall.
   *
   * Lazy on read rather than a cron: the repo's own idiom (see
   * `ensureSeeded` for buyer-message templates, `resolveProductData`'s
   * advisory lock), and a scheduled job is one more thing that can silently
   * stop running. Concurrency is handled by the table's own
   * `(subscription_id, limit_key, period_start)` unique constraint.
   *
   * Returns the open period's id, or null if it could not be resolved (which
   * callers treat as "no period" and degrade rather than fail).
   */
  async ensureOpenUsagePeriod(
    subscriptionId: string,
    kind: BillingLimitKey,
    limitValue: number,
    now: Date = new Date(),
  ): Promise<string | null> {
    const { periodStart, periodEnd } = utcMonthBounds(now);
    try {
      // Close anything that has run out, so a stale period cannot be picked up
      // as "the current one" below.
      await this.databaseService.query(
        `UPDATE billing_usage_periods
            SET status = 'closed', closed_at = COALESCE(closed_at, NOW()), updated_at = NOW()
          WHERE subscription_id = $1 AND limit_key = $2
            AND status = 'open' AND period_end <= $3`,
        [subscriptionId, kind, periodStart.toISOString()],
      );

      const rows = await this.databaseService.query<{ id: string }>(
        `INSERT INTO billing_usage_periods
           (subscription_id, limit_key, period_start, period_end, limit_value_snapshot, status)
         VALUES ($1, $2, $3, $4, $5, 'open')
         ON CONFLICT (subscription_id, limit_key, period_start) DO UPDATE
           SET updated_at = NOW()
         RETURNING id`,
        [
          subscriptionId,
          kind,
          periodStart.toISOString(),
          periodEnd.toISOString(),
          limitValue,
        ],
      );
      return rows[0]?.id ?? null;
    } catch (err) {
      // A usage period is bookkeeping, not a gate. Failing to open one must not
      // block a listing or an order.
      this.logger.warn(
        `ensureOpenUsagePeriod failed (subscription=${subscriptionId}, key=${kind}): ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Count the user's ACTIVE listings.
   *
   * The listing quota is a LEVEL, not a monthly flow: CLAUDE.md has always said
   * "active listings + open reservations", and `countReservedSlots`' own
   * docstring claimed it counted active listings — but the query only ever
   * counted reservation rows, and nothing released a reservation when a listing
   * was ended. So the number could only grow, and "delete one to add one" was
   * impossible. Counting the listings themselves is what makes ending a listing
   * free its slot, with no release call to forget.
   */
  async countActiveListings(userId: string, client?: PoolClient): Promise<number> {
    const rows = await this.run<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM listings
        WHERE user_id = $1 AND status = $2`,
      [userId, ListingStatus.ACTIVE],
      client,
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  /**
   * Count tracking conversions actually performed this calendar month.
   *
   * Read straight from `orders` rather than from a reservation ledger, and that
   * is deliberate. A conversion is a single synchronous act with a durable
   * record (`tracking_converted_at`), so there is no in-flight window a
   * reservation would protect — and a ledger is one more thing that can drift
   * from what really happened. Here the count IS the conversions that occurred:
   * a failed conversion writes nothing and therefore costs no quota, which is
   * also the correct billing answer since we only pay the provider on success.
   */
  async countMonthlyConversions(
    userId: string,
    now: Date = new Date(),
    client?: PoolClient,
  ): Promise<number> {
    const { periodStart } = utcMonthBounds(now);
    const rows = await this.run<{ cnt: string }>(
      // Both spellings: `normalizeProvider` collapses the legacy 'api' alias
      // onto AQUILINE before persisting, but matching only the canonical value
      // would undercount if any legacy row ever carried the alias — and
      // undercounting hands out free conversions we have already paid for.
      `SELECT COUNT(*)::text AS cnt FROM orders
        WHERE user_id = $1
          AND tracking_provider IN ($2, $3)
          AND tracking_converted_at >= $4`,
      [
        userId,
        TrackingConversionProvider.AQUILINE,
        TrackingConversionProvider.API,
        periodStart.toISOString(),
      ],
      client,
    );
    return Number(rows[0]?.cnt ?? 0);
  }

  // -------------------------------------------------------------------------
  // Quota top-ups (migration 087)
  // -------------------------------------------------------------------------

  /** Active top-up packs for a meter, cheapest first. */
  async listQuotaAddons(limitKey?: BillingLimitKey): Promise<BillingQuotaAddonDto[]> {
    const rows = await this.databaseService.query<QuotaAddonEntity>(
      `SELECT * FROM billing_quota_addons
        WHERE is_active = TRUE
          AND ($1::text IS NULL OR limit_key = $1)
        ORDER BY display_order ASC, amount_micros ASC`,
      [limitKey ?? null],
    );
    return rows.map((row) => this.mapQuotaAddon(row));
  }

  /** One pack by slug, active or not — a purchase in flight must still resolve. */
  async findQuotaAddonBySlug(slug: string): Promise<BillingQuotaAddonDto | null> {
    const rows = await this.databaseService.query<QuotaAddonEntity>(
      `SELECT * FROM billing_quota_addons WHERE slug = $1`,
      [slug],
    );
    return rows.length > 0 ? this.mapQuotaAddon(rows[0]) : null;
  }

  /**
   * Extra allowance the user bought for the CURRENT calendar month.
   *
   * Summed rather than decremented: a credit raises the ceiling, and usage is
   * still counted the one way it always was. That is what keeps the number the
   * seller sees and the number the gate enforces from ever disagreeing — a
   * separate consumption ledger would be a second accounting of the same
   * quantity, and those drift.
   */
  async sumQuotaCredits(
    userId: string,
    limitKey: BillingLimitKey,
    now: Date = new Date(),
  ): Promise<number> {
    const { periodStart } = utcMonthBounds(now);
    const rows = await this.databaseService.query<{ total: string | null }>(
      `SELECT COALESCE(SUM(quantity), 0)::text AS total
         FROM billing_quota_credits
        WHERE user_id = $1 AND limit_key = $2 AND period_start = $3`,
      [userId, limitKey, periodStart.toISOString()],
    );
    return Number(rows[0]?.total ?? 0);
  }

  /**
   * Grant a purchased top-up. Idempotent on `provider_event_id`.
   *
   * Returns true only when a row was actually inserted, so a redelivered Stripe
   * webhook is visible in the log as a no-op rather than looking like a second
   * sale. The UNIQUE constraint is what enforces this — the webhook inbox also
   * dedupes, but free allowance is not something to protect with one layer.
   */
  async grantQuotaCredit(params: {
    userId: string;
    limitKey: BillingLimitKey;
    quantity: number;
    addonId: string | null;
    providerEventId: string;
    amountMicros: number | null;
    currency: string | null;
    now?: Date;
  }): Promise<boolean> {
    const { periodStart } = utcMonthBounds(params.now ?? new Date());
    const rows = await this.databaseService.query<{ id: string }>(
      `INSERT INTO billing_quota_credits
         (user_id, limit_key, quantity, period_start, addon_id,
          provider_event_id, amount_micros, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (provider_event_id) DO NOTHING
       RETURNING id`,
      [
        params.userId,
        params.limitKey,
        params.quantity,
        periodStart.toISOString(),
        params.addonId,
        params.providerEventId,
        params.amountMicros,
        params.currency,
      ],
    );
    return rows.length > 0;
  }

  /**
   * The ceiling that is actually enforced: the plan's limit PLUS credits bought
   * for the current calendar month.
   *
   * Lives here, not in a service, because BOTH the quota gate and the billing
   * summary need it. If the gate resolved the plan limit while the summary
   * added credits, a seller who topped up would see headroom and still be
   * refused — the worst possible outcome for something they just paid for.
   *
   * The `null` (plan declares no limit) and `-1` (unlimited) sentinels are
   * returned untouched: adding a credit to "unlimited" is meaningless, and
   * adding one to "no limit declared" would invent a ceiling out of nothing.
   */
  async resolveEffectiveLimit(
    userId: string,
    subscriptionId: string,
    limitKey: BillingLimitKey,
    now: Date = new Date(),
  ): Promise<{ limitValue: number | null; creditValue: number }> {
    const planLimit = await this.resolveLimitValue(subscriptionId, limitKey);
    if (planLimit === null || planLimit === -1) {
      return { limitValue: planLimit, creditValue: 0 };
    }
    try {
      const creditValue = await this.sumQuotaCredits(userId, limitKey, now);
      return { limitValue: planLimit + creditValue, creditValue };
    } catch (err) {
      // Fail to the PLAN limit, never to unlimited. A credit lookup that fails
      // costs the seller headroom they paid for — annoying, and visible. The
      // other direction would hand out unmetered allowance silently.
      this.logger.warn(
        `Credit lookup failed for user ${userId} / ${limitKey}: ${(err as Error).message}`,
      );
      return { limitValue: planLimit, creditValue: 0 };
    }
  }

  /** The Stripe price id for a pack. Kept off the DTO — it is an internal
   *  identifier the browser has no use for. */
  async resolveAddonProviderPriceId(addonId: string): Promise<string | null> {
    const rows = await this.databaseService.query<{ provider_price_id: string | null }>(
      `SELECT provider_price_id FROM billing_quota_addons WHERE id = $1`,
      [addonId],
    );
    return rows[0]?.provider_price_id ?? null;
  }

  /** Write back a Stripe price id after `stripe:sync-catalog` mirrors a pack. */
  async setQuotaAddonProviderPriceId(addonId: string, providerPriceId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE billing_quota_addons
          SET provider_price_id = $2, updated_at = NOW()
        WHERE id = $1`,
      [addonId, providerPriceId],
    );
  }

  private mapQuotaAddon(row: QuotaAddonEntity): BillingQuotaAddonDto {
    return {
      id: row.id,
      slug: row.slug,
      limitKey: row.limit_key as BillingLimitKey,
      quantity: Number(row.quantity),
      amountMicros: Number(row.amount_micros),
      currency: row.currency,
      // Not purchasable until it exists in Stripe. Surfaced as a flag rather
      // than hidden, so an operator who forgot the sync script sees the pack
      // greyed out instead of wondering where it went.
      isPurchasable: Boolean(row.provider_price_id),
    };
  }

  // -------------------------------------------------------------------------
  // Webhook inbox (append-only log + idempotent processing state)
  // -------------------------------------------------------------------------

  /**
   * Insert a webhook inbox row. Idempotent on (provider, provider_event_id)
   * via the partial unique index — a repeated delivery returns the existing
   * row instead of inserting a duplicate. Returns the row + a flag indicating
   * whether this was a new insert (true) or a dedup hit (false).
   */
  async insertWebhook(
    provider: string,
    event: ParsedStripeEvent,
  ): Promise<{ row: BillingWebhookDto; inserted: boolean }> {
    const existing = event.eventId
      ? await this.databaseService.query<WebhookEntity>(
          `SELECT * FROM billing_webhook_inbox WHERE provider = $1 AND provider_event_id = $2`,
          [provider, event.eventId],
        )
      : [];
    if (existing.length > 0) {
      return { row: this.mapWebhook(existing[0]), inserted: false };
    }
    const inserted = await this.databaseService.query<WebhookEntity>(
      `INSERT INTO billing_webhook_inbox (provider, provider_event_id, event_type, payload, status)
       VALUES ($1, $2, $3, $4, 'received')
       ON CONFLICT (provider, provider_event_id) WHERE provider_event_id IS NOT NULL
       DO UPDATE SET received_at = billing_webhook_inbox.received_at
       RETURNING *`,
      [provider, event.eventId, event.eventType, JSON.stringify(event.payload)],
    );
    return { row: this.mapWebhook(inserted[0]), inserted: inserted.length > 0 };
  }

  /**
   * Atomically claim a webhook for processing: UPDATE … SET status='processing'
   * WHERE id=$1 AND status IN ('received','failed'). Returns true if the row
   * was claimed (this caller owns it), false if another worker already owns
   * it. This is the idempotent processing seam — concurrent deliveries of the
   * same event dedup at insert time, and concurrent processing attempts dedup
   * here.
   */
  async claimWebhook(webhookId: string): Promise<boolean> {
    const rows = await this.databaseService.query<{ id: string }>(
      `UPDATE billing_webhook_inbox
       SET status = 'processing', processing_started_at = NOW(), attempts = attempts + 1
       WHERE id = $1 AND status IN ('received', 'failed')
       RETURNING id`,
      [webhookId],
    );
    return rows.length > 0;
  }

  async markWebhookProcessed(webhookId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE billing_webhook_inbox
       SET status = 'processed', processed_at = NOW(), error = NULL
       WHERE id = $1`,
      [webhookId],
    );
  }

  async markWebhookFailed(webhookId: string, error: string, maxAttempts: number): Promise<void> {
    // Only flip to 'failed' (terminal) when attempts >= maxAttempts; otherwise
    // reset to 'received' so a future tick can retry. The status enum has no
    // 'retrying' state, so 'received' is the retriable bucket.
    await this.databaseService.query(
      `UPDATE billing_webhook_inbox
       SET status = CASE WHEN attempts >= $2 THEN 'failed'::billing_webhook_status ELSE 'received'::billing_webhook_status END,
           error = $3,
           processing_started_at = NULL
       WHERE id = $1`,
      [webhookId, maxAttempts, error],
    );
  }

  async findWebhookById(id: string): Promise<BillingWebhookDto | null> {
    const rows = await this.databaseService.query<WebhookEntity>(
      `SELECT * FROM billing_webhook_inbox WHERE id = $1`,
      [id],
    );
    return rows.length > 0 ? this.mapWebhook(rows[0]) : null;
  }

  // -------------------------------------------------------------------------
  // Subscription state mutations (applied by the webhook processor)
  // -------------------------------------------------------------------------

  /**
   * Upsert a subscription from a Stripe event. Idempotent on
   * provider_subscription_id — a repeated subscription.activated event
   * updates the row in place rather than inserting a duplicate. The caller
   * passes the resolved customer_id (from billing_customers.provider_customer_id).
   */
  async upsertSubscriptionByProvider(
    customerId: string,
    planId: string,
    fields: {
      providerSubscriptionId: string;
      status: BillingSubscriptionStatus;
      interval: 'monthly' | 'annual';
      currentPeriodStart: Date;
      currentPeriodEnd: Date;
      canceledAt: Date | null;
      endedAt: Date | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<BillingSubscriptionDto | null> {
    const rows = await this.databaseService.query<SubscriptionEntity>(
      `INSERT INTO billing_subscriptions
         (customer_id, plan_id, status, interval,
          current_period_start, current_period_end, canceled_at, ended_at,
          provider_subscription_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (provider_subscription_id) WHERE provider_subscription_id IS NOT NULL
       DO UPDATE SET
         plan_id = EXCLUDED.plan_id,
         status = EXCLUDED.status,
         interval = EXCLUDED.interval,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         canceled_at = EXCLUDED.canceled_at,
         ended_at = EXCLUDED.ended_at,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [
        customerId,
        planId,
        fields.status,
        fields.interval,
        fields.currentPeriodStart.toISOString(),
        fields.currentPeriodEnd.toISOString(),
        fields.canceledAt ? fields.canceledAt.toISOString() : null,
        fields.endedAt ? fields.endedAt.toISOString() : null,
        fields.providerSubscriptionId,
        JSON.stringify(fields.metadata ?? {}),
      ],
    );
    return rows.length > 0 ? this.mapSubscription(rows[0]) : null;
  }

  /**
   * Repoint a subscription at a different plan, in place.
   *
   * Used by `changePlan` the moment Stripe accepts the reprice, rather than
   * waiting for the `customer.subscription.updated` webhook to carry it back.
   * The webhook is authoritative for everything a plan change does NOT decide
   * (status, period boundaries) and re-applies this same plan_id when it lands,
   * so the two cannot disagree — but it arrives a second or two later, and the
   * FE refetches its summary immediately after the mutation resolves. Leaving
   * the local row stale in that window showed the seller their OLD quotas right
   * after a successful upgrade, with nothing scheduled to correct it until they
   * reloaded the page by hand.
   *
   * Safe to write ahead of the webhook because Stripe has already returned
   * success for the exact price we asked for: the new plan IS the truth at this
   * point, not a prediction.
   */
  async updateSubscriptionPlan(
    subscriptionId: string,
    planId: string,
    client?: PoolClient,
  ): Promise<void> {
    await this.run(
      `UPDATE billing_subscriptions
          SET plan_id = $2, updated_at = NOW()
        WHERE id = $1`,
      [subscriptionId, planId],
      client,
    );
  }

  /**
   * End this user's local trial rows.
   *
   * The trial exists only in our tables — it has no Stripe subscription — and
   * it is over the moment the seller actually pays. Nothing closed it before,
   * so a converted seller kept a live `trialing` row forever; combined with
   * findCurrentSubscription's ordering that row MASKED their real subscription,
   * `hasProviderSubscription` read false, and every later plan click opened a
   * fresh Checkout and minted another live subscription.
   *
   * `provider_subscription_id IS NULL` is the safety catch: this must never be
   * able to touch a provider-backed row, because doing so would suspend a
   * paying customer.
   */
  async endTrialSubscriptionsForUser(userId: string): Promise<void> {
    await this.databaseService.query(
      `UPDATE billing_subscriptions s
          SET status = $2, ended_at = NOW(), updated_at = NOW()
         FROM billing_customers c
        WHERE c.id = s.customer_id
          AND c.user_id = $1
          AND s.provider_subscription_id IS NULL
          AND s.status <> $2`,
      [userId, BillingSubscriptionStatus.ENDED],
    );
  }

  /**
   * Find a customer by provider customer id (for webhook processing — the
   * Stripe event carries the provider customer id, not our user_id).
   */
  async findCustomerByProviderId(
    provider: string,
    providerCustomerId: string,
  ): Promise<BillingCustomerDto | null> {
    const rows = await this.databaseService.query<CustomerEntity>(
      `SELECT * FROM billing_customers WHERE provider = $1 AND provider_customer_id = $2`,
      [provider, providerCustomerId],
    );
    return rows.length > 0 ? this.mapCustomer(rows[0]) : null;
  }

  /**
   * Create a local customer row for a user (provider='local') if one does not
   * exist. Used by checkout to ensure a customer record exists before
   * redirecting to Stripe. Idempotent on user_id.
   */
  async startTrialOnce(
    userId: string,
    billingEmail: string | null,
    startedAt: Date,
    trialEndsAt: Date,
  ): Promise<BillingSubscriptionDto | null> {
    return this.databaseService.transaction(async (client) => {
      const customerResult = await client.query<CustomerEntity>(
        `INSERT INTO billing_customers (user_id, provider, billing_email)
         VALUES ($1, 'local', $2)
         ON CONFLICT (user_id) DO UPDATE SET
           billing_email = COALESCE(billing_customers.billing_email, EXCLUDED.billing_email),
           updated_at = NOW()
         RETURNING *`,
        [userId, billingEmail],
      );
      const customer = customerResult.rows[0];
      if (!customer || customer.trial_started_at) {
        return null;
      }

      // This conditional update is the one-time entitlement guard. Concurrent
      // registration retries can both read NULL above, but only one can claim it.
      const claimed = await client.query<{ id: string }>(
        `UPDATE billing_customers
         SET trial_started_at = $2, updated_at = NOW()
         WHERE id = $1 AND trial_started_at IS NULL
         RETURNING id`,
        [customer.id, startedAt.toISOString()],
      );
      if (claimed.rowCount !== 1) {
        return null;
      }

      const planResult = await client.query<{ id: string }>(
        `SELECT id FROM billing_plans WHERE slug = $1 LIMIT 1`,
        [TRIAL_PLAN_SLUG],
      );
      const trialPlanId = planResult.rows[0]?.id;
      if (!trialPlanId) {
        throw new Error('billing.errors.trialPlanMissing');
      }

      const subscriptionResult = await client.query<SubscriptionEntity>(
        `INSERT INTO billing_subscriptions
           (customer_id, plan_id, status, interval, current_period_start,
            current_period_end, trial_ends_at, metadata)
         VALUES ($1, $2, 'trialing', 'monthly', $3, $4, $4, '{}'::jsonb)
         RETURNING *`,
        [customer.id, trialPlanId, startedAt.toISOString(), trialEndsAt.toISOString()],
      );
      const subscription = subscriptionResult.rows[0];
      if (!subscription) {
        throw new Error('billing.errors.trialCreateFailed');
      }
      return this.mapSubscription(subscription);
    });
  }

  async expireElapsedTrials(): Promise<number> {
    return this.databaseService.transaction(async (client) => {
      const expired = await client.query<{ id: string }>(
        `UPDATE billing_subscriptions
         SET status = 'ended', ended_at = COALESCE(ended_at, trial_ends_at), updated_at = NOW()
         WHERE status = 'trialing' AND trial_ends_at <= NOW()
         RETURNING id`,
      );
      const subscriptionIds = expired.rows.map((row) => row.id);
      if (subscriptionIds.length > 0) {
        await client.query(
          `UPDATE billing_usage_periods
           SET status = 'closed', closed_at = COALESCE(closed_at, NOW()), updated_at = NOW()
           WHERE subscription_id = ANY($1::uuid[]) AND status = 'open'`,
          [subscriptionIds],
        );
      }
      return subscriptionIds.length;
    });
  }

  async ensureLocalCustomer(
    userId: string,
    billingEmail: string | null,
    client?: PoolClient,
  ): Promise<BillingCustomerDto> {
    const existing = await this.findCustomerByUserId(userId, client);
    if (existing) {return existing;}
    const rows = await this.run<CustomerEntity>(
      `INSERT INTO billing_customers (user_id, provider, billing_email)
       VALUES ($1, 'local', $2)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId, billingEmail],
      client,
    );
    return this.mapCustomer(rows[0]);
  }

  /**
   * Link a local billing_customers row to its real provider-side customer id.
   * Without this, `provider` stays 'local' forever (ensureLocalCustomer never
   * updates it) and findCustomerByProviderId() can never resolve a webhook's
   * customer id back to a user — every subscription event would be silently
   * ignored as `no_customer`. Called from the webhook applier the first time
   * an event carries both our userId and the provider's customer id (Stripe:
   * `checkout.session.completed`'s `client_reference_id` + `customer`).
   * One row per user (unique on user_id), so this is a plain UPDATE — no
   * upsert/conflict handling needed. Idempotent: re-running with the same
   * values is a no-op write.
   */
  async linkProviderCustomer(
    userId: string,
    provider: string,
    providerCustomerId: string,
    client?: PoolClient,
  ): Promise<void> {
    await this.run(
      `UPDATE billing_customers
       SET provider = $2, provider_customer_id = $3, updated_at = NOW()
       WHERE user_id = $1`,
      [userId, provider, providerCustomerId],
      client,
    );
  }

  /**
   * Run `fn` while holding a Postgres advisory lock scoped to this user, for
   * the duration of `fn` (released when the wrapping transaction ends,
   * whether it commits or the callback throws — `pg_advisory_xact_lock`
   * cannot be left held by a crashed process).
   *
   * Used by BillingService.createCheckout/createAddonCheckout to serialize
   * Stripe-customer resolution, and by changePlan to serialize the whole
   * resolve-decide-mutate sequence: two concurrent checkouts for a brand-new
   * user (no linked provider customer yet) must not each read "no customer"
   * and each mint a separate Stripe customer — billing_customers.user_id is
   * UNIQUE, so whichever linkProviderCustomer call lands second silently
   * overwrites the first's link, orphaning the first (now-unreferenced)
   * Stripe customer, and any subscription created under it, from all local
   * tracking. This is the same class of bug
   * subscription-integrity.guard.spec.ts exists to prevent.
   *
   * Same shape as reserveSlotsBulk (DatabaseService.transaction +
   * pg_advisory_xact_lock), a different key space (billingCustomerLockKey,
   * not advisoryLockKey — see that function's doc for why).
   *
   * `fn` receives the LOCKED client and should pass it to every repository
   * call it makes inside the critical section, rather than letting those
   * calls fall back to their default pooled connection. `transaction` already
   * holds one connection from the pool for the advisory lock itself; a
   * repository call inside `fn` that ignores this client checks out a SECOND
   * connection from the same pool for the duration of the lock — at high
   * concurrency (many users each holding their own lock + a second borrowed
   * connection) that can starve the pool for unrelated requests. `fn` is
   * still free to make an external call (Stripe) in between — the lock only
   * needs to stay held while `fn` runs, whatever mix of DB and network work
   * that involves.
   */
  async withUserBillingLock<T>(
    userId: string,
    fn: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    return this.databaseService.transaction(async (client) => {
      const { key1, key2 } = billingCustomerLockKey(userId);
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [key1, key2]);
      return fn(client);
    });
  }

  // -------------------------------------------------------------------------
  // eBay trial ledger (migration 084) — one free trial per eBay store, ever
  // -------------------------------------------------------------------------

  /**
   * Record that this eBay store has consumed its one free trial, and report
   * whether the claim was new.
   *
   * The INSERT ... ON CONFLICT DO NOTHING is the enforcement: the table's
   * primary key is (seller_id, marketplace_id), so a second attempt for the
   * same store returns rowCount 0 no matter how many user accounts have been
   * created in between. That is the whole point of the ledger — it outlives
   * the `ebay_accounts` row, which is ON DELETE CASCADE from users and would
   * otherwise release the store for a fresh trial when an account is deleted.
   *
   * Returns true when this call consumed the store's trial (first time), false
   * when it had already been consumed.
   */
  async claimEbayTrial(sellerId: string, marketplaceId: string, userId: string): Promise<boolean> {
    const rows = await this.databaseService.query<{ seller_id: string }>(
      `INSERT INTO ebay_trial_ledger (seller_id, marketplace_id, first_user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (seller_id, marketplace_id) DO NOTHING
       RETURNING seller_id`,
      [sellerId, marketplaceId, userId],
    );
    return rows.length > 0;
  }

  /**
   * Whether the user holds an entitlement that is NOT the free trial — i.e. a
   * real subscription that has been paid for. Used to decide whether a store
   * whose trial is already spent may still be connected: a paying customer is
   * always allowed, only a second free ride is refused.
   */
  async hasPaidSubscription(userId: string): Promise<boolean> {
    const rows = await this.databaseService.query<{ id: string }>(
      `SELECT s.id
       FROM billing_subscriptions s
       JOIN billing_customers c ON c.id = s.customer_id
       JOIN billing_plans p ON p.id = s.plan_id
       WHERE c.user_id = $1
         AND p.slug <> $2
         AND s.status IN ('active', 'trialing', 'past_due')
       LIMIT 1`,
      [userId, TRIAL_PLAN_SLUG],
    );
    return rows.length > 0;
  }

  // -------------------------------------------------------------------------
  // Quota enforcement — reservation count / reserve / release
  // -------------------------------------------------------------------------
  // These methods operate on the phase-1 reservation ledger tables
  // (billing_listing_reservations, billing_ao_reservations). The enforcement
  // service (QuotaEnforcementService) composes them with the limit resolution
  // + config bypass to implement the create/publish/AO gates.
  //
  // Idempotency: every reservation has a UNIQUE(subscription_id, source_key).
  // Re-reserving the same key is a no-op (ON CONFLICT DO NOTHING) so BullMQ
  // retries and order-sync re-enqueues never double-count.
  //
  // Lifecycle:
  //   reserve  → INSERT ... ON CONFLICT DO NOTHING (status='reserved')
  //   consume  → leave as 'reserved' (counts for the billing period)
  //   release  → UPDATE the row → 'released' (no longer counts)

  /**
   * Count outstanding 'reserved' rows for a (subscription, kind). This is the
   * "in-use" total the gate checks against. For listings, also counts ACTIVE
   * listings (a published listing occupies a slot even if its reservation row
   * was released — the listing itself is the entitlement). For AO, only
   * reserved rows count (placed orders keep their 'reserved' row).
   */
  async countReservedSlots(
    subscriptionId: string,
    kind: BillingLimitKey,
    usagePeriodId: string | null,
    client?: PoolClient,
  ): Promise<number> {
    if (kind === BillingLimitKey.LISTINGS_PER_MONTH) {
      // Listings are a LEVEL: only the in-flight reservations are counted here
      // (a bulk create can be minutes long and must not oversell), while the
      // durable half of the number is the ACTIVE listing rows themselves —
      // added by the caller via countActiveListings. No period filter: the
      // calendar does not reset how many listings you have.
      const q = await this.run<{ cnt: string }>(
        `SELECT COUNT(*)::text AS cnt FROM billing_listing_reservations
          WHERE subscription_id = $1 AND status = 'reserved'`,
        [subscriptionId],
        client,
      );
      return Number(q[0]?.cnt ?? 0);
    }

    // Automatic orders are a monthly FLOW, so the count MUST be scoped to the
    // current period. It never was: `usage_period_id` was written on every
    // reservation and then filtered on by nothing, so rows accumulated for the
    // life of the subscription and the monthly allowance never reset.
    //
    // A null period means one could not be opened (see ensureOpenUsagePeriod's
    // fail-soft path). Counting every row would then wrongly block the seller,
    // so the unscoped count is deliberately NOT the fallback — an unknown
    // period yields 0 used, i.e. the gate opens. Bookkeeping trouble must not
    // read as quota exhaustion.
    if (!usagePeriodId) {
      return 0;
    }
    const q = await this.run<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM billing_ao_reservations
        WHERE subscription_id = $1 AND status = 'reserved'
          AND usage_period_id = $2`,
      [subscriptionId, usagePeriodId],
      client,
    );
    return Number(q[0]?.cnt ?? 0);
  }

  /**
   * Idempotently reserve a single slot. Returns true if a NEW reservation was
   * created, false if one already existed for the same source_key (idempotent
   * re-reserve). No advisory lock — single-row insert; the UNIQUE constraint
   * provides atomicity. Used by AO reserve + single publish.
   */
  async reserveSlot(
    subscriptionId: string,
    kind: BillingLimitKey,
    sourceKey: string,
    ref: { listingId?: string | null; ebayOrderId?: string | null },
    usagePeriodId: string | null,
    client?: PoolClient,
  ): Promise<boolean> {
    // The two reservation ledgers carry different ref columns:
    // billing_listing_reservations has listing_id (no ebay_order_id),
    // billing_ao_reservations has ebay_order_id (no listing_id). A single
    // column list naming both fails on whichever table lacks one — so the
    // ref column + value are branched per kind, mirroring reserveSlotsBulk.
    const isListing = kind === BillingLimitKey.LISTINGS_PER_MONTH;
    const table = isListing
      ? 'billing_listing_reservations'
      : 'billing_ao_reservations';
    const refColumn = isListing ? 'listing_id' : 'ebay_order_id';
    const refValue = isListing ? (ref.listingId ?? null) : (ref.ebayOrderId ?? null);
    const q = await this.run<{ inserted: boolean }>(
      `INSERT INTO ${table}
         (subscription_id, source_key, ${refColumn}, usage_period_id, status)
       VALUES ($1, $2, $3, $4, 'reserved')
       ON CONFLICT (subscription_id, source_key) DO UPDATE SET
         updated_at = NOW()
       RETURNING (xmax = 0) AS inserted`,
      [subscriptionId, sourceKey, refValue, usagePeriodId],
      client,
    );
    return Boolean(q[0]?.inserted);
  }

  /**
   * Race-safe bulk reserve for listing creates. Takes a transaction-scoped
   * advisory lock on (subscription_id, kind) so a concurrent burst serialises;
   * the count+reserve happens atomically. Returns the count of newly-reserved
   * rows (existing reservations for the same source_keys are reused — no-op).
   */
  async reserveSlotsBulk(
    subscriptionId: string,
    kind: BillingLimitKey,
    sourceKeys: string[],
    usagePeriodId: string | null,
  ): Promise<number> {
    if (sourceKeys.length === 0) {
      return 0;
    }
    return this.databaseService.transaction(async (client) => {
      const { key1, key2 } = advisoryLockKey(subscriptionId, kind);
      await client.query('SELECT pg_advisory_xact_lock($1, $2)', [key1, key2]);
      let reserved = 0;
      for (const sourceKey of sourceKeys) {
        const rows = await client.query<{ inserted: boolean }>(
          `INSERT INTO billing_listing_reservations
             (subscription_id, source_key, usage_period_id, status)
           VALUES ($1, $2, $3, 'reserved')
           ON CONFLICT (subscription_id, source_key) DO UPDATE SET
             updated_at = NOW()
           RETURNING (xmax = 0) AS inserted`,
          [subscriptionId, sourceKey, usagePeriodId],
        );
        if (rows.rows[0]?.inserted) {
          reserved++;
        }
      }
      return reserved;
    });
  }

  /**
   * Release a reservation (permanent failure path). Updates the row to
   * 'released' so it no longer counts against the quota. Idempotent: no-op if
   * already released or no row exists.
   */
  async releaseSlot(
    subscriptionId: string,
    kind: BillingLimitKey,
    sourceKey: string,
  ): Promise<void> {
    const table =
      kind === BillingLimitKey.LISTINGS_PER_MONTH
        ? 'billing_listing_reservations'
        : 'billing_ao_reservations';
    try {
      await this.databaseService.query(
        `UPDATE ${table}
           SET status = 'released', updated_at = NOW()
         WHERE subscription_id = $1
           AND source_key = $2
           AND status = 'reserved'`,
        [subscriptionId, sourceKey],
      );
    } catch (err) {
      this.logger.warn(
        `releaseSlot failed (table=${table}, source_key=${sourceKey}): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Resolve the effective limit value for a (subscription, kind): reads the
   * subscription's plan → billing_plan_limits. Returns -1 (unlimited) when the
   * limit_key is absent for the plan (fail-open — a missing limit means
   * unlimited, not disabled).
   */
  async resolveLimitValue(
    subscriptionId: string,
    kind: BillingLimitKey,
  ): Promise<number | null> {
    const rows = await this.databaseService.query<{ limit_value: string }>(
      `SELECT l.limit_value::text AS limit_value
         FROM billing_plan_limits l
         JOIN billing_subscriptions s ON s.plan_id = l.plan_id
        WHERE s.id = $1 AND l.limit_key = $2`,
      [subscriptionId, kind],
    );
    if (rows.length === 0) {
      return null;
    }
    return Number(rows[0].limit_value);
  }

  /**
   * Run a query either on the pool or on a provided transaction client.
   *
   * `params` takes the same shape `DatabaseService.query` does (scalars OR
   * arrays — an array param is how e.g. `findPricesForPlans` sends
   * `ANY($1::uuid[])` in one round trip), not the narrower scalar-only type
   * this used to declare, which happened to be enough for every call site
   * that existed before methods like `findPlanById`/`findPricesForPlans`
   * needed to take a client too (see `withUserBillingLock`'s doc).
   */
  private async run<T>(
    text: string,
    params: QueryParam[],
    client?: PoolClient,
  ): Promise<T[]> {
    if (client) {
      const result = await client.query(text, params);
      return result.rows as T[];
    }
    return this.databaseService.query<T>(text, params);
  }

  // -------------------------------------------------------------------------
  // Mappers
  // -------------------------------------------------------------------------

  private mapCustomer(row: CustomerEntity): BillingCustomerDto {
    return {
      id: row.id,
      userId: row.user_id,
      providerCustomerId: row.provider_customer_id,
      provider: row.provider,
      status: row.status as BillingCustomerDto['status'],
      billingEmail: row.billing_email,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapSubscription(row: SubscriptionEntity): BillingSubscriptionDto {
    return {
      id: row.id,
      customerId: row.customer_id,
      planId: row.plan_id,
      status: row.status as BillingSubscriptionStatus,
      interval: row.interval as BillingSubscriptionDto['interval'],
      currentPeriodStart: row.current_period_start.toISOString(),
      currentPeriodEnd: row.current_period_end.toISOString(),
      canceledAt: row.canceled_at ? row.canceled_at.toISOString() : null,
      endedAt: row.ended_at ? row.ended_at.toISOString() : null,
      trialEndsAt: row.trial_ends_at ? row.trial_ends_at.toISOString() : null,
      providerSubscriptionId: row.provider_subscription_id,
      metadata: row.metadata,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapUsagePeriod(row: UsagePeriodEntity): BillingUsagePeriodDto {
    return {
      id: row.id,
      subscriptionId: row.subscription_id,
      limitKey: row.limit_key,
      periodStart: row.period_start.toISOString(),
      periodEnd: row.period_end.toISOString(),
      usedQty: Number(row.used_qty),
      limitValueSnapshot: Number(row.limit_value_snapshot),
      status: row.status as BillingUsagePeriodStatus,
      closedAt: row.closed_at ? row.closed_at.toISOString() : null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private mapWebhook(row: WebhookEntity): BillingWebhookDto {
    return {
      id: row.id,
      provider: row.provider,
      providerEventId: row.provider_event_id,
      eventType: row.event_type,
      payload: row.payload,
      status: row.status as BillingWebhookStatus,
      processingStartedAt: row.processing_started_at ? row.processing_started_at.toISOString() : null,
      processedAt: row.processed_at ? row.processed_at.toISOString() : null,
      error: row.error,
      attempts: row.attempts,
      receivedAt: row.received_at.toISOString(),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}

// Re-export so the module can wire the provider with config without a circular
// import on billing-helpers.
export type { BillingConfig };
