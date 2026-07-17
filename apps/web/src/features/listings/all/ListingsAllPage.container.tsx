import { ListingStatus } from '@repo/shared';
import { useLoading, useUI, type ViewMode } from '@repo/ui';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  useDeleteListingsMutation,
  useEndListingsMutation,
  useExportListingsCsvMutation,
  useGetListingsQuery,
  usePublishListingsMutation,
} from '../api/listings.api';

import { useListingsColumns } from './hooks/useListingsColumns';
import { useListingsFilters } from './hooks/useListingsFilters';
import { ListingsAllPageComponent } from './ListingsAllPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useGetEbayAccountsQuery } from '@/features/ebay/api/ebayApi';
import { useLocale } from '@/utils/useLocale';

export const ListingsAllPage: React.FC = () => {
  const { t } = useTranslation(['listings', 'translation']);
  const { showMessage } = useUI();
  const { localeNavigate } = useLocale();

  const [tableView, setTableView] = useState<ViewMode>('grid');
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([
    'product',
    'prices',
    'quantity',
    'sold',
    'lastSale',
    'profit',
    'createdAt',
  ]);

  const {
    page,
    setPage,
    rowsPerPage,
    handleRowsPerPageChange,
    sortColumn,
    sortDirection,
    handleSort,
    filters,
    serverQuery,
    advancedOpen,
    setAdvancedOpen,
    handleSearchChange,
    handleCategoryChange,
    handleStatusChange,
    handleEbayAccountChange,
    handleClearFilters,
    hasActiveFilters,
    statusOptions,
    numericFilters,
    fromDashboard,
  } = useListingsFilters();

  const { data: ebayAccountsData } = useGetEbayAccountsQuery();

  const storeOptions = useMemo(
    () => [
      { value: '', label: t('listings.filters.allStores') },
      ...(ebayAccountsData?.items ?? []).map((acc) => ({
        value: acc.id,
        label: acc.storeName || acc.sellerId || acc.id,
      })),
    ],
    [ebayAccountsData?.items, t]
  );

  const {
    data,
    isLoading: isListingsLoading,
    isError: isListingsError,
    error: listingsError,
  } = useGetListingsQuery(serverQuery, {
    refetchOnMountOrArgChange: true,
  });

  // Support both paginated shape and accidental legacy array responses
  const listings = useMemo(() => (Array.isArray(data) ? data : (data?.items ?? [])), [data]);
  const total = Array.isArray(data) ? data.length : (data?.total ?? 0);
  const categories = useMemo(() => (Array.isArray(data) ? [] : (data?.categories ?? [])), [data]);

  useEffect(() => {
    if (!isListingsError || !listingsError) {
      return;
    }
    showMessage(
      {
        type: 'error',
        headerKey: 'translation:message.error.header',
        descriptionKey: 'listings:listings.errors.loadFailed',
      },
      t
    );
  }, [isListingsError, listingsError, showMessage, t]);

  const isDraftMode = serverQuery.status === ListingStatus.DRAFT;

  const [endListings, { isLoading: isEnding, isSuccess: isEndSuccess, data: endData }] = useEndListingsMutation();
  const [deleteListings, { isLoading: isDeleting, isSuccess: isDeleteSuccess, data: deleteData }] =
    useDeleteListingsMutation();
  const [publishListings, { isLoading: isPublishing, isSuccess: isPublishSuccess, data: publishData }] =
    usePublishListingsMutation();
  const [exportCsv, { isLoading: isExporting }] = useExportListingsCsvMutation();

  // Global overlay only for mutations — list fetch is inline
  useLoading(isEnding || isDeleting || isExporting || isPublishing);

  const { columnOptions, allColumns } = useListingsColumns();

  const filteredColumns = useMemo(
    () => allColumns.filter((col) => visibleColumnKeys.includes(col.key || '')),
    [allColumns, visibleColumnKeys]
  );

  const selectedRows = useMemo(
    () => listings.filter((l) => selectedListingIds.includes(l.id)),
    [listings, selectedListingIds]
  );

  const categoryOptions = useMemo(
    () => [
      { value: '', label: t('listings.filters.allCategories') },
      ...categories.map((c) => ({ value: c, label: c })),
    ],
    [categories, t]
  );

  // Clear selection when the page of results changes. Implemented as render-time
  // state adjustment (React-recommended) rather than setState-in-effect.
  const selectionResetKey = `${page}|${rowsPerPage}|${serverQuery.search ?? ''}|${serverQuery.status ?? ''}|${serverQuery.category ?? ''}|${serverQuery.ebayAccountId ?? ''}`;
  const [lastSelectionResetKey, setLastSelectionResetKey] = useState(selectionResetKey);
  if (lastSelectionResetKey !== selectionResetKey) {
    setLastSelectionResetKey(selectionResetKey);
    setSelectedListingIds([]);
  }

  useEffect(() => {
    if (isEndSuccess && endData?.success) {
      showMessage(
        {
          type: 'success',
          headerKey: 'listings:listings.notifications.endSuccessTitle',
          descriptionKey: 'listings:listings.notifications.endSuccess',
          descriptionParams: { count: endData.count.toString() },
        },
        t
      );
    }
  }, [isEndSuccess, endData, showMessage, t]);

  useEffect(() => {
    if (isDeleteSuccess && deleteData?.success) {
      showMessage(
        {
          type: 'success',
          headerKey: 'listings:listings.notifications.deleteSuccessTitle',
          descriptionKey: 'listings:listings.notifications.deleteSuccess',
          descriptionParams: { count: deleteData.count.toString() },
        },
        t
      );
    }
  }, [isDeleteSuccess, deleteData, showMessage, t]);

  useEffect(() => {
    if (isPublishSuccess && publishData?.success) {
      showMessage(
        {
          type: publishData.count > 0 ? 'success' : 'warning',
          headerKey:
            publishData.count > 0
              ? 'listings:listings.notifications.publishSuccessTitle'
              : 'listings:listings.notifications.publishErrorTitle',
          descriptionKey:
            publishData.count > 0
              ? 'listings:listings.notifications.publishSuccess'
              : 'listings:listings.notifications.publishError',
          descriptionParams: { count: publishData.count.toString() },
        },
        t
      );
    }
  }, [isPublishSuccess, publishData, showMessage, t]);

  const handleToggleListingSelection = useCallback((id: string, selected: boolean) => {
    setSelectedListingIds((prev) => {
      if (selected) {
        return prev.includes(id) ? prev : [...prev, id];
      }
      return prev.filter((x) => x !== id);
    });
  }, []);

  const handleBack = useCallback(() => {
    if (fromDashboard) {
      localeNavigate('/dashboard');
      return;
    }
    localeNavigate('/listings');
  }, [localeNavigate, fromDashboard]);

  const handleAddListing = useCallback(() => {
    // Overview owns the add-listings drawer — land there to create
    localeNavigate('/listings');
  }, [localeNavigate]);

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumnKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }, []);

  const handleEndSelected = useCallback(() => {
    if (selectedListingIds.length === 0) {
      return;
    }
    showMessage(
      {
        type: 'warning',
        headerKey: 'listings:listings.modals.endTitle',
        descriptionKey: 'listings:listings.modals.endDescription',
        descriptionParams: { count: selectedListingIds.length },
        primaryButton: {
          labelKey: 'listings:listings.actions.endListing',
          variant: 'danger',
          onClick: () => {
            void endListings(selectedListingIds);
            setSelectedListingIds([]);
          },
        },
        secondaryButton: {
          labelKey: 'translation:common.cancel',
          onClick: () => {},
        },
      },
      t
    );
  }, [selectedListingIds, endListings, showMessage, t]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedListingIds.length === 0) {
      return;
    }
    showMessage(
      {
        type: 'warning',
        headerKey: 'listings:listings.modals.deleteTitle',
        descriptionKey: 'listings:listings.modals.deleteDescription',
        descriptionParams: { count: selectedListingIds.length },
        primaryButton: {
          labelKey: 'translation:common.delete',
          variant: 'danger',
          onClick: () => {
            void deleteListings(selectedListingIds);
            setSelectedListingIds([]);
          },
        },
        secondaryButton: {
          labelKey: 'translation:common.cancel',
          onClick: () => {},
        },
      },
      t
    );
  }, [selectedListingIds, deleteListings, showMessage, t]);

  const handlePublishSelected = useCallback(() => {
    if (selectedListingIds.length === 0) {
      return;
    }
    showMessage(
      {
        type: 'info',
        headerKey: 'listings:listings.modals.publishTitle',
        descriptionKey: 'listings:listings.modals.publishDescription',
        descriptionParams: { count: selectedListingIds.length },
        primaryButton: {
          labelKey: 'listings:listings.actions.publishSelected',
          onClick: () => {
            void publishListings(selectedListingIds);
            setSelectedListingIds([]);
          },
        },
        secondaryButton: {
          labelKey: 'translation:common.cancel',
          onClick: () => {},
        },
      },
      t
    );
  }, [selectedListingIds, publishListings, showMessage, t]);

  const bulkActions = useMemo(
    () =>
      isDraftMode
        ? [
            {
              label: t('listings.actions.publishSelected'),
              onClick: handlePublishSelected,
            },
            {
              label: t('listings.actions.deleteListings'),
              onClick: handleDeleteSelected,
            },
          ]
        : [
            {
              label: t('listings.actions.endListing'),
              onClick: handleEndSelected,
            },
            {
              label: t('listings.actions.deleteListings'),
              onClick: handleDeleteSelected,
            },
          ],
    [t, isDraftMode, handleEndSelected, handleDeleteSelected, handlePublishSelected]
  );

  /** Dedicated export endpoint — server builds CSV with current filters. */
  const handleDownload = useCallback(async () => {
    try {
      const csvContent = await exportCsv({
        search: serverQuery.search,
        status: serverQuery.status,
        category: serverQuery.category,
        ebayAccountId: serverQuery.ebayAccountId,
        sortBy: serverQuery.sortBy,
        sortOrder: serverQuery.sortOrder,
        priceMin: serverQuery.priceMin,
        priceMax: serverQuery.priceMax,
        purchasePriceMin: serverQuery.purchasePriceMin,
        purchasePriceMax: serverQuery.purchasePriceMax,
        estimatedProfitMin: serverQuery.estimatedProfitMin,
        estimatedProfitMax: serverQuery.estimatedProfitMax,
        roiMin: serverQuery.roiMin,
        roiMax: serverQuery.roiMax,
        profitMarginMin: serverQuery.profitMarginMin,
        profitMarginMax: serverQuery.profitMarginMax,
        soldCountMin: serverQuery.soldCountMin,
        soldCountMax: serverQuery.soldCountMax,
        watchCountMin: serverQuery.watchCountMin,
        watchCountMax: serverQuery.watchCountMax,
        viewCountMin: serverQuery.viewCountMin,
        viewCountMax: serverQuery.viewCountMax,
        quantityMin: serverQuery.quantityMin,
        quantityMax: serverQuery.quantityMax,
        sourceStockMin: serverQuery.sourceStockMin,
        sourceStockMax: serverQuery.sourceStockMax,
      }).unwrap();

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `zonds_listings_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      showMessage(
        {
          type: 'error',
          headerKey: 'translation:message.error.header',
          descriptionKey: 'translation:message.error.header',
        },
        t
      );
    }
  }, [exportCsv, serverQuery, showMessage, t]);

  return (
    <EbayAccountGuard>
      <ListingsAllPageComponent
        listings={listings}
        onSelectionChange={setSelectedListingIds}
        columns={filteredColumns}
        selectedRows={selectedRows}
        selectedIds={selectedListingIds}
        onToggleListingSelection={handleToggleListingSelection}
        bulkActions={bulkActions}
        onDownload={() => {
          void handleDownload();
        }}
        tableView={tableView}
        onTableViewChange={setTableView}
        onBack={handleBack}
        isInitialLoading={isListingsLoading}
        onListingClick={(id) => localeNavigate(`/listings/${id}`)}
        pagination={{
          count: total,
          page,
          rowsPerPage,
          onPageChange: setPage,
          onRowsPerPageChange: handleRowsPerPageChange,
          labelRowsPerPage: t('translation:common.rowsPerPage'),
          labelInfo: t('translation:common.showing_info'),
        }}
        columnOptions={columnOptions}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={toggleColumn}
        sortColumn={sortColumn}
        sortDirection={sortDirection}
        onSort={handleSort}
        filters={filters}
        onSearchChange={handleSearchChange}
        onCategoryChange={handleCategoryChange}
        categoryOptions={categoryOptions}
        onStatusChange={handleStatusChange}
        statusOptions={statusOptions}
        onEbayAccountChange={handleEbayAccountChange}
        storeOptions={storeOptions}
        numericFilters={numericFilters}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
        resultCount={total}
        advancedOpen={advancedOpen}
        onToggleAdvanced={() => setAdvancedOpen((v) => !v)}
        isDraftMode={isDraftMode}
        hideStatusFilter={isDraftMode}
        onAddListing={handleAddListing}
      />
    </EbayAccountGuard>
  );
};
