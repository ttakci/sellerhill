// apps/api/src/modules/admin/queue-observability.service.ts
//
// Single writer for the `queue_observations` table (migration 051).
//
// Mirrors the UsageEventsService fail-soft / idempotent contract:
//   - `record()` NEVER throws on a DB error — it returns a result shape so the
//     caller (QueueEvents collector) can swallow it and keep observing.
//   - Idempotency: the (queue_name, job_id, event) partial unique index makes a
//     repeated BullMQ event for the same job+event an `idempotentSkip`, never a
//     duplicate. PG 23505 is caught and reported.
//   - Payload is NEVER stored. The caller pre-computes `payloadHash` via
//     `redactPayloadToAllowlist(job.data)` + `computePayloadHash(...)` and passes
//     only the hash. The raw job.data never reaches this service's SQL.
//
// Schema (migration 051):
//   queue_name VARCHAR(80), job_id VARCHAR(160), event queue_event_type,
//   correlation_id VARCHAR(120), job_name VARCHAR(160), attempts SMALLINT,
//   duration_ms INTEGER, error_message TEXT, payload_hash CHAR(64),
//   recorded_at TIMESTAMPTZ.

import { Injectable, Logger } from '@nestjs/common';
import { type QueueObservationParams, type QueueObservationRecordResult } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

/** SQL parameter array shape — matches DatabaseService.query. */
type InsertParams = Array<string | number | boolean | null>;

@Injectable()
export class QueueObservabilityService {
  private readonly logger = new Logger(QueueObservabilityService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Record a single queue job terminal event. Fail-soft: never throws on DB
   * error. Returns a result describing what happened (inserted / idempotent
   * skip / failed). The QueueEvents collector calls this inside a try/catch so
   * observability never breaks job processing.
   */
  async record(params: QueueObservationParams): Promise<QueueObservationRecordResult> {
    const validation = this.validateParams(params);
    if (validation) {
      return validation;
    }

    const normalized = this.normalize(params);
    try {
      await this.databaseService.query(this.insertSql(), normalized);
      return { inserted: true, idempotentSkip: false, failed: false };
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        return { inserted: false, idempotentSkip: true, failed: false };
      }
      this.logger.error(
        `Failed to record queue observation (${params.queueName}/${params.jobId}/${params.event}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        inserted: false,
        idempotentSkip: false,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** Validate params before any DB work. Returns a failed result or undefined. */
  private validateParams(params: QueueObservationParams): QueueObservationRecordResult | undefined {
    if (!params.queueName || params.queueName.length === 0) {
      return { inserted: false, idempotentSkip: false, failed: true, error: 'queueName is required' };
    }
    if (!params.jobId || params.jobId.length === 0) {
      return { inserted: false, idempotentSkip: false, failed: true, error: 'jobId is required' };
    }
    if (!Number.isFinite(params.attempts) || params.attempts < 0) {
      return { inserted: false, idempotentSkip: false, failed: true, error: 'attempts must be a non-negative finite number' };
    }
    if (params.durationMs !== undefined && params.durationMs !== null) {
      if (!Number.isFinite(params.durationMs) || params.durationMs < 0) {
        return { inserted: false, idempotentSkip: false, failed: true, error: 'durationMs must be a non-negative finite number when present' };
      }
    }
    return undefined;
  }

  /** Normalize params into the SQL parameter array (051 schema columns). */
  private normalize(params: QueueObservationParams): InsertParams {
    const recordedAt = params.recordedAt ? params.recordedAt.toISOString() : null;
    return [
      params.queueName,
      params.jobId,
      params.event,
      params.correlationId ?? null,
      params.jobName ?? null,
      Math.round(params.attempts),
      params.durationMs !== undefined && params.durationMs !== null ? Math.round(params.durationMs) : null,
      params.errorMessage ?? null,
      params.payloadHash ?? null,
      recordedAt,
    ];
  }

  /**
   * Plain INSERT — no ON CONFLICT. Idempotency is enforced by the
   * `uq_queue_observations_job_event` partial unique index (migration 051).
   * A repeated BullMQ event for the same job+event raises 23505, caught and
   * reported as idempotentSkip — never a duplicate.
   */
  private insertSql(): string {
    return `
      INSERT INTO queue_observations
        (queue_name, job_id, event, correlation_id, job_name, attempts, duration_ms, error_message, payload_hash, recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, NOW()))
    `;
  }

  /** Detect a Postgres unique-violation error (23505). */
  private isUniqueViolation(error: unknown): boolean {
    if (error === null || typeof error !== 'object') {
      return false;
    }
    const err = error as { code?: string };
    return err.code === '23505';
  }
}
