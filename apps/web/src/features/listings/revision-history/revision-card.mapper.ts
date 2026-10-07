import type { TFunction } from 'i18next';

import type { RevisionHistoryRow } from './RevisionHistoryPage.types';

import type { ListingCardProps, ListingCardStat } from '@/domain-ui';

const EMPTY_VALUE = '—';

const changeStat = (
  label: string,
  previous: string,
  next: string,
  changed: boolean,
  increased: boolean
): ListingCardStat => ({
  label,
  value: next,
  previous: changed ? previous : undefined,
  tone: changed ? (increased ? 'positive' : 'negative') : 'default',
});

/**
 * RevisionHistoryRow → ListingCard props, so a revision reads like every other
 * listing card: brand, ASIN, eBay ID, created, sync — in the listing card's
 * order. The store is not shown — the page already filters by it.
 */
export const toRevisionCardProps = (
  row: RevisionHistoryRow,
  t: TFunction
): Omit<ListingCardProps, 'orientation' | 'onClick'> => {
  // Our eBay sale price, the Amazon price behind it and the Amazon stock — each
  // as `previous → new` when this revision moved it. A row older than the column
  // that records it shows an em dash rather than dropping the cell.
  const stats: ListingCardStat[] = [
    changeStat(
      t('listings.detail.revisions.priceChange'),
      row.previousPrice,
      row.newPrice,
      row.priceChanged,
      row.priceIncreased
    ),
    changeStat(
      t('listings.detail.revisions.sourcePriceChange'),
      row.previousSourcePrice ?? EMPTY_VALUE,
      row.newSourcePrice ?? EMPTY_VALUE,
      row.sourcePriceChanged,
      row.sourcePriceIncreased
    ),
    changeStat(
      t('listings.detail.revisions.sourceStockChange'),
      row.previousSourceStock ?? EMPTY_VALUE,
      row.newSourceStock ?? EMPTY_VALUE,
      row.sourceStockChanged,
      row.sourceStockIncreased
    ),
  ];

  return {
    title: row.title,
    imageUrl: row.imageUrl,
    meta: [
      ...(row.brand ? [{ label: t('listings.table.brand'), value: row.brand }] : []),
      { label: t('listings.table.asin'), value: row.asin, storeType: 'amazon' as const },
      ...(row.ebayItemId ? [{ label: t('listings.table.ebayId'), value: row.ebayItemId, storeType: 'ebay' as const }] : []),
      { label: t('listings.table.createdAt'), value: row.createdAt },
      { label: t('listings.table.lastSynced'), value: row.recordedAt },
    ],
    stats,
    detailLabel: t('translation:common.details'),
  };
};
