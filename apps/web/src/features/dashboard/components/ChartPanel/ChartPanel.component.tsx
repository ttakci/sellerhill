/**
 * ChartPanel (Presentation)
 * Net-profit bars against sales/units/refunds lines, with toggleable legend
 * chips, a granularity switch and a Sellerboard-style P&L summary rail.
 */

import { DashboardChartSeries } from '@repo/shared';
import { Card, CardHeader, SegmentedControl, Text } from '@repo/ui';
import React from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import * as S from './ChartPanel.style';
import type { ChartPanelComponentProps } from './ChartPanel.types';

const PROFIT_GRADIENT_ID = 'sellerhill-dashboard-profit-fill';

/**
 * Chart geometry recharts needs as raw SVG numbers (px). Colors, fonts and
 * spacing all come from the theme — these are the only literals, and they are
 * canvas geometry rather than design-system values.
 */
const BAR_MAX_WIDTH = 40;
const CHART_MARGIN = { top: 8, right: 8, left: -12, bottom: 0 } as const;
const CURRENCY_AXIS_WIDTH = 56;
const COUNT_AXIS_WIDTH = 36;
const LINE_STROKE_WIDTH = 2;
const REFUND_STROKE_WIDTH = 1.5;
const ACTIVE_DOT_RADIUS = 4;
const REFUND_DOT_RADIUS = 3;
const CURSOR_FILL_OPACITY = 0.35;
const GRADIENT_TOP_OPACITY = 0.95;
const GRADIENT_BOTTOM_OPACITY = 0.35;
const TICK_GAP = 12;

export const ChartPanelComponent = ({
  title,
  subtitle,
  summaryTitle,
  emptyLabel,
  data,
  series,
  summarySections,
  granularityOptions,
  granularityValue,
  onGranularityChange,
  onToggleSeries,
  formatTick,
  formatAxisCurrency,
  formatTooltipTitle,
  formatSeriesValue,
  gridColor,
  axisColor,
  axisFontSize,
  barRadius,
  isEmpty,
}: ChartPanelComponentProps): React.ReactElement => {
  const visible = series.filter((s) => s.visible);
  const colorOf = (id: DashboardChartSeries): string =>
    series.find((s) => s.id === id)?.color ?? axisColor;
  const isVisible = (id: DashboardChartSeries): boolean =>
    visible.some((s) => s.id === id);
  const barCorners: [number, number, number, number] = [barRadius, barRadius, 0, 0];

  return (
    <Card variant="bordered">
      <CardHeader
        description={
          <Text variant="caption" color="text.tertiary">
            {subtitle}
          </Text>
        }
        actions={
          <SegmentedControl
            options={granularityOptions}
            value={granularityValue}
            onChange={onGranularityChange}
            size="sm"
          />
        }
      >
        <Text variant="h4" weight="semibold">
          {title}
        </Text>
      </CardHeader>

      <S.Layout>
        <S.ChartColumn>
          <S.LegendRow>
            {series.map((entry) => (
              <S.LegendChip
                key={entry.id}
                type="button"
                $active={entry.visible}
                aria-pressed={entry.visible}
                onClick={() => onToggleSeries(entry.id)}
              >
                <S.LegendDot $color={entry.color} />
                <Text variant="caption" weight="medium" color="text.secondary">
                  {entry.label}
                </Text>
              </S.LegendChip>
            ))}
          </S.LegendRow>

          {isEmpty ? (
            <S.EmptyState>
              <Text variant="body-sm" color="text.tertiary">
                {emptyLabel}
              </Text>
            </S.EmptyState>
          ) : (
            <S.ChartCanvas>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data} margin={CHART_MARGIN}>
                  <defs>
                    <linearGradient id={PROFIT_GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="0%"
                        stopColor={colorOf(DashboardChartSeries.NET_PROFIT)}
                        stopOpacity={GRADIENT_TOP_OPACITY}
                      />
                      <stop
                        offset="100%"
                        stopColor={colorOf(DashboardChartSeries.NET_PROFIT)}
                        stopOpacity={GRADIENT_BOTTOM_OPACITY}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis
                    dataKey="period"
                    tickFormatter={formatTick}
                    tick={{ fontSize: axisFontSize, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={TICK_GAP}
                  />
                  <YAxis
                    yAxisId="currency"
                    tickFormatter={formatAxisCurrency}
                    tick={{ fontSize: axisFontSize, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={CURRENCY_AXIS_WIDTH}
                  />
                  <YAxis
                    yAxisId="count"
                    orientation="right"
                    tick={{ fontSize: axisFontSize, fill: axisColor }}
                    axisLine={false}
                    tickLine={false}
                    width={COUNT_AXIS_WIDTH}
                  />

                  <Tooltip
                    cursor={{ fill: gridColor, fillOpacity: CURSOR_FILL_OPACITY }}
                    content={(tooltipProps) => {
                      if (!tooltipProps.active) {
                        return null;
                      }
                      const point = data.find((p) => p.period === String(tooltipProps.label));
                      if (!point) {
                        return null;
                      }
                      return (
                        <S.TooltipCard>
                          <Text variant="caption" weight="semibold">
                            {formatTooltipTitle(point.period)}
                          </Text>
                          {visible.map((entry) => (
                            <S.TooltipRow key={entry.id}>
                              <S.TooltipLabel>
                                <S.LegendDot $color={entry.color} />
                                <Text variant="caption" color="text.secondary">
                                  {entry.label}
                                </Text>
                              </S.TooltipLabel>
                              <Text variant="caption" weight="semibold">
                                {formatSeriesValue(entry.id, point)}
                              </Text>
                            </S.TooltipRow>
                          ))}
                        </S.TooltipCard>
                      );
                    }}
                  />

                  {isVisible(DashboardChartSeries.NET_PROFIT) && (
                    <Bar
                      yAxisId="currency"
                      dataKey="netProfit"
                      fill={`url(#${PROFIT_GRADIENT_ID})`}
                      radius={barCorners}
                      maxBarSize={BAR_MAX_WIDTH}
                      isAnimationActive={false}
                    />
                  )}
                  {isVisible(DashboardChartSeries.SALES) && (
                    <Line
                      yAxisId="currency"
                      type="monotone"
                      dataKey="sales"
                      stroke={colorOf(DashboardChartSeries.SALES)}
                      strokeWidth={LINE_STROKE_WIDTH}
                      dot={false}
                      activeDot={{ r: ACTIVE_DOT_RADIUS }}
                      isAnimationActive={false}
                    />
                  )}
                  {isVisible(DashboardChartSeries.UNITS) && (
                    <Line
                      yAxisId="count"
                      type="monotone"
                      dataKey="units"
                      stroke={colorOf(DashboardChartSeries.UNITS)}
                      strokeWidth={LINE_STROKE_WIDTH}
                      dot={false}
                      activeDot={{ r: ACTIVE_DOT_RADIUS }}
                      isAnimationActive={false}
                    />
                  )}
                  {isVisible(DashboardChartSeries.REFUNDS) && (
                    <Line
                      yAxisId="count"
                      type="monotone"
                      dataKey="refunds"
                      stroke={colorOf(DashboardChartSeries.REFUNDS)}
                      strokeWidth={REFUND_STROKE_WIDTH}
                      strokeDasharray="4 4"
                      dot={false}
                      activeDot={{ r: REFUND_DOT_RADIUS }}
                      isAnimationActive={false}
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </S.ChartCanvas>
          )}
        </S.ChartColumn>

        <S.SummaryRail>
          <S.SummaryTitle>
            <Text variant="h5" weight="semibold">
              {summaryTitle}
            </Text>
          </S.SummaryTitle>
          {summarySections.map((section) => (
            <S.SummarySection key={section.group}>
              <S.SummaryGroupLabel>
                <Text variant="overline" color="text.tertiary">
                  {section.label}
                </Text>
              </S.SummaryGroupLabel>
              {section.rows.map((row) => (
                <S.SummaryRow key={row.key} $emphasis={Boolean(row.emphasis)}>
                  <Text
                    variant="body-sm"
                    weight={row.emphasis ? 'semibold' : 'regular'}
                    color="text.secondary"
                  >
                    {row.label}
                  </Text>
                  <Text
                    variant="body-sm"
                    weight={row.emphasis ? 'semibold' : 'medium'}
                    color={
                      row.tone === 'positive'
                        ? 'semantic.success'
                        : row.tone === 'negative'
                          ? 'semantic.error'
                          : undefined
                    }
                  >
                    {row.value}
                  </Text>
                </S.SummaryRow>
              ))}
            </S.SummarySection>
          ))}
        </S.SummaryRail>
      </S.Layout>
    </Card>
  );
};
