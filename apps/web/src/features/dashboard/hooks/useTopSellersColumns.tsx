import { formatSourceStock, type TopListingDto } from '@repo/shared';
import { formatCurrency, Sparkline, Text, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from '../components/TopSellersPanel/TopSellersPanel.style';
import { changeTone, formatSignedMoney, formatSignedPercent, profitTone, trendTone } from '../utils/topSellerCard';

import { ProductTableCell, type ProductTableCellMetaRow, type StatTone } from '@/domain-ui';

/**
 * Table columns for the Top sellers tab: the listing, its trend over the
 * range, then the period figures. Money is two decimals in each listing's
 * own currency (never the UI language); `locale` sets separators only.
 */
export function useTopSellersColumns(locale: string): TableColumn<TopListingDto>[] {
  const { t } = useTranslation(['dashboard', 'listings', 'translation']);

  return useMemo<TableColumn<TopListingDto>[]>(() => {
    const count = new Intl.NumberFormat(locale);
    const money = (value: number, row: TopListingDto) =>
      formatCurrency(value, locale, row.listing.currency || 'USD', 2);
    const toneColor = (tone: StatTone | undefined) => {
      if (tone === 'positive') {
        return 'semantic.success';
      }
      return tone === 'negative' ? 'semantic.error' : 'text.secondary';
    };

    return [
      {
        key: 'product',
        header: t('dashboard.topSellers.columns.product'),
        render: (_value, row) => {
          const { listing } = row;
          const title = listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title;
          const meta: ProductTableCellMetaRow[] = [
            { label: t('listings:listings.table.asin'), id: listing.asin, storeType: 'amazon' },
          ];
          if (listing.ebayListingId) {
            meta.push({ label: t('listings:listings.table.ebayId'), id: listing.ebayListingId, storeType: 'ebay' });
          }
          return <ProductTableCell title={title} imageUrl={listing.imageUrls?.[0]} meta={meta} />;
        },
      },
      {
        key: 'trend',
        header: t('dashboard.topSellers.columns.trend'),
        width: '7rem',
        render: (_value, row) => (
          <S.TrendCell>
            <Sparkline
              values={row.series}
              tone={trendTone(row.changes.sales)}
              ariaLabel={t('dashboard.topSellers.trendAria')}
              size="sm"
            />
          </S.TrendCell>
        ),
      },
      {
        key: 'sales',
        header: t('dashboard.topSellers.columns.sales'),
        width: '7.5rem',
        align: 'right',
        render: (_value, row) => {
          const change = formatSignedPercent(row.changes.sales, locale);
          return (
            <S.MetricCell>
              <Text variant="body-sm" weight="semibold" numeric>
                {money(row.metrics.sales, row)}
              </Text>
              {change && (
                <Text variant="caption" color={toneColor(changeTone(row.changes.sales))} numeric>
                  {change}
                </Text>
              )}
            </S.MetricCell>
          );
        },
      },
      {
        key: 'units',
        header: t('dashboard.topSellers.columns.units'),
        width: '4.5rem',
        align: 'right',
        render: (_value, row) => (
          <Text variant="body-sm" weight="semibold" numeric>
            {count.format(row.metrics.units)}
          </Text>
        ),
      },
      {
        key: 'orders',
        header: t('dashboard.topSellers.columns.orders'),
        width: '5.5rem',
        align: 'right',
        render: (_value, row) => (
          <Text variant="body-sm" weight="semibold" numeric>
            {count.format(row.metrics.orders)}
          </Text>
        ),
      },
      {
        key: 'netProfit',
        header: t('dashboard.topSellers.columns.netProfit'),
        width: '7.5rem',
        align: 'right',
        render: (_value, row) => (
          <S.MetricCell>
            <Text variant="body-sm" weight="semibold" color={toneColor(profitTone(row.metrics.netProfit))} numeric>
              {formatSignedMoney(row.metrics.netProfit, locale, row.listing.currency || 'USD')}
            </Text>
            {row.metrics.profitProvisional !== 0 && (
              <Text variant="caption" color="text.secondary">
                {t('dashboard.topSellers.estimatedAmount', {
                  amount: formatSignedMoney(row.metrics.profitProvisional, locale, row.listing.currency || 'USD'),
                })}
              </Text>
            )}
          </S.MetricCell>
        ),
      },
      {
        key: 'price',
        header: t('dashboard.topSellers.columns.price'),
        width: '5.5rem',
        align: 'right',
        render: (_value, row) => (
          <Text variant="body-sm" numeric>
            {money(row.listing.price, row)}
          </Text>
        ),
      },
      {
        key: 'stock',
        header: t('dashboard.topSellers.columns.stock'),
        width: '9.5rem',
        align: 'right',
        render: (_value, row) => {
          const { listing } = row;
          const amazon =
            listing.sourceStock === null || listing.sourceStock === undefined
              ? '—'
              : formatSourceStock(listing.sourceStock, listing.sourceStockStatus);
          return (
            <Text variant="body-sm" numeric>
              {`${listing.quantity} / ${amazon}`}
            </Text>
          );
        },
      },
    ];
  }, [t, locale]);
}
