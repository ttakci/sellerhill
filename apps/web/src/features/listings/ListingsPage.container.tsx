import { Icon, useLoading, useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ListingsPageComponent } from './ListingsPage.component';
import * as S from './ListingsPage.style';
import {
  useDeleteListingsMutation,
  useEndListingsMutation,
  useGetListingJobsQuery,
  useGetListingsQuery,
} from './api/listings.api';

export const ListingsPageContainer: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['listings', 'translation']);
  const { showMessage } = useUI();

  // Pagination state
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // View mode state (default 'table' on desktop, 'grid' on mobile)
  const [viewMode, setViewMode] = useState<'table' | 'grid'>(window.innerWidth < 768 ? 'grid' : 'table');

  // Selection state
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);

  // Column visibility state
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>([
    'product',
    'category',
    'prices',
    'profit',
    'margins',
    'sold',
    'watch',
    'views',
    'quantity',
    'status',
  ]);

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Fetch listings and jobs
  const {
    data: listings = [],
    isLoading: isListingsLoading,
    refetch: refetchListings,
  } = useGetListingsQuery(undefined, {
    pollingInterval: 5000,
  });
  const {
    data: jobs = [],
    isLoading: isJobsLoading,
    refetch: refetchJobs,
  } = useGetListingJobsQuery(undefined, {
    pollingInterval: 5000,
  });

  const [endListings, { isLoading: isEnding, isSuccess: isEndSuccess, error: endError, data: endData }] =
    useEndListingsMutation();
  const [deleteListings, { isLoading: isDeleting, isSuccess: isDeleteSuccess, error: deleteError, data: deleteData }] =
    useDeleteListingsMutation();

  const isLoading = isListingsLoading || isJobsLoading || isEnding || isDeleting;

  useLoading(isLoading);

  // Sorting handler
  const handleSort = (columnKey: string) => {
    console.log('Sort clicked:', columnKey, 'Current:', sortColumn, sortDirection);
    if (sortColumn === columnKey) {
      const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      console.log('Toggle direction:', newDirection);
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
      console.log('New column, set to asc');
    }
  };

  // Sorted listings
  const sortedListings = useMemo(() => {
    if (!sortColumn) return listings;

    return [...listings].sort((a, b) => {
      let aValue: any = a[sortColumn as keyof typeof a];
      let bValue: any = b[sortColumn as keyof typeof b];

      // Handle nested values for specific columns
      if (sortColumn === 'product') {
        aValue = a.title?.toLowerCase() || '';
        bValue = b.title?.toLowerCase() || '';
      } else if (sortColumn === 'prices') {
        aValue = a.price || 0;
        bValue = b.price || 0;
      } else if (sortColumn === 'profit') {
        aValue = a.estimatedProfit || 0;
        bValue = b.estimatedProfit || 0;
      } else if (sortColumn === 'margins') {
        aValue = a.roi || 0;
        bValue = b.roi || 0;
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
  }, [listings, sortColumn, sortDirection]);

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
    navigate('/listings/add');
  };

  const handleRefresh = () => {
    refetchListings();
    refetchJobs();
  };

  const handleEndListings = (listingIds: string[]) => {
    void endListings(listingIds);
  };

  const handleDeleteListings = (listingIds: string[]) => {
    void deleteListings(listingIds);
  };

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
      { key: 'status', label: t('listings.table.status') },
    ];

    const headers = options.map((opt) => opt.label);
    const rows = listings.map((l) =>
      options
        .map((opt) => {
          const value = l[opt.key as keyof typeof l] ?? '';
          return `"${value}"`;
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
      { key: 'profit', label: t('listings.table.estimatedProfit') },
      { key: 'margins', label: t('listings.table.roi') },
      { key: 'sold', label: t('listings.table.sold') },
      { key: 'watch', label: t('listings.table.watch') },
      { key: 'views', label: t('listings.table.views') },
      { key: 'quantity', label: t('listings.table.stock') },
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
        sticky: true,
        sortable: true,
        header: t('listings.table.product'),
        render: (_: any, listing: any) => (
          <S.ProductCell>
            <S.ProductImageWrapper>
              {listing.imageUrls?.[0] ? (
                <S.ProductImage src={listing.imageUrls[0]} alt={listing.title} />
              ) : (
                <Icon name="image" size={24} />
              )}
            </S.ProductImageWrapper>
            <S.ProductMainInfo>
              <S.ProductTitle title={listing.title}>
                {listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title}
              </S.ProductTitle>
              <S.ProductMeta>
                <S.IDLink>
                  <S.MonoText>ASIN: {listing.asin}</S.MonoText>
                  <a href={`https://www.amazon.com/dp/${listing.asin}`} target="_blank" rel="noreferrer">
                    <Icon name="open-in-new" size={14} />
                  </a>
                </S.IDLink>
                {listing.ebayListingId && (
                  <S.IDLink>
                    <S.MonoText>eBay: {listing.ebayListingId}</S.MonoText>
                    <a href={`https://www.ebay.com/itm/${listing.ebayListingId}`} target="_blank" rel="noreferrer">
                      <Icon name="open-in-new" size={14} />
                    </a>
                  </S.IDLink>
                )}
              </S.ProductMeta>
            </S.ProductMainInfo>
          </S.ProductCell>
        ),
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
          <S.StatBadge>
            <S.MetricValue $bold>${listing.price.toFixed(2)}</S.MetricValue>
            <S.StatSub>
              {t('listings.table.purchasePrice')}: ${listing.purchasePrice?.toFixed(2) || '0.00'}
            </S.StatSub>
          </S.StatBadge>
        ),
      },
      {
        key: 'profit',
        sortable: true,
        header: t('listings.table.estimatedProfit'),
        render: (_: any, listing: any) => {
          const profit = listing.estimatedProfit || 0;
          return (
            <S.MetricValue $positive={profit > 0} $negative={profit < 0}>
              {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
            </S.MetricValue>
          );
        },
      },
      {
        key: 'margins',
        sortable: true,
        header: t('listings.table.roi'),
        render: (_: any, listing: any) => (
          <S.StatBadge>
            <S.MetricValue $positive={(listing.roi || 0) > 0} $negative={(listing.roi || 0) < 0}>
              ROI: {listing.roi?.toFixed(1) || '0'}%
            </S.MetricValue>
            <S.StatSub>
              {t('listings.table.profitMargin')}: {listing.profitMargin?.toFixed(1) || '0'}%
            </S.StatSub>
          </S.StatBadge>
        ),
      },
      {
        key: 'sold',
        sortable: true,
        header: t('listings.table.sold'),
        align: 'center' as const,
        render: (_: any, listing: any) => <S.StatMain>{listing.soldCount || 0}</S.StatMain>,
      },
      {
        key: 'watch',
        sortable: true,
        header: t('listings.table.watch'),
        align: 'center' as const,
        render: (_: any, listing: any) => <S.StatMain>{listing.watchCount || 0}</S.StatMain>,
      },
      {
        key: 'views',
        sortable: true,
        header: t('listings.table.views'),
        align: 'center' as const,
        render: (_: any, listing: any) => <S.StatMain>{listing.viewCount || 0}</S.StatMain>,
      },
      {
        key: 'quantity',
        sortable: true,
        header: t('listings.table.stock'),
        align: 'center' as const,
        render: (_: any, listing: any) => (
          <S.StatBadge>
            <S.StockBadge $outOfStock={listing.quantity === 0}>{listing.quantity}</S.StockBadge>
            <S.StatSub title="Amazon Stock">Src: {listing.sourceStock ?? '—'}</S.StatSub>
          </S.StatBadge>
        ),
      },
      {
        key: 'status',
        sortable: true,
        header: t('listings.table.status'),
        render: (status: string) => <S.StatusBadge $status={status}>{status}</S.StatusBadge>,
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

  const handleEndSelected = () => {
    if (selectedListingIds.length === 0) return;
    showMessage(
      {
        type: 'warning',
        headerKey: 'listings:listings.modals.endTitle',
        descriptionKey: 'listings:listings.modals.endDescription',
        descriptionParams: { count: selectedListingIds.length },
        primaryButton: {
          labelKey: 'listings:listings.actions.endListing',
          variant: 'danger',
          onClick: async () => {
            await handleEndListings(selectedListingIds);
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
  };

  const handleDeleteSelected = () => {
    if (selectedListingIds.length === 0) return;
    showMessage(
      {
        type: 'warning',
        headerKey: 'listings:listings.modals.deleteTitle',
        descriptionKey: 'listings:listings.modals.deleteDescription',
        descriptionParams: { count: selectedListingIds.length },
        primaryButton: {
          labelKey: 'translation:common.delete',
          variant: 'danger',
          onClick: async () => {
            await handleDeleteListings(selectedListingIds);
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
  };

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

  return (
    <ListingsPageComponent
      listings={paginatedListings}
      isLoading={isListingsLoading}
      jobs={jobs}
      isJobsLoading={isJobsLoading}
      onRefresh={handleRefresh}
      onAddListing={handleAddListing}
      onEndListings={handleEndListings}
      selectedListingIds={selectedListingIds}
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
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      pagination={{
        count: listings.length,
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
  );
};
