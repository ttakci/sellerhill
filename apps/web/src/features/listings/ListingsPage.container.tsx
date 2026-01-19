import { useLoading } from '@repo/ui';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ListingsPageComponent } from './ListingsPage.component';
import { useGetListingJobsQuery, useGetListingsQuery } from './api/listings.api';

export const ListingsPageContainer: React.FC = () => {
  const navigate = useNavigate();
  
  // Fetch listings and jobs
  const { data: listings = [], isLoading: isListingsLoading, refetch: refetchListings } = useGetListingsQuery();
  const { 
    data: jobs = [], 
    isLoading: isJobsLoading, 
    refetch: refetchJobs 
  } = useGetListingJobsQuery(undefined, {
    pollingInterval: 5000, // Poll every 5s to show progress
  });
  
  const isLoading = isListingsLoading || isJobsLoading;
  
  useLoading(isLoading && listings.length === 0 && jobs.length === 0);
  
  const handleAddListing = () => {
    navigate('/listings/add');
  };
  
  const handleRefresh = () => {
    refetchListings();
    refetchJobs();
  };
  
  return (
    <ListingsPageComponent
      listings={listings}
      isLoading={isListingsLoading}
      jobs={jobs}
      isJobsLoading={isJobsLoading}
      onRefresh={handleRefresh}
      onAddListing={handleAddListing}
    />
  );
};
