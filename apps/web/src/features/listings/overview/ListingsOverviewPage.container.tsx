import { ListingStatus } from '@repo/shared';
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AddListingsDrawer } from '../add-listings/drawer';
import { useGetListingsQuery } from '../api/listings.api';
import { ExistingListingsImportDrawer } from '../import-existing';

import { ListingsOverviewPageComponent } from './ListingsOverviewPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useLocale } from '@/utils/useLocale';

/** `?drawer=add` opens the create flow — the legacy `/listings/add` page redirects here. */
const ADD_DRAWER_PARAM = 'add';
/**
 * `?drawer=import` opens the existing-listing import flow. It is the fix for
 * untracked orders (a sale on an eBay item we hold no listing for), so the
 * Action Center links straight at it — the drawer had no URL param at all and
 * that link silently opened the plain overview page.
 */
const IMPORT_DRAWER_PARAM = 'import';

export const ListingsOverviewPageContainer: React.FC = () => {
  const { localeNavigate } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(
    () => searchParams.get('drawer') === ADD_DRAWER_PARAM
  );
  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(
    () => searchParams.get('drawer') === IMPORT_DRAWER_PARAM
  );

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

  /**
   * Drop the `drawer` param on close so a back/refresh does not immediately
   * reopen a drawer the seller just dismissed.
   */
  const clearDrawerParam = (value: string) => {
    if (searchParams.get('drawer') === value) {
      const next = new URLSearchParams(searchParams);
      next.delete('drawer');
      setSearchParams(next, { replace: true });
    }
  };

  const handleAddDrawerClose = () => {
    setIsAddDrawerOpen(false);
    clearDrawerParam(ADD_DRAWER_PARAM);
  };

  const handleImportDrawerClose = () => {
    setIsImportDrawerOpen(false);
    clearDrawerParam(IMPORT_DRAWER_PARAM);
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
        onImportExisting={() => setIsImportDrawerOpen(true)}
        onViewDrafts={() => localeNavigate(`/listings/all?status=${ListingStatus.DRAFT}`)}
        onListingClick={(id) => localeNavigate(`/listings/${id}`)}
      />
      <AddListingsDrawer isOpen={isAddDrawerOpen} onClose={handleAddDrawerClose} onSuccess={handleAddSuccess} />
      <ExistingListingsImportDrawer
        isOpen={isImportDrawerOpen}
        onClose={handleImportDrawerClose}
        onSuccess={(jobId) => localeNavigate(`/listings/jobs/${jobId}`)}
      />
    </EbayAccountGuard>
  );
};
