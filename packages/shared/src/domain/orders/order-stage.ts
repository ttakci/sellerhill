// packages/shared/src/domain/orders/order-stage.ts
//
// ONE seller-facing status per order. `deriveOrderStage` and
// `buildOrderStageSql` (order-stage-sql.ts) are the same decision in two
// languages; `order-stage-sql.guard.spec.ts` proves it on every input
// combination, so change them together.

import { isSimulatedAmazonOrderId } from './fulfillment-state';
import { AutoFulfillStatus, OrderStage, OrderStageTab, OrderStatus } from './orders.types';

export interface OrderStageInput {
  status: OrderStatus;
  autoFulfillStatus?: AutoFulfillStatus | null;
  amazonOrderId?: string | null;
  amazonCancelledAt?: string | Date | null;
  /** `orders.shipped_detected_at` — Amazon observed shipped (migration 089). */
  shippedDetectedAt?: string | Date | null;
  /** `orders.ebay_tracking_pushed_at` — eBay received a fulfillment (089). */
  ebayTrackingPushedAt?: string | Date | null;
  /**
   * `orders.auto_fulfill_submitted_at` (132) — stamped immediately before the
   * Place Order click. Set while nothing proves the purchase = outcome unknown.
   */
  autoFulfillSubmittedAt?: string | Date | null;
}

/** Priority order — the first rule that matches wins. */
export function deriveOrderStage(input: OrderStageInput): OrderStage {
  // A cancelled eBay sale first: there is no buyer left to serve, so neither
  // an Amazon cancellation ("buy it again") nor a blocked purchase is an
  // action any more. An Amazon order still open for it is the Action Center's
  // ORDER_CANCELLED_AMAZON_OPEN.
  if (input.status === OrderStatus.CANCELLED) {
    return OrderStage.CANCELLED;
  }
  const settled = input.status === OrderStatus.COMPLETED;
  if (input.amazonCancelledAt && !settled) {
    return OrderStage.AMAZON_CANCELLED;
  }
  if (settled) {
    return OrderStage.DELIVERED;
  }
  // A dry run is a test only while nothing real was bought: the manual link
  // writes a real Amazon order id without touching auto_fulfill_status, and
  // that order must then read as purchased / shipped / held like any other.
  if (
    isSimulatedAmazonOrderId(input.amazonOrderId) ||
    (input.autoFulfillStatus === AutoFulfillStatus.DRY_RUN && !input.amazonOrderId)
  ) {
    return OrderStage.TEST_RUN;
  }
  // eBay's IN_PROGRESS (PROCESSING) means at least one line item shipped, and
  // the platform only reads lineItems[0] — so it is shipped, never "to buy"
  // (the same reading `isOrderAlreadyFulfilled` gives auto-fulfill).
  if (input.status === OrderStatus.SHIPPED || input.status === OrderStatus.PROCESSING || input.ebayTrackingPushedAt) {
    return OrderStage.SHIPPED;
  }
  if (input.shippedDetectedAt) {
    return OrderStage.TRACKING_HELD;
  }
  if (input.autoFulfillStatus === AutoFulfillStatus.PENDING || input.autoFulfillStatus === AutoFulfillStatus.RUNNING) {
    return OrderStage.BUYING;
  }
  // PLACED without an id: the purchase is proven (Amazon's "Order placed"
  // page) but its order number has not been read yet — cost-capture links it
  // later. It must never read as "to purchase", or the seller buys it twice.
  if (input.amazonOrderId || input.autoFulfillStatus === AutoFulfillStatus.PLACED) {
    return OrderStage.PURCHASED;
  }
  // The click went out and nothing above proves a purchase (no Amazon order
  // id, not PLACED). The order may exist on Amazon: it must read as neither
  // "blocked, try again" nor "to purchase", or it gets bought twice.
  if (input.autoFulfillSubmittedAt) {
    return OrderStage.PURCHASE_UNKNOWN;
  }
  if (input.autoFulfillStatus === AutoFulfillStatus.BLOCKED || input.autoFulfillStatus === AutoFulfillStatus.FAILED) {
    return OrderStage.PURCHASE_BLOCKED;
  }
  if (input.status === OrderStatus.PENDING) {
    return OrderStage.AWAITING_PAYMENT;
  }
  return OrderStage.TO_PURCHASE;
}

/** Legend / select order — the enum's own order. */
export const ORDER_STAGE_ORDER: readonly OrderStage[] = Object.values(OrderStage);

/** Stages the seller must act on — red badges, the "Needs action" tab. */
export const ACTIONABLE_ORDER_STAGES: readonly OrderStage[] = [
  OrderStage.AMAZON_CANCELLED,
  OrderStage.TRACKING_HELD,
  OrderStage.PURCHASE_UNKNOWN,
  OrderStage.PURCHASE_BLOCKED,
];

export const ORDER_STAGE_TABS: Readonly<Record<OrderStageTab, readonly OrderStage[]>> = {
  [OrderStageTab.ALL]: ORDER_STAGE_ORDER,
  [OrderStageTab.ACTION]: ACTIONABLE_ORDER_STAGES,
  [OrderStageTab.TO_PURCHASE]: [OrderStage.TO_PURCHASE, OrderStage.AWAITING_PAYMENT],
  [OrderStageTab.IN_PROGRESS]: [OrderStage.BUYING, OrderStage.PURCHASED, OrderStage.SHIPPED, OrderStage.TEST_RUN],
  [OrderStageTab.DONE]: [OrderStage.DELIVERED, OrderStage.CANCELLED],
};

/** A held order is "waiting" for this long, then it is "a problem" (red).
 *  Same grace the Action Center's ORDER_TRACKING_CONVERSION_HELD uses. */
export const TRACKING_HELD_ALARM_HOURS = 12;

export function isTrackingHeldOverdue(shippedDetectedAt: string | Date | null | undefined, now: Date): boolean {
  if (!shippedDetectedAt) {
    return false;
  }
  const since = new Date(shippedDetectedAt).getTime();
  return now.getTime() - since >= TRACKING_HELD_ALARM_HOURS * 3_600_000;
}
