import { OrderFulfillmentState } from '@repo/shared';
import type { BadgeVariant, IconName } from '@repo/ui';

/**
 * Presentation for the derived seller-facing fulfillment state.
 *
 * One place decides how each state looks, so the list column, the detail page and
 * any future surface cannot disagree about what "purchased" or "action required"
 * means visually. The state itself is derived server-side
 * (`deriveFulfillmentState`), so this file is purely visual mapping.
 *
 * Variant policy follows urgency, not internals:
 *  - action required / Amazon cancelled -> warning / error: the seller must act.
 *  - purchased                          -> success: done, nothing to do.
 *  - in progress                        -> info: automation is working.
 *  - manual / not automated             -> secondary: normal, no action implied.
 *  - simulated                          -> neutral: operator diagnostics only.
 */
export const fulfillmentStateToBadgeVariant = (
  state: OrderFulfillmentState | undefined | null,
): BadgeVariant => {
  if (!state) {
    return 'secondary';
  }
  const map: Record<OrderFulfillmentState, BadgeVariant> = {
    [OrderFulfillmentState.PURCHASED]: 'success',
    [OrderFulfillmentState.AMAZON_CANCELLED]: 'error',
    [OrderFulfillmentState.ACTION_REQUIRED]: 'warning',
    [OrderFulfillmentState.IN_PROGRESS]: 'info',
    [OrderFulfillmentState.NOT_AUTOMATED]: 'secondary',
    [OrderFulfillmentState.MANUAL]: 'secondary',
    [OrderFulfillmentState.SIMULATED]: 'neutral',
  };
  return map[state] ?? 'secondary';
};

/**
 * i18n key for the state's consequence + next step, or undefined when the label
 * already says everything (purchased / manual / in progress need no advice).
 *
 * A raw reason code like "blocked · address" told the seller nothing about what
 * to DO, which is the whole point of surfacing the state.
 */
export const fulfillmentStateNoticeKey = (
  state: OrderFulfillmentState | undefined | null,
): string | undefined => {
  switch (state) {
    case OrderFulfillmentState.SIMULATED:
      return 'orders.fulfillmentState.detail.simulatedNotice';
    case OrderFulfillmentState.ACTION_REQUIRED:
      return 'orders.fulfillmentState.detail.actionRequiredNotice';
    case OrderFulfillmentState.AMAZON_CANCELLED:
      return 'orders.fulfillmentState.detail.cancelledNotice';
    case OrderFulfillmentState.NOT_AUTOMATED:
      return 'orders.fulfillmentState.detail.notAutomatedNotice';
    default:
      return undefined;
  }
};

/**
 * Leading icon per state. A colour alone is not enough: the states differ in
 * kind (done / working / blocked), and colour-only encoding fails for
 * colour-blind users and in dense tables.
 */
export const fulfillmentStateToIcon = (
  state: OrderFulfillmentState | undefined | null,
): IconName => {
  if (!state) {
    return 'minus';
  }
  const map: Record<OrderFulfillmentState, IconName> = {
    [OrderFulfillmentState.PURCHASED]: 'check-circle',
    [OrderFulfillmentState.AMAZON_CANCELLED]: 'alert-circle',
    [OrderFulfillmentState.ACTION_REQUIRED]: 'alert-triangle',
    [OrderFulfillmentState.IN_PROGRESS]: 'clock',
    [OrderFulfillmentState.NOT_AUTOMATED]: 'minus',
    [OrderFulfillmentState.MANUAL]: 'user',
    [OrderFulfillmentState.SIMULATED]: 'info',
  };
  return map[state] ?? 'minus';
};
