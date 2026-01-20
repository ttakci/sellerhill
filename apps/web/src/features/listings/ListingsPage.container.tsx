import { Icon, useLoading, useUI } from '@repo/ui';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ListingsPageComponent } from './ListingsPage.component';
import * as S from './ListingsPage.style';
import { useEndListingsMutation, useGetListingJobsQuery, useGetListingsQuery } from './api/listings.api';

export const ListingsPageContainer: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['listings', 'translation']);
  const { showMessage } = useUI();
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  
  // Selection state (moved from component)
  const [selectedListingIds, setSelectedListingIds] = useState<string[]>([]);
  
  // Fetch listings and jobs
  const { data: listings = [], isLoading: isListingsLoading, refetch: refetchListings } = useGetListingsQuery(undefined, {
    pollingInterval: 5000, 
  });
  const { 
    data: jobs = [], 
    isLoading: isJobsLoading, 
    refetch: refetchJobs 
  } = useGetListingJobsQuery(undefined, {
    pollingInterval: 5000,
  });

  const [endListings, { isSuccess: isEndSuccess, error: endError, data: endData }] = useEndListingsMutation();
  
  const isLoading = isListingsLoading || isJobsLoading;
  
  useLoading(isLoading && listings.length === 0 && jobs.length === 0);

  // Pagination logic
  const paginatedListings = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return listings.slice(start, start + rowsPerPage);
  }, [listings, page, rowsPerPage]);

  // Handle end listings success
  React.useEffect(() => {
    if (isEndSuccess && endData?.success) {
      showMessage({
        type: 'success',
        headerKey: 'listings:listings.notifications.endSuccessTitle',
        descriptionKey: 'listings:listings.notifications.endSuccess',
        descriptionParams: { count: endData.count.toString() },
      }, t);
    }
  }, [isEndSuccess, endData, showMessage, t]);

  // Handle end listings error
  React.useEffect(() => {
    if (endError) {
      showMessage({
        type: 'error',
        headerKey: 'listings:listings.notifications.endErrorTitle',
        descriptionKey: 'listings:listings.notifications.endError',
      }, t);
    }
  }, [endError, showMessage, t]);
  
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

  // Columns definition (moved from component)
  const columns = useMemo(() => [
    {
      key: 'product',
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
            <S.ProductSubtitle>
              {new Date(listing.createdAt).toLocaleDateString(t('translation:common.languageCode') || 'en-US', { 
                month: 'short', 
                day: 'numeric', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </S.ProductSubtitle>
          </S.ProductMainInfo>
        </S.ProductCell>
      )
    },
    {
      key: 'asin',
      header: t('listings.table.asin'),
      render: (asin: string) => (
        <S.ASINLink>
          <S.MonoText>{asin}</S.MonoText>
          <a href={`https://www.amazon.com/dp/${asin}`} target="_blank" rel="noreferrer">
            <Icon name="open-in-new" size={16} />
          </a>
        </S.ASINLink>
      )
    },
    {
      key: 'ebayListingId',
      header: t('listings.table.ebayId'),
      render: (id: string) => <S.MonoText>{id || '—'}</S.MonoText>
    },
    {
      key: 'price',
      header: t('listings.table.price'),
      render: (price: number) => <S.PriceText>${price.toFixed(2)}</S.PriceText>
    },
    {
      key: 'quantity',
      header: t('listings.table.stock'),
      align: 'center' as const,
      render: (quantity: number) => (
        <S.StockBadge $outOfStock={quantity === 0}>
          {quantity}
        </S.StockBadge>
      )
    },
    {
      key: 'status',
      header: t('listings.table.status'),
      render: (status: string) => (
        <S.StatusBadge $status={status}>
          {status}
        </S.StatusBadge>
      )
    }
  ], [t]);

  // Selected rows computation (moved from component)
  const selectedRows = useMemo(() => 
    paginatedListings.filter(l => selectedListingIds.includes(l.id)),
    [paginatedListings, selectedListingIds]
  );

  // Handle end selected (moved from component)
  const handleEndSelected = () => {
    if (selectedListingIds.length === 0) return;

    showMessage({
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
        }
      },
      secondaryButton: {
        labelKey: 'translation:common.cancel',
        onClick: () => {}
      }
    }, t);
  };

  const handleSelectionChange = (ids: string[]) => {
    setSelectedListingIds(ids);
  };
  
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
      onSelectionChange={handleSelectionChange}
      onEndSelected={handleEndSelected}
      columns={columns}
      selectedRows={selectedRows}
      pagination={{
        count: listings.length,
        page,
        rowsPerPage,
        onPageChange: setPage,
        onRowsPerPageChange: (val) => {
          setRowsPerPage(val);
          setPage(1);
        }
      }}
    />
  );
};
