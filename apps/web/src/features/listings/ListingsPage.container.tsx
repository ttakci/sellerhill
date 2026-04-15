import { ListingStatus } from '@repo/shared';
import { IdBadge, Icon, Tooltip, useLoading, useUI } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  useDeleteListingsMutation,
  useEndListingsMutation,
  useGetListingJobsQuery,
  useGetListingsQuery,
} from './api/listings.api';
import { ListingsPageComponent } from './ListingsPage.component';
import * as S from './ListingsPage.style';
import type { ListingsFilterState } from './ListingsPage.types';

const DEFAULT_FILTERS: ListingsFilterState = {
  search: '',
  category: '',
  status: '',
  price: { min: '', max: '' },
  purchasePrice: { min: '', max: '' },
  estimatedProfit: { min: '', max: '' },
  roi: { min: '', max: '' },
  profitMargin: { min: '', max: '' },
  soldCount: { min: '', max: '' },
  watchCount: { min: '', max: '' },
  viewCount: { min: '', max: '' },
  quantity: { min: '', max: '' },
  sourceStock: { min: '', max: '' },
};

export const ListingsPageContainer: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['listings', 'translation']);
  const { showMessage } = useUI();

  // Pagination state
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Refresh trigger state
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Selection state
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);

  // Column visibility state
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([
    'product',
    'category',
    'prices',
    'purchasePrice',
    'profit',
    'roi',
    'profitMargin',
    'sold',
    'watch',
    'views',
    'quantity',
    'sourceStock',
    'status',
  ]);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Filter state
  const [filters, setFilters] = useState<ListingsFilterState>(DEFAULT_FILTERS);

  // Fetch listings and jobs
  const {
    data: listings = [],
    isLoading: isListingsLoading,
  } = useGetListingsQuery(refreshTrigger, {
    refetchOnMountOrArgChange: true,
  });
  const {
    data: jobs = [],
    isLoading: isJobsLoading,
  } = useGetListingJobsQuery(refreshTrigger, {
    refetchOnMountOrArgChange: true,
  });

  const [endListings, { isLoading: isEnding, isSuccess: isEndSuccess, error: _endError, data: endData }] =
    useEndListingsMutation();
  const [deleteListings, { isLoading: isDeleting, isSuccess: isDeleteSuccess, error: _deleteError, data: deleteData }] =
    useDeleteListingsMutation();

  const isLoading = isListingsLoading || isJobsLoading || isEnding || isDeleting;

  useLoading(isLoading);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Filtered listings
  const filteredListings = useMemo(() => {
    const inRange = (val: number | undefined, range: { min: string; max: string }) => {
      if (range.min !== '' && (val ?? 0) < Number(range.min)) {return false;}
      if (range.max !== '' && (val ?? 0) > Number(range.max)) {return false;}
      return true;
    };

    return listings.filter((listing) => {
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!listing.title?.toLowerCase().includes(q) && !listing.asin?.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filters.category && listing.category !== filters.category) {return false;}
      if (filters.status && listing.status !== (filters.status as ListingStatus)) {return false;}
      if (!inRange(listing.price, filters.price)) {return false;}
      if (!inRange(listing.purchasePrice, filters.purchasePrice)) {return false;}
      if (!inRange(listing.estimatedProfit, filters.estimatedProfit)) {return false;}
      if (!inRange(listing.roi, filters.roi)) {return false;}
      if (!inRange(listing.profitMargin, filters.profitMargin)) {return false;}
      if (!inRange(listing.soldCount, filters.soldCount)) {return false;}
      if (!inRange(listing.watchCount, filters.watchCount)) {return false;}
      if (!inRange(listing.viewCount, filters.viewCount)) {return false;}
      if (!inRange(listing.quantity, filters.quantity)) {return false;}
      if (!inRange(listing.sourceStock, filters.sourceStock)) {return false;}
      return true;
    });
  }, [listings, filters]);

  // Sorted listings
  const sortedListings = useMemo(() => {
    if (!sortColumn) {return filteredListings;}

    return [...filteredListings].sort((a, b) => {
      let aValue: any = a[sortColumn as keyof typeof a];
      let bValue: any = b[sortColumn as keyof typeof b];

      // Handle nested values for specific columns
      if (sortColumn === 'product') {
        aValue = a.title?.toLowerCase() || '';
        bValue = b.title?.toLowerCase() || '';
      } else if (sortColumn === 'prices') {
        aValue = a.price || 0;
        bValue = b.price || 0;
      } else if (sortColumn === 'purchasePrice') {
        aValue = a.purchasePrice || 0;
        bValue = b.purchasePrice || 0;
      } else if (sortColumn === 'profit') {
        aValue = a.estimatedProfit || 0;
        bValue = b.estimatedProfit || 0;
      } else if (sortColumn === 'roi') {
        aValue = a.roi || 0;
        bValue = b.roi || 0;
      } else if (sortColumn === 'profitMargin') {
        aValue = a.profitMargin || 0;
        bValue = b.profitMargin || 0;
      } else if (sortColumn === 'sold') {
        aValue = a.soldCount || 0;
        bValue = b.soldCount || 0;
      } else if (sortColumn === 'watch') {
        aValue = a.watchCount || 0;
        bValue = b.watchCount || 0;
      } else if (sortColumn === 'views') {
        aValue = a.viewCount || 0;
        bValue = b.viewCount || 0;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      // Handle numeric comparison
      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });
  }, [filteredListings, sortColumn, sortDirection]);

  // Pagination logic
  const paginatedListings = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return sortedListings.slice(start, start + rowsPerPage);
  }, [sortedListings, page, rowsPerPage]);

  // Handle end listings success
  React.useEffect(() => {
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

  // Handle delete listings success
  React.useEffect(() => {
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

  const handleAddListing = () => {
    void navigate('/listings/add');
  };

  const handleRefresh = () => {
    setRefreshTrigger(Date.now());
  };

  const handleEndListings = useCallback((listingIds: string[]) => {
    void endListings(listingIds);
  }, [endListings]);

  const handleDeleteListings = useCallback((listingIds: string[]) => {
    return deleteListings(listingIds);
  }, [deleteListings]);

  const handleDownload = () => {
    // Define all data columns for export (regardless of visibility)
    const options = [
      { key: 'title', label: t('listings.table.product') },
      { key: 'asin', label: t('listings.table.asin') },
      { key: 'ebayListingId', label: t('listings.table.ebayId') },
      { key: 'category', label: t('listings.table.category') },
      { key: 'price', label: t('listings.table.price') },
      { key: 'purchasePrice', label: t('listings.table.purchasePrice') },
      { key: 'estimatedProfit', label: t('listings.table.estimatedProfit') },
      { key: 'roi', label: t('listings.table.roi') },
      { key: 'profitMargin', label: t('listings.table.profitMargin') },
      { key: 'soldCount', label: t('listings.table.sold') },
      { key: 'watchCount', label: t('listings.table.watch') },
      { key: 'viewCount', label: t('listings.table.views') },
      { key: 'quantity', label: t('listings.table.stock') },
      { key: 'sourceStock', label: t('listings.table.amazonStock') },
      { key: 'status', label: t('listings.table.status') },
    ];

    const headers = options.map((opt) => opt.label);
    const rows = listings.map((l) =>
      options
        .map((opt) => {
          const value = l[opt.key as keyof typeof l] ?? '';
          return `"${String(value)}"`;
        })
        .join(',')
    );

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `zonds_listings_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const columnOptions = useMemo(
    () => [
      { key: 'product', label: t('listings.table.product'), alwaysVisible: true },
      { key: 'category', label: t('listings.table.category') },
      { key: 'prices', label: t('listings.table.price') },
      { key: 'purchasePrice', label: t('listings.table.purchasePrice') },
      { key: 'profit', label: t('listings.table.estimatedProfit') },
      { key: 'roi', label: t('listings.table.roi') },
      { key: 'profitMargin', label: t('listings.table.profitMargin') },
      { key: 'sold', label: t('listings.table.sold') },
      { key: 'watch', label: t('listings.table.watch') },
      { key: 'views', label: t('listings.table.views') },
      { key: 'quantity', label: t('listings.table.stock') },
      { key: 'sourceStock', label: t('listings.table.amazonStock') },
      { key: 'status', label: t('listings.table.status') },
    ],
    [t]
  );

  const toggleColumn = (key: string) => {
    setVisibleColumnKeys((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  // All available columns
  const allColumns = useMemo(
    () => [
      {
        key: 'product',
        sortable: true,
        header: t('listings.table.product'),
        render: (_: any, listing: any) => {
          const displayName = listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title;
          const truncated = displayName.length > 40 ? displayName.slice(0, 40) + '...' : displayName;
          return (
            <S.ProductCell>
              <S.ProductImageWrapper>
                {listing.imageUrls?.[0] ? (
                  <S.ProductImage src={listing.imageUrls[0]} alt={listing.title} />
                ) : (
                  <Icon name="image" size={24} />
                )}
              </S.ProductImageWrapper>
              <S.ProductMainInfo>
                {displayName.length > 40 ? (
                  <Tooltip content={displayName} position="top" variant="dark">
                    <S.ProductTitle>{truncated}</S.ProductTitle>
                  </Tooltip>
                ) : (
                  <S.ProductTitle>{truncated}</S.ProductTitle>
                )}
                <S.ProductBrand>{listing.brand || ''}</S.ProductBrand>
                <S.ProductMeta>
                  <IdBadge id={listing.asin} storeType="amazon" size="sm" />
                  {listing.ebayListingId && (
                    <IdBadge id={listing.ebayListingId} storeType="ebay" size="sm" />
                  )}
                </S.ProductMeta>
              </S.ProductMainInfo>
            </S.ProductCell>
          );
        },
      },
      {
        key: 'category',
        sortable: true,
        header: t('listings.table.category'),
        render: (category: string) => <S.CompactText title={category}>{category || '—'}</S.CompactText>,
      },
      {
        key: 'prices',
        sortable: true,
        header: t('listings.table.price'),
        render: (_: any, listing: any) => (
          <S.MetricValue variant="body-sm" weight="bold">${listing.price.toFixed(2)}</S.MetricValue>
        ),
      },
      {
        key: 'purchasePrice',
        sortable: true,
        header: t('listings.table.purchasePrice'),
        render: (_: any, listing: any) => (
          <S.MetricValue variant="body-sm">${listing.purchasePrice?.toFixed(2) || '0.00'}</S.MetricValue>
        ),
      },
      {
        key: 'profit',
        sortable: true,
        header: t('listings.table.estimatedProfit'),
        render: (_: any, listing: any) => {
          const profit = listing.estimatedProfit || 0;
          return (
            <S.MetricValue variant="body-sm" weight="semibold" $positive={profit > 0} $negative={profit < 0}>
              {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
            </S.MetricValue>
          );
        },
      },
      {
        key: 'roi',
        sortable: true,
        header: t('listings.table.roi'),
        render: (_: any, listing: any) => (
          <S.MetricValue variant="body-sm" weight="semibold" $positive={(listing.roi || 0) > 0} $negative={(listing.roi || 0) < 0}>
            {listing.roi?.toFixed(1) || '0'}%
          </S.MetricValue>
        ),
      },
      {
        key: 'profitMargin',
        sortable: true,
        header: t('listings.table.profitMargin'),
        render: (_: any, listing: any) => (
          <S.MetricValue variant="body-sm">
            {listing.profitMargin?.toFixed(1) || '0'}%
          </S.MetricValue>
        ),
      },
      {
        key: 'sold',
        sortable: true,
        header: t('listings.table.sold'),
        align: 'center' as const,
        render: (_: any, listing: any) => <S.StatMain variant="body-sm" weight="bold">{listing.soldCount || 0}</S.StatMain>,
      },
      {
        key: 'watch',
        sortable: true,
        header: t('listings.table.watch'),
        align: 'center' as const,
        render: (_: any, listing: any) => <S.StatMain variant="body-sm" weight="bold">{listing.watchCount || 0}</S.StatMain>,
      },
      {
        key: 'views',
        sortable: true,
        header: t('listings.table.views'),
        align: 'center' as const,
        render: (_: any, listing: any) => <S.StatMain variant="body-sm" weight="bold">{listing.viewCount || 0}</S.StatMain>,
      },
      {
        key: 'quantity',
        sortable: true,
        header: t('listings.table.stock'),
        render: (_: any, listing: any) => (
          <S.StockValue $outOfStock={listing.quantity === 0}>{listing.quantity}</S.StockValue>
        ),
      },
      {
        key: 'sourceStock',
        sortable: true,
        header: t('listings.table.amazonStock'),
        render: (_: any, listing: any) => (
          <S.StockValue $outOfStock={listing.sourceStock === 0}>{listing.sourceStock ?? '—'}</S.StockValue>
        ),
      },
      {
        key: 'status',
        sortable: true,
        header: t('listings.table.status'),
        render: (status: string) => (
          <S.StatusBadge $status={status}>{t(`listings.status.${status.toLowerCase()}`)}</S.StatusBadge>
        ),
      },
    ],
    [t]
  );

  const filteredColumns = useMemo(
    () => allColumns.filter((col) => visibleColumnKeys.includes(col.key || '')),
    [allColumns, visibleColumnKeys]
  );

  // Selected rows computation
  const selectedRows = useMemo(
    () => paginatedListings.filter((l) => selectedListingIds.includes(l.id)),
    [paginatedListings, selectedListingIds]
  );

  const handleEndSelected = useCallback(() => {
    if (selectedListingIds.length === 0) {return;}
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
            void handleEndListings(selectedListingIds);
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
  }, [selectedListingIds, handleEndListings, showMessage, t]);

  const handleDeleteSelected = useCallback(() => {
    if (selectedListingIds.length === 0) {return;}
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
            void handleDeleteListings(selectedListingIds);
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
  }, [selectedListingIds, handleDeleteListings, showMessage, t]);

  const bulkActions = useMemo(
    () => [
      {
        label: t('listings.actions.endListing'),
        onClick: handleEndSelected,
      },
      {
        label: t('listings.actions.deleteListings'),
        onClick: handleDeleteSelected,
      },
    ],
    [t, handleEndSelected, handleDeleteSelected]
  );

  // --- Filter handlers ---

  const categoryOptions = useMemo(
    () => {
      const cats = [...new Set(listings.map((l) => l.category).filter(Boolean))] as string[];
      return [
        { value: '', label: t('listings.filters.allCategories') },
        ...cats.sort().map((c) => ({ value: c, label: c })),
      ];
    },
    [listings, t]
  );

  const statusOptions = useMemo(
    () => [
      { value: '', label: t('listings.filters.allStatuses') },
      ...Object.values(ListingStatus).map((s) => ({
        value: s,
        label: t(`listings.status.${s.toLowerCase()}`),
      })),
    ],
    [t]
  );

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, search: e.target.value }));
      setPage(1);
    },
    []
  );

  const handleCategoryChange = useCallback(
    (value: string | number) => {
      setFilters((prev) => ({ ...prev, category: String(value) }));
      setPage(1);
    },
    []
  );

  const handleStatusChange = useCallback(
    (value: string | number) => {
      setFilters((prev) => ({ ...prev, status: String(value) }));
      setPage(1);
    },
    []
  );

  const handleRangeChange = useCallback(
    (field: keyof ListingsFilterState, bound: 'min' | 'max') =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setFilters((prev) => ({
          ...prev,
          [field]: { ...(prev[field] as { min: string; max: string }), [bound]: val },
        }));
        setPage(1);
      },
    []
  );

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }, []);

  const hasActiveFilters = useMemo(() => {
    if (filters.search || filters.category || filters.status) {return true;}
    const rangeKeys = ['price', 'purchasePrice', 'estimatedProfit', 'roi', 'profitMargin', 'soldCount', 'watchCount', 'viewCount', 'quantity', 'sourceStock'] as const;
    return rangeKeys.some((k) => filters[k].min !== '' || filters[k].max !== '');
  }, [filters]);

  const numericFilters = useMemo(
    () => [
      { key: 'price', label: t('listings.filters.fields.price') },
      { key: 'purchasePrice', label: t('listings.filters.fields.purchasePrice') },
      { key: 'estimatedProfit', label: t('listings.filters.fields.estimatedProfit') },
      { key: 'roi', label: t('listings.filters.fields.roi') },
      { key: 'profitMargin', label: t('listings.filters.fields.profitMargin') },
      { key: 'soldCount', label: t('listings.filters.fields.soldCount') },
      { key: 'watchCount', label: t('listings.filters.fields.watchCount') },
      { key: 'viewCount', label: t('listings.filters.fields.viewCount') },
      { key: 'quantity', label: t('listings.filters.fields.quantity') },
      { key: 'sourceStock', label: t('listings.filters.fields.sourceStock') },
    ].map(({ key, label }) => ({
      key,
      label,
      min: (filters[key as keyof ListingsFilterState] as { min: string; max: string }).min,
      max: (filters[key as keyof ListingsFilterState] as { min: string; max: string }).max,
      onMinChange: handleRangeChange(key as keyof ListingsFilterState, 'min'),
      onMaxChange: handleRangeChange(key as keyof ListingsFilterState, 'max'),
    })),
    [filters, t, handleRangeChange]
  );

  return (
    <ListingsPageComponent
      listings={paginatedListings}
      isLoading={isListingsLoading}
      jobs={jobs}
      isJobsLoading={isJobsLoading}
      onRefresh={handleRefresh}
      onAddListing={handleAddListing}
      onEndListings={handleEndListings}
      onSelectionChange={setSelectedListingIds}
      columns={filteredColumns}
      selectedRows={selectedRows}
      bulkActions={bulkActions}
      onDownload={handleDownload}
      columnOptions={columnOptions}
      visibleColumnKeys={visibleColumnKeys}
      onToggleColumn={toggleColumn}
      sortColumn={sortColumn}
      sortDirection={sortDirection}
      onSort={handleSort}
      pagination={{
        count: filteredListings.length,
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
      filters={filters}
      onSearchChange={handleSearchChange}
      onCategoryChange={handleCategoryChange}
      categoryOptions={categoryOptions}
      onStatusChange={handleStatusChange}
      statusOptions={statusOptions}
      numericFilters={numericFilters}
      onClearFilters={handleClearFilters}
      hasActiveFilters={hasActiveFilters}
      resultCount={filteredListings.length}
    />
  );
};
