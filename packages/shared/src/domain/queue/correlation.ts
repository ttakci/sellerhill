// packages/shared/src/domain/queue/correlation.ts
//
// Correlation ID propagation for BullMQ job queues.
//
// Producers stamp the current correlation id into job data via
// `stampJobData(data, correlationId)`; workers/collectors read it back via
// `extractCorrelationId(job)`. The field name (`correlationId`) is the
// **allowlisted** key — it is the only job-data field the QueueEvents collector
// persists directly (every other payload field is hashed, never stored).
//
// Pure helpers — no NestJS / BullMQ runtime deps, fully Jest-coverable.

/**
 * The job-data field name that carries the correlation id. This is the sole
 * allowlisted field stored verbatim in `queue_observations.correlation_id`.
 */
export const CORRELATION_ID_KEY = 'correlationId' as const;

/**
 * Merge a correlation id into BullMQ job data (producer side).
 *
 * Additive: the returned object is a shallow copy of `data` with
 * `correlationId` set. If `data` already carries a `correlationId`, it is
 * preserved (callers can override by passing an explicit non-null id).
 * Scheduled jobs (no initiating HTTP request) should pass a freshly generated
 * id so fan-out children inherit it.
 *
 * Type-safe: the return type extends the input with an optional
 * `correlationId` field — existing call sites that ignore the field keep
 * compiling.
 */
export function stampJobData<T extends object>(
  data: T,
  correlationId?: string | null,
): T & { correlationId?: string } {
  const base = { ...data };
  const record = data as Record<string, unknown>;
  const existing =
    typeof record[CORRELATION_ID_KEY] === 'string'
      ? record[CORRELATION_ID_KEY]
      : null;
  const id =
    typeof correlationId === 'string' && correlationId.length > 0
      ? correlationId
      : existing;
  if (id !== null && id.length > 0) {
    (base as Record<string, unknown>)[CORRELATION_ID_KEY] = id;
  }
  return base as T & { correlationId?: string };
}

/**
 * Read the correlation id from a BullMQ job (worker / collector side).
 *
 * Accepts any object with an optional `data` record (the BullMQ `Job` shape,
 * or a minimal stub for testing). Returns `null` when absent or not a string.
 */
export function extractCorrelationId<T extends object>(
  job: { data?: T } | undefined | null,
): string | null {
  if (!job || typeof job !== 'object') {
    return null;
  }
  const data = job.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') {
    return null;
  }
  const value = data[CORRELATION_ID_KEY];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/**
 * Generate a new correlation id (UUID v4) for scheduled jobs or when a producer
 * has no inbound HTTP request id. Re-exported here so producers have a single
 * import for stamp + generate.
 */
export { v4 as generateCorrelationId } from 'uuid';
