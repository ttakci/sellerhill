/**
 * DashboardPage Types
 */

import type { DashboardDataDto, UserDto } from '@repo/shared';

export interface DashboardPageComponentProps {
  user: UserDto | null;
  dashboardData?: DashboardDataDto;
  isLoading: boolean;
  onConnectEbay: () => void;
  onViewAllOrders: () => void;
  isTR: boolean;
  formatCurrency: (value: number) => string;
  formatCompactCurrency: (value: number) => string;
  formatDate: (dateString: string) => string;
}
