import { formatCurrency, formatDate, getLocaleConfig } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListingRevisionsDrawerComponent } from './ListingRevisionsDrawer.component';
import type { ListingRevisionRow, ListingRevisionsDrawerProps } from './ListingRevisionsDrawer.types';

import { useGetListingRevisionsQuery } from '@/features/listings/api/listings.api';

const PAGE_SIZE = 20;

/**
 * Price/quantity change history for one listing. Resets to page 1 whenever a
 * different listing (or none) is opened — without an effect, per the
 * "adjusting state when a prop changes" render-time-guard pattern used across
 * this codebase's other drawers.
 */
export const ListingRevisionsDrawer: React.FC<ListingRevisionsDrawerProps> = ({
  isOpen,
  onClose,
  listingId,
  currency,
}) => {
  const { i18n } = useTranslation();
  const localeCfg = useMemo(() => getLocaleConfig(i18n.language), [i18n.language]);

  const [page, setPage] = useState(1);
  const [openListingId, setOpenListingId] = useState(listingId);
  if (listingId !== openListingId) {
    setOpenListingId(listingId);
    setPage(1);
  }

  const { data, isFetching, isError } = useGetListingRevisionsQuery(
    { listingId: listingId ?? '', query: { page, limit: PAGE_SIZE } },
    { skip: !isOpen || !listingId }
  );

  const rows: ListingRevisionRow[] = useMemo(
    () =>
      (data?.items ?? []).map((revision) => ({
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
        previousQuantity: String(revision.previousQuantity),
        newQuantity: String(revision.newQuantity),
        quantityChanged: revision.previousQuantity !== revision.newQuantity,
        quantityIncreased: revision.newQuantity > revision.previousQuantity,
      })),
    [currency, data, localeCfg.locale]
  );

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1;

  return (
    <ListingRevisionsDrawerComponent
      isOpen={isOpen}
      onClose={onClose}
      isLoading={isFetching}
      isError={isError}
      rows={rows}
      page={page}
      totalPages={totalPages}
      hasPrev={page > 1}
      hasNext={page < totalPages}
      onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
      onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
    />
  );
};

ListingRevisionsDrawer.displayName = 'ListingRevisionsDrawer';
