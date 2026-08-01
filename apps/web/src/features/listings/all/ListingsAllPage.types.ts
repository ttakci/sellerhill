import type { ListingDto } from '@repo/shared';
import { type BulkAction, type TableColumn, type ViewMode } from '@repo/ui';

import type { ListingsFilterState } from '../shared/listings-filter.types';

export interface ListingsAllPageProps {
  listings: ListingDto[];
  onSelectionChange: (ids: string[]) => void;
  columns: TableColumn<ListingDto>[];
  selectedRows: ListingDto[];
  selectedIds: string[];
  onToggleListingSelection: (id: string, selected: boolean) => void;
  bulkActions?: BulkAction<ListingDto>[];
  onDownload?: () => void;
  tableView: ViewMode;
  onTableViewChange: (mode: ViewMode) => void;
  onBack?: () => void;
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
  onTrackingStateChange: (value: string | number) => void;
  trackingOptions: { value: string | number; label: string }[];
  onEbayAccountChange: (value: string | number) => void;
  storeOptions: { value: string | number; label: string }[];
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
  /** True while first listings fetch is in flight (inline empty state, not global overlay). */
  isInitialLoading?: boolean;
  onListingClick: (listingId: string) => void;
  /** Draft list mode — different title and bulk actions (publish instead of end). */
  isDraftMode?: boolean;
  /** Hide status filter when locked to drafts (or other fixed status views). */
  hideStatusFilter?: boolean;
  /** Empty catalog CTA (not used for draft empty). */
  onAddListing?: () => void;
}
