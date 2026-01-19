import type { ListingDto, ListingJobDto } from '@repo/shared';

export interface ListingsPageProps {
  listings: ListingDto[];
  isLoading: boolean;
  jobs: ListingJobDto[];
  isJobsLoading: boolean;
  onRefresh: () => void;
  onAddListing: () => void;
}
