import { OrderStage, ProfitBasis, type OrderDto } from '@repo/shared';
import type { TFunction } from 'i18next';

import { orderFlagBadges } from './order-flags';
import { orderStageShowsReason } from './order-stage';
import type { OrderCardProps } from './OrderCard';

/**
 * OrderDto → OrderCard props (presentation-ready).
 * Used by overview carousel and all-page grid.
 */
export const toOrderCardProps = (
  order: OrderDto,
  t: TFunction,
  formatCurrency: (value: number, ebayAccountId?: string | null) => string,
  formatDate: (value: string) => string,
  formatDay?: (value: string) => string,
  /** The order's store name — passed only when the seller has more than one store. */
  storeLabel?: string | null
): Omit<OrderCardProps, 'onClick' | 'className'> => {
  // Each order is money in its OWN store's currency, never a page-wide one.
  const money = (value: number) => formatCurrency(value, order.ebayAccountId);
  const productTitle =
    order.product?.title && order.product.title.trim().length > 0
      ? order.product.title
      : t('orders.detail.unknownProduct');

  // Four facts at most: who, when, which order, which product. The eBay item
  // id and a quantity of one say nothing a card needs — they live in the
  // table and on the detail page.
  const meta: OrderCardProps['meta'] = [
    { label: t('orders.table.orderNumber'), value: order.ebayOrderId },
    { label: t('orders.table.buyer'), value: order.buyerName || '—' },
    { label: t('orders.table.date'), value: formatDate(order.createdAt) },
  ];

  if (storeLabel) {
    meta.push({ label: t('translation:common.store'), value: storeLabel });
  }

  if (order.product?.quantity && order.product.quantity > 1) {
    meta.push({ label: t('orders.detail.quantity'), value: String(order.product.quantity) });
  }

  if (order.product?.asin) {
    meta.push({ label: t('orders.table.asin'), value: order.product.asin, storeType: 'amazon' });
  }

  // The seller's own note rides with the facts, cut to one line; the whole
  // text is on the detail page.
  if (order.sellerNote) {
    meta.push({ label: t('orders.note.label'), value: order.sellerNote });
  }

  const profitTone = order.netProfit > 0 ? 'positive' : order.netProfit < 0 ? 'negative' : 'default';

  // A card can carry both at once: an untracked order (no matched listing)
  // can never reach `linked`, so its profit is also always an estimate/unknown.
  const statsBadges: OrderCardProps['statsBadges'] = [...orderFlagBadges(order, t, money, formatDay)];
  if (!order.isTracked) {
    statsBadges.push({ label: t('orders.tracking.untracked'), variant: 'neutral' });
  }
  if (order.profitBasis === ProfitBasis.ESTIMATED) {
    statsBadges.push({ label: t('orders.estimateBadge'), variant: 'warning' });
  }
  // The reason is what makes "Purchase blocked" / "Purchase not confirmed"
  // actionable, and what explains a "To purchase" order automation left to the
  // seller — the table column shows it inline, so the card must too. Red only
  // where the stage itself is red.
  if (orderStageShowsReason(order.stage) && order.autoFulfillBlockedReason) {
    statsBadges.push({
      label: t(`orders.autoFulfill.reason.${order.autoFulfillBlockedReason}`),
      variant: order.stage === OrderStage.TO_PURCHASE ? 'warning' : 'error',
    });
  }

  return {
    productTitle,
    imageUrl: order.product?.imageUrl,
    ebayOrderId: order.ebayOrderId,
    stage: order.stage,
    shippedDetectedAt: order.shippedDetectedAt,
    statsBadges: statsBadges.length > 0 ? statsBadges : undefined,
    meta,
    stats: [
      {
        label: t('orders.table.salePrice'),
        value: money(order.salePrice),
      },
      {
        label: t('orders.table.purchasePrice'),
        value: money(order.purchasePrice),
      },
      {
        label: t('orders.table.netProfit'),
        value: `${order.netProfit >= 0 ? '+' : ''}${money(order.netProfit)}`,
        tone: profitTone,
      },
    ],
  };
};
