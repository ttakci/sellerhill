import type { OrderDto } from '@repo/shared';
import { Icon, StatusBadge, Text, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { orderStatusToBadgeStatus } from '../../shared/order-status';
import * as S from '../OrdersAllPage.style';

export function useOrdersColumns(
  formatCurrency: (value: number) => string,
  formatDate: (value: string) => string
) {
  const { t } = useTranslation(['orders', 'translation']);

  return useMemo<TableColumn<OrderDto>[]>(
    () => [
      {
        key: 'ebayOrderId',
        header: t('orders.table.orderNumber'),
        sortable: true,
        render: (_value, order) => (
          <Text variant="body" weight="semibold" color="brand.primary">
            {order.ebayOrderId}
          </Text>
        ),
      },
      {
        key: 'product',
        header: t('orders.table.product'),
        render: (_value, order) => (
          <S.ProductCell>
            <S.ProductThumb>
              {order.product?.imageUrl ? (
                <img src={order.product.imageUrl} alt="" />
              ) : (
                <Icon name="image" size={18} />
              )}
            </S.ProductThumb>
            <Text variant="body-sm" weight="medium">
              {order.product?.title || '—'}
            </Text>
          </S.ProductCell>
        ),
      },
      {
        key: 'createdAt',
        header: t('orders.table.date'),
        sortable: true,
        render: (_value, order) => (
          <Text variant="body-sm" color="text.secondary">
            {formatDate(order.createdAt)}
          </Text>
        ),
      },
      {
        key: 'buyer',
        header: t('orders.table.buyer'),
        render: (_value, order) => (
          <S.BuyerCell>
            <Text variant="body" weight="medium">
              {order.buyerName || '—'}
            </Text>
            {order.buyerEmail ? (
              <Text variant="caption" color="text.secondary">
                {order.buyerEmail}
              </Text>
            ) : null}
          </S.BuyerCell>
        ),
      },
      {
        key: 'status',
        header: t('orders.table.status'),
        sortable: true,
        render: (_value, order) => (
          <StatusBadge status={orderStatusToBadgeStatus(order.status)}>
            {t(`orders.status.${order.status}`)}
          </StatusBadge>
        ),
      },
      {
        key: 'salePrice',
        header: t('orders.table.salePrice'),
        sortable: true,
        render: (_value, order) => (
          <Text variant="body" weight="semibold">
            {formatCurrency(order.salePrice)}
          </Text>
        ),
      },
      {
        key: 'purchasePrice',
        header: t('orders.table.purchasePrice'),
        sortable: true,
        render: (_value, order) => (
          <Text variant="body-sm" color="text.secondary">
            {formatCurrency(order.purchasePrice)}
          </Text>
        ),
      },
      {
        key: 'netProfit',
        header: t('orders.table.netProfit'),
        sortable: true,
        render: (_value, order) => (
          <Text
            variant="body"
            weight="semibold"
            color={order.netProfit >= 0 ? 'semantic.success' : 'semantic.error'}
          >
            {order.netProfit >= 0 ? '+' : ''}
            {formatCurrency(order.netProfit)}
          </Text>
        ),
      },
    ],
    [t, formatCurrency, formatDate]
  );
}
