import type { ListingDto, ListingJobDto } from '@repo/shared';

export interface ListingsPageProps {
  listings: ListingDto[];
  isLoading: boolean;
  jobs: ListingJobDto[];
  isJobsLoading: boolean;
  onRefresh: () => void;
  onAddListing: () => void;
  onEndListings: (listingIds: string[]) => void;
  selectedListingIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEndSelected: () => void;
  columns: any[];
  selectedRows: any[];
  pagination?: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
  };
}
