import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { PlatformSettingKey } from '@repo/shared';
import type { Job, Queue } from 'bullmq';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import type { DigestClaim } from './digest-claim';
import { SellerDigestService, type DigestOutcome } from './seller-digest.service';

export const SELLER_DIGEST_QUEUE = 'seller-digest';
export const SELLER_DIGEST_TICK_JOB = 'digest-tick';
export const SELLER_DIGEST_SEND_JOB = 'digest-send';

/**
 * Hourly at :07. A seller's send hour is a whole local hour, so one tick per
 * hour reaches everybody inside their chosen hour (a 30- or 45-minute zone
 * such as India's simply receives it at :37 / :52 local).
 */
const DIGEST_TICK_CRON = '7 * * * *';
/** Sellers claimed per statement; the tick loops until a batch comes back short. */
const CLAIM_BATCH = 200;
/** Runaway guard: 50 × 200 = 10,000 sellers in one hour. */
const MAX_BATCHES_PER_TICK = 50;

/**
 * The daily summary e-mail. The tick claims due sellers (stamping their day
 * in the same statement) and queues one `send` job each.
 *
 * A send is tried ONCE (`attempts: 1`): the day is already stamped, and a
 * retry after an SMTP answer that was lost on the way back would mail the
 * same summary twice. A lost summary is the accepted cost.
 */
@Processor(SELLER_DIGEST_QUEUE, { concurrency: 2 })
@Injectable()
export class SellerDigestProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(SellerDigestProcessor.name);

  constructor(
    @InjectQueue(SELLER_DIGEST_QUEUE) private readonly queue: Queue,
    private readonly digestService: SellerDigestService,
    private readonly platformSettings: PlatformSettingsService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    try {
      // A repeatable job is keyed by its pattern; drop any older pattern so a
      // changed cron does not leave a second schedule behind.
      for (const repeatable of await this.queue.getRepeatableJobs()) {
        if (repeatable.name === SELLER_DIGEST_TICK_JOB && repeatable.pattern !== DIGEST_TICK_CRON) {
          await this.queue.removeRepeatableByKey(repeatable.key);
        }
      }
      await this.queue.add(
        SELLER_DIGEST_TICK_JOB,
        {},
        {
          repeat: { pattern: DIGEST_TICK_CRON },
          jobId: 'seller-digest-tick',
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        },
      );
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to schedule the daily summary tick: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async process(job: Job): Promise<unknown> {
    if (job.name === SELLER_DIGEST_TICK_JOB) {
      return this.tick();
    }
    if (job.name === SELLER_DIGEST_SEND_JOB) {
      return this.sendOne(job.data as DigestClaim);
    }
    return null;
  }

  private async tick(): Promise<{ claimed: number }> {
    if (!(await this.platformSettings.getBoolean(PlatformSettingKey.DIGEST_ENABLED))) {
      return { claimed: 0 };
    }
    let claimed = 0;
    for (let batch = 0; batch < MAX_BATCHES_PER_TICK; batch++) {
      const claims = await this.digestService.claimDue(CLAIM_BATCH);
      for (const claim of claims) {
        await this.queue.add(SELLER_DIGEST_SEND_JOB, claim, {
          jobId: `digest-${claim.userId}-${claim.reportDay}`,
          attempts: 1,
          removeOnComplete: 1000,
          removeOnFail: { age: 7 * 86_400 },
        });
      }
      claimed += claims.length;
      if (claims.length < CLAIM_BATCH) {
        break;
      }
    }
    if (claimed > 0) {
      this.logger.log(`Daily summary: claimed ${claimed} seller(s).`);
    }
    return { claimed };
  }

  private async sendOne(claim: DigestClaim): Promise<{ outcome: DigestOutcome }> {
    const outcome = await this.digestService.send(claim);
    this.logger.log(`Daily summary for ${claim.userId} (${claim.reportDay}): ${outcome}`);
    return { outcome };
  }
}
