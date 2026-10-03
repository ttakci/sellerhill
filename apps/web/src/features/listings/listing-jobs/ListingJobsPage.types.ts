import type { ListingJobDatePreset, ListingJobDto, ListingJobStatus } from '@repo/shared';
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
  /** Discoverable date-range dropdown — replaces guessing a typed date in search. */
  datePreset: ListingJobDatePreset;
  onDatePresetChange: (value: string | number) => void;
  datePresetOptions: Array<{ value: ListingJobDatePreset; label: string }>;
  /** eBay account id from `?store=`, or '' for all stores. */
  storeFilter: string;
  onStoreFilterChange: (value: string | number) => void;
  storeOptions: Array<{ value: string; label: string }>;
  /** Only with more than one connected store — a one-option filter is noise. */
  showStoreFilter: boolean;
  /** The store a job ran against — null with a single connected store. */
  jobStoreLabel: (job: ListingJobDto) => string | null;
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
