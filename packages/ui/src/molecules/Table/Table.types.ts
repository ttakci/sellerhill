export interface TableColumn<T = unknown> {
  key: string;
  header: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: unknown, row: T, index: number) => React.ReactNode;
  sortable?: boolean;
}

export interface TableProps<T = unknown> {
  columns: TableColumn<T>[];
  data: T[];
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
  footer?: React.ReactNode;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

export interface TableHeaderProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

export interface TableCellProps {
  children: React.ReactNode;
  align?: 'left' | 'center' | 'right';
}
