/**
 * PeriodCard types
 */

import type { PeriodMetricsDto } from '@repo/shared';

import type { DashboardFormatters } from '../../dashboard.types';

/** Every user-visible string the card needs, pre-translated by the page container. */
export interface PeriodCardLabels {
  sales: string;
  netProfit: string;
  grossProfit: string;
  ordersUnits: string;
  refunds: string;
  margin: string;
  roi: string;
  estimatedPayout: string;
  avgOrderValue: string;
  costOfGoods: string;
  transactionFees: string;
  adFees: string;
  amazonShipping: string;
  amazonTax: string;
  refundRate: string;
  showMore: string;
  showLess: string;
  estimatedLabel: string;
  estimatedTooltip: string;
  uncostedLabel: string;
  uncostedTooltip: string;
}

export interface PeriodCardContainerProps {
  title: string;
  dateRange: string;
  metrics: PeriodMetricsDto;
  /** Gradient band background from `theme.colors.dashboard.*Gradient`. */
  headerGradient: string;
  isActive: boolean;
  onSelect: () => void;
  formatters: DashboardFormatters;
  labels: PeriodCardLabels;
}

export interface PeriodCardComponentProps extends PeriodCardContainerProps {
  isExpanded: boolean;
  onSelectKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  onToggleDetails: (event: React.MouseEvent<HTMLButtonElement>) => void;
  salesTrend?: string;
  profitTrend?: string;
  salesTrendPositive: boolean;
  profitTrendPositive: boolean;
  profitPositive: boolean;
  hasEstimated: boolean;
  hasUncosted: boolean;
}
