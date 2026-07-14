import type { ListingDto } from '@repo/shared';

/**
 * Props for the ListingsOverviewPage presentational component.
 * The container owns all state (add-drawer open, queries) and passes only
 * what the markup needs.
 */
export interface ListingsOverviewPageProps {
  listings: ListingDto[];
  onAddListing: () => void;
  onViewAll: () => void;
  onViewJobs: () => void;
}
