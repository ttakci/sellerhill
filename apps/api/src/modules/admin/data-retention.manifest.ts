// apps/api/src/modules/admin/data-retention.manifest.ts
//
// The single declaration of which append-only tables get purged, how old is
// too old, and which column carries the age. Pure — no Nest, no pg, no fs — so
// the SQL-safety guards below are unit-testable.
//
// WHY A MANIFEST INSTEAD OF A SERVICE PER TABLE
// ---------------------------------------------
// `queue_observations` already had a bespoke retention worker while five other
// append-only tables had none, and `keepa_usage_log` — the fastest-growing of
// all of them at one row per REQUESTED ASIN per refresh (~26M rows/year on a
// full schedule) — was one of the five. Adding a second bespoke worker per
// table would have produced six copies of the same batched DELETE. One
// manifest + one worker means adding a table is a single entry here.
//
// SQL SAFETY
// ----------
// Table and column names cannot be bound as query parameters, so they are
// interpolated. That is only safe because every identifier comes from this
// frozen, literal-typed list and is additionally validated by
// `isSafeSqlIdentifier` before it reaches a query. `data-retention.manifest.spec.ts`
// asserts both properties, which is what stops a future entry from being
// sourced from config or user input.

import { PlatformSettingKey } from '@repo/shared';

/**
 * Tables under retention management.
 *
 * Deliberately NOT in `@repo/shared`: these are physical schema names, and the
 * shared package is consumed by the browser bundle. Domain enums belong there;
 * the database's table list does not.
 */
export enum DataRetentionTable {
  QUEUE_OBSERVATIONS = 'queue_observations',
  KEEPA_USAGE_LOG = 'keepa_usage_log',
  LLM_USAGE_LOG = 'llm_usage_log',
  USAGE_EVENTS = 'usage_events',
  BUYER_MESSAGE_LOG = 'buyer_message_log',
  AUDIT_LOGS = 'audit_logs',
}

export interface DataRetentionRule {
  table: DataRetentionTable;
  /** TIMESTAMPTZ column the age predicate reads. */
  timestampColumn: string;
  /** Operator-tunable window; the registry owns its default and bounds. */
  settingKey: PlatformSettingKey;
  /**
   * Absolute floor enforced in code, independent of the registry. Defence in
   * depth: a bad override row must not be able to delete data that something
   * else depends on for correctness.
   */
  minDays: number;
  /** Why this table is purged, and anything that makes its floor load-bearing. */
  rationale: string;
}

export const DATA_RETENTION_RULES: readonly DataRetentionRule[] = [
  {
    table: DataRetentionTable.QUEUE_OBSERVATIONS,
    timestampColumn: 'recorded_at',
    settingKey: PlatformSettingKey.RETENTION_QUEUE_OBSERVATIONS_DAYS,
    minDays: 1,
    rationale:
      'BullMQ completed/failed events for the admin Queues tab. Purely diagnostic — nothing reads it beyond the recent-history view.',
  },
  {
    table: DataRetentionTable.KEEPA_USAGE_LOG,
    timestampColumn: 'requested_at',
    settingKey: PlatformSettingKey.RETENTION_KEEPA_USAGE_LOG_DAYS,
    minDays: 7,
    rationale:
      'One row per requested ASIN per refresh — the fastest-growing table in the schema. Cost attribution is projected into usage_events, which is kept far longer, so purging the source loses only per-ASIN detail.',
  },
  {
    table: DataRetentionTable.LLM_USAGE_LOG,
    timestampColumn: 'requested_at',
    settingKey: PlatformSettingKey.RETENTION_LLM_USAGE_LOG_DAYS,
    minDays: 7,
    rationale:
      'Per-call LLM usage. Same story as Keepa: the durable cost record lives in usage_events.',
  },
  {
    table: DataRetentionTable.USAGE_EVENTS,
    timestampColumn: 'recorded_at',
    settingKey: PlatformSettingKey.RETENTION_USAGE_EVENTS_DAYS,
    minDays: 30,
    rationale:
      'The FinOps projection behind the admin Costs tab. Kept longer than its source logs so year-over-year period comparisons survive a source purge.',
  },
  {
    table: DataRetentionTable.BUYER_MESSAGE_LOG,
    timestampColumn: 'created_at',
    settingKey: PlatformSettingKey.RETENTION_BUYER_MESSAGE_LOG_DAYS,
    minDays: 180,
    rationale:
      'CORRECTNESS-LOAD-BEARING: the partial unique index on (ebay_order_id, event_type) WHERE status = \'sent\' is the only thing preventing a buyer being messaged twice for the same event. Deleting a row re-arms that event for its order, so the floor must comfortably exceed any order lifecycle (including a delayed feedback request).',
  },
  {
    table: DataRetentionTable.AUDIT_LOGS,
    timestampColumn: 'created_at',
    settingKey: PlatformSettingKey.RETENTION_AUDIT_LOGS_DAYS,
    minDays: 365,
    rationale:
      'Compliance evidence for role changes and platform-setting edits — the record you need to answer "who changed what, when". Long floor on purpose.',
  },
] as const;

/**
 * Rows deleted per statement. Big enough that a daily purge finishes, small
 * enough that no single DELETE holds locks or bloats WAL for long. A purge of
 * millions of rows runs as many bounded statements rather than one huge one.
 */
export const DATA_RETENTION_BATCH_SIZE = 5_000;

/**
 * Hard cap on batches per table per run, so a badly-configured window cannot
 * let one table monopolise the nightly job. Leftovers are picked up by the
 * next run — the purge is idempotent and resumable by construction.
 */
export const DATA_RETENTION_MAX_BATCHES = 400;

/** Outcome for one table in one run. */
export interface DataRetentionTableResult {
  table: DataRetentionTable;
  deletedRows: number;
  retentionDays: number;
  /** True when the batch cap stopped us before the table was fully caught up. */
  truncated: boolean;
  failed: boolean;
  error?: string;
}

/**
 * Whether an identifier is safe to interpolate into SQL. Plain lowercase
 * snake_case only — no quotes, whitespace, semicolons, or dots.
 *
 * Every manifest identifier is a compile-time literal, so this can never fire
 * in practice today; it exists so that if someone later sources a table or
 * column name from config, the query still refuses to build.
 */
export function isSafeSqlIdentifier(value: string): boolean {
  return /^[a-z][a-z0-9_]*$/.test(value) && value.length <= 63;
}

/**
 * Clamp a resolved retention window to the rule's floor.
 *
 * An unusable value (NaN, non-finite, at or below zero) falls back to the
 * floor rather than to zero — "delete everything" must never be reachable by
 * mistyping a setting.
 */
export function clampRetentionDays(rule: DataRetentionRule, raw: number | null | undefined): number {
  if (raw === null || raw === undefined || !Number.isFinite(raw) || raw <= 0) {
    return rule.minDays;
  }
  return Math.max(rule.minDays, Math.floor(raw));
}

/**
 * Build the batched DELETE for one rule.
 *
 * Uses a `ctid IN (SELECT … LIMIT n)` subquery: it needs no primary key (
 * `queue_observations` and `keepa_usage_log` have different key shapes) and
 * bounds each statement to `DATA_RETENTION_BATCH_SIZE` rows. The interval is
 * bound as a parameter; only the validated identifiers are interpolated.
 *
 * @throws when an identifier fails validation — refusing to build is the
 *         correct outcome, never a best-effort query.
 */
export function buildRetentionDeleteSql(rule: DataRetentionRule, batchSize: number): string {
  if (!isSafeSqlIdentifier(rule.table)) {
    throw new Error(`Unsafe retention table identifier: ${rule.table}`);
  }
  if (!isSafeSqlIdentifier(rule.timestampColumn)) {
    throw new Error(`Unsafe retention column identifier: ${rule.timestampColumn}`);
  }
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error(`Invalid retention batch size: ${batchSize}`);
  }
  return `WITH victims AS (
      SELECT ctid FROM ${rule.table}
      WHERE ${rule.timestampColumn} < NOW() - ($1 || ' days')::INTERVAL
      LIMIT ${batchSize}
    ), deleted AS (
      DELETE FROM ${rule.table} WHERE ctid IN (SELECT ctid FROM victims) RETURNING 1
    )
    SELECT COUNT(*)::TEXT AS deleted FROM deleted`;
}
