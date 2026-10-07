import {
  formatSourceStock,
  type AllListingRevisionsQueryDto,
  type ListingRevisionWithListingDto,
} from '@repo/shared';
import { formatCurrency, formatDate, getLocaleConfig, type ViewMode } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RevisionHistoryPageComponent } from './RevisionHistoryPage.component';
import type { RevisionHistoryDrawerState, RevisionHistoryRow } from './RevisionHistoryPage.types';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
import { useGetAllListingRevisionsQuery } from '@/features/listings/api/listings.api';
import { useLocale } from '@/utils/useLocale';

const EMPTY_DRAWER: RevisionHistoryDrawerState = { isOpen: false, listingId: null, currency: 'USD', subject: null };
/** Amazon-sourced money is always USD — only Amazon US exists. */
const SOURCE_CURRENCY = 'USD';

type RevisionSortKey = NonNullable<AllListingRevisionsQueryDto['sortBy']>;
const REVISION_SORT_KEYS: RevisionSortKey[] = ['recordedAt', 'product', 'price'];

/** Table column keys + their header keys, in the default order (product first, date last). */
const REVISION_COLUMNS: { key: string; labelKey: string }[] = [
  { key: 'product', labelKey: 'listings.table.product' },
  { key: 'sourcePrice', labelKey: 'listings.detail.revisions.sourcePriceChange' },
  { key: 'price', labelKey: 'listings.detail.revisions.priceChange' },
  { key: 'sourceStock', labelKey: 'listings.detail.revisions.sourceStockChange' },
  { key: 'quantity', labelKey: 'listings.detail.revisions.quantityChange' },
  { key: 'recordedAt', labelKey: 'listings.jobs.table.date' },
];

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
  // The top bar's active store; a switch starts the list over on page 1.
  const { activeStoreId } = useActiveStore();
  const storeFilter = activeStoreId ?? '';
  const [pageStore, setPageStore] = useState(storeFilter);
  if (pageStore !== storeFilter) {
    setPageStore(storeFilter);
    setPage(1);
  }
  const [drawer, setDrawer] = useState<RevisionHistoryDrawerState>(EMPTY_DRAWER);
  const [sortBy, setSortBy] = useState<RevisionSortKey>('recordedAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Same column manager as the listings table: hide and reorder; the product stays.
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);
  const [columnOrder, setColumnOrder] = useState<string[]>(REVISION_COLUMNS.map((column) => column.key));
  const columnOptions = useMemo(
    () =>
      columnOrder.map((key) => ({
        key,
        label: t(REVISION_COLUMNS.find((column) => column.key === key)?.labelKey ?? key),
        alwaysVisible: key === 'product',
      })),
    [columnOrder, t]
  );
  const visibleColumnKeys = useMemo(
    () => columnOrder.filter((key) => !hiddenColumnKeys.includes(key)),
    [columnOrder, hiddenColumnKeys]
  );
  const handleToggleColumn = useCallback((key: string) => {
    setHiddenColumnKeys((current) =>
      current.includes(key) ? current.filter((columnKey) => columnKey !== key) : [...current, key]
    );
  }, []);
  const handleMoveColumn = useCallback((key: string, direction: -1 | 1) => {
    setColumnOrder((current) => {
      const index = current.indexOf(key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) {
        return current;
      }
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const sortOptions = useMemo(
    () =>
      REVISION_SORT_KEYS.flatMap((key) => {
        const label = t(REVISION_COLUMNS.find((column) => column.key === key)?.labelKey ?? key);
        return [
          { value: `${key}:desc`, label: `${label} ↓` },
          { value: `${key}:asc`, label: `${label} ↑` },
        ];
      }),
    [t]
  );
  const handleSortChange = useCallback((value: string | number) => {
    const [nextKey, nextDirection] = String(value).split(':');
    if (!REVISION_SORT_KEYS.includes(nextKey as RevisionSortKey)) {
      return;
    }
    setSortBy(nextKey as RevisionSortKey);
    setSortDirection(nextDirection === 'asc' ? 'asc' : 'desc');
    setPage(1);
  }, []);
  const handleColumnSort = useCallback(
    (columnKey: string) => {
      if (!REVISION_SORT_KEYS.includes(columnKey as RevisionSortKey)) {
        return;
      }
      setSortBy(columnKey as RevisionSortKey);
      setSortDirection((current) => (sortBy === columnKey && current === 'desc' ? 'asc' : 'desc'));
      setPage(1);
    },
    [sortBy]
  );

  const { data, isLoading } = useGetAllListingRevisionsQuery(
    {
      page,
      limit: rowsPerPage,
      search: search.trim() || undefined,
      ebayAccountId: storeFilter || undefined,
      sortBy,
      sortOrder: sortDirection,
    },
    { refetchOnMountOrArgChange: true, skip: !storeFilter }
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
        const sourceDiff =
          revision.previousSourceStock !== null && revision.newSourceStock !== null
            ? revision.newSourceStock - revision.previousSourceStock
            : 0;
        const prevSource = revision.previousSourcePrice;
        const nextSource = revision.newSourcePrice;
        const bothSource = prevSource !== null && nextSource !== null;
        return {
          id: revision.id,
          listingId: revision.listingId,
          title: revision.title,
          imageUrl: revision.imageUrl,
          asin: revision.asin,
          brand: revision.brand,
          ebayItemId: revision.ebayItemId,
          createdAt: formatDate(revision.listingCreatedAt, locale, { day: 'numeric', month: 'short', year: 'numeric' }),
          storeName: revision.storeName,
          currency: revision.currency,
          recordedAt: formatRowDate(revision.recordedAt),
          previousPrice: formatCurrency(revision.previousPrice, locale, revision.currency, 2),
          newPrice: formatCurrency(revision.newPrice, locale, revision.currency, 2),
          priceChanged: revision.previousPrice !== revision.newPrice,
          priceIncreased: revision.newPrice > revision.previousPrice,
          previousQuantity: String(revision.previousQuantity),
          newQuantity: String(revision.newQuantity),
          quantityChanged: qtyDiff !== 0,
          quantityIncreased: qtyDiff > 0,
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
          previousSourcePrice: prevSource === null ? null : formatCurrency(prevSource, locale, SOURCE_CURRENCY, 2),
          newSourcePrice: nextSource === null ? null : formatCurrency(nextSource, locale, SOURCE_CURRENCY, 2),
          sourcePriceChanged: bothSource && prevSource !== nextSource,
          sourcePriceIncreased: bothSource && nextSource > prevSource,
        };
      }),
    [items, formatRowDate, locale]
  );

  const hasActiveFilters = Boolean(search.trim());

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSearch('');
    setPage(1);
  }, []);

  const handleRowClick = useCallback((row: RevisionHistoryRow) => {
    setDrawer({
      isOpen: true,
      listingId: row.listingId,
      currency: row.currency,
      subject: { title: row.title, imageUrl: row.imageUrl, asin: row.asin, ebayItemId: row.ebayItemId },
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
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClearFilters}
        onRowClick={handleRowClick}
        onBack={handleBack}
        drawer={drawer}
        onCloseDrawer={handleCloseDrawer}
        onViewListing={handleViewListing}
        visibleColumnKeys={visibleColumnKeys}
        columnOptions={columnOptions}
        onToggleColumn={handleToggleColumn}
        onMoveColumn={handleMoveColumn}
        sortOptions={sortOptions}
        sortValue={`${sortBy}:${sortDirection}`}
        onSortChange={handleSortChange}
        sortColumn={sortBy}
        sortDirection={sortDirection}
        onSort={handleColumnSort}
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
