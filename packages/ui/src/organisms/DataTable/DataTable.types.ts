import { ReactNode } from 'react';

import { BulkAction, TableColumn } from '../../molecules/Table/Table.types';
import { ViewMode } from '../../molecules/ViewToggle/ViewToggle.types';

export interface ColumnOption {
  key: string;
  label: string;
  alwaysVisible?: boolean;
}

export interface DataTableProps<T extends Record<string, unknown>> {
  /** Table column definitions */
  columns: TableColumn<T>[];
  /** Row data array */
  data: T[];

  /** Render function for each grid card item */
  renderGridCard: (item: T, index: number) => ReactNode;

  // --- View mode ---
  /** Controlled view mode */
  viewMode?: ViewMode;
  /** Default view mode when uncontrolled. Auto-detects from viewport if omitted. */
  defaultViewMode?: ViewMode;
  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void;
  /** Hide the grid/table toggle entirely */
  hideViewToggle?: boolean;

  // --- Selection & bulk actions ---
  /** Enable row selection with checkboxes */
  selectable?: boolean;
  /** Currently selected rows */
  selectedRows?: T[];
  /** Callback when selection changes */
  onSelectionChange?: (selectedRows: T[]) => void;
  /** Bulk action options for selected rows */
  bulkActions?: BulkAction<T>[];
  /** Placeholder text for bulk actions dropdown */
  bulkActionsPlaceholder?: string;

  // --- Column visibility ---
  /** Column options for the column manager popover */
  columnOptions?: ColumnOption[];
  /** Keys of currently visible columns */
  visibleColumnKeys?: string[];
  /** Callback to toggle a column's visibility */
  onToggleColumn?: (key: string) => void;
  /** Header label for column manager popover (i18n) */
  columnManagerLabel?: string;

  // --- Sorting ---
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;

  // --- Toolbar ---
  /** Export/download callback */
  onDownload?: () => void;
  /** Custom content rendered on the left side of toolbar */
  toolbarLeft?: ReactNode;
  /** Custom content rendered on the right side of toolbar */
  actions?: ReactNode;

  // --- Pagination ---
  pagination?: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    labelRowsPerPage?: string;
    labelInfo?: string;
  };

  // --- Misc ---
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
}
