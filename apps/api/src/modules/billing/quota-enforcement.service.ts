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
  EntitlementState,
  PlatformSettingKey,
} from '@repo/shared';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { BillingRepositoryService } from './billing-repository.service';
import {
  buildSourceKey,
  decideQuota,
  quotaExhaustedBlockedReason,
  QuotaWindowOutcome,
  resolveEffectiveEntitlement,
  resolveQuotaWindow,
  type QuotaWindow,
} from './quota-helpers';

/**
 * Why a listing create was refused — suspension and a full quota are NOT the
 * same refusal.
 *
 * A suspended account is reported with `limitValue: 0`, so the quota check
 * refuses it too — but describing that as "50 in use (limit 0)" is nonsense
 * text for somebody whose trial simply expired, and it sends them to the wrong
 * fix (upgrade the plan, rather than pay for one). The two carry different
 * `name`s so both the HTTP layer and `classifyListingFailure` can tell them
 * apart.
 */
function buildListingRefusal(
  suspended: boolean,
  inUse: number,
  limitValue: number,
): Error {
  if (suspended) {
    const err = new Error('Subscription is not active — listing creation is suspended');
    err.name = 'SubscriptionSuspendedError';
    return err;
  }
  const err = new Error(
    `Active-listings quota exhausted: ${inUse} in use (limit ${limitValue})`,
  );
  err.name = 'QuotaExhaustedError';
  return err;
}

@Injectable()
export class QuotaEnforcementService {
  private readonly logger = new Logger(QuotaEnforcementService.name);

  constructor(
    private readonly repository: BillingRepositoryService,
    private readonly platformSettings: PlatformSettingsService,
  ) {}

  /**
   * Whether gates are active (master bypass). Resolved from platform settings
   * so an operator can turn enforcement on/off from the admin panel without a
   * restart; falls back to the BILLING_ENFORCEMENT_ENABLED env var.
   */
  async isEnabled(): Promise<boolean> {
    return this.platformSettings.getBoolean(PlatformSettingKey.BILLING_ENFORCEMENT_ENABLED);
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
    /** True when the account owes money or its entitlement has lapsed. */
    suspended: boolean;
    /** The billing window this call's usage is metered against. */
    window: QuotaWindow;
  } | null> {
    const subscription = await this.repository.findCurrentSubscription(userId);
    if (!subscription) {
      // No subscription → fail-open (unlimited). The foundation's summary
      // transition handles the 'no_subscription' UX; the gate does not block.
      return null;
    }

    const now = new Date();
    const graceHours = await this.platformSettings.getNumber(
      PlatformSettingKey.BILLING_WEBHOOK_GRACE_HOURS,
    );
    const window = resolveQuotaWindow(subscription, now, graceHours);
    if (window.outcome === QuotaWindowOutcome.UNPAID) {
      this.logger.error(
        `Subscription window for user ${userId} is stale past the grace; treating as unpaid`,
      );
    }

    // Entitlement comes BEFORE the limit. This check did not exist: the method
    // resolved a subscription and read its plan's limits without ever looking
    // at `subscription.status`, so a past_due, cancelled, or expired-trial
    // account kept the full allowance of a plan it was no longer paying for.
    // A suspended account gets a limit of 0, which every caller below already
    // knows how to refuse — no second refusal path to keep in step.
    //
    // resolveEffectiveEntitlement, not resolveEntitlementState: an `active`
    // subscription whose window has lapsed past the grace is treated as unpaid.
    // Absence of a renewal webhook is not evidence of payment.
    const entitlement = resolveEffectiveEntitlement(subscription, now, graceHours);
    if (entitlement === EntitlementState.SUSPENDED) {
      return {
        subscriptionId: subscription.id,
        usagePeriodId: null,
        limitValue: 0,
        suspended: true,
        window,
      };
    }

    // The EFFECTIVE limit — plan allowance plus any top-up bought for this
    // window. Resolving the plan limit alone here would refuse a seller who had
    // just paid for extra headroom while the billing page showed it to them.
    const { limitValue } = await this.repository.resolveEffectiveLimit(
      userId,
      subscription.id,
      kind,
      window,
    );

    // Open the current window's period on demand. Nothing had ever created one,
    // so `findOpenUsagePeriods` always returned an empty array and every
    // monthly meter counted against the whole life of the subscription instead
    // of the current window. Listings are a level, not a monthly flow, so they
    // deliberately get no period.
    let usagePeriodId: string | null = null;
    if (kind !== BillingLimitKey.LISTINGS_PER_MONTH) {
      usagePeriodId = await this.repository.ensureOpenUsagePeriod(
        subscription.id,
        kind,
        limitValue ?? -1,
        window,
      );
    }

    return {
      subscriptionId: subscription.id,
      usagePeriodId,
      limitValue,
      suspended: false,
      window,
    };
  }

  /**
   * Listing slots in use = ACTIVE listings + reservations still in flight.
   *
   * The two halves answer different questions and neither alone is right. The
   * listing rows are the durable entitlement (and are what a deletion frees);
   * the reservations cover the minutes a bulk create is running, during which
   * no listing row exists yet and a second concurrent batch would otherwise
   * oversell. A reservation is released the moment its listing goes ACTIVE, so
   * the same listing is never counted twice.
   */
  private async countListingUsage(userId: string, subscriptionId: string): Promise<number> {
    const [active, inFlight] = await Promise.all([
      this.repository.countActiveListings(userId),
      this.repository.countReservedSlots(subscriptionId, BillingLimitKey.LISTINGS_PER_MONTH, null),
    ]);
    return active + inFlight;
  }

  /**
   * Ask whether one more tracking conversion may be performed this month.
   *
   * Deliberately shaped differently from the listing and AO gates, because the
   * consequence is different. Exhausting listings or orders BLOCKS work;
   * exhausting conversions must not — the order still ships and eBay still gets
   * a tracking number, it is just the raw Amazon one. So this returns a plain
   * boolean for the caller to degrade on, and never throws.
   *
   * There is no reservation ledger here: a conversion is one synchronous act
   * with a durable record (`orders.tracking_converted_at`), so the count is
   * read from the orders themselves and cannot drift from what really
   * happened. The advisory lock is held by the caller across count-then-convert
   * so two concurrent shipments cannot both pass the last slot.
   *
   * Fail-open on any error: an unreadable quota must not silently un-hide the
   * seller's supplier, which is the outcome they are paying to avoid.
   */
  async canConvertTracking(userId: string): Promise<{
    allowed: boolean;
    used: number;
    limitValue: number | null;
  }> {
    if (!(await this.isEnabled())) {
      return { allowed: true, used: 0, limitValue: null };
    }
    try {
      const ctx = await this.resolveSubscriptionContext(
        userId,
        BillingLimitKey.TRACKING_CONVERSIONS_PER_MONTH,
      );
      if (!ctx) {
        return { allowed: true, used: 0, limitValue: null };
      }
      if (ctx.suspended) {
        return { allowed: false, used: 0, limitValue: 0 };
      }
      if (ctx.limitValue === null || ctx.limitValue === -1) {
        return { allowed: true, used: 0, limitValue: ctx.limitValue };
      }
      const used = await this.repository.countConversionsInWindow(userId, ctx.window);
      const decision = decideQuota({
        inUse: used,
        limitValue: ctx.limitValue,
        requested: 1,
      });
      return { allowed: decision.allowed, used, limitValue: ctx.limitValue };
    } catch (err) {
      this.logger.warn(
        `Conversion quota check failed for user ${userId}, allowing: ${(err as Error).message}`,
      );
      return { allowed: true, used: 0, limitValue: null };
    }
  }

  /**
   * Whether the account's entitlement is suspended (money owed, cancelled, or
   * an expired trial). Used by the cost-bearing pipelines that have no quota of
   * their own to gate on. Fail-open: a billing outage must not stop a paying
   * seller's automation.
   */
  async isSuspended(userId: string): Promise<boolean> {
    if (!(await this.isEnabled())) {
      return false;
    }
    try {
      const now = new Date();
      const graceHours = await this.platformSettings.getNumber(
        PlatformSettingKey.BILLING_WEBHOOK_GRACE_HOURS,
      );
      const subscription = await this.repository.findCurrentSubscription(userId);
      const window = resolveQuotaWindow(subscription, now, graceHours);
      if (window.outcome === QuotaWindowOutcome.UNPAID) {
        this.logger.error(
          `Subscription window for user ${userId} is stale past the grace; treating as unpaid`,
        );
      }
      // resolveEffectiveEntitlement, not resolveEntitlementState: an `active`
      // subscription whose window has lapsed past the grace is treated as
      // unpaid. Absence of a renewal webhook is not evidence of payment.
      return (
        resolveEffectiveEntitlement(subscription, now, graceHours) === EntitlementState.SUSPENDED
      );
    } catch (err) {
      this.logger.warn(
        `Entitlement check failed for user ${userId}, allowing: ${(err as Error).message}`,
      );
      return false;
    }
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
    if (!(await this.isEnabled()) || listingJobItemIds.length === 0) {
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
    const inUse = await this.countListingUsage(userId, ctx.subscriptionId);
    const decision = decideQuota({
      inUse,
      limitValue: ctx.limitValue,
      requested: listingJobItemIds.length,
    });
    if (!decision.allowed) {
      throw buildListingRefusal(ctx.suspended, inUse, ctx.limitValue);
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
    if (!(await this.isEnabled())) {
      return;
    }
    const ctx = await this.resolveSubscriptionContext(
      userId,
      BillingLimitKey.LISTINGS_PER_MONTH,
    );
    if (!ctx || ctx.limitValue === null || ctx.limitValue === -1) {
      return;
    }
    const inUse = await this.countListingUsage(userId, ctx.subscriptionId);
    const decision = decideQuota({
      inUse,
      limitValue: ctx.limitValue,
      requested: 1,
    });
    if (!decision.allowed) {
      throw buildListingRefusal(ctx.suspended, inUse, ctx.limitValue);
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
   * Hand a successful create's slot over from the reservation to the listing.
   *
   * This used to be a no-op that left the row 'reserved' forever, and that is
   * what made the listing quota a ratchet: nothing released a slot when a
   * listing was ended, so the count could only climb and a seller could never
   * free room by deleting a listing. Now the reservation covers only the
   * in-flight window and the ACTIVE listing row is the durable entitlement, so
   * ending a listing frees its slot with no release call to remember.
   *
   * Releasing on success is therefore not "giving the slot back" — the listing
   * is still counted, by countActiveListings. Idempotent + fail-soft.
   */
  async consumeForCreate(userId: string, listingJobItemId: string): Promise<void> {
    await this.releaseForCreate(userId, listingJobItemId);
  }

  /** Hand the publish reservation over to the ACTIVE listing row. Idempotent. */
  async consumeForPublish(userId: string, listingId: string): Promise<void> {
    await this.releaseForPublish(userId, listingId);
  }

  /**
   * Release the create reservation for a job-item on PERMANENT worker failure
   * (terminal ERROR). Intermediate RETRYING holds the reservation so a BullMQ
   * retry doesn't oversell. Fail-soft + idempotent.
   */
  async releaseForCreate(userId: string, listingJobItemId: string): Promise<void> {
    if (!(await this.isEnabled())) {
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
    if (!(await this.isEnabled())) {
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
    if (!(await this.isEnabled())) {
      return { allowed: true };
    }
    const ctx = await this.resolveSubscriptionContext(
      userId,
      BillingLimitKey.AMAZON_ORDERS_PER_MONTH,
    );
    if (ctx?.suspended) {
      // Reported separately from quota exhaustion on purpose: the two need
      // different actions from the seller ("pay the invoice" vs "upgrade the
      // plan"), and no reservation is created because nothing is being held —
      // there is no slot to give back when they pay, the gate simply reopens.
      this.logger.warn(
        `Auto-fulfill refused for user ${userId} (ebay_order_id=${ebayOrderId}): subscription suspended`,
      );
      return {
        allowed: false,
        blockedReason: AutoFulfillBlockedReason.SUBSCRIPTION_SUSPENDED,
      };
    }
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
      ctx.usagePeriodId,
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
  }

  /**
   * Release the AO reservation on BLOCKED or final FAILED. Idempotent. Called
   * from AmazonCheckoutService.block and from AutoFulfillProcessor on the last
   * attempt.
   */
  async releaseAmazonOrder(userId: string, ebayOrderId: string): Promise<void> {
    if (!(await this.isEnabled())) {
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
