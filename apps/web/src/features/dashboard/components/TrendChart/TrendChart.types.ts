/**
 * TrendChart types
 */

import type React from 'react';

/** One bucket of the range: its key (`YYYY-MM-DD`, or `YYYY-MM-DD HH` for an hour) and value. */
export interface TrendChartPoint {
  key: string;
  value: number;
}

/** What recharts hands a custom dot renderer (only the fields used). */
export interface TrendChartDotProps {
  cx?: number;
  cy?: number;
  index?: number;
  value?: number;
}

/** Resolved theme colours — recharts takes strings, not tokens. */
export interface TrendChartColors {
  /** Line and the dots of buckets that carried a value. */
  line: string;
  /** Hollow dots of empty buckets. */
  empty: string;
  /** Dot fill / active-dot ring. */
  surface: string;
  /** Baseline and hover cursor. */
  grid: string;
  /** Axis tick text. */
  axis: string;
  axisFontSize: string;
}

export interface TrendChartProps {
  points: TrendChartPoint[];
  /** "Revenue · daily" */
  title: string;
  /** "Best: 3 Oct · $24.20"; omitted when no bucket carried a value. */
  peakLabel?: string;
  /** The metric's name in the tooltip ("Revenue"). */
  valueLabel: string;
  colors: TrendChartColors;
  formatTick: (key: string) => string;
  formatTooltipTitle: (key: string) => string;
  formatValue: (value: number) => string;
  ariaLabel: string;
  /** Keeps a tap on the chart (which shows a tooltip) from opening the listing. */
  onChartClick: (event: React.MouseEvent) => void;
}
