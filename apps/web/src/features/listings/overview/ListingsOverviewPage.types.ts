import type { ListingDto } from '@repo/shared';

/**
 * Props for the ListingsOverviewPage presentational component.
 * The container owns all state (add-drawer open, queries) and passes only
 * what the markup needs.
 */
export interface ListingsOverviewPageProps {
  listings: ListingDto[];
  /** Total live listings for the user (from paginated API), not just the carousel page. */
  totalCount: number;
  /** Draft count for optional chrome (overview other-actions). */
  draftCount: number;
  onAddListing: () => void;
  onViewAll: () => void;
  onViewJobs: () => void;
  onImportExisting: () => void;
  onViewDrafts: () => void;
  onListingClick: (listingId: string) => void;
  /** eBay account id from `?store=`, or '' for all stores. */
  storeFilter: string;
  onStoreFilterChange: (value: string | number) => void;
  storeOptions: Array<{ value: string; label: string }>;
  /** Only with more than one connected store — a one-option filter is noise. */
  showStoreFilter: boolean;
}
