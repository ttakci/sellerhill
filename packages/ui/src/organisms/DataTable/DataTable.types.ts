import { ReactNode } from 'react';

import { BulkAction, TableColumn } from '../../molecules/Table/Table.types';
import { ViewMode } from '../../molecules/ViewToggle/ViewToggle.types';

export interface ColumnOption {
  key: string;
  label: string;
  alwaysVisible?: boolean;
}

export interface DataTablePagination {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  labelRowsPerPage?: string;
  labelInfo?: string;
}

export interface DataTableProps<T> {
  /** Table column definitions */
  columns: TableColumn<T>[];
  /** Row data array */
  data: T[];

  /** Render function for each grid card item */
  renderGridCard: (item: T, index: number) => ReactNode;

  /**
   * Narrowest track a grid card can survive in. Column count is derived from it
   * (auto-fill), so a wide horizontal card never gets squeezed into a third of
   * the row. Default suits a compact vertical card.
   */
  gridMinItemWidth?: string;

  /** Hard cap on grid columns. Omit to let the viewport decide. */
  gridMaxColumns?: number;

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
  pagination?: DataTablePagination;

  // --- Misc ---
  /** Plain-text empty fallback (table + grid). Prefer emptyContent for rich UI. */
  emptyMessage?: string;
  /** Rich empty state (icon, actions). Takes precedence over emptyMessage when data is empty. */
  emptyContent?: ReactNode;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
}

/** Internal props for the presentation component (computed by container). */
export interface DataTableComponentProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  renderGridCard: (item: T, index: number) => ReactNode;
  gridMinItemWidth: string;
  gridMaxColumns?: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  hideViewToggle: boolean;
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (selectedRows: T[]) => void;
  bulkActions?: BulkAction<T>[];
  bulkActionsPlaceholder?: string;
  bulkValue: string | number;
  bulkOptions: { value: string; label: string }[];
  onBulkChange: (value: string | number) => void;
  columnOptions?: ColumnOption[];
  visibleColumnKeys?: string[];
  onToggleColumn?: (key: string) => void;
  columnManagerLabel?: string;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  onDownload?: () => void;
  toolbarLeft?: ReactNode;
  actions?: ReactNode;
  pagination?: DataTablePagination;
  emptyMessage?: string;
  emptyContent?: ReactNode;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
}
