// apps/api/src/modules/billing/quota-enforcement.service.ts
//
// High-level quota enforcement gate consumed by the listings + orders + amazon
// modules. Each method is a no-op when BILLING_ENFORCEMENT_ENABLED is false
// (the master bypass, resolved via the foundation's resolveBillingConfig).
//
// When enabled, the gate:
//   1. Resolves userId → current subscription → open usage period (fail-open:
//      no subscription = unlimited, since the foundation's summary transition
//      is 'full_access' when enforcement is off and 'no_subscription' when on
//      but no row — in the latter case the gate still allows so a brand-new
//      user isn't locked out before checkout).
//   2. Resolves the limit value from the plan's billing_plan_limits.
//   3. Counts reserved slots + decides.
//   4. Reserves (race-safe advisory lock for bulk create) or returns a blocked
//      reason (for AO, surfaces as AutoFulfillBlockedReason.QUOTA_EXHAUSTED).
//
// Built on the phase-1 foundation: uses BillingRepositoryService for all DB
// access, the foundation's enums (BillingLimitKey, BillingReservationStatus),
// and resolveBillingConfig for the bypass. No separate schema/module.

import { Injectable, Logger } from '@nestjs/common';
import {
  AutoFulfillBlockedReason,
  BillingLimitKey,
} from '@repo/shared';

import { BillingRepositoryService } from './billing-repository.service';
import {
  buildSourceKey,
  decideQuota,
  isEnforcementEnabled,
  quotaExhaustedBlockedReason,
} from './quota-helpers';

@Injectable()
export class QuotaEnforcementService {
  private readonly logger = new Logger(QuotaEnforcementService.name);

  constructor(private readonly repository: BillingRepositoryService) {}

  /** Whether gates are active (master bypass). Exposed for callers/tests. */
  isEnabled(): boolean {
    return isEnforcementEnabled();
  }

  /**
   * Resolve the subscription + open usage period for a user. Returns null
   * (fail-open: treat as unlimited) when the user has no subscription — a
   * brand-new user isn't locked out before checkout. The caller checks the
   * returned limitValue: null = unlimited (no limit row / no subscription).
   */
  private async resolveSubscriptionContext(
    userId: string,
    kind: BillingLimitKey,
  ): Promise<{
    subscriptionId: string;
    usagePeriodId: string | null;
    limitValue: number | null;
  } | null> {
    const subscription = await this.repository.findCurrentSubscription(userId);
    if (!subscription) {
      // No subscription → fail-open (unlimited). The foundation's summary
      // transition handles the 'no_subscription' UX; the gate does not block.
      return null;
    }
    const periods = await this.repository.findOpenUsagePeriods(subscription.id);
    // Find the open period for this limit_key; if none, usagePeriodId is null
    // (the reservation will still be created, just not linked to a period).
    const period = periods.find((p) => (p.limitKey as BillingLimitKey) === kind);
    const limitValue = await this.repository.resolveLimitValue(subscription.id, kind);
    return {
      subscriptionId: subscription.id,
      usagePeriodId: period?.id ?? null,
      limitValue,
    };
  }

  /**
   * Reserve N listing slots for a bulk non-draft create. Race-safe (advisory-
   * locked inside reserveSlotsBulk). Throws QuotaExhaustedError iff the limit
   * would be exceeded AND enforcement is on AND the user has a subscription
   * with a finite limit.
   */
  async reserveForBulkCreate(
    userId: string,
    listingJobItemIds: string[],
  ): Promise<void> {
    if (!this.isEnabled() || listingJobItemIds.length === 0) {
      return;
    }
    const ctx = await this.resolveSubscriptionContext(
      userId,
      BillingLimitKey.LISTINGS_PER_MONTH,
    );
    if (!ctx || ctx.limitValue === null || ctx.limitValue === -1) {
      // No subscription or unlimited limit → no gate.
      return;
    }
    const inUse = await this.repository.countReservedSlots(
      ctx.subscriptionId,
      BillingLimitKey.LISTINGS_PER_MONTH,
    );
    const decision = decideQuota({
      inUse,
      limitValue: ctx.limitValue,
      requested: listingJobItemIds.length,
    });
    if (!decision.allowed) {
      const err = new Error(
        `Active-listings quota exhausted: ${inUse} in use (limit ${ctx.limitValue})`,
      );
      err.name = 'QuotaExhaustedError';
      throw err;
    }
    const sourceKeys = listingJobItemIds.map((id) =>
      buildSourceKey(BillingLimitKey.LISTINGS_PER_MONTH, { listingJobItemId: id }),
    );
    await this.repository.reserveSlotsBulk(
      ctx.subscriptionId,
      BillingLimitKey.LISTINGS_PER_MONTH,
      sourceKeys,
      ctx.usagePeriodId,
    );
  }

  /**
   * Reserve a single listing slot for publish (draft → active). Race-safe.
   * Throws QuotaExhaustedError on exhaustion.
   */
  async reserveForPublish(userId: string, listingId: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    const ctx = await this.resolveSubscriptionContext(
      userId,
      BillingLimitKey.LISTINGS_PER_MONTH,
    );
    if (!ctx || ctx.limitValue === null || ctx.limitValue === -1) {
      return;
    }
    const inUse = await this.repository.countReservedSlots(
      ctx.subscriptionId,
      BillingLimitKey.LISTINGS_PER_MONTH,
    );
    const decision = decideQuota({
      inUse,
      limitValue: ctx.limitValue,
      requested: 1,
    });
    if (!decision.allowed) {
      const err = new Error(
        `Active-listings quota exhausted: ${inUse} in use (limit ${ctx.limitValue})`,
      );
      err.name = 'QuotaExhaustedError';
      throw err;
    }
    const sourceKey = buildSourceKey(BillingLimitKey.LISTINGS_PER_MONTH, { listingId });
    await this.repository.reserveSlot(
      ctx.subscriptionId,
      BillingLimitKey.LISTINGS_PER_MONTH,
      sourceKey,
      { listingId },
      ctx.usagePeriodId,
    );
  }

  /**
   * Consume the create reservation for a job-item on worker success. In the
   * foundation's ledger model, "consume" = leave the row as 'reserved' (it
   * counts for the billing period). So this is a no-op confirmation — the
   * reservation already exists and stays. Idempotent + fail-soft.
   */
  consumeForCreate(_userId: string, _listingJobItemId: string): void {
    // No DB write needed: the 'reserved' row inserted at enqueue already
    // counts, and stays counted for the billing period. The listing row
    // itself is the entitlement. Kept as a seam for future per-event metering.
    // (Synchronous no-op — callers `await` it, which is harmless on void.)
    if (!this.isEnabled()) {
      return;
    }
  }

  /** Consume the publish reservation on successful publish. Idempotent. */
  consumeForPublish(_userId: string, _listingId: string): void {
    // Same as consumeForCreate — the 'reserved' row stays counted.
    if (!this.isEnabled()) {
      return;
    }
  }

  /**
   * Release the create reservation for a job-item on PERMANENT worker failure
   * (terminal ERROR). Intermediate RETRYING holds the reservation so a BullMQ
   * retry doesn't oversell. Fail-soft + idempotent.
   */
  async releaseForCreate(userId: string, listingJobItemId: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    const ctx = await this.resolveSubscriptionContext(
      userId,
      BillingLimitKey.LISTINGS_PER_MONTH,
    );
    if (!ctx) {
      return;
    }
    const sourceKey = buildSourceKey(BillingLimitKey.LISTINGS_PER_MONTH, {
      listingJobItemId,
    });
    await this.repository.releaseSlot(
      ctx.subscriptionId,
      BillingLimitKey.LISTINGS_PER_MONTH,
      sourceKey,
    );
  }

  /** Release the publish reservation on permanent publish failure. Idempotent. */
  async releaseForPublish(userId: string, listingId: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    const ctx = await this.resolveSubscriptionContext(
      userId,
      BillingLimitKey.LISTINGS_PER_MONTH,
    );
    if (!ctx) {
      return;
    }
    const sourceKey = buildSourceKey(BillingLimitKey.LISTINGS_PER_MONTH, { listingId });
    await this.repository.releaseSlot(
      ctx.subscriptionId,
      BillingLimitKey.LISTINGS_PER_MONTH,
      sourceKey,
    );
  }

  // -------------------------------------------------------------------------
  // AO (Amazon Orders) monthly quota
  // -------------------------------------------------------------------------

  /**
   * Idempotently reserve an AO slot for an eBay order before enqueue. Returns a
   * result describing whether the operation may proceed and, if not, the
   * blocked reason to persist on the order.
   *
   * Idempotency: if a reservation already exists for this ebayOrderId (a
   * re-enqueue from order-sync), this returns allowed=true without creating a
   * second row. The count check is skipped on the idempotent path so a retry
   * never fails on a quota that was already reserved.
   */
  async reserveAmazonOrder(
    userId: string,
    ebayOrderId: string,
  ): Promise<{
    allowed: boolean;
    blockedReason?: AutoFulfillBlockedReason;
  }> {
    if (!this.isEnabled()) {
      return { allowed: true };
    }
    const ctx = await this.resolveSubscriptionContext(
      userId,
      BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
    );
    if (!ctx || ctx.limitValue === null || ctx.limitValue === -1) {
      return { allowed: true };
    }
    const sourceKey = buildSourceKey(BillingLimitKey.AMAZON_ORDERS_PER_MONTH, {
      ebayOrderId,
    });
    // Idempotent reserve first — if a row already exists, this is a re-enqueue
    // and we let it proceed (the hold is already counted).
    const created = await this.repository.reserveSlot(
      ctx.subscriptionId,
      BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
      sourceKey,
      { ebayOrderId },
      ctx.usagePeriodId,
    );
    if (!created) {
      return { allowed: true };
    }
    // Fresh reservation: check the limit. If over, release the row we just
    // created and return blocked.
    const inUse = await this.repository.countReservedSlots(
      ctx.subscriptionId,
      BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
    );
    const decision = decideQuota({
      inUse,
      limitValue: ctx.limitValue,
      requested: 1,
    });
    if (decision.allowed) {
      return { allowed: true };
    }
    // Over quota — release the reservation we just created and surface blocked.
    await this.repository.releaseSlot(
      ctx.subscriptionId,
      BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
      sourceKey,
    );
    this.logger.warn(
      `AO quota exhausted for user ${userId} (ebay_order_id=${ebayOrderId}): ${inUse} in use (limit ${ctx.limitValue})`,
    );
    return {
      allowed: false,
      blockedReason: quotaExhaustedBlockedReason(),
    };
  }

  /**
   * Consume the AO reservation on a confirmed PLACED outcome. In the
   * foundation's ledger model, "consume" = leave as 'reserved' (it counts for
   * the billing period). Idempotent + fail-soft.
   */
  consumeAmazonOrder(_userId: string, _ebayOrderId: string): void {
    // No DB write: the 'reserved' row stays counted. Kept as a seam.
    // (Synchronous no-op — callers `await` it, which is harmless on void.)
    if (!this.isEnabled()) {
      return;
    }
  }

  /**
   * Release the AO reservation on BLOCKED or final FAILED. Idempotent. Called
   * from AmazonCheckoutService.block and from AutoFulfillProcessor on the last
   * attempt.
   */
  async releaseAmazonOrder(userId: string, ebayOrderId: string): Promise<void> {
    if (!this.isEnabled()) {
      return;
    }
    const ctx = await this.resolveSubscriptionContext(
      userId,
      BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
    );
    if (!ctx) {
      return;
    }
    const sourceKey = buildSourceKey(BillingLimitKey.AMAZON_ORDERS_PER_MONTH, {
      ebayOrderId,
    });
    await this.repository.releaseSlot(
      ctx.subscriptionId,
      BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
      sourceKey,
    );
  }
}
