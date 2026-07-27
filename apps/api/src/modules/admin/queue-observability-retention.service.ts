// apps/api/src/modules/admin/queue-observability-retention.service.ts
//
// Retention purge worker for `queue_observations`. Runs daily via a BullMQ
// repeatable scheduler on its own dedicated queue (`queue-observability-retention`),
// deleting rows older than QUEUE_OBSERVABILITY_RETENTION_DAYS (default 7,
// clamp 1–90 via resolveRetentionDays).
//
// Fail-soft: a purge failure logs and reschedules; it never throws into the
// API process. The purge is a single DELETE with a `recorded_at < NOW() - $1`
// predicate — idempotent and safe to re-run.
//
// The scheduler + processor are co-located here (small, self-contained). The
// queue is registered in AdminModule (BullModule.registerQueue) so the
// @InjectQueue resolves.

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type QueueObservationPurgeResult,
  QueueObservabilityRetentionKind,
  resolveRetentionDays,
} from '@repo/shared';
import type { Job, Queue } from 'bullmq';

import { DatabaseService } from '../../common/database/database.service';

/** Dedicated BullMQ queue name for the retention purge job. */
export const QUEUE_OBSERVABILITY_RETENTION_QUEUE = 'queue-observability-retention';

/** Daily purge cron (configurable, default 03:17 daily — off the :00 mark). */
const DEFAULT_RETENTION_CRON = '17 3 * * *';

interface PurgeJobRow {
  deleted: string;
}

@Processor(QUEUE_OBSERVABILITY_RETENTION_QUEUE, { concurrency: 1 })
@Injectable()
export class QueueObservabilityRetentionService extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(QueueObservabilityRetentionService.name);

  constructor(
    @InjectQueue(QUEUE_OBSERVABILITY_RETENTION_QUEUE) private readonly retentionQueue: Queue,
    private readonly configService: ConfigService,
    private readonly databaseService: DatabaseService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const cron =
      this.configService.get<string>('QUEUE_OBSERVABILITY_RETENTION_CRON') ?? DEFAULT_RETENTION_CRON;
    try {
      await this.retentionQueue.add(
        'purge-old-observations',
        {},
        {
          repeat: { pattern: cron },
          jobId: 'queue-observability-retention-tick',
          removeOnComplete: true,
          removeOnFail: { age: 86_400 },
        },
      );
      this.logger.log(`Queue observability retention purge scheduled: cron="${cron}".`);
    } catch (err: unknown) {
      // Fail-soft: scheduling failure does not abort boot.
      this.logger.warn(
        `Failed to schedule retention purge: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Process the daily purge job. Deletes rows older than the retention window.
   * Fail-soft: never throws into BullMQ's retry path (a transient DB error is
   * logged and reported; the next daily tick retries naturally).
   */
  async process(job: Job): Promise<QueueObservationPurgeResult> {
    if (job.name !== 'purge-old-observations') {
      return { deletedRows: 0, failed: false };
    }
    return this.purgeOld();
  }

  /**
   * Purge rows older than the retention window. Returns the count deleted.
   * Fail-soft: a DB error returns `{ failed: true, error }` instead of throwing.
   */
  async purgeOld(): Promise<QueueObservationPurgeResult> {
    const rawDays = this.configService.get<number>('QUEUE_OBSERVABILITY_RETENTION_DAYS');
    const retentionDays = resolveRetentionDays(rawDays);
    const kind = QueueObservabilityRetentionKind.BY_AGE;
    try {
      const rows = await this.databaseService.query<PurgeJobRow>(
        `WITH deleted AS (
           DELETE FROM queue_observations
           WHERE recorded_at < NOW() - ($1 || ' days')::INTERVAL
           RETURNING 1
         )
         SELECT COUNT(*)::TEXT AS deleted FROM deleted`,
        [String(retentionDays)],
      );
      const deleted = Number.parseInt(rows[0]?.deleted ?? '0', 10) || 0;
      this.logger.log(
        `Queue observability retention purge (${kind}): deleted ${deleted} rows older than ${retentionDays} day(s).`,
      );
      return { deletedRows: deleted, failed: false };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.error(`Queue observability retention purge failed: ${error}`);
      return { deletedRows: 0, failed: true, error };
    }
  }
}
