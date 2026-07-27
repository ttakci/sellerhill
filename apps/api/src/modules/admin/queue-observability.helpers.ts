// apps/api/src/modules/admin/queue-observability.helpers.ts
//
// API-side pure helpers for queue observability. The node-free helpers
// (`resolveRetentionDays`, `redactPayloadToAllowlist`, `PAYLOAD_HASH_ALLOWLIST`,
// enums/DTOs) live in `packages/shared` (environment-agnostic — consumed by
// web too). Only `computePayloadHash` requires `node:crypto`, so it lives here
// on the API side, conforming to the shared `ComputePayloadHashFn` signature.
// Jest-covered by `queue-observability-helpers.spec.ts`.

import { createHash } from 'node:crypto';

import {
  type ComputePayloadHashFn,
  PAYLOAD_HASH_ALLOWLIST,
  QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS,
  QUEUE_OBSERVABILITY_MAX_RETENTION_DAYS,
  QUEUE_OBSERVABILITY_MIN_RETENTION_DAYS,
  QueueEventType,
  QueueObservabilityRetentionKind,
  redactPayloadToAllowlist,
  resolveRetentionDays,
} from '@repo/shared';

// Re-export the shared node-free helpers + enums/DTOs so API consumers import
// from one place.
export {
  PAYLOAD_HASH_ALLOWLIST,
  QUEUE_OBSERVABILITY_DEFAULT_RETENTION_DAYS,
  QUEUE_OBSERVABILITY_MAX_RETENTION_DAYS,
  QUEUE_OBSERVABILITY_MIN_RETENTION_DAYS,
  QueueEventType,
  QueueObservabilityRetentionKind,
  redactPayloadToAllowlist,
  resolveRetentionDays,
};
export type {
  ComputePayloadHashFn,
  QueueObservationDto,
  QueueObservationParams,
  QueueObservationPurgeResult,
  QueueObservationQuery,
  QueueObservationRecordResult,
  QueueObservabilityRetentionConfig,
} from '@repo/shared';

/**
 * Compute a stable SHA-256 hex hash of an allowlisted payload projection.
 *
 * The input is the output of `redactPayloadToAllowlist` (or any record of
 * scalar values). Keys are sorted for determinism so the same logical payload
 * always produces the same hash regardless of insertion order. Returns `null`
 * when the projection is empty (no allowlisted signal → no hash stored).
 *
 * The raw payload is never persisted; only this hash is. Collectors call
 * `redactPayloadToAllowlist(job.data)` then this — the raw job.data never
 * reaches the DB layer.
 */
export const computePayloadHash: ComputePayloadHashFn = (
  allowlistedFields: Record<string, string | number | boolean | null>,
): string | null => {
  if (allowlistedFields === null || typeof allowlistedFields !== 'object') {
    return null;
  }
  const keys = Object.keys(allowlistedFields).sort();
  if (keys.length === 0) {
    return null;
  }
  // Stable serialization: sorted keys, JSON primitive values.
  const stable = keys
    .map((k) => `${k}=${JSON.stringify(allowlistedFields[k])}`)
    .join('&');
  return createHash('sha256').update(stable, 'utf8').digest('hex');
};
