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

  const profitTone = order.netProfit >= 0 ? 'positive' : 'negative';

  // Chips beside the stage: ship-by deadline, refund, estimated profit and, where it explains the stage, the
  // automatic-purchase reason. There is no "untracked" chip: SellerHill does not follow those orders at all.
  // An order SellerHill does not follow (no matching listing) carries ONE chip and
  // nothing else: no stage, no deadline, no estimate — none of them would mean anything.
  const statsBadges: OrderCardProps['statsBadges'] = order.isTracked
    ? [...orderFlagBadges(order, t, money, formatDay)]
    : [{ label: t('orders.tracking.untracked'), variant: 'neutral' }];
  // The reason is what makes "Purchase blocked" / "Purchase not confirmed"
  // actionable, and what explains a "To purchase" order automation left to the
  // seller — the table column shows it inline, so the card must too. Red only
  // where the stage itself is red.
  if (order.isTracked && orderStageShowsReason(order.stage) && order.autoFulfillBlockedReason) {
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
    showStage: order.isTracked,
    // "Estimated" qualifies the money, so it leads the figures row, not the top row.
    // A cancelled sale is settled, not estimated.
    footerBadge:
      order.isTracked && order.profitBasis === ProfitBasis.ESTIMATED && order.stage !== OrderStage.CANCELLED
        ? { label: t('orders.estimateBadge'), variant: 'warning' as const }
        : undefined,
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
        value: order.isTracked ? money(order.purchasePrice) : '—',
      },
      {
        label: t('orders.table.netProfit'),
        value: order.isTracked ? `${order.netProfit >= 0 ? '+' : ''}${money(order.netProfit)}` : '—',
        tone: order.isTracked ? profitTone : 'default',
      },
    ],
  };
};
