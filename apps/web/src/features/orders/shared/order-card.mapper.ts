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
  formatDay?: (value: string) => string
): Omit<OrderCardProps, 'onClick' | 'className'> => {
  // Each order is money in its OWN store's currency, never a page-wide one.
  const money = (value: number) => formatCurrency(value, order.ebayAccountId);
  const productTitle =
    order.product?.title && order.product.title.trim().length > 0
      ? order.product.title
      : t('orders.detail.unknownProduct');

  // The same facts as the listing card, in the same order: order, buyer,
  // date, quantity, then the Amazon and eBay ids of the product.
  const meta: OrderCardProps['meta'] = [
    { label: t('orders.table.orderNumber'), value: order.ebayOrderId },
    { label: t('orders.table.buyer'), value: order.buyerName || '—' },
    { label: t('orders.table.date'), value: formatDate(order.createdAt) },
  ];

  meta.push({ label: t('orders.detail.quantity'), value: String(order.product?.quantity ?? 1) });

  if (order.product?.asin) {
    meta.push({ label: t('orders.table.asin'), value: order.product.asin, storeType: 'amazon' });
  }

  if (order.product?.ebayItemId) {
    meta.push({ label: t('orders.table.ebayId'), value: order.product.ebayItemId, storeType: 'ebay' });
  }

  // The seller's own note rides with the facts, cut to one line; the whole
  // text is on the detail page.
  if (order.sellerNote) {
    meta.push({ label: t('orders.note.label'), value: order.sellerNote });
  }

  const roi = order.purchasePrice > 0 ? (order.netProfit / order.purchasePrice) * 100 : null;
  const profitTone = order.netProfit >= 0 ? 'positive' : 'negative';

  // Chips beside the stage: ship-by deadline, refund, estimated profit and, where it explains the stage, the
  // automatic-purchase reason. There is no "untracked" chip: SellerHill does not follow those orders at all.
  const statsBadges: OrderCardProps['statsBadges'] = [...orderFlagBadges(order, t, money, formatDay)];
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
    detailLabel: t('translation:common.details'),
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
      {
        label: t('orders.detail.roi'),
        // Profit over what the order cost; unknown until a cost is captured.
        value: roi === null ? '—' : `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`,
        tone: roi === null ? 'default' : roi >= 0 ? 'positive' : 'negative',
      },
    ],
  };
};
