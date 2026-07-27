// apps/api/src/common/observability/correlation.context.ts
//
// AsyncLocalStorage-backed correlation context. Producers stamp the current
// correlation id into BullMQ job data; workers re-enter it here via
// `withCorrelation(...)` so every downstream `Logger`/Winston call (and the
// QueueEvents collector) carries it automatically — no manual plumbing.
//
// This is the "Winston refactor" seam: `logger.config.ts` reads
// `getCorrelation()` to stamp `{ correlationId, queueName, jobId }` into every
// structured log line. Existing `new Logger(ClassName)` call sites keep
// working unchanged — the global Winston instance picks up the ALS context.

import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The correlation context carried through AsyncLocalStorage. All fields
 * optional — a context may carry only the correlation id (HTTP request),
 * or the full set (worker processing a job).
 */
export interface CorrelationContext {
  /** The allowlisted correlation id (propagated through job.data.correlationId). */
  correlationId?: string;
  /** BullMQ queue name (set when processing/observing a job). */
  queueName?: string;
  /** BullMQ job id (set when processing/observing a job). */
  jobId?: string;
  /** Origin: where the correlation id was established. */
  origin?: 'http' | 'scheduled' | 'worker' | 'collector';
}

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

/**
 * Run `fn` inside a correlation context. The context is available to `fn` and
 * all async descendants via {@link getCorrelation}. Returns whatever `fn`
 * returns (sync or promise). Never throws on context machinery itself.
 */
export function withCorrelation<T>(
  context: CorrelationContext,
  fn: () => T,
): T {
  return correlationStorage.run(context, fn);
}

/**
 * Read the current correlation context (empty object when none is active).
 * Safe to call anywhere — never throws. Used by the Winston logger format
 * to stamp structured fields into every log line.
 */
export function getCorrelation(): CorrelationContext {
  const store = correlationStorage.getStore();
  return store ?? {};
}
