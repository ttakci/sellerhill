import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { BillingRepositoryService } from './billing-repository.service';
import { decideListingPlanLimitAction, ListingPlanLimitAction } from './listing-plan-limit';
import { QuotaEnforcementService } from './quota-enforcement.service';

export const BILLING_LISTING_PLAN_LIMIT_QUEUE = 'billing-listing-plan-limit';
const BILLING_LISTING_PLAN_LIMIT_JOB = 'reconcile-listing-plan-limit';
const DEFAULT_RECONCILE_CRON = '*/10 * * * *';

/**
 * Keeps `listings.over_plan_limit` in step with each seller's plan.
 *
 * A seller can hold more ACTIVE listings than their plan allows (a downgrade
 * lands at period end and never ends listings for them). Only the oldest
 * listings up to the limit stay automated; this job is what marks the rest.
 *
 * One periodic job rather than a recompute at every place that can move the
 * answer (webhook plan change, listing ended, trial expiry, enforcement
 * toggled). Those are many call sites and a missed one would leave flags wrong
 * forever; a reconcile converges on its own. The cost is a lag of at most one
 * interval, which is harmless for a limit that changes monthly.
 *
 * Fail-soft per user: a failed limit read leaves that user's flags untouched
 * and the rest of the run continues.
 */
@Processor(BILLING_LISTING_PLAN_LIMIT_QUEUE, { concurrency: 1 })
@Injectable()
export class ListingPlanLimitProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(ListingPlanLimitProcessor.name);

  constructor(
    @InjectQueue(BILLING_LISTING_PLAN_LIMIT_QUEUE) private readonly queue: Queue,
    private readonly repository: BillingRepositoryService,
    private readonly quotaEnforcement: QuotaEnforcementService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        BILLING_LISTING_PLAN_LIMIT_JOB,
        {},
        {
          repeat: { pattern: DEFAULT_RECONCILE_CRON },
          jobId: 'billing-listing-plan-limit-tick',
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        },
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to schedule listing plan-limit reconcile: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async process(job: Job): Promise<{ changed: number }> {
    if (job.name !== BILLING_LISTING_PLAN_LIMIT_JOB) {
      return { changed: 0 };
    }

    // Enforcement off: nothing is over any limit. One statement clears every
    // flag, so turning enforcement off in the panel restores full automation
    // on the next tick without a per-user loop.
    if (!(await this.quotaEnforcement.isEnabled())) {
      const changed = await this.repository.clearListingPlanLimit(null);
      if (changed > 0) {
        this.logger.log(`Billing enforcement off — cleared ${changed} over-plan-limit flag(s).`);
      }
      return { changed };
    }

    const candidates = await this.repository.listListingPlanLimitCandidates();
    let changed = 0;
    for (const candidate of candidates) {
      try {
        const limitValue = await this.quotaEnforcement.resolveListingPlanLimit(candidate.userId);
        const action = decideListingPlanLimitAction({ ...candidate, limitValue });
        if (action === ListingPlanLimitAction.CLEAR) {
          changed += await this.repository.clearListingPlanLimit(candidate.userId);
        } else if (action === ListingPlanLimitAction.RANK && limitValue !== null) {
          changed += await this.repository.applyListingPlanLimit(candidate.userId, limitValue);
        }
      } catch (err) {
        this.logger.warn(
          `Listing plan-limit reconcile skipped for user ${candidate.userId}: ${(err as Error).message}`,
        );
      }
    }
    if (changed > 0) {
      this.logger.log(`Listing plan-limit reconcile updated ${changed} listing flag(s).`);
    }
    return { changed };
  }
}
