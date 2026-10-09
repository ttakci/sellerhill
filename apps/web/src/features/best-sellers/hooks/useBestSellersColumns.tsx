/**
 * useBestSellersColumns
 *
 * Column definitions for the table view, shaped like the eBay Listings table:
 * the product cell is the shared `ProductTableCell`, figures are right-aligned
 * tabular numbers, and every figure column sorts. Extracted so the page
 * container stays orchestration-only.
 *
 * A LOCKED row holds no data (the server withheld the product), so each of its
 * cells is a blurred skeleton bar; the product cell additionally carries the
 * lock glyph, unblurred, so the row reads as "locked" rather than "loading".
 */
import { Icon, Skeleton, Text, type ColumnOption, type TableColumn } from '@repo/ui';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { BestSellersSortKey } from '../bestSellers.types';
import * as S from '../BestSellersPage/BestSellersPage.style';
import type { BestSellersColumns, BestSellersItemView } from '../BestSellersPage/BestSellersPage.types';

import { ProductTableCell } from '@/domain-ui';

const EMPTY_VALUE = '—';

const renderLockedCell = (width: string) => (
  <S.LockedCell aria-hidden="true">
    <Skeleton width={width} height="0.875rem" />
  </S.LockedCell>
);

const renderFigure = (value: string | null, weight: 'regular' | 'semibold' = 'semibold') => (
  <S.CompactMetric>
    <Text variant="body-sm" weight={weight} color="text.primary" numeric>
      {value ?? EMPTY_VALUE}
    </Text>
  </S.CompactMetric>
);

/** `showRankChange` is true on Movers & Shakers, the only list that prints a 24-hour rank change. */
export function useBestSellersColumns(showRankChange: boolean): BestSellersColumns {
  const { t } = useTranslation(['bestSellers', 'listings']);

  const columnOptions = useMemo<ColumnOption[]>(
    () => [
      { key: BestSellersSortKey.RANK, label: t('bestSellers.table.rank') },
      { key: 'product', label: t('bestSellers.table.product'), alwaysVisible: true },
      { key: BestSellersSortKey.PRICE, label: t('bestSellers.table.price') },
      { key: BestSellersSortKey.RATING, label: t('bestSellers.table.rating') },
      { key: BestSellersSortKey.REVIEWS, label: t('bestSellers.table.reviews') },
      ...(showRankChange ? [{ key: BestSellersSortKey.RANK_CHANGE, label: t('bestSellers.table.rankChange') }] : []),
    ],
    [showRankChange, t],
  );

  const allColumns = useMemo<TableColumn<BestSellersItemView>[]>(() => {
    const columns: TableColumn<BestSellersItemView>[] = [
      {
        key: BestSellersSortKey.RANK,
        sortable: true,
        header: t('bestSellers.table.rank'),
        align: 'right',
        width: '5rem',
        render: (_value, row) => (row.isLocked ? renderLockedCell('2rem') : renderFigure(row.rankLabel)),
      },
      {
        key: 'product',
        header: t('bestSellers.table.product'),
        width: '20.5rem',
        render: (_value, row) =>
          row.isLocked ? (
            <S.LockedProductCell role="img" aria-label={t('bestSellers.locked.rowLabel')}>
              <Icon name="lock" size={18} color="text.tertiary" />
              <S.LockedLines aria-hidden="true">
                <Skeleton width="70%" height="0.875rem" />
                <Skeleton width="40%" height="0.75rem" />
              </S.LockedLines>
            </S.LockedProductCell>
          ) : (
            <ProductTableCell
              title={row.title}
              imageUrl={row.imageUrl ?? undefined}
              meta={[{ label: t('listings:listings.table.asin'), id: row.asin, storeType: 'amazon' }]}
            />
          ),
      },
      {
        key: BestSellersSortKey.PRICE,
        sortable: true,
        header: t('bestSellers.table.price'),
        align: 'right',
        width: '7rem',
        render: (_value, row) => (row.isLocked ? renderLockedCell('3.5rem') : renderFigure(row.priceLabel)),
      },
      {
        key: BestSellersSortKey.RATING,
        sortable: true,
        header: t('bestSellers.table.rating'),
        align: 'right',
        width: '6rem',
        render: (_value, row) => {
          if (row.isLocked) {
            return renderLockedCell('3rem');
          }
          if (!row.ratingValueLabel) {
            return renderFigure(null, 'regular');
          }
          return (
            <S.RatingValue>
              <Icon name="star" size={14} color="semantic.warning" filled />
              <Text variant="body-sm" weight="semibold" color="text.primary" numeric>
                {row.ratingValueLabel}
              </Text>
            </S.RatingValue>
          );
        },
      },
      {
        key: BestSellersSortKey.REVIEWS,
        sortable: true,
        header: t('bestSellers.table.reviews'),
        align: 'right',
        width: '7rem',
        render: (_value, row) => (row.isLocked ? renderLockedCell('3rem') : renderFigure(row.reviewsLabel, 'regular')),
      },
    ];
    if (showRankChange) {
      columns.push({
        key: BestSellersSortKey.RANK_CHANGE,
        sortable: true,
        header: t('bestSellers.table.rankChange'),
        align: 'right',
        width: '9rem',
        render: (_value, row) => (row.isLocked ? renderLockedCell('3rem') : renderFigure(row.rankChangeLabel)),
      });
    }
    return columns;
  }, [showRankChange, t]);

  return { allColumns, columnOptions };
}
