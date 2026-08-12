/**
 * `buildFulfillmentStateSql` is a hand-written SQL copy of
 * `deriveFulfillmentState`. Two implementations of one rule drift — that is
 * exactly what happened to the seven per-state predicates this expression
 * replaced, where a BLOCKED order with a linked Amazon id matched both the
 * MANUAL and the ACTION_REQUIRED filter.
 *
 * There is no database in this harness, so equivalence is proven the only way
 * that is honest without one: a tiny evaluator interprets the generated SQL's
 * branch chain against a row, and every reachable combination of the four
 * inputs is checked against the TypeScript function. If someone edits one side
 * and not the other, a combination diverges and this fails.
 */

import {
  AutoFulfillStatus,
  OrderFulfillmentState,
  OrderStatus,
  buildFulfillmentStateSql,
  deriveFulfillmentState,
  isSimulatedAmazonOrderId,
  SIMULATED_AMAZON_ORDER_PREFIX,
} from '@repo/shared';

interface Row {
  status: OrderStatus;
  auto_fulfill_status: AutoFulfillStatus | null;
  amazon_order_id: string | null;
  amazon_cancelled_at: string | null;
}

/**
 * Evaluate one `WHEN <cond> THEN '<state>'` chain against a row.
 *
 * The parser understands only the handful of shapes the builder emits — that is
 * deliberate. If the builder starts emitting a construct this cannot read, the
 * parse throws rather than silently passing, so an unreviewed SQL change cannot
 * slip through as a green test.
 */
function evaluateCondition(condition: string, row: Row, alias: string): boolean {
  const c = condition.trim();

  if (c.startsWith('NOT (') && c.endsWith(')')) {
    return !evaluateCondition(c.slice(5, -1), row, alias);
  }

  const and = splitTopLevel(c, ' AND ');
  if (and.length > 1) {
    return and.every((part) => evaluateCondition(part, row, alias));
  }

  if (c === `${alias}.status = '${OrderStatus.COMPLETED}'`) {
    return row.status === OrderStatus.COMPLETED;
  }
  if (c === `${alias}.amazon_cancelled_at IS NOT NULL`) {
    return row.amazon_cancelled_at !== null;
  }
  if (c === `${alias}.amazon_order_id IS NOT NULL`) {
    return row.amazon_order_id !== null;
  }
  if (c === `COALESCE(${alias}.amazon_order_id, '') LIKE '${SIMULATED_AMAZON_ORDER_PREFIX}%'`) {
    return (row.amazon_order_id ?? '').startsWith(SIMULATED_AMAZON_ORDER_PREFIX);
  }

  const eq = /^(\w+)\.(\w+) = '([^']*)'$/.exec(c);
  if (eq && eq[1] === alias) {
    return String(row[eq[2] as keyof Row] ?? '') === eq[3];
  }

  const inList = /^(\w+)\.(\w+) IN \(([^)]*)\)$/.exec(c);
  if (inList && inList[1] === alias) {
    const values = inList[3].split(',').map((v) => v.trim().replace(/^'|'$/g, ''));
    return values.includes(String(row[inList[2] as keyof Row] ?? ''));
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
    if (char === '(') {depth++;}
    if (char === ')') {depth--;}
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

/** Interpret the generated CASE expression (including its nested CASEs). */
function evaluateCase(sql: string, row: Row, alias: string): OrderFulfillmentState {
  const body = sql.trim().replace(/^CASE/, '').replace(/END$/, '');

  // Split into branches at top-level WHEN/ELSE, leaving nested CASE ... END intact.
  const tokens: Array<{ when?: string; then: string }> = [];
  const whenRe = /\bWHEN\b/g;
  const segments: string[] = [];
  let lastIndex = 0;
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body.startsWith('CASE', i)) {depth++;}
    if (body.startsWith('END', i)) {depth--;}
    if (depth === 0 && (body.startsWith('WHEN', i) || body.startsWith('ELSE', i)) && i > lastIndex) {
      segments.push(body.slice(lastIndex, i));
      lastIndex = i;
    }
  }
  segments.push(body.slice(lastIndex));
  whenRe.lastIndex = 0;

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
    const result = token.then;
    if (result.startsWith('CASE')) {
      return evaluateCase(result, row, alias);
    }
    return result.replace(/^'|'$/g, '') as OrderFulfillmentState;
  }

  throw new Error('CASE expression fell through with no ELSE');
}

describe('buildFulfillmentStateSql', () => {
  const ALIAS = 'o';
  const sql = buildFulfillmentStateSql(ALIAS);

  const statuses = Object.values(OrderStatus);
  const autoStatuses: Array<AutoFulfillStatus | null> = [null, ...Object.values(AutoFulfillStatus)];
  const amazonIds = [null, '123-4567890-1234567', `${SIMULATED_AMAZON_ORDER_PREFIX}123-456`];
  const cancelledAts = [null, '2026-08-12T00:00:00Z'];

  it('agrees with deriveFulfillmentState on every combination of inputs', () => {
    const divergences: string[] = [];

    for (const status of statuses) {
      for (const auto of autoStatuses) {
        for (const amazonOrderId of amazonIds) {
          for (const amazon_cancelled_at of cancelledAts) {
            const row: Row = {
              status,
              auto_fulfill_status: auto,
              amazon_order_id: amazonOrderId,
              amazon_cancelled_at,
            };
            const fromSql = evaluateCase(sql, row, ALIAS);
            const fromTs = deriveFulfillmentState({
              status,
              autoFulfillStatus: auto,
              amazonOrderId,
              amazonCancelledAt: amazon_cancelled_at,
              isSimulated: isSimulatedAmazonOrderId(amazonOrderId),
            });
            if (fromSql !== fromTs) {
              divergences.push(
                `${status}/${auto ?? 'none'}/${amazonOrderId ?? 'none'}/` +
                  `${amazon_cancelled_at ? 'cancelled' : 'live'}: SQL=${fromSql} TS=${fromTs}`,
              );
            }
          }
        }
      }
    }

    expect(divergences).toEqual([]);
  });

  it('can produce every state, so no branch is unreachable', () => {
    const produced = new Set<OrderFulfillmentState>();
    for (const status of statuses) {
      for (const auto of autoStatuses) {
        for (const amazonOrderId of amazonIds) {
          for (const amazon_cancelled_at of cancelledAts) {
            produced.add(
              evaluateCase(
                sql,
                {
                  status,
                  auto_fulfill_status: auto,
                  amazon_order_id: amazonOrderId,
                  amazon_cancelled_at,
                },
                ALIAS,
              ),
            );
          }
        }
      }
    }
    expect([...produced].sort()).toEqual([...Object.values(OrderFulfillmentState)].sort());
  });

  it('produces states that are mutually exclusive by construction', () => {
    // A CASE returns exactly one value per row, which is the structural
    // property the seven old predicates lacked: they could, and did, match the
    // same order under two different filters.
    const row: Row = {
      status: OrderStatus.WAITING_SHIPMENT,
      auto_fulfill_status: AutoFulfillStatus.BLOCKED,
      amazon_order_id: '123-4567890-1234567',
      amazon_cancelled_at: null,
    };
    const matches = Object.values(OrderFulfillmentState).filter(
      (state) => evaluateCase(sql, row, ALIAS) === state,
    );
    expect(matches).toEqual([OrderFulfillmentState.ACTION_REQUIRED]);
  });

  it('honours the caller alias so it can be embedded in any query', () => {
    expect(buildFulfillmentStateSql('orders')).toContain('orders.amazon_cancelled_at');
    expect(buildFulfillmentStateSql('orders')).not.toContain('o.amazon_cancelled_at');
  });
});
