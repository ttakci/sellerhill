import type { ListingJobDto } from '@repo/shared';

export interface ListingJobsPageContainerProps {}

export interface ListingJobsPageComponentProps {
  jobs: ListingJobDto[];
  isLoading: boolean;
  onRefresh: () => void;
  onViewDetails: (jobId: string) => void;
  pagination?: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    labelRowsPerPage?: string;
    labelInfo?: string;
  };
  columns: any[];
}
