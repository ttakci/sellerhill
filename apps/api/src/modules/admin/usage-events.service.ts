import { Injectable, Logger } from '@nestjs/common';
import { type UsageEventAppendResult, type UsageEventParams } from '@repo/shared';

import { DatabaseService } from '../../common/database/database.service';

/**
 * Single writer for the `usage_events` FinOps ledger (migration 049 table).
 *
 * Fail-soft by design: `append` and `appendBatch` NEVER throw on a DB error —
 * they return a result shape so the caller (Keepa/LLM writer) can log and
 * continue, and the source pipeline is never broken.
 *
 * Idempotency: the `(source, metric, provider_ref_id, user_id)` natural key is
 * enforced by two partial unique indexes (migration 050). A re-projection of the
 * same source row hits the unique constraint (PG 23505) and is reported as
 * `idempotentSkip`, not an error — this makes the backfill service safe to run
 * repeatedly.
 *
 * Cost/currency pair invariant: both set or both null. Enforced in code before
 * any DB work (defensive); the 049 table also has a CHECK backstop.
 *
 * Schema (migration 049): quantity BIGINT, recorded_at TIMESTAMPTZ,
 * provider_ref_id VARCHAR(200), estimated_cost_micros BIGINT, currency CHAR(3).
 */
@Injectable()
export class UsageEventsService {
  private readonly logger = new Logger(UsageEventsService.name);

  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * Append a single usage event. Fail-soft: never throws on DB error.
   * Returns a result describing what happened (inserted / idempotent skip / failed).
   */
  async append(params: UsageEventParams): Promise<UsageEventAppendResult> {
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
        `Failed to append usage event (${params.source}/${params.metric}/${params.providerRefId}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        inserted: false,
        idempotentSkip: false,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Append multiple events in a single transaction. Each event is validated
   * independently; invalid events short-circuit to a failed result. The whole
   * batch is fail-soft: a non-idempotent error rolls back the transaction and
   * every valid event is reported as failed (the caller can retry — idempotency
   * makes that safe). Returns one result per input event, preserving order.
   */
  async appendBatch(paramsList: UsageEventParams[]): Promise<UsageEventAppendResult[]> {
    if (paramsList.length === 0) {
      return [];
    }

    const results: UsageEventAppendResult[] = Array.from({ length: paramsList.length });
    const valid: { originalIndex: number; normalized: InsertParams }[] = [];
    for (let i = 0; i < paramsList.length; i++) {
      const validation = this.validateParams(paramsList[i]);
      if (validation) {
        results[i] = validation;
      } else {
        valid.push({ originalIndex: i, normalized: this.normalize(paramsList[i]) });
        results[i] = { inserted: false, idempotentSkip: false, failed: true, error: 'pending' };
      }
    }

    if (valid.length === 0) {
      return results;
    }

    try {
      await this.databaseService.transaction(async (client) => {
        for (const entry of valid) {
          try {
            await client.query(this.insertSql(), entry.normalized);
            results[entry.originalIndex] = { inserted: true, idempotentSkip: false, failed: false };
          } catch (error: unknown) {
            if (this.isUniqueViolation(error)) {
              results[entry.originalIndex] = { inserted: false, idempotentSkip: true, failed: false };
            } else {
              throw error;
            }
          }
        }
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Usage events batch failed (rolled back): ${msg}`);
      for (const entry of valid) {
        results[entry.originalIndex] = { inserted: false, idempotentSkip: false, failed: true, error: msg };
      }
    }

    return results;
  }

  /** Validate a single event params object before any DB work. */
  private validateParams(params: UsageEventParams): UsageEventAppendResult | undefined {
    if (!params.providerRefId || params.providerRefId.length === 0) {
      return { inserted: false, idempotentSkip: false, failed: true, error: 'providerRefId is required' };
    }
    if (!Number.isFinite(params.quantity) || params.quantity < 0) {
      return { inserted: false, idempotentSkip: false, failed: true, error: 'quantity must be a non-negative finite number' };
    }
    const costSet = params.estimatedCostMicros !== undefined && params.estimatedCostMicros !== null;
    const currencySet = params.currency !== undefined && params.currency !== null;
    if (costSet !== currencySet) {
      return { inserted: false, idempotentSkip: false, failed: true, error: 'cost and currency must both be set or both be null' };
    }
    if (costSet && (!Number.isFinite(params.estimatedCostMicros!) || params.estimatedCostMicros! < 0)) {
      return { inserted: false, idempotentSkip: false, failed: true, error: 'estimatedCostMicros must be a non-negative finite number' };
    }
    return undefined;
  }

  /** Normalize params into the SQL parameter array (049 schema columns). */
  private normalize(params: UsageEventParams): InsertParams {
    const costPresent = params.estimatedCostMicros !== undefined && params.estimatedCostMicros !== null;
    const recordedAt = params.recordedAt ? params.recordedAt.toISOString() : null;
    return [
      params.source,
      params.metric,
      params.providerRefId,
      params.userId ?? null,
      Math.round(params.quantity),
      costPresent ? Math.round(params.estimatedCostMicros!) : null,
      costPresent ? (params.currency ?? 'USD') : null,
      recordedAt,
    ];
  }

  /**
   * Plain INSERT — no ON CONFLICT. Idempotency is enforced by the two partial
   * unique indexes (migration 050). A re-projection hits the appropriate index
   * and raises unique-violation (23505), caught and reported as idempotentSkip.
   */
  private insertSql(): string {
    return `
      INSERT INTO usage_events
        (source, metric, provider_ref_id, user_id, quantity, estimated_cost_micros, currency, recorded_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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

/** The params array shape for the INSERT — matches DatabaseService.query. */
type InsertParams = (string | number | boolean | null)[];
