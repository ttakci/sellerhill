import type { ListingDto, ListingJobDto } from '@repo/shared';
import { BulkAction, TableColumn } from '@repo/ui';

export interface ListingsPageProps {
  listings: ListingDto[];
  isLoading: boolean;
  jobs: ListingJobDto[];
  isJobsLoading: boolean;
  onRefresh: () => void;
  onAddListing: () => void;
  onEndListings: (ids: string[]) => void;
  onSelectionChange: (ids: string[]) => void;
  columns: TableColumn<ListingDto>[];
  selectedRows: ListingDto[];
  bulkActions?: BulkAction<ListingDto>[];
  onDownload?: () => void;
  pagination: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    labelRowsPerPage?: string;
    labelInfo?: string;
  };
  columnOptions: { key: string; label: string; alwaysVisible?: boolean }[];
  visibleColumnKeys: string[];
  onToggleColumn: (key: string) => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}
