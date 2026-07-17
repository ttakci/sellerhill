import type { OrderDto } from '@repo/shared';
import type { TableColumn, ViewMode } from '@repo/ui';

export interface OrdersAllPageProps {
  orders: OrderDto[];
  columns: TableColumn<OrderDto>[];
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
  search: string;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  status: string;
  onStatusChange: (value: string | number) => void;
  statusOptions: { value: string | number; label: string }[];
  ebayAccountId: string;
  onEbayAccountChange: (value: string | number) => void;
  storeOptions: { value: string | number; label: string }[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  resultCount: number;
  isInitialLoading?: boolean;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  onOrderClick: (orderId: string) => void;
  onBack: () => void;
  onDownload: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}
