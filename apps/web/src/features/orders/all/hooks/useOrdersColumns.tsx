import { ProfitBasis, type OrderDto } from '@repo/shared';
import { Badge, Icon, StatusBadge, Text, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { fulfillmentStateToBadgeVariant } from '../../shared/fulfillment-state';
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
        width: '10rem',
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
        width: '18rem',
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
        width: '8rem',
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
        width: '12rem',
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
        width: '8rem',
        sortable: true,
        render: (_value, order) => (
          <StatusBadge status={orderStatusToBadgeStatus(order.status)} size="sm">
            {t(`orders.status.${order.status}`)}
          </StatusBadge>
        ),
      },
      {
        // ONE column answering "did Amazon buy this, and do I need to act?".
        // Previously this showed the raw `auto_fulfill_status` (seven values,
        // several internal) beside a separate cancellation badge, so the reader
        // had to know the schema to interpret it — and an untouched order rendered
        // a bare em dash that said nothing.
        key: 'fulfillmentState',
        header: t('orders.fulfillmentState.column'),
        width: '13rem',
        render: (_value, order) => {
          const state = order.fulfillmentState;
          if (!state) {
            return (
              <Text variant="body-sm" color="text.secondary">
                —
              </Text>
            );
          }
          // The blocked reason is the actionable part of ACTION_REQUIRED — it
          // tells the seller WHAT to fix, so it is shown inline, not on hover.
          const reasonLabel = order.autoFulfillBlockedReason
            ? t(`orders.autoFulfill.reason.${order.autoFulfillBlockedReason}`)
            : undefined;
          return (
            <S.AutoFulfillCell>
              <Badge variant={fulfillmentStateToBadgeVariant(state)} size="xs" isPill>
                {t(`orders.fulfillmentState.${state}`)}
              </Badge>
              {reasonLabel && (
                <Text variant="caption" color="text.secondary">
                  {reasonLabel}
                </Text>
              )}
              {order.amazonOrderId && (
                <Text variant="caption" color="text.tertiary" numeric>
                  {order.amazonOrderId}
                </Text>
              )}
            </S.AutoFulfillCell>
          );
        },
      },
      {
        key: 'salePrice',
        header: t('orders.table.salePrice'),
        width: '7.5rem',
        align: 'right',
        sortable: true,
        render: (_value, order) => (
          <Text variant="body" weight="semibold" numeric>
            {formatCurrency(order.salePrice)}
          </Text>
        ),
      },
      {
        key: 'purchasePrice',
        header: t('orders.table.purchasePrice'),
        width: '7.5rem',
        align: 'right',
        sortable: true,
        render: (_value, order) => (
          <Text variant="body-sm" color="text.secondary" numeric>
            {formatCurrency(order.purchasePrice)}
          </Text>
        ),
      },
      {
        key: 'netProfit',
        header: t('orders.table.netProfit'),
        width: '8.5rem',
        align: 'right',
        sortable: true,
        render: (_value, order) => (
          <S.ProfitCell>
            <Text
              variant="body"
              weight="semibold"
              color={order.netProfit >= 0 ? 'semantic.success' : 'semantic.error'}
              numeric
            >
              {order.netProfit >= 0 ? '+' : ''}
              {formatCurrency(order.netProfit)}
            </Text>
            {order.profitBasis === ProfitBasis.ESTIMATED && (
              <Badge variant="warning" size="xs">
                {t('orders.estimateBadge')}
              </Badge>
            )}
          </S.ProfitCell>
        ),
      },
    ],
    [t, formatCurrency, formatDate]
  );
}
