import { ACTIONABLE_ORDER_STAGES, isTrackingHeldOverdue, ORDER_STAGE_ORDER, OrderStage } from '@repo/shared';

import type { OrderStagePresentation } from './order-stage.types';

// Colours group by MEANING (red = money/reputation at risk, amber = your
// work, blue/primary/secondary = the system is working, green/grey = done);
// the icon and the legend tell the stages within a group apart.
const PRESENTATION: Record<OrderStage, OrderStagePresentation> = {
  [OrderStage.AMAZON_CANCELLED]: { variant: 'error', icon: 'x-circle' },
  [OrderStage.CANCELLED]: { variant: 'neutral', icon: 'x-circle' },
  [OrderStage.DELIVERED]: { variant: 'success', icon: 'package-check' },
  [OrderStage.TEST_RUN]: { variant: 'neutral', icon: 'info' },
  [OrderStage.SHIPPED]: { variant: 'info', icon: 'truck' },
  [OrderStage.TRACKING_HELD]: { variant: 'warning', icon: 'alert-circle' },
  [OrderStage.BUYING]: { variant: 'secondary', icon: 'loader' },
  [OrderStage.PURCHASED]: { variant: 'primary', icon: 'shopping-bag' },
  // Red with a question mark, not the blocked stage's warning triangle: the
  // instruction is the opposite ("check Amazon before you buy anything").
  [OrderStage.PURCHASE_UNKNOWN]: { variant: 'error', icon: 'help' },
  [OrderStage.PURCHASE_BLOCKED]: { variant: 'error', icon: 'alert-triangle' },
  [OrderStage.AWAITING_PAYMENT]: { variant: 'neutral', icon: 'circle-dollar-sign' },
  [OrderStage.TO_PURCHASE]: { variant: 'warning', icon: 'shopping-cart' },
};

export function orderStagePresentation(
  stage: OrderStage,
  opts: { shippedDetectedAt?: string | null; now: Date }
): OrderStagePresentation {
  const base = PRESENTATION[stage];
  // A held tracking is "waiting" for the first 12 hours and "a problem" after.
  if (stage === OrderStage.TRACKING_HELD && isTrackingHeldOverdue(opts.shippedDetectedAt, opts.now)) {
    return { ...base, variant: 'error' };
  }
  return base;
}

/**
 * Stages offered in the Status select and the legend. Every stage is reachable
 * since order sync reads eBay cancellations (2026-09-30), so this is the whole
 * list; the constant stays as the one place to hide a stage again.
 */
export const SELLER_VISIBLE_ORDER_STAGES: readonly OrderStage[] = ORDER_STAGE_ORDER;

const STAGES_WITH_ACTION: readonly OrderStage[] = [...ACTIONABLE_ORDER_STAGES, OrderStage.TO_PURCHASE];

/**
 * Stages under which the auto-fulfill reason is shown. The reason explains why
 * nothing was bought (`purchase_blocked`), why the outcome is unknown
 * (`purchase_unknown`) or why automation left the order to the seller
 * (`to_purchase`: a multi-item order, a listing outside the plan limit). On any
 * later stage the order has moved on and a stale reason must not linger.
 */
const STAGES_SHOWING_REASON: readonly OrderStage[] = [
  OrderStage.PURCHASE_BLOCKED,
  OrderStage.PURCHASE_UNKNOWN,
  OrderStage.TO_PURCHASE,
];

export function orderStageShowsReason(stage: OrderStage): boolean {
  return STAGES_SHOWING_REASON.includes(stage);
}

/** Stages in which the seller still has to act, so eBay's ship-by date matters. */
const STAGES_WITH_DEADLINE: readonly OrderStage[] = [
  OrderStage.TO_PURCHASE,
  OrderStage.PURCHASE_BLOCKED,
  OrderStage.PURCHASE_UNKNOWN,
  OrderStage.AMAZON_CANCELLED,
];

export function orderStageHasDeadline(stage: OrderStage): boolean {
  return STAGES_WITH_DEADLINE.includes(stage);
}

/** A ship-by date this close (or already past) is shown as urgent. */
export const SHIP_BY_URGENT_HOURS = 24;

export function isShipByUrgent(shipByDate: string | null | undefined, now: Date): boolean {
  if (!shipByDate) {
    return false;
  }
  const due = new Date(shipByDate).getTime();
  return Number.isFinite(due) && due - now.getTime() <= SHIP_BY_URGENT_HOURS * 3_600_000;
}

/** Whether `orders.stage.<stage>.action` exists — the "what you do" sentence. */
export function orderStageHasAction(stage: OrderStage): boolean {
  return STAGES_WITH_ACTION.includes(stage);
}
