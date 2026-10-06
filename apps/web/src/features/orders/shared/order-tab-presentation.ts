/**
 * Presentation mapping for Orders stage tabs (mirrors Action Center).
 * The API groups stages into tabs; exactly one file decides how each tab looks.
 */

import { OrderStageTab } from '@repo/shared';
import type { IconName } from '@repo/ui';

export const ORDER_TAB_ICON: Record<OrderStageTab, IconName> = {
  [OrderStageTab.ALL]: 'format-list-bulleted',
  [OrderStageTab.ACTION]: 'shield-alert',
  [OrderStageTab.TO_PURCHASE]: 'shopping-cart',
  [OrderStageTab.IN_PROGRESS]: 'loader',
  [OrderStageTab.DONE]: 'check-circle',
};

export const orderTabToIcon = (tab: OrderStageTab): IconName => ORDER_TAB_ICON[tab];
