// apps/api/src/modules/orders/order-stage-sql.guard.spec.ts
//
// `buildOrderStageSql` and `deriveOrderStage` are the same decision written
// twice — once for Postgres (the list filter, the tab counts, the Action
// Center) and once for TypeScript (the DTO). This spec interprets the
// generated CASE expression with a tiny evaluator and compares it with the
// function on EVERY combination of inputs, so the two cannot drift apart
// silently. The evaluator throws on any SQL it does not understand, which is
// what keeps the SQL's grammar small (no OR — nest CASE instead).

import {
  AutoFulfillStatus,
  buildOrderStageSql,
  deriveOrderStage,
  OrderStage,
  OrderStatus,
  SIMULATED_AMAZON_ORDER_PREFIX,
} from '@repo/shared';

interface Row {
  status: OrderStatus;
  auto_fulfill_status: AutoFulfillStatus | null;
  amazon_order_id: string | null;
  amazon_cancelled_at: string | null;
  shipped_detected_at: string | null;
  ebay_tracking_pushed_at: string | null;
}

const NULLABLE_COLUMNS = [
  'amazon_cancelled_at',
  'amazon_order_id',
  'shipped_detected_at',
  'ebay_tracking_pushed_at',
] as const;

function evaluateCondition(condition: string, row: Row, alias: string): boolean {
  const c = condition.trim();

  if (c.startsWith('NOT (') && c.endsWith(')')) {
    return !evaluateCondition(c.slice(5, -1), row, alias);
  }

  const and = splitTopLevel(c, ' AND ');
  if (and.length > 1) {
    return and.every((part) => evaluateCondition(part, row, alias));
  }

  for (const name of NULLABLE_COLUMNS) {
    if (c === `${alias}.${name} IS NOT NULL`) {
      return row[name] !== null;
    }
    if (c === `${alias}.${name} IS NULL`) {
      return row[name] === null;
    }
  }

  if (c === `COALESCE(${alias}.amazon_order_id, '') LIKE '${SIMULATED_AMAZON_ORDER_PREFIX}%'`) {
    return (row.amazon_order_id ?? '').startsWith(SIMULATED_AMAZON_ORDER_PREFIX);
  }

  const eq = /^(\w+)\.(\w+) = '([^']*)'$/.exec(c);
  if (eq && eq[1] === alias) {
    return String(row[eq[2] as keyof Row] ?? '') === eq[3];
  }

  const ne = /^(\w+)\.(\w+) <> '([^']*)'$/.exec(c);
  if (ne && ne[1] === alias) {
    return String(row[ne[2] as keyof Row] ?? '') !== ne[3];
  }

  const inList = /^(\w+)\.(\w+) IN \(([^)]*)\)$/.exec(c);
  if (inList && inList[1] === alias) {
    const values = inList[3].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
    const actual = row[inList[2] as keyof Row];
    return actual !== null && values.includes(String(actual));
  }

  throw new Error(`Unrecognized SQL condition — update this evaluator: ${c}`);
}

/** Split on a separator, ignoring occurrences nested inside parentheses. */
function splitTopLevel(input: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '(') {
      depth++;
    }
    if (char === ')') {
      depth--;
    }
    if (depth === 0 && input.startsWith(separator, i)) {
      parts.push(current);
      current = '';
      i += separator.length - 1;
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}

/** Interpret the generated CASE expression (including nested CASEs). */
function evaluateCase(sql: string, row: Row, alias: string): OrderStage {
  const body = sql.trim().replace(/^CASE/, '').replace(/END$/, '');

  const tokens: Array<{ when?: string; then: string }> = [];
  const segments: string[] = [];
  let lastIndex = 0;
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body.startsWith('CASE', i)) {
      depth++;
    }
    if (body.startsWith('END', i)) {
      depth--;
    }
    if (depth === 0 && (body.startsWith('WHEN', i) || body.startsWith('ELSE', i)) && i > lastIndex) {
      segments.push(body.slice(lastIndex, i));
      lastIndex = i;
    }
  }
  segments.push(body.slice(lastIndex));

  for (const segment of segments.map((s) => s.trim()).filter(Boolean)) {
    if (segment.startsWith('ELSE')) {
      tokens.push({ then: segment.slice(4).trim() });
      continue;
    }
    const [condition, ...rest] = splitTopLevel(segment.slice(4), ' THEN ');
    tokens.push({ when: condition.trim(), then: rest.join(' THEN ').trim() });
  }

  for (const token of tokens) {
    if (token.when !== undefined && !evaluateCondition(token.when, row, alias)) {
      continue;
    }
    if (token.then.startsWith('CASE')) {
      return evaluateCase(token.then, row, alias);
    }
    return token.then.replace(/^'|'$/g, '') as OrderStage;
  }

  throw new Error('CASE expression fell through with no ELSE');
}

const ALIAS = 'o';
const sql = buildOrderStageSql(ALIAS);

const statuses = Object.values(OrderStatus);
const autos: (AutoFulfillStatus | null)[] = [null, ...Object.values(AutoFulfillStatus)];
const amazonIds = [null, '111-2222222-3333333', `${SIMULATED_AMAZON_ORDER_PREFIX}1`];
const stamps = [null, '2026-09-30T00:00:00Z'];

function* everyRow(): Generator<Row> {
  for (const status of statuses) {
    for (const auto of autos) {
      for (const amazonId of amazonIds) {
        for (const cancelledAt of stamps) {
          for (const shippedAt of stamps) {
            for (const pushedAt of stamps) {
              yield {
                status,
                auto_fulfill_status: auto,
                amazon_order_id: amazonId,
                amazon_cancelled_at: cancelledAt,
                shipped_detected_at: shippedAt,
                ebay_tracking_pushed_at: pushedAt,
              };
            }
          }
        }
      }
    }
  }
}

describe('buildOrderStageSql', () => {
  it('agrees with deriveOrderStage on every combination of inputs', () => {
    let combos = 0;
    for (const row of everyRow()) {
      const expected = deriveOrderStage({
        status: row.status,
        autoFulfillStatus: row.auto_fulfill_status,
        amazonOrderId: row.amazon_order_id,
        amazonCancelledAt: row.amazon_cancelled_at,
        shippedDetectedAt: row.shipped_detected_at,
        ebayTrackingPushedAt: row.ebay_tracking_pushed_at,
      });
      expect({ row, stage: evaluateCase(sql, row, ALIAS) }).toEqual({ row, stage: expected });
      combos += 1;
    }
    expect(combos).toBe(statuses.length * autos.length * amazonIds.length * 8);
  });

  it('can produce every stage, so no branch is unreachable', () => {
    const seen = new Set<string>();
    for (const row of everyRow()) {
      seen.add(evaluateCase(sql, row, ALIAS));
    }
    expect([...seen].sort()).toEqual(Object.values(OrderStage).sort());
  });

  it('honours the caller alias', () => {
    expect(buildOrderStageSql('orders')).toContain('orders.shipped_detected_at');
    expect(buildOrderStageSql('orders')).not.toContain('o.shipped_detected_at');
  });
});
