import type React from 'react';

export interface TableComponentProps<T = unknown> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  emptyContent?: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  selectable?: boolean;
  selectedRows?: T[];
  bulkActions?: BulkAction<T>[];
  bulkActionsPlaceholder?: string;
  onFilter?: () => void;
  onDownload?: () => void;
  actions?: React.ReactNode;
  pagination?: TableProps<T>['pagination'];
  bulkValue: string | number;
  bulkOptions: { value: string; label: string }[];
  overflowRef: React.RefObject<HTMLDivElement>;
  onRowClick: (row: T, index: number) => void;
  onSort: (columnKey: string) => void;
  onSelectAll: (checked: boolean) => void;
  onSelectRow: (row: T, checked: boolean) => void;
  onBulkChange: (value: string | number) => void;
  onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUpOrLeave: () => void;
  isAllSelected: boolean;
  hasToolbar: boolean;
}

export interface TableColumn<T = unknown> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string | number;
  sticky?: boolean;
}

export interface BulkAction<T = unknown> {
  label: string;
  onClick: (selectedRows: T[]) => void;
  variant?: 'default' | 'danger';
}

export interface TableProps<T = unknown> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  /** Rich empty state; takes precedence over emptyMessage when set. */
  emptyContent?: React.ReactNode;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
  footer?: React.ReactNode;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
  selectable?: boolean;
  selectedRows?: T[];
  onSelectionChange?: (selectedRows: T[]) => void;
  bulkActions?: BulkAction<T>[];
  bulkActionsPlaceholder?: string;
  onFilter?: () => void;
  onDownload?: () => void;
  actions?: React.ReactNode;
  pagination?: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    labelRowsPerPage?: string;
    labelInfo?: string;
  };
}

export interface TableHeaderProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface TableCellProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}
