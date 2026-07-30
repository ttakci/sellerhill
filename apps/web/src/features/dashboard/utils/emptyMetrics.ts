/**
 * Zeroed period aggregate used while the dashboard query is in flight.
 * Mirrors the backend's empty period so no surface has to null-check.
 */

import type { PeriodMetricsDto } from '@repo/shared';

export const EMPTY_PERIOD_METRICS: PeriodMetricsDto = {
  sales: 0,
  orders: 0,
  units: 0,
  refunds: 0,
  grossProfit: 0,
  netProfit: 0,
  estimatedPayout: 0,
  margin: 0,
  avgOrderValue: 0,
  trend: null,
  profitTrend: null,
  profitConfirmed: 0,
  profitProvisional: 0,
  revenueUncosted: 0,
  ordersPendingCapture: 0,
  ordersCaptureFailed: 0,
  ordersUntracked: 0,
  costOfGoods: 0,
  transactionFees: 0,
  adFees: 0,
  amazonShipping: 0,
  amazonTax: 0,
  roi: 0,
  refundRate: 0,
};
