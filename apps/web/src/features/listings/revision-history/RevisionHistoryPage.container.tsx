import type { ListingRevisionWithListingDto } from '@repo/shared';
import { formatCurrency, formatDate, getLocaleConfig, type ViewMode } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RevisionHistoryPageComponent } from './RevisionHistoryPage.component';
import type { RevisionHistoryDrawerState, RevisionHistoryRow } from './RevisionHistoryPage.types';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useGetAllListingRevisionsQuery } from '@/features/listings/api/listings.api';
import { useLocale } from '@/utils/useLocale';

const EMPTY_DRAWER: RevisionHistoryDrawerState = { isOpen: false, listingId: null, currency: 'USD', subject: null };

/**
 * Price/quantity change history across every listing the caller owns — the
 * "Revizyon Geçmişi" sidebar page. Sibling of `ListingRevisionsDrawer`
 * (single listing) and modeled on `ListingJobsPage`'s server-paginated table.
 */
export const RevisionHistoryPageContainer: React.FC = () => {
  const { t, i18n } = useTranslation(['listings', 'translation']);
  const { localeNavigate } = useLocale();
  const { locale } = getLocaleConfig(i18n.language);

  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [drawer, setDrawer] = useState<RevisionHistoryDrawerState>(EMPTY_DRAWER);

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();
  const storeOptions = useMemo(
    () => [
      { value: '', label: t('listings.filters.allStores') },
      ...(ebayAccountsData?.items ?? []).map((acc) => ({
        value: acc.id,
        label: acc.storeName || acc.ebayUsername || acc.sellerId || acc.id,
      })),
    ],
    [ebayAccountsData?.items, t]
  );

  const { data, isLoading } = useGetAllListingRevisionsQuery(
    {
      page,
      limit: rowsPerPage,
      search: search.trim() || undefined,
      ebayAccountId: storeFilter || undefined,
    },
    { refetchOnMountOrArgChange: true }
  );

  const items = useMemo(() => data?.items ?? [], [data]);
  const totalCount = data?.total ?? 0;
  const isInitialLoading = isLoading && items.length === 0;

  const formatRowDate = useCallback(
    (iso: string) =>
      formatDate(iso, locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale]
  );

  const rows: RevisionHistoryRow[] = useMemo(
    () =>
      items.map((revision: ListingRevisionWithListingDto) => {
        const qtyDiff = revision.newQuantity - revision.previousQuantity;
        return {
          id: revision.id,
          listingId: revision.listingId,
          title: revision.title,
          imageUrl: revision.imageUrl,
          asin: revision.asin,
          storeName: revision.storeName,
          currency: revision.currency,
          recordedAt: formatRowDate(revision.recordedAt),
          previousPrice: formatCurrency(revision.previousPrice, locale, revision.currency),
          newPrice: formatCurrency(revision.newPrice, locale, revision.currency),
          priceChanged: revision.previousPrice !== revision.newPrice,
          priceIncreased: revision.newPrice > revision.previousPrice,
          previousQuantity: String(revision.previousQuantity),
          newQuantity: String(revision.newQuantity),
          quantityChanged: qtyDiff !== 0,
          quantityIncreased: qtyDiff > 0,
        };
      }),
    [items, formatRowDate, locale]
  );

  const hasActiveFilters = Boolean(search.trim() || storeFilter);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleStoreFilterChange = useCallback((value: string | number) => {
    setStoreFilter(String(value));
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setStoreFilter('');
    setPage(1);
  }, []);

  const handleRowClick = useCallback((row: RevisionHistoryRow) => {
    setDrawer({
      isOpen: true,
      listingId: row.listingId,
      currency: row.currency,
      subject: { title: row.title, imageUrl: row.imageUrl, asin: row.asin, storeName: row.storeName },
    });
  }, []);

  const handleCloseDrawer = useCallback(() => {
    // Keep the last subject/listingId while the Drawer plays its close
    // transition — clearing them immediately would blank the header first.
    setDrawer((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleViewListing = useCallback(() => {
    if (drawer.listingId) {
      localeNavigate(`/listings/${drawer.listingId}`);
    }
  }, [drawer.listingId, localeNavigate]);

  const handleBack = useCallback(() => {
    localeNavigate('/listings');
  }, [localeNavigate]);

  return (
    <EbayAccountGuard>
      <RevisionHistoryPageComponent
        rows={rows}
        totalCount={totalCount}
        isInitialLoading={isInitialLoading}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        search={search}
        onSearchChange={handleSearchChange}
        storeFilter={storeFilter}
        onStoreFilterChange={handleStoreFilterChange}
        storeOptions={storeOptions}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        onRowClick={handleRowClick}
        onBack={handleBack}
        drawer={drawer}
        onCloseDrawer={handleCloseDrawer}
        onViewListing={handleViewListing}
        pagination={{
          count: totalCount,
          page,
          rowsPerPage,
          onPageChange: setPage,
          onRowsPerPageChange: (val) => {
            setRowsPerPage(val);
            setPage(1);
          },
          labelRowsPerPage: t('translation:common.rowsPerPage'),
          labelInfo: t('translation:common.showing_info'),
        }}
      />
    </EbayAccountGuard>
  );
};

RevisionHistoryPageContainer.displayName = 'RevisionHistoryPageContainer';
