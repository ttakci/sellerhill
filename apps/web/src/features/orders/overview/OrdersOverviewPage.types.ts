import type { OrderDto } from '@repo/shared';

export interface OrdersOverviewPageProps {
  orders: OrderDto[];
  totalCount: number;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  onViewAll: () => void;
  onOrderClick: (orderId: string) => void;
  onRefresh: () => void;
}
