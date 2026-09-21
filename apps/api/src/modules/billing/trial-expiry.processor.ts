import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';

import { BillingRepositoryService } from './billing-repository.service';

export const BILLING_TRIAL_EXPIRY_QUEUE = 'billing-trial-expiry';
const BILLING_TRIAL_EXPIRY_JOB = 'expire-trials';
/**
 * Hourly, at :23. It was once-a-day (`23 2 * * *`), which let a seller whose
 * trial had ended keep using the product for up to ~24 more hours — for a
 * 1-day trial that is nearly double the advertised length. The work is one
 * indexed UPDATE plus a small reminder query, so the cadence costs nothing;
 * it now matches the other billing sweeps (price migration, reconcile).
 */
const DEFAULT_EXPIRY_CRON = '23 * * * *';
/** How many days before a trial ends the one reminder goes out. */
const TRIAL_REMINDER_DAYS = 3;

/**
 * Hourly idempotent trial closer. Existing listings are deliberately untouched:
 * trial expiry is a downgrade, and billing's contract blocks future create/
 * publish only when enforcement is enabled.
 */
/** The one mail call this processor makes — see BillingNotificationSender in
 *  billing-webhook-processor.ts for why it is a local port. */
export interface TrialReminderSender {
  sendTrialEndingEmail(
    email: string,
    firstName: string,
    daysLeft: number,
    trialEndDate: string,
    locale?: string,
  ): Promise<void>;
}

@Processor(BILLING_TRIAL_EXPIRY_QUEUE, { concurrency: 1 })
@Injectable()
export class TrialExpiryProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(TrialExpiryProcessor.name);

  constructor(
    @InjectQueue(BILLING_TRIAL_EXPIRY_QUEUE) private readonly queue: Queue,
    private readonly repository: BillingRepositoryService,
    /** Optional so the processor stays constructible without the mail stack;
     *  absent means no reminder is sent, never a failed tick. */
    private readonly email?: TrialReminderSender,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      // A repeatable job is keyed by its cron pattern, so changing the pattern
      // does not replace the old schedule — it adds a second one. Drop any
      // schedule for this job that is not the current pattern (the old daily
      // one lingers in Redis after a deploy otherwise).
      const existing = await this.queue.getRepeatableJobs();
      for (const repeatable of existing) {
        if (repeatable.name === BILLING_TRIAL_EXPIRY_JOB && repeatable.pattern !== DEFAULT_EXPIRY_CRON) {
          await this.queue.removeRepeatableByKey(repeatable.key);
        }
      }
      await this.queue.add(
        BILLING_TRIAL_EXPIRY_JOB,
        {},
        {
          repeat: { pattern: DEFAULT_EXPIRY_CRON },
          jobId: 'billing-trial-expiry-tick',
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        },
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to schedule billing trial expiry: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async process(job: Job): Promise<{ expired: number; reminded: number }> {
    if (job.name !== BILLING_TRIAL_EXPIRY_JOB) {
      return { expired: 0, reminded: 0 };
    }
    // Remind BEFORE expiring, so a trial that ends today still gets its
    // reminder counted against the trialing state rather than being closed
    // out of the query first.
    const reminded = await this.sendTrialReminders();
    const expired = await this.repository.expireElapsedTrials();
    this.logger.log(`Expired ${expired} billing trial(s); reminded ${reminded}.`);
    return { expired, reminded };
  }

  /**
   * One e-mail per trial, a few days out. The in-app Action Center already
   * warns at five days, but a trial that quietly ends is the one case where
   * the seller has no reason to be logged in — they are still evaluating.
   *
   * Rows are claimed by the query itself (see `claimTrialsEndingSoon`), so a
   * failure here costs one reminder rather than risking a duplicate.
   */
  private async sendTrialReminders(): Promise<number> {
    if (!this.email) {
      return 0;
    }
    let sent = 0;
    try {
      const due = await this.repository.claimTrialsEndingSoon(TRIAL_REMINDER_DAYS);
      for (const trial of due) {
        try {
          const daysLeft = Math.max(
            1,
            Math.ceil((trial.trialEndsAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
          );
          const trialEndDate = trial.trialEndsAt.toLocaleDateString(
            trial.locale === 'tr' ? 'tr-TR' : 'en-US',
            { day: 'numeric', month: 'long', year: 'numeric' },
          );
          await this.email.sendTrialEndingEmail(
            trial.email,
            trial.firstName,
            daysLeft,
            trialEndDate,
            trial.locale,
          );
          sent += 1;
        } catch (err) {
          this.logger.warn(
            `Trial-ending e-mail not sent to user ${trial.userId}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    } catch (err) {
      this.logger.warn(
        `Trial reminder sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return sent;
  }
}
