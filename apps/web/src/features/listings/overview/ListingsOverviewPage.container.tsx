import { ListingStatus, parseAsins } from '@repo/shared';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { AddListingsDrawer } from '../add-listings/drawer';
import { useGetListingsQuery } from '../api/listings.api';
import { ExistingListingsImportDrawer } from '../import-existing';

import { ListingsOverviewPageComponent } from './ListingsOverviewPage.component';

import { EbayAccountGuard } from '@/components/EbayAccountGuard';
import { useStoreFilterOptions } from '@/features/ebay/hooks/useStoreLabel';
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
  const { t } = useTranslation(['listings', 'translation']);
  const { localeNavigate } = useLocale();
  const [searchParams, setSearchParams] = useSearchParams();
  /* `?store=` narrows the page to one store — the carousel, the counts, the
     links onward and the store the Add Listings drawer opens on. */
  const storeFilter = searchParams.get('store') ?? '';
  const { options: storeOptions, hasMultipleStores } = useStoreFilterOptions(t('listings.filters.allStores'));
  const storeQuery = storeFilter ? `store=${encodeURIComponent(storeFilter)}` : '';
  const withStore = (path: string) => (storeQuery ? `${path}${path.includes('?') ? '&' : '?'}${storeQuery}` : path);

  const handleStoreFilterChange = (value: string | number) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set('store', String(value));
    } else {
      next.delete('store');
    }
    setSearchParams(next, { replace: true });
  };
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
    { refetchOnMountOrArgChange: true }
  );

  // Lightweight draft count for other-actions context
  const { data: draftsData } = useGetListingsQuery(
    { page: 1, limit: 1, status: ListingStatus.DRAFT, ebayAccountId: storeFilter || undefined },
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
      localeNavigate(withStore(`/listings/all?status=${ListingStatus.DRAFT}`));
      return;
    }
    localeNavigate(withStore('/listings/jobs'));
  };

  return (
    <EbayAccountGuard>
      <ListingsOverviewPageComponent
        listings={listings}
        totalCount={total}
        draftCount={draftCount}
        onAddListing={handleAddListing}
        onViewAll={() => localeNavigate(withStore('/listings/all'))}
        onViewJobs={() => localeNavigate(withStore('/listings/jobs'))}
        onImportExisting={() => setIsImportDrawerOpen(true)}
        onViewDrafts={() => localeNavigate(withStore(`/listings/all?status=${ListingStatus.DRAFT}`))}
        onListingClick={(id) => localeNavigate(`/listings/${id}`)}
        storeFilter={storeFilter}
        onStoreFilterChange={handleStoreFilterChange}
        storeOptions={storeOptions}
        showStoreFilter={hasMultipleStores}
      />
      <AddListingsDrawer
        isOpen={isAddDrawerOpen}
        onClose={handleAddDrawerClose}
        onSuccess={handleAddSuccess}
        initialAsins={initialAsins}
        initialEbayAccountId={storeFilter || undefined}
      />
      <ExistingListingsImportDrawer
        isOpen={isImportDrawerOpen}
        onClose={handleImportDrawerClose}
        onSuccess={(jobId) => localeNavigate(`/listings/jobs/${jobId}`)}
      />
    </EbayAccountGuard>
  );
};
