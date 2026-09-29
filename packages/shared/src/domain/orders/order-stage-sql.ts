// packages/shared/src/domain/orders/order-stage-sql.ts
//
// SQL twin of `deriveOrderStage` — one ordered CASE so the list filter, the
// tab counts and the Action Center all read the same stage the DTO carries.
// Grammar is deliberately tiny (no OR: nest CASE instead) because
// `order-stage-sql.guard.spec.ts` interprets it and compares it with the
// TypeScript on every input combination. Only enum constants are
// interpolated.

import { SIMULATED_AMAZON_ORDER_PREFIX } from './fulfillment-state';
import { AutoFulfillStatus, OrderStage, OrderStatus } from './orders.types';

export function buildOrderStageSql(alias: string): string {
  const status = `${alias}.status`;
  const auto = `${alias}.auto_fulfill_status`;
  const cancelled = `${alias}.amazon_cancelled_at IS NOT NULL`;
  const simulated = `COALESCE(${alias}.amazon_order_id, '') LIKE '${SIMULATED_AMAZON_ORDER_PREFIX}%'`;
  const hasAmazonOrder = `${alias}.amazon_order_id IS NOT NULL`;
  const shippedDetected = `${alias}.shipped_detected_at IS NOT NULL`;
  const pushed = `${alias}.ebay_tracking_pushed_at IS NOT NULL`;

  return `CASE
    WHEN ${cancelled} AND ${status} <> '${OrderStatus.COMPLETED}' THEN '${OrderStage.AMAZON_CANCELLED}'
    WHEN ${status} = '${OrderStatus.CANCELLED}' THEN '${OrderStage.CANCELLED}'
    WHEN ${status} = '${OrderStatus.COMPLETED}' THEN '${OrderStage.DELIVERED}'
    WHEN ${simulated} THEN '${OrderStage.TEST_RUN}'
    WHEN ${auto} = '${AutoFulfillStatus.DRY_RUN}' AND ${alias}.amazon_order_id IS NULL THEN '${OrderStage.TEST_RUN}'
    WHEN ${status} IN ('${OrderStatus.SHIPPED}', '${OrderStatus.PROCESSING}') THEN '${OrderStage.SHIPPED}'
    WHEN ${pushed} THEN '${OrderStage.SHIPPED}'
    WHEN ${shippedDetected} THEN '${OrderStage.TRACKING_HELD}'
    WHEN ${auto} IN ('${AutoFulfillStatus.PENDING}', '${AutoFulfillStatus.RUNNING}') THEN '${OrderStage.BUYING}'
    WHEN ${hasAmazonOrder} THEN '${OrderStage.PURCHASED}'
    WHEN ${auto} IN ('${AutoFulfillStatus.BLOCKED}', '${AutoFulfillStatus.FAILED}') THEN '${OrderStage.PURCHASE_BLOCKED}'
    WHEN ${status} = '${OrderStatus.PENDING}' THEN '${OrderStage.AWAITING_PAYMENT}'
    ELSE '${OrderStage.TO_PURCHASE}'
  END`;
}
