import type { OrderDto, OrderStageTab } from '@repo/shared';
import type { TabNavItem, TableColumn, ViewMode } from '@repo/ui';

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
  /** Counted stage tabs (All · Needs action · To purchase · In progress · Done). */
  tab: OrderStageTab;
  tabItems: TabNavItem[];
  onTabChange: (tabId: string) => void;
  /** The Status select — one stage; choosing one returns the rail to "All". */
  stage: string;
  onStageChange: (value: string | number) => void;
  stageOptions: { value: string | number; label: string }[];
  trackingState: string;
  onTrackingStateChange: (value: string | number) => void;
  trackingStateOptions: { value: string | number; label: string }[];
  /** Conditions beside the stage: ship-by deadline close / missed, refunded. */
  flag: string;
  onFlagChange: (value: string | number) => void;
  flagOptions: { value: string | number; label: string }[];
  // No date props: `dateFrom`/`dateTo` are read-only inbound state from the
  // dashboard's "view all" deep link (see useOrdersFilters), the list renders
  // no date inputs, and the component never read them — so declaring them here
  // only made every render of this page a type error.
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  resultCount: number;
  isInitialLoading?: boolean;
  /** Formats money in the order's OWN store currency (`ebayAccountId`), never a page-wide one. */
  formatCurrency: (value: number, ebayAccountId?: string | null) => string;
  /** The store a row belongs to — `null` with a single connected store. */
  storeLabelFor: (ebayAccountId?: string | null) => string | null;
  formatDate: (value: string) => string;
  /** Month + day only — for eBay's ship-by date on a card. */
  formatDay: (value: string) => string;
  onOrderClick: (orderId: string) => void;
  /** Only set when the user arrived from the dashboard — `/orders` is itself the root of this section. */
  onBack?: () => void;
  onDownload: () => void;
}
