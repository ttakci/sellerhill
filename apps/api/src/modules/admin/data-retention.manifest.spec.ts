// apps/api/src/modules/admin/data-retention.manifest.spec.ts
//
// Two classes of guard here:
//   * SQL safety — identifiers are interpolated, so the manifest must never
//     carry anything that is not a bare snake_case identifier.
//   * Correctness floors — `buyer_message_log` doubles as the "don't message
//     this buyer twice" ledger, so its window is not a free tuning knob.

import { PlatformSettingKey } from '@repo/shared';

import {
  buildRetentionDeleteSql,
  clampRetentionDays,
  DATA_RETENTION_BATCH_SIZE,
  DATA_RETENTION_MAX_BATCHES,
  DATA_RETENTION_RULES,
  DataRetentionTable,
  isSafeSqlIdentifier,
  type DataRetentionRule,
} from './data-retention.manifest';

const ruleFor = (table: DataRetentionTable): DataRetentionRule => {
  const rule = DATA_RETENTION_RULES.find((r) => r.table === table);
  if (!rule) {
    throw new Error(`missing rule for ${table}`);
  }
  return rule;
};

describe('DATA_RETENTION_RULES', () => {
  it('covers every table exactly once', () => {
    const tables = DATA_RETENTION_RULES.map((r) => r.table);
    expect(new Set(tables).size).toBe(tables.length);
    expect(new Set(tables)).toEqual(new Set(Object.values(DataRetentionTable)));
  });

  it('uses a distinct platform setting key per table', () => {
    const keys = DATA_RETENTION_RULES.map((r) => r.settingKey);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(Object.values(PlatformSettingKey)).toContain(key);
    }
  });

  it('only names safe SQL identifiers', () => {
    for (const rule of DATA_RETENTION_RULES) {
      expect(isSafeSqlIdentifier(rule.table)).toBe(true);
      expect(isSafeSqlIdentifier(rule.timestampColumn)).toBe(true);
    }
  });

  it('gives every rule a positive floor and a stated rationale', () => {
    for (const rule of DATA_RETENTION_RULES) {
      expect(rule.minDays).toBeGreaterThan(0);
      expect(rule.rationale.length).toBeGreaterThan(20);
    }
  });

  it('keeps buyer_message_log long enough to remain an idempotency guard', () => {
    // The partial unique index on (ebay_order_id, event_type) WHERE
    // status='sent' is the ONLY thing stopping a duplicate buyer message.
    // Purging a row re-arms that event, so this floor must outlive any order —
    // including a feedback request delayed days after delivery.
    expect(ruleFor(DataRetentionTable.BUYER_MESSAGE_LOG).minDays).toBeGreaterThanOrEqual(180);
  });

  it('keeps audit_logs for at least a year', () => {
    expect(ruleFor(DataRetentionTable.AUDIT_LOGS).minDays).toBeGreaterThanOrEqual(365);
  });

  it('keeps the usage_events projection longer than the source logs it summarises', () => {
    const projection = ruleFor(DataRetentionTable.USAGE_EVENTS);
    expect(projection.minDays).toBeGreaterThanOrEqual(
      ruleFor(DataRetentionTable.KEEPA_USAGE_LOG).minDays,
    );
    expect(projection.minDays).toBeGreaterThanOrEqual(
      ruleFor(DataRetentionTable.LLM_USAGE_LOG).minDays,
    );
  });
});

describe('isSafeSqlIdentifier', () => {
  it('accepts bare snake_case', () => {
    expect(isSafeSqlIdentifier('keepa_usage_log')).toBe(true);
    expect(isSafeSqlIdentifier('recorded_at')).toBe(true);
    expect(isSafeSqlIdentifier('a1')).toBe(true);
  });

  it('rejects anything that could break out of an identifier position', () => {
    for (const bad of [
      '',
      'Users',
      '1table',
      'users; DROP TABLE users',
      'users--',
      'public.users',
      'user"s',
      "user's",
      'user s',
      'users\n',
      '_leading',
      'a'.repeat(64),
    ]) {
      expect(isSafeSqlIdentifier(bad)).toBe(false);
    }
  });
});

describe('clampRetentionDays', () => {
  const rule = ruleFor(DataRetentionTable.BUYER_MESSAGE_LOG);

  it('returns the value when it is above the floor', () => {
    expect(clampRetentionDays(rule, 400)).toBe(400);
  });

  it('raises a below-floor value to the floor', () => {
    expect(clampRetentionDays(rule, 1)).toBe(rule.minDays);
  });

  it('never lets a bad value mean "delete everything"', () => {
    // Zero/negative/NaN must resolve to the FLOOR, not to 0 — a mistyped
    // override must not be able to wipe the table.
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null, undefined]) {
      expect(clampRetentionDays(rule, bad)).toBe(rule.minDays);
    }
  });

  it('floors fractional values', () => {
    expect(clampRetentionDays(ruleFor(DataRetentionTable.KEEPA_USAGE_LOG), 90.9)).toBe(90);
  });
});

describe('buildRetentionDeleteSql', () => {
  const rule = ruleFor(DataRetentionTable.KEEPA_USAGE_LOG);

  it('binds the age window as a parameter rather than interpolating it', () => {
    const sql = buildRetentionDeleteSql(rule, DATA_RETENTION_BATCH_SIZE);
    expect(sql).toContain('$1');
    expect(sql).toContain('keepa_usage_log');
    expect(sql).toContain('requested_at <');
  });

  it('bounds each statement with the batch size', () => {
    const sql = buildRetentionDeleteSql(rule, 250);
    expect(sql).toContain('LIMIT 250');
  });

  it('refuses to build for an unsafe identifier instead of degrading', () => {
    expect(() =>
      buildRetentionDeleteSql(
        { ...rule, table: 'users; DROP TABLE users' as DataRetentionTable },
        DATA_RETENTION_BATCH_SIZE,
      ),
    ).toThrow(/Unsafe retention table/);
    expect(() =>
      buildRetentionDeleteSql({ ...rule, timestampColumn: 'a b' }, DATA_RETENTION_BATCH_SIZE),
    ).toThrow(/Unsafe retention column/);
  });

  it('rejects a non-positive or fractional batch size', () => {
    for (const bad of [0, -5, 1.5, Number.NaN]) {
      expect(() => buildRetentionDeleteSql(rule, bad)).toThrow(/Invalid retention batch size/);
    }
  });
});

describe('batch bounds', () => {
  it('are positive integers', () => {
    expect(Number.isInteger(DATA_RETENTION_BATCH_SIZE)).toBe(true);
    expect(DATA_RETENTION_BATCH_SIZE).toBeGreaterThan(0);
    expect(Number.isInteger(DATA_RETENTION_MAX_BATCHES)).toBe(true);
    expect(DATA_RETENTION_MAX_BATCHES).toBeGreaterThan(0);
  });
});
