import type { ListingRevisionDto } from '@repo/shared';
import { formatCurrency, formatDate, getLocaleConfig } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListingRevisionsDrawerComponent } from './ListingRevisionsDrawer.component';
import type { ListingRevisionRow, ListingRevisionsDrawerProps } from './ListingRevisionsDrawer.types';

import { useGetListingRevisionsQuery } from '@/features/listings/api/listings.api';

const PAGE_SIZE = 20;

/** `+$7.31 (+2.4%)` — kept module-level so it is not a reactive dependency. */
function formatPriceDelta(
  previous: number,
  next: number,
  locale: string,
  currency: string
): string | null {
  const diff = next - previous;
  if (diff === 0) {
    return null;
  }
  const sign = diff > 0 ? '+' : '-';
  const amount = formatCurrency(Math.abs(diff), locale, currency);
  if (previous === 0) {
    return `${sign}${amount}`;
  }
  const pct = Math.abs((diff / previous) * 100).toLocaleString(locale, { maximumFractionDigits: 1 });
  return `${sign}${amount} (${sign}${pct}%)`;
}

/**
 * Price/quantity change history for one listing.
 *
 * A listing held for a year can carry hundreds of revisions, so the server
 * paginates (`limit` is clamped to 100 API-side). This drawer never asks for
 * the whole set: it loads one {@link PAGE_SIZE}-row page at a time, folds each
 * fetched page into `buckets` at render time (the same converging
 * "adjust state when a prop changes" pattern the `openListingId` reset uses —
 * no effect, so no cascading-render warning), and a "load more" button walks
 * the pages until every server row is shown. Everything resets when a
 * different listing (or none) is opened.
 */
export const ListingRevisionsDrawer: React.FC<ListingRevisionsDrawerProps> = ({
  isOpen,
  onClose,
  listingId,
  currency,
}) => {
  const { i18n } = useTranslation();
  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  const [openListingId, setOpenListingId] = useState(listingId);
  const [pagesLoaded, setPagesLoaded] = useState(1);
  const [buckets, setBuckets] = useState<Record<number, ListingRevisionDto[]>>({});
  const [knownTotal, setKnownTotal] = useState(0);

  if (listingId !== openListingId) {
    setOpenListingId(listingId);
    setPagesLoaded(1);
    setBuckets({});
    setKnownTotal(0);
  }

  const { data, isFetching, isError } = useGetListingRevisionsQuery(
    { listingId: listingId ?? '', query: { page: pagesLoaded, limit: PAGE_SIZE } },
    { skip: !isOpen || !listingId }
  );

  if (data) {
    if (buckets[pagesLoaded] === undefined) {
      setBuckets((prev) => ({ ...prev, [pagesLoaded]: data.items }));
    }
    if (data.total !== knownTotal) {
      setKnownTotal(data.total);
    }
  }

  const accumulated: ListingRevisionDto[] = useMemo(() => {
    const out: ListingRevisionDto[] = [];
    for (let page = 1; page <= pagesLoaded; page += 1) {
      const chunk = buckets[page];
      if (chunk) {
        out.push(...chunk);
      }
    }
    return out;
  }, [buckets, pagesLoaded]);

  const rows: ListingRevisionRow[] = useMemo(
    () =>
      accumulated.map((revision) => {
        const qtyDiff = revision.newQuantity - revision.previousQuantity;
        return {
          id: revision.id,
          recordedAt: formatDate(revision.recordedAt, localeCfg.locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          previousPrice: formatCurrency(revision.previousPrice, localeCfg.locale, currency),
          newPrice: formatCurrency(revision.newPrice, localeCfg.locale, currency),
          priceChanged: revision.previousPrice !== revision.newPrice,
          priceIncreased: revision.newPrice > revision.previousPrice,
          priceDelta: formatPriceDelta(
            revision.previousPrice,
            revision.newPrice,
            localeCfg.locale,
            currency
          ),
          previousQuantity: String(revision.previousQuantity),
          newQuantity: String(revision.newQuantity),
          quantityChanged: qtyDiff !== 0,
          quantityIncreased: qtyDiff > 0,
          quantityDelta: qtyDiff === 0 ? null : `${qtyDiff > 0 ? '+' : '-'}${Math.abs(qtyDiff)}`,
        };
      }),
    [accumulated, currency, localeCfg.locale]
  );

  const shown = accumulated.length;
  const total = Math.max(knownTotal, shown);

  return (
    <ListingRevisionsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      isLoading={isFetching && shown === 0}
      isError={isError && shown === 0}
      rows={rows}
      shown={shown}
      total={total}
      hasMore={shown < total}
      isLoadingMore={isFetching && shown > 0}
      onLoadMore={() => setPagesLoaded((p) => p + 1)}
    />
  );
};

ListingRevisionsDrawer.displayName = 'ListingRevisionsDrawer';
