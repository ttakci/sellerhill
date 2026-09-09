import { ProfitBasis, type OrderDto } from '@repo/shared';
import { Badge, StatusBadge, Text, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { fulfillmentStateToBadgeVariant } from '../../shared/fulfillment-state';
import { orderStatusToBadgeStatus } from '../../shared/order-status';
import * as S from '../OrdersAllPage.style';

import { ProductTableCell, type ProductTableCellMetaRow } from '@/domain-ui';

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
        // Same cell as the listings table — one implementation in domain-ui, so
        // the two product columns cannot drift apart again.
        key: 'product',
        header: t('orders.table.product'),
        width: '20.5rem',
        render: (_value, order) => {
          const meta: ProductTableCellMetaRow[] = [];
          if (order.product?.asin) {
            meta.push({
              label: t('orders.table.asin'),
              id: order.product.asin,
              storeType: 'amazon',
              icon: 'barcode',
            });
          }
          if (order.product?.ebayItemId) {
            meta.push({
              label: t('orders.table.ebayId'),
              id: order.product.ebayItemId,
              storeType: 'ebay',
              icon: 'tag',
            });
          }
          return (
            <ProductTableCell
              title={order.product?.title || t('translation:common.unknownProduct')}
              imageUrl={order.product?.imageUrl}
              meta={meta}
              subtitle={
                // No matched listing — price/stock/auto-fulfill/tracking never
                // run for this order, and cost_capture_status stays 'untracked'
                // forever. Independent of the fulfillment-state badge, which
                // only describes automation on an order we already recognize.
                !order.isTracked ? (
                  <Badge variant="neutral" size="xs">
                    {t('orders.tracking.untracked')}
                  </Badge>
                ) : undefined
              }
            />
          );
        },
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
