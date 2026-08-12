import { AutoFulfillStatus, OrderFulfillmentState, OrderStatus } from './orders.types';

/** Inputs the derivation needs. Mirrors the columns, so callers pass raw values. */
export interface FulfillmentStateInput {
  status: OrderStatus;
  autoFulfillStatus?: AutoFulfillStatus | null;
  amazonOrderId?: string | null;
  amazonCancelledAt?: string | Date | null;
  /** True when the stored Amazon order id is a dry-run placeholder. */
  isSimulated?: boolean;
}

/**
 * A settled eBay sale — the buyer has the item and the order is closed.
 *
 * `COMPLETED` is the ONLY terminal status the platform ever writes:
 * `mapOrderStatus` maps eBay's fulfillment statuses onto
 * pending/waiting_shipment/processing/shipped, and an Amazon-side cancellation
 * deliberately stamps `amazon_cancelled_at` WITHOUT touching `orders.status`
 * (the eBay sale is still live). `SHIPPED` is deliberately NOT settled: the
 * parcel has not arrived, so an Amazon cancellation after the tracking push is
 * very much still the seller's problem.
 */
function isSettled(status: OrderStatus): boolean {
  return status === OrderStatus.COMPLETED;
}

/**
 * Collapse the three separate axes into the one state a seller acts on.
 *
 * Precedence is deliberate:
 *  0. **A settled sale is never action-required.** Whatever went wrong on the
 *     Amazon side — a cancellation, a blocked checkout — a completed eBay order
 *     means the seller already resolved it another way, so it reports as
 *     MANUAL. Without this rule an order fixed by hand stayed in the "needs
 *     you" bucket forever: there is no acknowledge flag on an order, so nothing
 *     would ever clear it, and an action list that cannot reach zero stops
 *     being read.
 *  1. Otherwise an Amazon-side cancellation outranks everything — the money
 *     moved, the item is not coming, and the eBay sale is still owed.
 *  2. A dry-run is flagged before "purchased" so a simulated order can never be
 *     mistaken for a real one.
 *  3. `blocked`/`failed` outrank `placed` only via (1); otherwise a placed order
 *     is done.
 *  4. Without any automation record, a linked Amazon order means the seller did
 *     it manually.
 *
 * `buildFulfillmentStateSql` mirrors this chain branch for branch. Any change
 * here MUST be made there too — `fulfillment-state-sql.guard.spec.ts` fails the
 * build if the two fall out of step.
 */
export function deriveFulfillmentState(
  input: FulfillmentStateInput,
): OrderFulfillmentState {
  const settled = isSettled(input.status);

  if (input.amazonCancelledAt) {
    return settled ? OrderFulfillmentState.MANUAL : OrderFulfillmentState.AMAZON_CANCELLED;
  }
  if (input.isSimulated) {
    return OrderFulfillmentState.SIMULATED;
  }

  switch (input.autoFulfillStatus) {
    case AutoFulfillStatus.PLACED:
      return OrderFulfillmentState.PURCHASED;
    case AutoFulfillStatus.BLOCKED:
    case AutoFulfillStatus.FAILED:
      // Same rule as (0): automation failed, but the sale closed anyway, so the
      // seller handled it and there is nothing left to act on.
      return settled ? OrderFulfillmentState.MANUAL : OrderFulfillmentState.ACTION_REQUIRED;
    case AutoFulfillStatus.RUNNING:
    case AutoFulfillStatus.PENDING:
      return OrderFulfillmentState.IN_PROGRESS;
    case AutoFulfillStatus.DRY_RUN:
      return OrderFulfillmentState.SIMULATED;
    case AutoFulfillStatus.SKIPPED:
      // Automation declined this order (gate off / no eligible account). If the
      // seller bought it by hand anyway, that is the more useful label.
      return input.amazonOrderId
        ? OrderFulfillmentState.MANUAL
        : OrderFulfillmentState.NOT_AUTOMATED;
    default:
      break;
  }

  // No automation record at all.
  if (input.amazonOrderId) {
    return OrderFulfillmentState.MANUAL;
  }
  if (input.status === OrderStatus.SHIPPED || input.status === OrderStatus.COMPLETED) {
    return OrderFulfillmentState.MANUAL;
  }
  return OrderFulfillmentState.NOT_AUTOMATED;
}

/** States the seller must personally act on — what the filter's default view is for. */
export const ACTIONABLE_FULFILLMENT_STATES: readonly OrderFulfillmentState[] = [
  OrderFulfillmentState.ACTION_REQUIRED,
  OrderFulfillmentState.AMAZON_CANCELLED,
];

export function isActionableFulfillmentState(state: OrderFulfillmentState): boolean {
  return ACTIONABLE_FULFILLMENT_STATES.includes(state);
}

/**
 * Dry-run Amazon order ids carry this prefix so a simulated purchase is
 * distinguishable from a real one in the DB, the UI and any later reconciliation
 * — without a schema change, and without ever looking like a real Amazon id.
 */
export const SIMULATED_AMAZON_ORDER_PREFIX = 'SIM-';

export function isSimulatedAmazonOrderId(amazonOrderId?: string | null): boolean {
  return Boolean(amazonOrderId?.startsWith(SIMULATED_AMAZON_ORDER_PREFIX));
}
