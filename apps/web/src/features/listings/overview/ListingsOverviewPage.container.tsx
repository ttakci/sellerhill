import { ListingStatus, parseAsins } from '@repo/shared';
import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { AddListingsDrawer } from '../add-listings/drawer';
import { useGetListingsQuery } from '../api/listings.api';
import { ExistingListingsImportDrawer } from '../import-existing';

import { ListingsOverviewPageComponent } from './ListingsOverviewPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useActiveStore } from '@/features/ebay/hooks/useActiveStore';
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
/**
 * `?asins=B0…,B0…` alongside `drawer=add` pre-fills the create flow — the Best
 * Sellers page hands its ticked products over this way. Read once, like the
 * drawer flag: the URL is the hand-off, not live state.
 */
const ASINS_PARAM = 'asins';

export const ListingsOverviewPageContainer: React.FC = () => {
  const { localeNavigate } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  /* The top bar's active store: the carousel, the counts and the links onward
     all show it (the links need no `?store=` — the provider adds it). */
  const { activeStoreId } = useActiveStore();
  const storeFilter = activeStoreId ?? '';
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(
    () => searchParams.get('drawer') === ADD_DRAWER_PARAM
  );
  const [isImportDrawerOpen, setIsImportDrawerOpen] = useState(
    () => searchParams.get('drawer') === IMPORT_DRAWER_PARAM
  );
  const [initialAsins, setInitialAsins] = useState(() => {
    const raw = searchParams.get(ASINS_PARAM);
    return raw ? parseAsins(raw).join('\n') : '';
  });

  // Carousel + "view all" only show real (active) listings — never drafts
  const { data } = useGetListingsQuery(
    {
      page: 1,
      limit: 12,
      status: ListingStatus.ACTIVE,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      ebayAccountId: storeFilter || undefined,
    },
    { refetchOnMountOrArgChange: true, skip: !storeFilter }
  );

  // Lightweight draft count for other-actions context
  const { data: draftsData } = useGetListingsQuery(
    { page: 1, limit: 1, status: ListingStatus.DRAFT, ebayAccountId: storeFilter || undefined },
    { refetchOnMountOrArgChange: true, skip: !storeFilter }
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
      // The hand-off travels with the drawer flag; a reopened drawer must start blank.
      next.delete(ASINS_PARAM);
      setSearchParams(next, { replace: true });
    }
  };

  const handleAddDrawerClose = () => {
    setIsAddDrawerOpen(false);
    // The hand-off is spent once the drawer closes: reopening from the page's
    // own "Add listings" action must start blank, not with the Best Sellers pick.
    setInitialAsins('');
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
      <AddListingsDrawer
        isOpen={isAddDrawerOpen}
        onClose={handleAddDrawerClose}
        onSuccess={handleAddSuccess}
        initialAsins={initialAsins}
      />
      <ExistingListingsImportDrawer
        isOpen={isImportDrawerOpen}
        onClose={handleImportDrawerClose}
        onSuccess={(jobId) => localeNavigate(`/listings/jobs/${jobId}`)}
      />
    </EbayAccountGuard>
  );
};
