import { OrderStage, ProfitBasis, type OrderDto } from '@repo/shared';
import { Badge, Text, Tooltip, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { orderFlagBadges } from '../../shared/order-flags';
import { orderStageShowsReason } from '../../shared/order-stage';
import { OrderStageBadge } from '../../shared/OrderStageBadge';
import * as S from '../OrdersAllPage.style';

import { ProductTableCell, type ProductTableCellMetaRow } from '@/domain-ui';

/**
 * Seven columns, read left to right the way a seller asks about a sale:
 * which order · which product · who · where it stands · what it sold for ·
 * what it cost · what was left. The date rides under the order number — a
 * sale is "12-11247 on Oct 1", not two facts in two columns — and the margin
 * rides under the profit, so the one figure that matters carries its own
 * context. Money columns are right-aligned with tabular numerals.
 *
 * `sortable` flags are deliberately absent: the page never wires `onSort`
 * (the API floats what needs the seller to the top, then newest first), and a
 * sort affordance that does nothing is worse than none.
 */
export function useOrdersColumns(
  formatCurrency: (value: number, ebayAccountId?: string | null) => string,
  formatDate: (value: string) => string,
  formatMargin: (order: OrderDto) => string | null,
  formatDay: (value: string) => string
) {
  const { t } = useTranslation(['orders', 'translation']);

  return useMemo<TableColumn<OrderDto>[]>(
    () => [
      {
        key: 'ebayOrderId',
        header: t('orders.table.orderNumber'),
        width: '9.75rem',
        render: (_value, order) => (
          <S.OrderCell>
            <Text variant="body-sm" weight="semibold" numeric>
              {order.ebayOrderId}
            </Text>
            <Text variant="caption" color="text.secondary" numeric>
              {formatDate(order.createdAt)}
            </Text>
            {/* The seller's own note, one line; the full text on hover. */}
            {order.sellerNote ? (
              <Tooltip content={order.sellerNote} position="top" variant="dark">
                <S.NoteLine variant="caption" color="text.secondary">
                  {order.sellerNote}
                </S.NoteLine>
              </Tooltip>
            ) : null}
          </S.OrderCell>
        ),
      },
      {
        // Same cell as the listings table — one implementation in domain-ui, so
        // the two product columns cannot drift apart again.
        // No width: under `table-layout: fixed` the one unsized column takes
        // whatever the sized ones leave, so the table always fits its card and
        // the profit column is never pushed off the right edge.
        key: 'product',
        header: t('orders.table.product'),
        render: (_value, order) => {
          const meta: ProductTableCellMetaRow[] = [];
          if (order.product?.asin) {
            meta.push({ label: t('orders.table.asin'), id: order.product.asin, storeType: 'amazon' });
          }
          if (order.product?.ebayItemId) {
            meta.push({ label: t('orders.table.ebayId'), id: order.product.ebayItemId, storeType: 'ebay' });
          }
          return (
            <ProductTableCell
              title={order.product?.title || t('translation:common.unknownProduct')}
              imageUrl={order.product?.imageUrl}
              meta={meta}
            />
          );
        },
      },
      {
        key: 'buyer',
        header: t('orders.table.buyer'),
        width: '8.5rem',
        render: (_value, order) => (
          <S.BuyerCell>
            <Text variant="body-sm" weight="medium">
              {order.buyerName || '—'}
            </Text>
            {order.buyerEmail ? (
              <Text variant="caption" color="text.secondary" truncate>
                {order.buyerEmail}
              </Text>
            ) : null}
          </S.BuyerCell>
        ),
      },
      {
        // ONE column: the stage badge, then the one line of context that makes
        // it actionable — the blocked reason, the Amazon order id, the tracking
        // number. The eBay status is a fact, not a status, and lives on the
        // detail page's eBay card.
        key: 'stage',
        header: t('orders.stageLegend.columnStage'),
        width: '11.5rem',
        render: (_value, order) => {
          const reasonLabel =
            orderStageShowsReason(order.stage) && order.autoFulfillBlockedReason
              ? t(`orders.autoFulfill.reason.${order.autoFulfillBlockedReason}`)
              : undefined;
          const trackingShown =
            order.stage === OrderStage.SHIPPED
              ? order.convertedTrackingNumber || order.amazonTrackingNumber
              : undefined;
          const flags = orderFlagBadges(order, t, (value) => formatCurrency(value, order.ebayAccountId), formatDay);
          // Not one of the seller's listings: SellerHill does not follow the sale, so
          // no stage, deadline or reason applies — just the one chip.
          if (!order.isTracked) {
            return (
              <S.StageCell>
                <Badge variant="neutral" size="sm">
                  {t('orders.tracking.untracked')}
                </Badge>
              </S.StageCell>
            );
          }
          return (
            <S.StageCell>
              <OrderStageBadge stage={order.stage} shippedDetectedAt={order.shippedDetectedAt} size="sm" />
              {flags.map((flag) => (
                <Badge key={flag.label} variant={flag.variant ?? 'warning'} size="sm">
                  {flag.label}
                </Badge>
              ))}
              {reasonLabel && (
                <Text variant="caption" color="text.secondary">
                  {reasonLabel}
                </Text>
              )}
              {order.amazonOrderId && !order.isSimulated && (
                <Text variant="caption" color="text.tertiary" numeric>
                  {order.amazonOrderId}
                </Text>
              )}
              {trackingShown && (
                <Text variant="caption" color="text.tertiary" numeric>
                  {trackingShown}
                </Text>
              )}
            </S.StageCell>
          );
        },
      },
      {
        key: 'salePrice',
        header: t('orders.table.salePrice'),
        width: '6rem',
        align: 'right',
        render: (_value, order) => (
          <Text variant="body-sm" numeric>
            {formatCurrency(order.salePrice, order.ebayAccountId)}
          </Text>
        ),
      },
      {
        key: 'purchasePrice',
        header: t('orders.table.purchasePrice'),
        width: '6rem',
        align: 'right',
        render: (_value, order) => (
          <Text variant="body-sm" color="text.secondary" numeric>
            {formatCurrency(order.purchasePrice, order.ebayAccountId)}
          </Text>
        ),
      },
      {
        key: 'netProfit',
        header: t('orders.table.netProfit'),
        width: '7.5rem',
        align: 'right',
        render: (_value, order) => {
          const margin = formatMargin(order);
          return (
            <S.ProfitCell>
              <Text
                variant="body"
                weight="semibold"
                color={order.netProfit >= 0 ? 'semantic.success' : 'semantic.error'}
                numeric
              >
                {order.netProfit >= 0 ? '+' : ''}
                {formatCurrency(order.netProfit, order.ebayAccountId)}
              </Text>
              {order.profitBasis === ProfitBasis.ESTIMATED ? (
                <Badge variant="warning" size="sm">
                  {t('orders.estimateBadge')}
                </Badge>
              ) : margin ? (
                <Text variant="caption" color="text.secondary" numeric>
                  {margin}
                </Text>
              ) : null}
            </S.ProfitCell>
          );
        },
      },
    ],
    [t, formatCurrency, formatDate, formatMargin, formatDay]
  );
}
