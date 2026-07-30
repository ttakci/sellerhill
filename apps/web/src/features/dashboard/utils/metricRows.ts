/**
 * Canonical metric row definitions shared by the P&L matrix and the chart
 * summary panel, so both surfaces always show the same figures in the same order.
 */

import { DashboardPnlGroup, DashboardValueFormat } from '@repo/shared';

import type { DashboardMetricRow } from '../dashboard.types';

export const DASHBOARD_METRIC_ROWS: DashboardMetricRow[] = [
  {
    key: 'sales',
    group: DashboardPnlGroup.REVENUE,
    labelKey: 'dashboard.metrics.sales',
    format: DashboardValueFormat.CURRENCY,
    monthField: 'sales',
    summaryField: 'sales',
  },
  {
    key: 'units',
    group: DashboardPnlGroup.REVENUE,
    labelKey: 'dashboard.metrics.units',
    format: DashboardValueFormat.NUMBER,
    monthField: 'units',
    summaryField: 'units',
  },
  {
    key: 'orders',
    group: DashboardPnlGroup.REVENUE,
    labelKey: 'dashboard.metrics.orders',
    format: DashboardValueFormat.NUMBER,
    monthField: 'orders',
    summaryField: 'orders',
  },
  {
    key: 'refunds',
    group: DashboardPnlGroup.REVENUE,
    labelKey: 'dashboard.metrics.refunds',
    format: DashboardValueFormat.NUMBER,
    monthField: 'refunds',
    summaryField: 'refunds',
  },
  {
    key: 'costOfGoods',
    group: DashboardPnlGroup.COSTS,
    labelKey: 'dashboard.metrics.costOfGoods',
    format: DashboardValueFormat.CURRENCY,
    monthField: 'purchasePrice',
    summaryField: 'costOfGoods',
    negative: true,
  },
  {
    key: 'amazonTax',
    group: DashboardPnlGroup.COSTS,
    labelKey: 'dashboard.metrics.amazonTax',
    format: DashboardValueFormat.CURRENCY,
    monthField: 'amazonTax',
    summaryField: 'amazonTax',
    negative: true,
  },
  {
    key: 'amazonShipping',
    group: DashboardPnlGroup.COSTS,
    labelKey: 'dashboard.metrics.amazonShipping',
    format: DashboardValueFormat.CURRENCY,
    monthField: 'amazonShipping',
    summaryField: 'amazonShipping',
    negative: true,
  },
  {
    key: 'transactionFees',
    group: DashboardPnlGroup.COSTS,
    labelKey: 'dashboard.metrics.transactionFees',
    format: DashboardValueFormat.CURRENCY,
    monthField: 'transactionFee',
    summaryField: 'transactionFees',
    negative: true,
  },
  {
    key: 'adFees',
    group: DashboardPnlGroup.COSTS,
    labelKey: 'dashboard.metrics.adFees',
    format: DashboardValueFormat.CURRENCY,
    monthField: 'adFee',
    summaryField: 'adFees',
    negative: true,
  },
  {
    key: 'grossProfit',
    group: DashboardPnlGroup.PROFIT,
    labelKey: 'dashboard.metrics.grossProfit',
    format: DashboardValueFormat.CURRENCY,
    monthField: 'grossProfit',
    summaryField: 'grossProfit',
    emphasis: true,
  },
  {
    key: 'netProfit',
    group: DashboardPnlGroup.PROFIT,
    labelKey: 'dashboard.metrics.netProfit',
    format: DashboardValueFormat.CURRENCY,
    monthField: 'netProfit',
    summaryField: 'netProfit',
    emphasis: true,
  },
  {
    key: 'estimatedPayout',
    group: DashboardPnlGroup.PROFIT,
    labelKey: 'dashboard.metrics.estimatedPayout',
    format: DashboardValueFormat.CURRENCY,
    monthField: 'estimatedPayout',
    summaryField: 'estimatedPayout',
  },
  {
    key: 'margin',
    group: DashboardPnlGroup.RATIOS,
    labelKey: 'dashboard.metrics.margin',
    format: DashboardValueFormat.PERCENT,
    monthField: 'margin',
    summaryField: 'margin',
  },
  {
    key: 'roi',
    group: DashboardPnlGroup.RATIOS,
    labelKey: 'dashboard.metrics.roi',
    format: DashboardValueFormat.PERCENT,
    monthField: 'roi',
    summaryField: 'roi',
  },
  {
    key: 'refundRate',
    group: DashboardPnlGroup.RATIOS,
    labelKey: 'dashboard.metrics.refundRate',
    format: DashboardValueFormat.PERCENT,
    monthField: 'refunds',
    summaryField: 'refundRate',
    summaryOnly: true,
  },
];

/** Rows rendered in the P&L matrix (summary-only ratios are excluded). */
export const PNL_MATRIX_ROWS = DASHBOARD_METRIC_ROWS.filter((row) => !row.summaryOnly);

/** Group order for section headers. */
export const DASHBOARD_GROUP_ORDER: DashboardPnlGroup[] = [
  DashboardPnlGroup.REVENUE,
  DashboardPnlGroup.COSTS,
  DashboardPnlGroup.PROFIT,
  DashboardPnlGroup.RATIOS,
];
