import type { ListingDto } from '@repo/shared';
import { type BulkAction, type TableColumn, type ViewMode } from '@repo/ui';

import type { ListingsFilterState } from '../shared/listings-filter.types';

export interface ListingsAllPageProps {
  listings: ListingDto[];
  onSelectionChange: (ids: string[]) => void;
  columns: TableColumn<ListingDto>[];
  selectedRows: ListingDto[];
  bulkActions?: BulkAction<ListingDto>[];
  onDownload?: () => void;
  tableView: ViewMode;
  onTableViewChange: (mode: ViewMode) => void;
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
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
}
