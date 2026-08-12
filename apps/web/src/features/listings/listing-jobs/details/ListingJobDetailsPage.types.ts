import type { ListingJobDto, ListingJobItemDto, ListingJobStatus, ListingStatus } from '@repo/shared';
import type { TableColumn, ViewMode } from '@repo/ui';

export interface ListingJobDetailsPageComponentProps {
  jobId: string;
  job: ListingJobDto | undefined;
  items: ListingJobItemDto[];
  isLoading: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  columns: TableColumn<ListingJobItemDto>[];
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
  onClearItemSearch: () => void;
  /** Count after the search filter, before pagination slicing. */
  filteredItemCount: number;
}
