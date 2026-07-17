import { ListingStatus } from '@repo/shared';
import React, { useState } from 'react';

import { AddListingsDrawer } from '../add-listings/drawer';
import { useGetListingsQuery } from '../api/listings.api';

import { ListingsOverviewPageComponent } from './ListingsOverviewPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useLocale } from '@/utils/useLocale';

export const ListingsOverviewPageContainer: React.FC = () => {
  const { localeNavigate } = useLocale();
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

  // Carousel + "view all" only show real (active) listings — never drafts
  const { data } = useGetListingsQuery(
    {
      page: 1,
      limit: 12,
      status: ListingStatus.ACTIVE,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    },
    { refetchOnMountOrArgChange: true }
  );

  // Lightweight draft count for other-actions context
  const { data: draftsData } = useGetListingsQuery(
    { page: 1, limit: 1, status: ListingStatus.DRAFT },
    { refetchOnMountOrArgChange: true }
  );

  const listings = data?.items ?? [];
  const total = data?.total ?? 0;
  const draftCount = draftsData?.total ?? 0;

  const handleAddListing = () => {
    setIsAddDrawerOpen(true);
  };

  const handleAddDrawerClose = () => {
    setIsAddDrawerOpen(false);
  };

  const handleAddSuccess = (result?: { asDraft: boolean }) => {
    if (result?.asDraft) {
      localeNavigate(`/listings/all?status=${ListingStatus.DRAFT}`);
      return;
    }
    localeNavigate('/listings/jobs');
  };

  return (
    <EbayAccountGuard>
      <ListingsOverviewPageComponent
        listings={listings}
        totalCount={total}
        draftCount={draftCount}
        onAddListing={handleAddListing}
        onViewAll={() => localeNavigate('/listings/all')}
        onViewJobs={() => localeNavigate('/listings/jobs')}
        onViewDrafts={() => localeNavigate(`/listings/all?status=${ListingStatus.DRAFT}`)}
        onListingClick={(id) => localeNavigate(`/listings/${id}`)}
      />
      <AddListingsDrawer isOpen={isAddDrawerOpen} onClose={handleAddDrawerClose} onSuccess={handleAddSuccess} />
    </EbayAccountGuard>
  );
};
