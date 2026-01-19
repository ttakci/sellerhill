import { useLoading, useUI } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ListingsPageComponent } from './ListingsPage.component';
import { useEndListingsMutation, useGetListingJobsQuery, useGetListingsQuery } from './api/listings.api';

export const ListingsPageContainer: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('listings');
  const { showMessage } = useUI();
  
  // Fetch listings and jobs
  const { data: listings = [], isLoading: isListingsLoading, refetch: refetchListings } = useGetListingsQuery(undefined, {
    pollingInterval: 5000, // Poll every 5s to sync with completed jobs
  });
  const { 
    data: jobs = [], 
    isLoading: isJobsLoading, 
    refetch: refetchJobs 
  } = useGetListingJobsQuery(undefined, {
    pollingInterval: 5000, // Poll every 5s to show progress
  });

  const [endListings, { isSuccess: isEndSuccess, error: endError, data: endData }] = useEndListingsMutation();
  
  const isLoading = isListingsLoading || isJobsLoading;
  
  useLoading(isLoading && listings.length === 0 && jobs.length === 0);

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
  
  return (
    <ListingsPageComponent
      listings={listings}
      isLoading={isListingsLoading}
      jobs={jobs}
      isJobsLoading={isJobsLoading}
      onRefresh={handleRefresh}
      onAddListing={handleAddListing}
      onEndListings={handleEndListings}
    />
  );
};
