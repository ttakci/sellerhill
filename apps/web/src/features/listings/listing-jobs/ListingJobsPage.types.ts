import type { ListingJobDto } from '@repo/shared';

export interface ListingJobsPageContainerProps {}

export interface ListingJobsPageComponentProps {
  jobs: ListingJobDto[];
  isLoading: boolean;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: any[];
  onDownload: () => void;
}
