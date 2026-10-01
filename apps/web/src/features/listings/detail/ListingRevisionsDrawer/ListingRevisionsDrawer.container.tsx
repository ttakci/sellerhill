import { formatSourceStock, type ListingRevisionDto } from '@repo/shared';
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
  const amount = formatCurrency(Math.abs(diff), locale, currency, 2);
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
  subject,
  onViewListing,
}) => {
  const { t, i18n } = useTranslation(['listings']);
  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  const [openListingId, setOpenListingId] = useState(listingId);
  const [pagesLoaded, setPagesLoaded] = useState(1);
  const [buckets, setBuckets] = useState<Record<number, ListingRevisionDto[]>>({});
  const [knownTotal, setKnownTotal] = useState(0);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);
  const [hasUncommittedCheck, setHasUncommittedCheck] = useState(false);

  if (listingId !== openListingId) {
    setOpenListingId(listingId);
    setPagesLoaded(1);
    setBuckets({});
    setKnownTotal(0);
    setLastCheckedAt(null);
    setHasUncommittedCheck(false);
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
    // Reflects the true latest state regardless of which page is open — the
    // API computes it against the newest revision across ALL pages, not just
    // the one currently loaded (see `getListingRevisions`'s correlated MAX()).
    // Normalised BEFORE the comparison: a response with no `lastCheckedAt`
    // (undefined, as the demo fixtures answer) compared against the stored
    // null re-ran this render-phase update on every render — an infinite
    // loop, since React does not bail out of render-phase setState.
    const nextLastCheckedAt = data.lastCheckedAt ?? null;
    const nextHasUncommittedCheck = Boolean(data.hasUncommittedCheck);
    if (nextLastCheckedAt !== lastCheckedAt || nextHasUncommittedCheck !== hasUncommittedCheck) {
      setLastCheckedAt(nextLastCheckedAt);
      setHasUncommittedCheck(nextHasUncommittedCheck);
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
        const sourceDiff =
          revision.previousSourceStock !== null && revision.newSourceStock !== null
            ? revision.newSourceStock - revision.previousSourceStock
            : 0;
        return {
          id: revision.id,
          recordedAt: formatDate(revision.recordedAt, localeCfg.locale, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          previousPrice: formatCurrency(revision.previousPrice, localeCfg.locale, currency, 2),
          newPrice: formatCurrency(revision.newPrice, localeCfg.locale, currency, 2),
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
          previousSourceStock:
            revision.previousSourceStock === null
              ? null
              : formatSourceStock(revision.previousSourceStock, revision.previousSourceStockStatus),
          newSourceStock:
            revision.newSourceStock === null
              ? null
              : formatSourceStock(revision.newSourceStock, revision.newSourceStockStatus),
          sourceStockChanged: sourceDiff !== 0,
          sourceStockIncreased: sourceDiff > 0,
          sourceStockDelta: sourceDiff === 0 ? null : `${sourceDiff > 0 ? '+' : '-'}${Math.abs(sourceDiff)}`,
        };
      }),
    [accumulated, currency, localeCfg.locale]
  );

  const shown = accumulated.length;
  const total = Math.max(knownTotal, shown);

  const lastCheckedLabel = useMemo(() => {
    if (!hasUncommittedCheck || !lastCheckedAt) {
      return null;
    }
    return t('listings.detail.revisions.lastChecked', {
      date: formatDate(lastCheckedAt, localeCfg.locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    });
  }, [hasUncommittedCheck, lastCheckedAt, localeCfg.locale, t]);

  return (
    <ListingRevisionsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      isLoading={isFetching && shown === 0}
      isError={isError && shown === 0}
      subject={subject}
      onViewListing={onViewListing}
      rows={rows}
      shown={shown}
      total={total}
      hasMore={shown < total}
      isLoadingMore={isFetching && shown > 0}
      onLoadMore={() => setPagesLoaded((p) => p + 1)}
      lastCheckedLabel={lastCheckedLabel}
    />
  );
};

ListingRevisionsDrawer.displayName = 'ListingRevisionsDrawer';
