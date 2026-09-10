import { ProfitBasis, type OrderDto } from '@repo/shared';
import type { TFunction } from 'i18next';

import type { OrderCardProps } from './OrderCard';

/**
 * OrderDto → OrderCard props (presentation-ready).
 * Used by overview carousel and all-page grid.
 */
export const toOrderCardProps = (
  order: OrderDto,
  t: TFunction,
  formatCurrency: (value: number) => string,
  formatDate: (value: string) => string
): Omit<OrderCardProps, 'onClick' | 'className'> => {
  const productTitle =
    order.product?.title && order.product.title.trim().length > 0
      ? order.product.title
      : t('orders.detail.unknownProduct');

  const meta: OrderCardProps['meta'] = [
    {
      label: t('orders.table.orderNumber'),
      value: order.ebayOrderId,
      icon: 'receipt',
    },
    {
      label: t('orders.table.buyer'),
      value: order.buyerName || '—',
      icon: 'user',
    },
    {
      label: t('orders.table.date'),
      value: formatDate(order.createdAt),
      icon: 'calendar',
    },
  ];

  if (order.product?.quantity) {
    meta.push({
      label: t('orders.detail.quantity'),
      value: String(order.product.quantity),
      icon: 'box',
    });
  }

  if (order.product?.asin) {
    meta.push({
      label: t('orders.table.asin'),
      value: order.product.asin,
      storeType: 'amazon',
      icon: 'barcode',
    });
  }

  if (order.product?.ebayItemId) {
    meta.push({
      label: t('orders.table.ebayId'),
      value: order.product.ebayItemId,
      storeType: 'ebay',
      icon: 'tag',
    });
  }

  const profitTone =
    order.netProfit > 0 ? 'positive' : order.netProfit < 0 ? 'negative' : 'default';

  // A card can carry both at once: an untracked order (no matched listing)
  // can never reach `linked`, so its profit is also always an estimate/unknown.
  const statsBadges: OrderCardProps['statsBadges'] = [];
  if (!order.isTracked) {
    statsBadges.push({ label: t('orders.tracking.untracked'), variant: 'neutral' });
  }
  if (order.profitBasis === ProfitBasis.ESTIMATED) {
    statsBadges.push({ label: t('orders.estimateBadge'), variant: 'warning' });
  }

  return {
    productTitle,
    imageUrl: order.product?.imageUrl,
    ebayOrderId: order.ebayOrderId,
    status: order.status,
    statusLabel: (() => {
      const key = `orders.status.${order.status}`;
      const translated = t(key);
      return translated === key ? order.status : translated;
    })(),
    statsBadges: statsBadges.length > 0 ? statsBadges : undefined,
    meta,
    stats: [
      {
        label: t('orders.table.salePrice'),
        value: formatCurrency(order.salePrice),
      },
      {
        label: t('orders.table.purchasePrice'),
        value: formatCurrency(order.purchasePrice),
      },
      {
        label: t('orders.table.netProfit'),
        value: `${order.netProfit >= 0 ? '+' : ''}${formatCurrency(order.netProfit)}`,
        tone: profitTone,
      },
    ],
  };
};
