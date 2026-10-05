import type { ListingJobDto, ListingJobItemDto, ListingJobStatus, ListingStatus } from '@repo/shared';
import type { TableColumn, ViewMode } from '@repo/ui';

/**
 * Which job items the list shows. `FAILED` is every item that ended in
 * `ListingStatus.ERROR`; the two blacklist values split those by whether the
 * seller's own blacklist caused the failure (`ListingFailureCode.BLACKLISTED_KEYWORD`)
 * — the one failure a seller fixes themselves, so it is worth isolating.
 */
export enum JobItemFilter {
  ALL = 'all',
  FAILED = 'failed',
  BLACKLISTED = 'blacklisted',
  NON_BLACKLISTED = 'non_blacklisted',
}

export interface JobItemFilterOption {
  value: JobItemFilter;
  label: string;
}

export interface ListingJobDetailsPageComponentProps {
  jobId: string;
  job: ListingJobDto | undefined;
  items: ListingJobItemDto[];
  isLoading: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  columns: TableColumn<ListingJobItemDto>[];
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
  onBack: () => void;
  /**
   * Cancel is offered only while the job can still be stopped. There is no
   * refresh action — the page polls every 3s, so a manual refresh only ever
   * duplicated what was already happening.
   */
  canCancel: boolean;
  isCancelling: boolean;
  isCancelConfirmOpen: boolean;
  onCancelRequest: () => void;
  onCancelDismiss: () => void;
  onCancelConfirm: () => void;
  formatPercent: (job: ListingJobDto) => number;
  formatJobDate: (iso: string) => string;
  jobStatusLabel: (status: ListingJobStatus | string) => string;
  itemStatusLabel: (status: ListingStatus | string) => string;
  /**
   * Localized, seller-actionable failure reason. Null when the item did not
   * fail. The provider's raw error text never reaches this surface.
   */
  itemFailureLabel: (item: ListingJobItemDto) => string | null;
  /** Correlation id for the failed attempt, quoted when opening a support case. */
  itemFailureReference: (item: ListingJobItemDto) => string | null;
  pagination: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    labelRowsPerPage?: string;
    labelInfo?: string;
  };
  paginatedItems: ListingJobItemDto[];
  /** Client-side search over ASIN + the localized failure message. */
  itemSearch: string;
  onItemSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Clears the search AND the status filter — the empty state's "clear filters" action. */
  onClearItemSearch: () => void;
  /** Status / failure-cause filter, applied before the search. */
  itemFilter: JobItemFilter;
  onItemFilterChange: (value: string | number) => void;
  /** Options carry their own counts so the seller sees the size of each group before choosing. */
  itemFilterOptions: JobItemFilterOption[];
  /** Count after the search and status filters, before pagination slicing. */
  filteredItemCount: number;
}
