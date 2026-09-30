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
 * Stages a seller can meet today. `cancelled` is reserved: `mapOrderStatus` never
 * writes OrderStatus.CANCELLED, so offering it in the Status select or the legend
 * would promise a state that cannot appear. It stays in the enum, the SQL twin and
 * the i18n (a future eBay-cancel sync needs no migration) and is one line to re-list.
 */
export const SELLER_VISIBLE_ORDER_STAGES: readonly OrderStage[] = ORDER_STAGE_ORDER.filter(
  (stage) => stage !== OrderStage.CANCELLED
);

const STAGES_WITH_ACTION: readonly OrderStage[] = [...ACTIONABLE_ORDER_STAGES, OrderStage.TO_PURCHASE];

/** Whether `orders.stage.<stage>.action` exists — the "what you do" sentence. */
export function orderStageHasAction(stage: OrderStage): boolean {
  return STAGES_WITH_ACTION.includes(stage);
}
