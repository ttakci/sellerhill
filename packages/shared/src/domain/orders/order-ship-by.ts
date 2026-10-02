// packages/shared/src/domain/orders/order-ship-by.ts
//
// eBay's ship-by deadline as a FLAG beside the stage, never a stage of its
// own: an order is "purchased AND late", "blocked AND late" — one more stage
// would hide the other. `deriveShipByState` and the SQL builders below are the
// same rule in two languages; `order-ship-by.spec.ts` compares them.

import { ACTIONABLE_ORDER_STAGES } from './order-stage';
import { buildOrderStageSql } from './order-stage-sql';
import { OrderShipByState, OrderStage } from './orders.types';

/**
 * Stages in which eBay has not received a shipment yet, so its ship-by date
 * still counts. An unpaid order has no deadline to meet; a shipped, delivered
 * or cancelled one has nothing left to be late with.
 */
export const STAGES_AWAITING_EBAY_SHIPMENT: readonly OrderStage[] = [
  OrderStage.AMAZON_CANCELLED,
  OrderStage.TEST_RUN,
  OrderStage.TRACKING_HELD,
  OrderStage.BUYING,
  OrderStage.PURCHASED,
  OrderStage.PURCHASE_UNKNOWN,
  OrderStage.PURCHASE_BLOCKED,
  OrderStage.TO_PURCHASE,
];

/** A deadline this close is "due soon". */
export const SHIP_BY_DUE_SOON_HOURS = 24;

export interface OrderShipByInput {
  stage: OrderStage;
  shipByDate?: string | Date | null;
  now: Date;
}

/** `null` = no deadline to worry about (none reported, or already shipped). */
export function deriveShipByState(input: OrderShipByInput): OrderShipByState | null {
  if (!input.shipByDate || !STAGES_AWAITING_EBAY_SHIPMENT.includes(input.stage)) {
    return null;
  }
  const due = new Date(input.shipByDate).getTime();
  if (!Number.isFinite(due)) {
    return null;
  }
  const remaining = due - input.now.getTime();
  if (remaining < 0) {
    return OrderShipByState.LATE;
  }
  return remaining < SHIP_BY_DUE_SOON_HOURS * 3_600_000 ? OrderShipByState.DUE_SOON : null;
}

const quoted = (stages: readonly OrderStage[]): string => stages.map((s) => `'${s}'`).join(', ');

/** Only enum constants and the alias are interpolated. */
export function buildShipByStateSql(alias: string, state: OrderShipByState): string {
  const due = `${alias}.ebay_ship_by_date`;
  const window =
    state === OrderShipByState.LATE
      ? `${due} < NOW()`
      : `${due} >= NOW() AND ${due} < NOW() + INTERVAL '${SHIP_BY_DUE_SOON_HOURS} hours'`;
  return `(${due} IS NOT NULL AND ${window} AND ${buildOrderStageSql(alias)} IN (${quoted(
    STAGES_AWAITING_EBAY_SHIPMENT
  )}))`;
}

/**
 * "Needs action": a stage the seller must act on, OR a ship-by date already
 * missed. The list's Needs-action tab, its count and the default sort all read
 * this one predicate.
 */
export function buildNeedsActionSql(alias: string): string {
  return `(${buildOrderStageSql(alias)} IN (${quoted(ACTIONABLE_ORDER_STAGES)}) OR ${buildShipByStateSql(
    alias,
    OrderShipByState.LATE
  )})`;
}

export function orderNeedsAction(stage: OrderStage, shipByState: OrderShipByState | null | undefined): boolean {
  return ACTIONABLE_ORDER_STAGES.includes(stage) || shipByState === OrderShipByState.LATE;
}
