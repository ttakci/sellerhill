export interface TableColumn<T = any> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string | number;
  sticky?: boolean;
}

export interface BulkAction<T = any> {
  label: string;
  onClick: (selectedRows: T[]) => void;
  variant?: 'default' | 'danger';
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
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
