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
 * Collapse the three separate axes into the one state a seller acts on.
 *
 * Precedence is deliberate:
 *  1. An Amazon-side cancellation outranks everything — the money moved, the item
 *     is not coming, and the eBay sale is still live. It is the most urgent case.
 *  2. A dry-run is flagged before "purchased" so a simulated order can never be
 *     mistaken for a real one.
 *  3. `blocked`/`failed` outrank `placed` only via (1); otherwise a placed order
 *     is done.
 *  4. Without any automation record, a linked Amazon order means the seller did
 *     it manually.
 */
export function deriveFulfillmentState(
  input: FulfillmentStateInput,
): OrderFulfillmentState {
  if (input.amazonCancelledAt) {
    return OrderFulfillmentState.AMAZON_CANCELLED;
  }
  if (input.isSimulated) {
    return OrderFulfillmentState.SIMULATED;
  }

  switch (input.autoFulfillStatus) {
    case AutoFulfillStatus.PLACED:
      return OrderFulfillmentState.PURCHASED;
    case AutoFulfillStatus.BLOCKED:
    case AutoFulfillStatus.FAILED:
      return OrderFulfillmentState.ACTION_REQUIRED;
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
