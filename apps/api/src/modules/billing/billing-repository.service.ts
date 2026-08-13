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

import { DatabaseService } from '../../common/database/database.service';

import {
  expandPlan,
  mapLimitRow,
  mapPlanRow,
  mapPriceRow,
  type BillingConfig,
} from './billing-helpers';
import type { ParsedPaddleEvent } from './billing.types';
import { advisoryLockKey } from './quota-helpers';


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

  async findPricesForPlans(planIds: string[]): Promise<BillingPlanPriceDto[]> {
    if (planIds.length === 0) {return [];}
    const rows = await this.databaseService.query<PriceEntity>(
      `SELECT * FROM billing_plan_prices WHERE plan_id = ANY($1::uuid[]) ORDER BY effective_from DESC`,
      [planIds as unknown as string],
    );
    return rows.map(mapPriceRow);
  }

  async findLimitsForPlans(planIds: string[]): Promise<BillingPlanLimitDto[]> {
    if (planIds.length === 0) {return [];}
    const rows = await this.databaseService.query<LimitEntity>(
      `SELECT * FROM billing_plan_limits WHERE plan_id = ANY($1::uuid[])`,
      [planIds as unknown as string],
    );
    return rows.map(mapLimitRow);
  }

  async findPlanById(id: string): Promise<BillingPlanDto | null> {
    const rows = await this.databaseService.query<PlanEntity>(
      `SELECT * FROM billing_plans WHERE id = $1`,
      [id],
    );
    return rows.length > 0 ? mapPlanRow(rows[0]) : null;
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

  async loadPlanWithPricing(planId: string): Promise<BillingPlanWithPricingDto | null> {
    const plan = await this.findPlanById(planId);
    if (!plan) {return null;}
    const [prices, limits] = await Promise.all([
      this.findPricesForPlans([planId]),
      this.findLimitsForPlans([planId]),
    ]);
    return expandPlan(plan, prices, limits);
  }

  // -------------------------------------------------------------------------
  // Customer + subscription reads (summary)
  // -------------------------------------------------------------------------

  async findCustomerByUserId(userId: string): Promise<BillingCustomerDto | null> {
    const rows = await this.databaseService.query<CustomerEntity>(
      `SELECT * FROM billing_customers WHERE user_id = $1`,
      [userId],
    );
    return rows.length > 0 ? this.mapCustomer(rows[0]) : null;
  }

  /**
   * Find the user's current subscription (the most recent row whose period
   * contains now, preferring active/trialing/past_due over canceled/ended).
   * Returns null when the user has no subscription at all.
   */
  async findCurrentSubscription(userId: string): Promise<BillingSubscriptionDto | null> {
    const rows = await this.databaseService.query<SubscriptionEntity>(
      `SELECT s.* FROM billing_subscriptions s
       JOIN billing_customers c ON c.id = s.customer_id
       WHERE c.user_id = $1
       ORDER BY
         CASE s.status
           WHEN 'trialing' THEN 1
           WHEN 'active' THEN 2
           WHEN 'past_due' THEN 3
           WHEN 'canceled' THEN 4
           WHEN 'ended' THEN 5
         END ASC,
         s.current_period_end DESC`,
      [userId],
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
    event: ParsedPaddleEvent,
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
   * Upsert a subscription from a Paddle event. Idempotent on
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
   * Find a customer by provider customer id (for webhook processing — the
   * Paddle event carries the provider customer id, not our user_id).
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
   * redirecting to Paddle. Idempotent on user_id.
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
        `SELECT id FROM billing_plans WHERE slug = 'trial' LIMIT 1`,
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

  async ensureLocalCustomer(userId: string, billingEmail: string | null): Promise<BillingCustomerDto> {
    const existing = await this.findCustomerByUserId(userId);
    if (existing) {return existing;}
    const rows = await this.databaseService.query<CustomerEntity>(
      `INSERT INTO billing_customers (user_id, provider, billing_email)
       VALUES ($1, 'local', $2)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [userId, billingEmail],
    );
    return this.mapCustomer(rows[0]);
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
    client?: PoolClient,
  ): Promise<number> {
    const table =
      kind === BillingLimitKey.LISTINGS_PER_MONTH
        ? 'billing_listing_reservations'
        : 'billing_ao_reservations';
    const q = await this.run<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM ${table}
        WHERE subscription_id = $1 AND status = 'reserved'`,
      [subscriptionId],
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
    const table =
      kind === BillingLimitKey.LISTINGS_PER_MONTH
        ? 'billing_listing_reservations'
        : 'billing_ao_reservations';
    const listingCol =
      kind === BillingLimitKey.LISTINGS_PER_MONTH ? '$4' : 'NULL';
    const aoCol =
      kind === BillingLimitKey.AMAZON_ORDERS_PER_MONTH ? '$5' : 'NULL';
    const q = await this.run<{ inserted: boolean }>(
      `INSERT INTO ${table}
         (subscription_id, source_key, listing_id, ebay_order_id,
          usage_period_id, status)
       VALUES ($1, $2, ${listingCol}, ${aoCol}, $6, 'reserved')
       ON CONFLICT (subscription_id, source_key) DO UPDATE SET
         updated_at = NOW()
       RETURNING (xmax = 0) AS inserted`,
      [
        subscriptionId,
        sourceKey,
        ref.listingId ?? null,
        ref.ebayOrderId ?? null,
        ref.ebayOrderId ?? null,
        usagePeriodId,
      ],
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

  /** Run a query either on the pool or on a provided transaction client. */
  private async run<T>(
    text: string,
    params: (string | number | boolean | null | undefined)[],
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
