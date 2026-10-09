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
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  columns: TableColumn<ListingJobDto>[];
  columnOptions: { key: string; label: string; alwaysVisible?: boolean }[];
  visibleColumnKeys: string[];
  onToggleColumn: (key: string) => void;
  onMoveColumn: (key: string, direction: -1 | 1) => void;
  sortOptions: { value: string; label: string }[];
  sortValue: string;
  onSortChange: (value: string | number) => void;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  onJobClick: (jobId: string) => void;
  cancellingJobId: string | null;
  cancelTargetId: string | null;
  onCancelRequest: (jobId: string) => void;
  onCancelDismiss: () => void;
  onCancelConfirm: () => void;
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
