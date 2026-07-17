import type { ListingJobDto, ListingJobStatus } from '@repo/shared';
import type { TableColumn, ViewMode } from '@repo/ui';

export interface ListingJobsPageComponentProps {
  jobs: ListingJobDto[];
  totalCount: number;
  isInitialLoading: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  search: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string | number) => void;
  statusOptions: Array<{ value: string; label: string }>;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  columns: TableColumn<ListingJobDto>[];
  onJobClick: (jobId: string) => void;
  onDownload: () => void;
  onBack: () => void;
  formatPercent: (job: ListingJobDto) => number;
  formatJobDate: (iso: string) => string;
  statusLabel: (status: ListingJobStatus | string) => string;
  pagination: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    labelRowsPerPage?: string;
    labelInfo?: string;
  };
}
