import type { ListingDto } from '@repo/shared';
import { formatCurrency as formatCurrencyValue, type TableColumn } from '@repo/ui';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from '../ListingsAllPage.style';

import { ProductTableCell, type ProductTableCellMetaRow } from '@/domain-ui';

/**
 * Column definitions for ListingsAll table view.
 * Extracted so the page container stays orchestration-only.
 *
 * Money is formatted per row from the listing's own `currency` (resolved
 * server-side from its eBay store's marketplace — see CLAUDE.md's listing
 * detail notes) — never a single page-wide currency, and never the UI
 * language. `locale` only controls separators/ordering.
 */
export function useListingsColumns(locale: string) {
  const { t } = useTranslation(['listings', 'translation']);
  const formatCurrency = useCallback(
    (value: number, listing: ListingDto) => formatCurrencyValue(value, locale, listing.currency || 'USD'),
    [locale]
  );

  const columnOptions = useMemo(
    () => [
      { key: 'product', label: t('listings.table.product'), alwaysVisible: true },
      { key: 'prices', label: t('listings.table.price') },
      { key: 'quantity', label: t('listings.table.stock') },
      { key: 'sold', label: t('listings.table.sold') },
      { key: 'lastSale', label: t('listings.table.lastSale') },
      { key: 'profit', label: t('listings.table.estimatedProfit') },
      { key: 'createdAt', label: t('listings.table.added') },
      { key: 'category', label: t('listings.table.category') },
      { key: 'purchasePrice', label: t('listings.table.purchasePrice') },
      { key: 'roi', label: t('listings.table.roi') },
      { key: 'profitMargin', label: t('listings.table.profitMargin') },
      { key: 'sourceStock', label: t('listings.table.amazonStock') },
    ],
    [t]
  );

  const allColumns = useMemo<TableColumn<ListingDto>[]>(
    () => [
      {
        key: 'product',
        sortable: true,
        header: t('listings.table.product'),
        width: '20.5rem',
        render: (_value, listing) => {
          const displayName = listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title;
          const meta: ProductTableCellMetaRow[] = [
            { label: t('listings.table.asin'), id: listing.asin, storeType: 'amazon', icon: 'barcode' },
          ];
          if (listing.ebayListingId) {
            meta.push({
              label: t('listings.table.ebayId'),
              id: listing.ebayListingId,
              storeType: 'ebay',
              icon: 'tag',
            });
          }
          return <ProductTableCell title={displayName} imageUrl={listing.imageUrls?.[0]} meta={meta} />;
        },
      },
      {
        key: 'category',
        sortable: true,
        header: t('listings.table.category'),
        width: '7rem',
        render: (category) => {
          const str = String(category ?? '');
          return <S.CompactText title={str}>{str || '—'}</S.CompactText>;
        },
      },
      {
        key: 'prices',
        sortable: true,
        header: t('listings.table.price'),
        width: '6rem',
        align: 'right',
        render: (_value, listing) => (
          <S.CompactMetric>
            <S.MetricValue variant="body-sm" weight="semibold">
              {formatCurrency(listing.price, listing)}
            </S.MetricValue>
          </S.CompactMetric>
        ),
      },
      {
        key: 'createdAt',
        sortable: true,
        header: t('listings.table.added'),
        width: '5.75rem',
        render: (_value, listing) => (
          <S.CompactText>{listing.createdAt ? new Date(listing.createdAt).toLocaleDateString() : '—'}</S.CompactText>
        ),
      },
      {
        key: 'lastSale',
        sortable: true,
        header: t('listings.table.lastSale'),
        width: '5.75rem',
        render: (_value, listing) => (
          <S.CompactText>{listing.lastSaleAt ? new Date(listing.lastSaleAt).toLocaleDateString() : '—'}</S.CompactText>
        ),
      },
      {
        key: 'purchasePrice',
        sortable: true,
        header: t('listings.table.purchasePrice'),
        width: '6rem',
        align: 'right',
        render: (_value, listing) => (
          <S.CompactMetric>
            <S.MetricValue variant="body-sm">{formatCurrency(listing.purchasePrice ?? 0, listing)}</S.MetricValue>
          </S.CompactMetric>
        ),
      },
      {
        key: 'profit',
        sortable: true,
        header: t('listings.table.estimatedProfit'),
        width: '6.25rem',
        align: 'right',
        render: (_value, listing) => {
          const profit = listing.estimatedProfit || 0;
          return (
            <S.CompactMetric>
              <S.MetricValue variant="body-sm" weight="semibold" $positive={profit > 0} $negative={profit < 0}>
                {profit >= 0 ? '+' : ''}
                {formatCurrency(profit, listing)}
              </S.MetricValue>
            </S.CompactMetric>
          );
        },
      },
      {
        key: 'roi',
        sortable: true,
        header: t('listings.table.roi'),
        width: '4.5rem',
        align: 'right',
        render: (_value, listing) => (
          <S.CompactMetric>
            <S.MetricValue
              variant="body-sm"
              weight="semibold"
              $positive={(listing.roi || 0) > 0}
              $negative={(listing.roi || 0) < 0}
            >
              {listing.roi?.toFixed(1) || '0'}%
            </S.MetricValue>
          </S.CompactMetric>
        ),
      },
      {
        key: 'profitMargin',
        sortable: true,
        header: t('listings.table.profitMargin'),
        width: '4.5rem',
        align: 'right',
        render: (_value, listing) => (
          <S.CompactMetric>
            <S.MetricValue variant="body-sm">{listing.profitMargin?.toFixed(1) || '0'}%</S.MetricValue>
          </S.CompactMetric>
        ),
      },
      {
        key: 'sold',
        sortable: true,
        header: t('listings.table.sold'),
        align: 'right',
        width: '4.25rem',
        render: (_value, listing) => (
          <S.StatMain variant="body-sm" weight="semibold">
            {listing.soldCount || 0}
          </S.StatMain>
        ),
      },
      {
        key: 'quantity',
        sortable: true,
        header: t('listings.table.stock'),
        width: '3.75rem',
        align: 'right',
        render: (_value, listing) => (
          <S.StockValue $outOfStock={listing.quantity === 0}>{listing.quantity}</S.StockValue>
        ),
      },
      {
        key: 'sourceStock',
        sortable: true,
        header: t('listings.table.amazonStock'),
        width: '4.25rem',
        align: 'right',
        render: (_value, listing) => (
          <S.StockValue $outOfStock={listing.sourceStock === 0}>{listing.sourceStock ?? '—'}</S.StockValue>
        ),
      },
    ],
    [t, formatCurrency]
  );

  return { columnOptions, allColumns };
}
