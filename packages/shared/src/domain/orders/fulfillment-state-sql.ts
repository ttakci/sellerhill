import { SIMULATED_AMAZON_ORDER_PREFIX } from './fulfillment-state';
import { AutoFulfillStatus, OrderFulfillmentState, OrderStatus } from './orders.types';

/**
 * The SQL twin of {@link deriveFulfillmentState}.
 *
 * **Why an ordered CASE and not one predicate per state.** The orders list used
 * to carry seven independent WHERE predicates, each re-encoding the whole
 * precedence chain by hand. They had already drifted from the function: the
 * MANUAL predicate matched any non-`placed` order with an `amazon_order_id`,
 * so a BLOCKED order with a linked Amazon id was returned by BOTH the MANUAL
 * and the ACTION_REQUIRED filter while the row itself rendered as
 * ACTION_REQUIRED. Seven copies of a precedence chain cannot be kept in step;
 * one ordered chain can, because it IS the precedence.
 *
 * The expression evaluates to a {@link OrderFulfillmentState} value, so callers
 * compare it to a bound parameter (filter) or GROUP BY it (counts) instead of
 * spelling out state logic themselves. That is what makes the Action Center's
 * counts equal to what the list shows, by construction rather than by comment.
 *
 * Only enum constants are interpolated — never caller input — so the string is
 * a compile-time constant, not a query built from user data.
 *
 * @param alias table alias for `orders` in the surrounding query (e.g. `o`).
 */
export function buildFulfillmentStateSql(alias: string): string {
  const settled = `${alias}.status = '${OrderStatus.COMPLETED}'`;
  const cancelled = `${alias}.amazon_cancelled_at IS NOT NULL`;
  const simulated = `COALESCE(${alias}.amazon_order_id, '') LIKE '${SIMULATED_AMAZON_ORDER_PREFIX}%'`;
  const hasAmazonOrder = `${alias}.amazon_order_id IS NOT NULL`;
  const autoStatus = `${alias}.auto_fulfill_status`;

  // Branch order below is the function's branch order. Do not reorder.
  return `CASE
    WHEN ${cancelled} AND NOT (${settled}) THEN '${OrderFulfillmentState.AMAZON_CANCELLED}'
    WHEN ${cancelled} THEN '${OrderFulfillmentState.MANUAL}'
    WHEN ${simulated} THEN '${OrderFulfillmentState.SIMULATED}'
    WHEN ${autoStatus} = '${AutoFulfillStatus.PLACED}' THEN '${OrderFulfillmentState.PURCHASED}'
    WHEN ${autoStatus} IN ('${AutoFulfillStatus.BLOCKED}', '${AutoFulfillStatus.FAILED}')
      THEN CASE WHEN ${settled} THEN '${OrderFulfillmentState.MANUAL}' ELSE '${OrderFulfillmentState.ACTION_REQUIRED}' END
    WHEN ${autoStatus} IN ('${AutoFulfillStatus.PENDING}', '${AutoFulfillStatus.RUNNING}')
      THEN '${OrderFulfillmentState.IN_PROGRESS}'
    WHEN ${autoStatus} = '${AutoFulfillStatus.DRY_RUN}' THEN '${OrderFulfillmentState.SIMULATED}'
    WHEN ${autoStatus} = '${AutoFulfillStatus.SKIPPED}'
      THEN CASE WHEN ${hasAmazonOrder} THEN '${OrderFulfillmentState.MANUAL}' ELSE '${OrderFulfillmentState.NOT_AUTOMATED}' END
    WHEN ${hasAmazonOrder} THEN '${OrderFulfillmentState.MANUAL}'
    WHEN ${alias}.status IN ('${OrderStatus.SHIPPED}', '${OrderStatus.COMPLETED}')
      THEN '${OrderFulfillmentState.MANUAL}'
    ELSE '${OrderFulfillmentState.NOT_AUTOMATED}'
  END`;
}
