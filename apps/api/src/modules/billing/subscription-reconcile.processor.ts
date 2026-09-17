import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';
import type { Job, Queue } from 'bullmq';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import type { BillingProviderPort } from './billing-provider';
import { BillingRepositoryService } from './billing-repository.service';
import { BILLING_PROVIDER_TOKEN } from './billing.tokens';
import { extractStripeSubscriptionFields } from './stripe-event-applier';
import { buildReconcileEvent, resolveReconcilePlanId } from './subscription-reconcile';

export const BILLING_RECONCILE_QUEUE = 'billing-subscription-reconcile';
const BILLING_RECONCILE_JOB = 'reconcile-subscriptions';
const DEFAULT_RECONCILE_CRON = '41 * * * *';

/**
 * Hourly safety net for subscriptions whose paid period has run out locally.
 *
 * WHY THIS HAS TO EXIST. Entitlement is resolved at READ time: a subscription
 * whose `current_period_end` is past, plus the webhook grace, resolves to
 * UNPAID and the account is suspended — because the absence of a renewal
 * webhook is not evidence of payment. That rule is right, and it has a sharp
 * edge: the same thing happens when the webhook never arrives for a reason that
 * has nothing to do with the seller. A wrong `STRIPE_WEBHOOK_SECRET`, an
 * endpoint disabled in the Dashboard, a Stripe delivery incident — any of them
 * suspends EVERY paying customer a few hours later, with no self-healing path.
 * Recovery was an operator running `billing:reconcile` per account, by hand,
 * after someone noticed.
 *
 * So this job asks Stripe directly about exactly those subscriptions and writes
 * the answer back through the SAME mapper and the SAME repository writer the
 * webhook uses — never its own SQL, never its own field extraction. A renewal
 * that really happened is picked up within the hour and the account
 * un-suspends itself; a subscription that really is unpaid is confirmed as such
 * and stays suspended.
 *
 * Deliberately narrow: only provider-backed rows at or past their period end
 * (or already PAST_DUE) are read, so a healthy mid-period subscription costs no
 * Stripe call at all. Fail-soft per row — one unreadable subscription must not
 * stop the rest of the sweep.
 */
@Processor(BILLING_RECONCILE_QUEUE, { concurrency: 1 })
@Injectable()
export class SubscriptionReconcileProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SubscriptionReconcileProcessor.name);

  constructor(
    @InjectQueue(BILLING_RECONCILE_QUEUE) private readonly queue: Queue,
    private readonly repository: BillingRepositoryService,
    private readonly platformSettings: PlatformSettingsService,
    @Inject(BILLING_PROVIDER_TOKEN) private readonly provider: BillingProviderPort,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        BILLING_RECONCILE_JOB,
        {},
        {
          repeat: { pattern: DEFAULT_RECONCILE_CRON },
          jobId: 'billing-subscription-reconcile-tick',
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        },
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to schedule billing subscription reconcile: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async process(job: Job): Promise<{ checked: number; updated: number }> {
    if (job.name !== BILLING_RECONCILE_JOB) {
      return { checked: 0, updated: 0 };
    }
    if (!this.provider.isConfigured()) {
      // No Stripe key: nothing to ask, and every quota gate is already inert.
      return { checked: 0, updated: 0 };
    }

    // The same grace the entitlement rule uses, so this sweep looks at a row
    // shortly BEFORE that rule would start treating it as unpaid rather than
    // after — the seller never sees the suspension in the first place.
    const graceHours = await this.platformSettings.getNumber(
      PlatformSettingKey.BILLING_WEBHOOK_GRACE_HOURS,
    );
    const staleBefore = new Date(Date.now() + Math.max(0, graceHours) * 60 * 60 * 1000);

    const candidates = await this.repository.listSubscriptionsNeedingReconcile(staleBefore);
    let updated = 0;
    for (const candidate of candidates) {
      try {
        if (await this.reconcileOne(candidate)) {
          updated += 1;
        }
      } catch (err) {
        // Transport/Stripe failure for one subscription. Leave the local row
        // exactly as it is — writing a guess here is how a paying account gets
        // suspended by its own recovery path — and try again next hour.
        this.logger.warn(
          `Subscription reconcile failed for ${candidate.providerSubscriptionId}: ${
            (err as Error).message
          }`,
        );
      }
    }

    if (candidates.length > 0) {
      this.logger.log(
        `Subscription reconcile: re-read ${candidates.length} at-risk subscription(s), updated ${updated}.`,
      );
    }
    return { checked: candidates.length, updated };
  }

  /** Returns true when the local row was re-written from Stripe's answer. */
  private async reconcileOne(candidate: {
    customerId: string;
    providerSubscriptionId: string;
    userId: string;
  }): Promise<boolean> {
    const subscription = await this.provider.fetchSubscription(candidate.providerSubscriptionId);
    if (!subscription) {
      // Stripe no longer has it. Nothing to copy, and inventing an ENDED row
      // here would be this job deciding an account's entitlement on its own —
      // precisely what it exists to avoid. `customer.subscription.deleted` is
      // what ends a subscription.
      this.logger.warn(
        `Subscription ${candidate.providerSubscriptionId} is missing in Stripe — left untouched.`,
      );
      return false;
    }

    const fields = extractStripeSubscriptionFields(buildReconcileEvent(subscription));
    if (!fields) {
      // A status this system does not track ('incomplete' / 'paused'). Not an
      // error, and not something to guess at.
      return false;
    }
    const planId = resolveReconcilePlanId(subscription);
    if (!planId) {
      this.logger.warn(
        `Subscription ${candidate.providerSubscriptionId} carries no plan_id metadata — cannot map it to a local plan.`,
      );
      return false;
    }

    // allowPeriodRewind stays FALSE here, unlike the operator CLI. This job is
    // unattended and runs against every at-risk row, so it may only move a
    // period FORWARD on Stripe's own evidence; repairing a corrupted earlier
    // start stays a deliberate, per-account operator action.
    const row = await this.repository.upsertSubscriptionByProvider(
      candidate.customerId,
      planId,
      fields,
    );
    return Boolean(row);
  }
}
