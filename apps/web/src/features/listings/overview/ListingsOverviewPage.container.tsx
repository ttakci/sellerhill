import { useLoading } from '@repo/ui';
import React, { useState } from 'react';

import { AddListingsDrawer } from '../add-listings/drawer';
import { useGetListingsQuery } from '../api/listings.api';

import { ListingsOverviewPageComponent } from './ListingsOverviewPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useLocale } from '@/utils/useLocale';

export const ListingsOverviewPageContainer: React.FC = () => {
  const { localeNavigate } = useLocale();
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);

  const { data: listings = [], isLoading } = useGetListingsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  useLoading(isLoading);

  const handleAddListing = () => {
    setIsAddDrawerOpen(true);
  };

  const handleAddDrawerClose = () => {
    setIsAddDrawerOpen(false);
  };

  const handleAddSuccess = () => {
    localeNavigate('/listings/jobs');
  };

  return (
    <EbayAccountGuard>
      <ListingsOverviewPageComponent
        listings={listings}
        onAddListing={handleAddListing}
        onViewAll={() => localeNavigate('/listings/all')}
        onViewJobs={() => localeNavigate('/listings/jobs')}
      />
      <AddListingsDrawer isOpen={isAddDrawerOpen} onClose={handleAddDrawerClose} onSuccess={handleAddSuccess} />
    </EbayAccountGuard>
  );
};
