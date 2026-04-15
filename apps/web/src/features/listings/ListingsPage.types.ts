import type { ListingDto, ListingJobDto } from '@repo/shared';
import { BulkAction, TableColumn } from '@repo/ui';

export interface NumericRange {
  min: string;
  max: string;
}

export interface ListingsFilterState {
  search: string;
  category: string;
  status: string;
  price: NumericRange;
  purchasePrice: NumericRange;
  estimatedProfit: NumericRange;
  roi: NumericRange;
  profitMargin: NumericRange;
  soldCount: NumericRange;
  watchCount: NumericRange;
  viewCount: NumericRange;
  quantity: NumericRange;
  sourceStock: NumericRange;
}

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
  // Filter props
  filters: ListingsFilterState;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCategoryChange: (value: string | number) => void;
  categoryOptions: { value: string | number; label: string }[];
  onStatusChange: (value: string | number) => void;
  statusOptions: { value: string | number; label: string }[];
  numericFilters: {
    key: string;
    label: string;
    min: string;
    max: string;
    onMinChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMaxChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  }[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  resultCount: number;
}
