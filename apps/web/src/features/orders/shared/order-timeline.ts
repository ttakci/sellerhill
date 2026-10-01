import { OrderTimelineNote, OrderTimelineStepKey, OrderTimelineStepState } from '@repo/shared';
import type { IconName } from '@repo/ui';

import { orderStagePresentation } from './order-stage';
import type {
  OrderStage,
  OrderTimelineRow,
  OrderTimelineRowContext,
  OrderTimelineStepDto,
} from './order-timeline.types';

/** The step's own glyph — shown while the step is still ahead. */
const STEP_ICON: Record<OrderTimelineStepKey, IconName> = {
  [OrderTimelineStepKey.RECEIVED]: 'receipt',
  [OrderTimelineStepKey.PURCHASE]: 'shopping-cart',
  [OrderTimelineStepKey.AMAZON_SHIPPED]: 'box',
  [OrderTimelineStepKey.EBAY_TRACKING]: 'truck',
  [OrderTimelineStepKey.DELIVERED]: 'package-check',
  [OrderTimelineStepKey.SALE_CANCELLED]: 'x-circle',
  [OrderTimelineStepKey.MESSAGE_ORDER_RECEIVED]: 'mail',
  [OrderTimelineStepKey.MESSAGE_SHIPPED]: 'mail',
  [OrderTimelineStepKey.MESSAGE_DELIVERED]: 'mail',
  [OrderTimelineStepKey.MESSAGE_FEEDBACK_REQUEST]: 'mail',
};

/**
 * The marker glyph. A finished step is a check and a step that did not happen
 * here is a dash, whatever the step; the step the order is standing on wears
 * its STAGE's icon (the same one the stage badge shows), so the timeline and
 * the badge never look like two different statuses.
 */
export function orderTimelineIcon(
  step: OrderTimelineStepDto,
  stage: OrderStage,
  opts: { shippedDetectedAt?: string | null; now: Date }
): IconName {
  if (step.isMessage || step.key === OrderTimelineStepKey.SALE_CANCELLED) {
    return STEP_ICON[step.key];
  }
  if (step.state === OrderTimelineStepState.DONE) {
    return 'check';
  }
  if (step.state === OrderTimelineStepState.SKIPPED) {
    return 'minus';
  }
  if (step.note === OrderTimelineNote.STAGE) {
    return orderStagePresentation(stage, opts).icon;
  }
  if (step.state === OrderTimelineStepState.CURRENT) {
    return 'clock';
  }
  return STEP_ICON[step.key];
}

/** Resolve the API's codes into the strings the timeline renders. */
export function toOrderTimelineRows(
  steps: readonly OrderTimelineStepDto[] | undefined,
  ctx: OrderTimelineRowContext
): OrderTimelineRow[] {
  return (steps ?? []).map((step) => {
    const explainedByStage = step.note === OrderTimelineNote.STAGE;
    return {
      id: step.key,
      label: ctx.t(`orders.timeline.step.${step.key}`),
      state: step.state,
      icon: orderTimelineIcon(step, ctx.stage, { shippedDetectedAt: ctx.shippedDetectedAt, now: ctx.now }),
      dateLabel: step.at ? ctx.formatDate(step.at) : null,
      description: explainedByStage
        ? ctx.t(`orders.stage.${ctx.stage}.meaning`)
        : ctx.t(`orders.timeline.note.${step.note}`),
      action: explainedByStage ? ctx.stageAction : null,
      reason: explainedByStage && step.key === OrderTimelineStepKey.PURCHASE ? ctx.reasonLabel : null,
      reference: step.reference ?? null,
      isMessage: step.isMessage === true,
    };
  });
}
