// packages/shared/src/domain/admin/queue-observability.types.ts
//
// Queue Observability — shared domain types, enums, and pure helpers.
//
// Additive to the admin domain (migration 051 + QueueObservabilityService).
// Mirrors the fail-soft / idempotent / no-payload conventions of the usage
// ledger (admin.types.ts): queue job terminal events are recorded as one row
// per (queue, job, event), with the job payload NEVER stored — only a SHA-256
// hash of an allowlisted subset of fields, plus the allowlisted correlation id.
//
// No `any`, no string status literals — every constant lives in an enum here.
//
// NOTE: this file is environment-agnostic (consumed by both web and api), so
// it must NOT import `node:*` built-ins. The SHA-256 `computePayloadHash`
// helper lives on the API side (`queue-observability.helpers.ts`) where
// `node:crypto` is available; only types/enums/DTOs and the node-free pure
// helpers (`resolveRetentionDays`, `redactPayloadToAllowlist`) live here.

/**
 * Terminal BullMQ job event captured by the QueueEvents collector.
 *
 * Stored as the Postgres `queue_event_type` enum (migration 051). Only terminal
 * lifecycle events are recorded — `waiting`/`active` transitions are not (they
 * are already surfaced live via `getJobCounts()` on `GET /admin/queues/health`).
 */
export enum QueueEventType {
  /** Job completed successfully. */
  COMPLETED = 'completed',
  /** Job failed (exhausted retries or failed before retry). */
  FAILED = 'failed',
}

/**
 * Retention strategy for `queue_observations` rows. Single-member enum today —
 * the purge worker deletes rows older than `retentionDays`. Future strategies
 * (count-bounded, per-queue overrides) extend this enum, never a string.
 */
export enum QueueObservabilityRetentionKind {
  /** Purge rows older than `retentionDays` (age-based). */
  BY_AGE = 'by_age',
}

/**
 * A single captured queue job terminal event (read shape returned by admin
 * endpoints). Mirrors a `queue_observations` row.
 *
 * NOTE: there is no `payload` field. The payload is never stored; only
 * `payloadHash` (SHA-256 of an allowlisted subset) is persisted.
 */
export interface QueueObservationDto {
  /** UUID primary key. */
  id: string;
  /** BullMQ queue name (e.g. 'order-sync', 'auto-fulfill'). */
  queueName: string;
  /** BullMQ job id. */
  jobId: string;
  /** Terminal event kind. */
  event: QueueEventType;
  /** Allowlisted correlation id (from `job.data.correlationId`); null when absent. */
  correlationId: string | null;
  /** BullMQ job name (the first arg to `queue.add(name, ...)`); null when omitted. */
  jobName: string | null;
  /** Number of attempts made before this terminal event (0-based from BullMQ). */
  attempts: number;
  /** Wall-clock duration in ms from enqueue to terminal, when known; null otherwise. */
  durationMs: number | null;
  /** Error message for `failed` events; null for `completed`. */
  errorMessage: string | null;
  /** SHA-256 hex of the allowlisted payload subset; null when the allowlist yielded nothing. */
  payloadHash: string | null;
  /** ISO 8601 timestamp the event was recorded. */
  recordedAt: string;
}

/** Query params for `GET /admin/queues/observations`. */
export interface QueueObservationQuery {
  /** Filter by queue name. */
  queueName?: string;
  /** Filter by event kind. */
  event?: QueueEventType;
  /** Filter by correlation id (exact match). */
  correlationId?: string;
  /** Period start (ISO 8601). Defaults to 24h ago. */
  from?: string;
  /** Period end (ISO 8601). Defaults to now. */
  to?: string;
  /** Page size (1–200). Defaults to 50. */
  limit?: number;
  /** Page number (1-based). Defaults to 1. */
  page?: number;
}

/** Effective retention configuration resolved from env. */
export interface QueueObservabilityRetentionConfig {
  /** Purge rows older than this many days. Clamped to [1, 90]. */
  retentionDays: number;
  /** Retention strategy. Today only `BY_AGE`. */
  kind: QueueObservabilityRetentionKind;
}

/** Fail-soft result of a retention purge run. */
export interface QueueObservationPurgeResult {
  /** Number of rows deleted. */
  deletedRows: number;
  /** True when the purge failed (fail-soft — never throws into the caller). */
  failed: boolean;
  /** Error message when `failed` is true. */
  error?: string;
}

/** Fail-soft result returned by `QueueObservabilityService.record(...)`. */
export interface QueueObservationRecordResult {
  /** True when a new row was inserted. */
  inserted: boolean;
  /** True when the (queue, job, event) tuple already existed (idempotent skip). */
  idempotentSkip: boolean;
  /** True when the write failed (fail-soft — never throws into the collector). */
  failed: boolean;
  /** Error message when `failed` is true. */
  error?: string;
}

/** Typed input for recording a queue observation. */
export interface QueueObservationParams {
  queueName: string;
  jobId: string;
  event: QueueEventType;
  /** Allowlisted correlation id extracted from `job.data.correlationId`. */
  correlationId?: string | null;
  /** BullMQ job name; null when the producer omitted it. */
  jobName?: string | null;
  /** Attempts made before this terminal event. */
  attempts: number;
  /** Duration in ms; null when unknown. */
  durationMs?: number | null;
  /** Error message for `failed` events; null for `completed`. */
  errorMessage?: string | null;
  /**
   * SHA-256 hex of the allowlisted payload subset. Pre-computed by the caller
   * via {@link computePayloadHash} so the service never sees the raw payload.
   * Null when the allowlist yielded nothing.
   */
  payloadHash?: string | null;
  /** When the event occurred; defaults to now when omitted. */
  recordedAt?: Date;
}

/**
 * Allowlist of job-data field names whose values may be hashed (never stored).
 * The collector projects `job.data` down to these keys before hashing. Adding
 * a field here is safe; it only widens the hash input. Removing one changes the
 * hash of in-flight observations — do so deliberately.
 */
export const PAYLOAD_HASH_ALLOWLIST = [
  'correlationId',
  'causationJobId',
  'asin',
  'ebayOrderId',
  'amazonAccountId',
  'productId',
  'userId',
  'listingSettingsGroupId',
] as const;

/** Default retention window (days) when env is unset. */
export const QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS = 7;

/** Minimum retention (days) — clamp floor. */
export const QUEUE_OBSERVABILITY_MIN_RETENTION_DAYS = 1;

/** Maximum retention (days) — clamp ceiling. */
export const QUEUE_OBSERVABILITY_MAX_RETENTION_DAYS = 90;

/**
 * Resolve the retention window from a raw env value.
 *
 * - Non-finite / non-positive / NaN → default (7).
 * - Below min → min (1). Above max → max (90).
 *
 * Pure — safe to unit-test without env.
 */
export function resolveRetentionDays(
  raw: number | undefined | null,
): number {
  if (raw === undefined || raw === null) {
    return QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS;
  }
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    return QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS;
  }
  const floored = Math.floor(n);
  return Math.min(
    QUEUE_OBSERVABILITY_MAX_RETENTION_DAYS,
    Math.max(QUEUE_OBSERVABILITY_MIN_RETENTION_DAYS, floored),
  );
}

/**
 * Project a job-data payload down to the allowlisted fields, preserving only
 * the keys in {@link PAYLOAD_HASH_ALLOWLIST} that are present and whose values
 * are primitives (string | number | boolean | null). Nested objects/arrays are
 * dropped (their structure is not part of the hash — only the allowlisted
 * scalar identifiers). This guarantees the hash never inadvertently captures
 * PII or large payload bodies.
 */
export function redactPayloadToAllowlist(
  payload: unknown,
  allowlist: readonly string[] = PAYLOAD_HASH_ALLOWLIST,
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};
  if (payload === null || payload === undefined || typeof payload !== 'object') {
    return out;
  }
  if (Array.isArray(payload)) {
    return out;
  }
  const record = payload as Record<string, unknown>;
  for (const key of allowlist) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      const value = record[key];
      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        out[key] = value;
      }
    }
  }
  return out;
}

/**
 * Compute a stable SHA-256 hex hash of an allowlisted payload projection.
 *
 * The input is the output of {@link redactPayloadToAllowlist} (or any record
 * of scalar values). Keys are sorted for determinism. Returns `null` when the
 * projection is empty (no allowlisted signal → no hash stored). The raw payload
 * is never persisted; only this hash is.
 *
 * Implemented on the API side (`queue-observability.helpers.ts`) via
 * `node:crypto` — not in this environment-agnostic shared file.
 */
export type ComputePayloadHashFn = (
  allowlistedFields: Record<string, string | number | boolean | null>,
) => string | null;
