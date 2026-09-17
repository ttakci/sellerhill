import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PlanChangeDirection } from '@repo/shared';
import type { Job, Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';

import type { BillingProviderPort } from './billing-provider';
import { BillingRepositoryService } from './billing-repository.service';
import { BILLING_PROVIDER_TOKEN } from './billing.tokens';
import {
  decidePriceMigration,
  formatStripeAmount,
  PriceMigrationAction,
  ScheduleSource,
} from './price-migration';
import type { CatalogQuery } from './stripe-catalog-sync';

export const BILLING_PRICE_MIGRATION_QUEUE = 'billing-price-migration';
const BILLING_PRICE_MIGRATION_JOB = 'migrate-prices';
const DEFAULT_PRICE_MIGRATION_CRON = '11 * * * *';

/** The one mail call this processor makes, as a narrow port. */
export interface PriceChangeNoticeSender {
  sendPriceChangeEmail(
    email: string,
    firstName: string,
    details: { planName: string; oldPrice: string; newPrice: string; effectiveDate: string },
    locale?: string,
  ): Promise<void>;
}

/**
 * Keeps every subscriber on their plan's CURRENT price, with no operator step.
 *
 * The rule (operator decision, 2026-09-17): when a plan's price changes, a
 * seller finishes the period they are in at the price they already paid, and
 * their next period starts at the new price. Nobody runs a command for this.
 *
 * Each hourly run:
 *   1. Mirrors the catalog into Stripe (`syncStripeCatalog`), so a price change
 *      shipped by migration gets its Stripe Price without anyone running
 *      `stripe:sync-catalog`. A price mismatch is logged at error — it means
 *      the app shows one figure while Stripe charges another.
 *   2. Reads only the subscriptions not yet in line with their plan's current
 *      price (migration 110). A healthy subscriber costs no Stripe call.
 *   3. For each, reads the live subscription and decides via
 *      `decidePriceMigration`: schedule the new price from the end of the
 *      current period (the same Subscription Schedule operation a downgrade
 *      uses, labelled `price_migration`), or leave it — already on it, a change
 *      the seller scheduled themselves, or a cancelling subscription.
 *   4. E-mails the seller the old price, the new price and the date, only after
 *      Stripe has accepted the schedule. A notice that fails is retried on the
 *      next run; one that succeeded is never sent twice.
 *
 * Hourly because the schedule must exist BEFORE the renewal it applies to: a
 * seller renewing an hour after a price change should still move at that
 * renewal, not a month later. Fail-soft per subscription.
 */
@Processor(BILLING_PRICE_MIGRATION_QUEUE, { concurrency: 1 })
@Injectable()
export class PriceMigrationProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(PriceMigrationProcessor.name);

  constructor(
    @InjectQueue(BILLING_PRICE_MIGRATION_QUEUE) private readonly queue: Queue,
    private readonly repository: BillingRepositoryService,
    private readonly database: DatabaseService,
    @Inject(BILLING_PROVIDER_TOKEN) private readonly provider: BillingProviderPort,
    private readonly email?: PriceChangeNoticeSender,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        BILLING_PRICE_MIGRATION_JOB,
        {},
        {
          repeat: { pattern: DEFAULT_PRICE_MIGRATION_CRON },
          jobId: 'billing-price-migration-tick',
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        },
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to schedule billing price migration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async process(job: Job): Promise<{ scheduled: number; notified: number }> {
    if (job.name !== BILLING_PRICE_MIGRATION_JOB || !this.provider.isConfigured()) {
      return { scheduled: 0, notified: 0 };
    }

    await this.syncCatalog();

    const candidates = await this.repository.listPriceMigrationCandidates();
    let scheduled = 0;
    let notified = 0;
    for (const candidate of candidates) {
      try {
        const outcome = await this.migrateOne(candidate);
        scheduled += outcome.scheduled ? 1 : 0;
        notified += outcome.notified ? 1 : 0;
      } catch (err) {
        this.logger.warn(
          `Price migration failed for ${candidate.providerSubscriptionId}: ${(err as Error).message}`,
        );
      }
    }
    if (scheduled > 0 || notified > 0) {
      this.logger.log(
        `Price migration: scheduled ${scheduled} move(s) to a new price, sent ${notified} notice(s).`,
      );
    }
    return { scheduled, notified };
  }

  private async syncCatalog(): Promise<void> {
    try {
      const query: CatalogQuery = (sql, params) =>
        this.database.query(sql, params as Parameters<DatabaseService['query']>[1]);
      const { created, mismatches } = await this.provider.syncCatalog(query);
      for (const line of created) {
        this.logger.log(`Stripe catalog: created ${line}`);
      }
      for (const line of mismatches) {
        this.logger.error(
          `Stripe catalog PRICE MISMATCH — the app and Stripe disagree: ${line}. A Stripe Price ` +
            'cannot be edited: close the local price row and insert a new one.',
        );
      }
    } catch (err) {
      // A catalog problem must not stop subscribers whose new price already
      // exists in Stripe from being moved.
      this.logger.warn(`Stripe catalog sync failed: ${(err as Error).message}`);
    }
  }

  private async migrateOne(
    candidate: Awaited<ReturnType<BillingRepositoryService['listPriceMigrationCandidates']>>[number],
  ): Promise<{ scheduled: boolean; notified: boolean }> {
    const live = await this.provider.inspectForPriceMigration(candidate.providerSubscriptionId);
    const action = decidePriceMigration({
      status: live.status,
      currentPriceId: live.priceId,
      targetPriceId: candidate.targetPriceId,
      cancelAtPeriodEnd: live.cancelAtPeriodEnd,
      pendingChange: live.pendingChange,
    });

    switch (action) {
      case PriceMigrationAction.ALREADY_ON_TARGET:
        // Already there — including a renewal that landed before a notice
        // could be sent, where a notice about a past change would only confuse.
        await this.repository.markPriceMigration(candidate.subscriptionId, {
          evaluatedFor: candidate.targetPriceId,
          notifiedFor:
            candidate.scheduledPriceId === candidate.targetPriceId ? candidate.targetPriceId : undefined,
        });
        return { scheduled: false, notified: false };

      case PriceMigrationAction.SKIP_PENDING_CHANGE:
      case PriceMigrationAction.SKIP_CANCELLING:
      case PriceMigrationAction.SKIP_NOT_LIVE:
        // Nothing recorded: re-checked next run. A seller's own pending change
        // lands and changes their plan; a cancelling subscription ends; a
        // status mismatch is corrected by the reconcile job.
        return { scheduled: false, notified: false };

      case PriceMigrationAction.MIGRATE:
      case PriceMigrationAction.ALREADY_SCHEDULED: {
        let didSchedule = false;
        if (action === PriceMigrationAction.MIGRATE) {
          // `scheduleDowngrade` is the generic "new price from the end of the
          // current period" operation; `direction` only labels it.
          await this.provider.scheduleDowngrade({
            providerSubscriptionId: candidate.providerSubscriptionId,
            providerPriceId: candidate.targetPriceId,
            // Written to the new phase's metadata: the renewal webhook resolves
            // the local plan from it, so it must be the real plan id.
            planId: candidate.planId,
            direction:
              candidate.targetAmountMicros / 10_000 >= (live.unitAmount ?? 0)
                ? PlanChangeDirection.UPGRADE
                : PlanChangeDirection.DOWNGRADE,
            scheduleSource: ScheduleSource.PRICE_MIGRATION,
          });
          didSchedule = true;
        }
        await this.repository.markPriceMigration(candidate.subscriptionId, {
          evaluatedFor: candidate.targetPriceId,
          scheduledTo: candidate.targetPriceId,
        });

        if (candidate.notifiedPriceId === candidate.targetPriceId || !this.email) {
          return { scheduled: didSchedule, notified: false };
        }
        const locale = candidate.locale === 'tr' ? 'tr' : 'en';
        const effectiveDate = live.currentPeriodEnd
          ? live.currentPeriodEnd.toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })
          : '—';
        try {
          await this.email.sendPriceChangeEmail(
            candidate.email,
            candidate.firstName,
            {
              planName: candidate.planName,
              oldPrice: formatStripeAmount(
                live.unitAmount,
                live.currency ?? candidate.targetCurrency,
                locale,
              ),
              newPrice: formatStripeAmount(
                Math.round(candidate.targetAmountMicros / 10_000),
                candidate.targetCurrency,
                locale,
              ),
              effectiveDate,
            },
            locale,
          );
        } catch (mailErr) {
          // Not recorded as notified, so the next run tries again. The move is
          // already scheduled either way.
          this.logger.warn(
            `Price-change notice not sent to user ${candidate.userId} (will retry): ${
              (mailErr as Error).message
            }`,
          );
          return { scheduled: didSchedule, notified: false };
        }
        await this.repository.markPriceMigration(candidate.subscriptionId, {
          notifiedFor: candidate.targetPriceId,
        });
        return { scheduled: didSchedule, notified: true };
      }
    }
  }
}
