import type { OrderDto } from '@repo/shared';
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
    },
    {
      label: t('orders.table.buyer'),
      value: order.buyerName || '—',
    },
    {
      label: t('orders.table.date'),
      value: formatDate(order.createdAt),
    },
  ];

  if (order.product?.quantity) {
    meta.push({
      label: t('orders.detail.quantity'),
      value: String(order.product.quantity),
    });
  }

  if (order.product?.asin) {
    meta.push({
      label: t('orders.table.asin'),
      value: order.product.asin,
      storeType: 'amazon',
    });
  }

  if (order.product?.ebayItemId) {
    meta.push({
      label: t('orders.table.ebayId'),
      value: order.product.ebayItemId,
      storeType: 'ebay',
    });
  }

  const profitTone =
    order.netProfit > 0 ? 'positive' : order.netProfit < 0 ? 'negative' : 'default';

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
