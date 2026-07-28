// apps/api/src/modules/admin/queue-events-collector.service.ts
//
// BullMQ QueueEvents collector — listens for job terminal events
// (completed/failed) via Redis pub/sub and persists one observation per event
// through QueueObservabilityService.
//
// Lifecycle:
//   - onModuleInit: one QueueEvents instance per observed queue name, started
//     only when QUEUE_OBSERVABILITY_ENABLED !== 'false'. Each instance attaches
//     `completed` and `failed` listeners.
//   - onModuleDestroy: closes every QueueEvents instance (graceful).
//
// Fail-soft: every listener wraps QueueObservabilityService.record(...) in a
// try/catch AND the record() call itself never throws — observability cannot
// break job processing. The raw job payload is never stored; only the
// allowlisted correlation id (verbatim) and a SHA-256 hash of the allowlisted
// payload subset (via redactPayloadToAllowlist + computePayloadHash).
//
// Correlation: the listener runs inside `withCorrelation({ queueName, jobId,
// correlationId, origin: 'collector' })` so the Winston log lines emitted by
// record() and any downstream code carry the correlation id automatically.

import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  extractCorrelationId,
  QueueEventType,
} from '@repo/shared';
import { QueueEvents } from 'bullmq';

import { withCorrelation } from '../../common/observability/correlation.context';
import { getBullRedisOptions } from '../../common/redis/redis.config';

import {
  computePayloadHash,
  PAYLOAD_HASH_ALLOWLIST,
  redactPayloadToAllowlist,
} from './queue-observability.helpers';
import { QueueObservabilityService } from './queue-observability.service';

/** Queue names observed by the collector. Matches the admin queue registry. */
export const OBSERVED_QUEUE_NAMES = [
  'order-sync',
  'stock-sync',
  'auto-fulfill',
  'amazon-order-sync',
  'amazon-tracking',
  'amazon-verify',
  'listings',
  'keepa-refresh',
  'buyer-message',
] as const;

/** A BullMQ QueueEvents job event payload (minimal shape we consume). */
interface QueueEventJobPayload {
  jobId: string;
  prev?: string;
  attemptsMade?: number;
  failedReason?: string;
  returnvalue?: unknown;
  timestamp?: number;
  // BullMQ stores job data inside the event under `data` for some events; the
  // collector reads it best-effort for the allowlisted hash + correlation id.
  data?: Record<string, unknown>;
}

@Injectable()
export class QueueEventsCollectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueEventsCollectorService.name);
  private readonly instances = new Map<string, QueueEvents>();
  private readonly enabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly observabilityService: QueueObservabilityService,
  ) {
    // Kill switch: any value !== literal 'false' keeps the collector on.
    const flag = this.configService.get<string>('QUEUE_OBSERVABILITY_ENABLED');
    this.enabled = flag !== 'false';
  }

  onModuleInit(): void {
    if (!this.enabled) {
      this.logger.log('Queue observability collector disabled (QUEUE_OBSERVABILITY_ENABLED=false).');
      return;
    }
    const connection = getBullRedisOptions(this.configService);
    for (const queueName of OBSERVED_QUEUE_NAMES) {
      try {
        const events = new QueueEvents(queueName, { connection });
        events.on('completed', (job: QueueEventJobPayload) => {
          void this.handleEvent(queueName, QueueEventType.COMPLETED, job);
        });
        events.on('failed', (job: QueueEventJobPayload) => {
          void this.handleEvent(queueName, QueueEventType.FAILED, job);
        });
        events.on('error', (err: unknown) => {
          this.logger.warn(
            `QueueEvents error on '${queueName}': ${err instanceof Error ? err.message : String(err)}`,
          );
        });
        this.instances.set(queueName, events);
        this.logger.log(`QueueEvents collector attached to '${queueName}'.`);
      } catch (err: unknown) {
        // Fail-soft: a single queue's collector failure does not abort the rest.
        this.logger.warn(
          `Failed to attach QueueEvents collector to '${queueName}': ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    const closes = Array.from(this.instances.entries()).map(async ([name, events]) => {
      try {
        await events.close();
      } catch (err: unknown) {
        this.logger.warn(
          `Error closing QueueEvents for '${name}': ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
    await Promise.allSettled(closes);
    this.instances.clear();
  }

  /**
   * Handle a single terminal event. Fail-soft: never throws into the QueueEvents
   * emitter (which would mute the listener). Runs inside a correlation context
   * so record()'s logs carry the correlation id.
   */
  private async handleEvent(
    queueName: string,
    event: QueueEventType,
    job: QueueEventJobPayload,
  ): Promise<void> {
    if (!job || typeof job.jobId !== 'string' || job.jobId.length === 0) {
      return;
    }
    const correlationId = extractCorrelationId({ data: job.data });
    const allowlisted = redactPayloadToAllowlist(job.data, PAYLOAD_HASH_ALLOWLIST);
    const payloadHash = computePayloadHash(allowlisted);
    const attempts = typeof job.attemptsMade === 'number' ? Math.max(0, Math.floor(job.attemptsMade)) : 0;
    const durationMs = this.resolveDurationMs(job);
    const errorMessage = event === QueueEventType.FAILED ? (job.failedReason ?? null) : null;
    const jobName = this.resolveJobName(job);

    await withCorrelation(
      {
        correlationId: correlationId ?? undefined,
        queueName,
        jobId: job.jobId,
        origin: 'collector',
      },
      async () => {
        try {
          await this.observabilityService.record({
            queueName,
            jobId: job.jobId,
            event,
            correlationId,
            jobName,
            attempts,
            durationMs,
            errorMessage,
            payloadHash,
          });
        } catch (err: unknown) {
          // Defense-in-depth: record() is already fail-soft, but a throw here
          // would mute the BullMQ listener. Swallow + log.
          this.logger.warn(
            `record() threw (swallowed) for ${queueName}/${job.jobId}/${event}: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      },
    );
  }

  /** Best-effort duration in ms from the BullMQ event timestamp. */
  private resolveDurationMs(job: QueueEventJobPayload): number | null {
    if (typeof job.timestamp !== 'number' || !Number.isFinite(job.timestamp) || job.timestamp <= 0) {
      return null;
    }
    const ms = Date.now() - job.timestamp;
    return Number.isFinite(ms) && ms >= 0 ? Math.floor(ms) : null;
  }

  /** Best-effort job name extraction. BullMQ events don't always carry it. */
  private resolveJobName(job: QueueEventJobPayload): string | null {
    const data = job.data;
    if (data && typeof data === 'object') {
      const name = data['name'];
      if (typeof name === 'string' && name.length > 0) {
        return name;
      }
    }
    return null;
  }
}
