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
  fulfillmentState: string;
  onFulfillmentStateChange: (value: string | number) => void;
  fulfillmentStateOptions: { value: string | number; label: string }[];
  trackingState: string;
  onTrackingStateChange: (value: string | number) => void;
  trackingStateOptions: { value: string | number; label: string }[];
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDateToChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  resultCount: number;
  isInitialLoading?: boolean;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  onOrderClick: (orderId: string) => void;
  /** Only set when the user arrived from the dashboard — `/orders` is itself the root of this section. */
  onBack?: () => void;
  onDownload: () => void;
}
