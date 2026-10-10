/**
 * TrendChart (Presentation)
 * A top seller's figure bucket by bucket across the dashboard's range: one dot
 * per hour/day/week/month, filled where the listing sold and hollow where it
 * did not, a date axis under it and a tooltip with the bucket's date and value.
 * A bare line with no dates told the seller nothing.
 */

import { Text } from '@repo/ui';
import React from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import * as S from './TrendChart.style';
import type { TrendChartDotProps, TrendChartProps } from './TrendChart.types';

const CHART_MARGIN = { top: 8, right: 8, left: 8, bottom: 0 } as const;
const TICK_GAP = 24;
/** A thin date axis, so most of a table cell's height is the plot the tooltip answers on. */
const COMPACT_AXIS_HEIGHT = 18;
/** Room on both sides so the first and last date are not cut in a table cell. */
const COMPACT_MARGIN = { top: 6, right: 20, left: 20, bottom: 0 } as const;
const LINE_STROKE_WIDTH = 2;
const SOLD_DOT_RADIUS = 3.5;
const EMPTY_DOT_RADIUS = 2;
const ACTIVE_DOT_RADIUS = 5;
const DOT_STROKE_WIDTH = 1.5;

/** The y axis always shows zero, so a bucket with no sale sits on the baseline. */
const Y_DOMAIN: [(min: number) => number, (max: number) => number] = [
  (min) => Math.min(0, min),
  (max) => (max > 0 ? max : 1),
];

export const TrendChart = ({
  points,
  title,
  peakLabel,
  valueLabel,
  colors,
  formatTick,
  formatTooltipTitle,
  formatValue,
  ariaLabel,
  compact = false,
  onChartClick,
}: TrendChartProps): React.ReactElement => (
  <S.Pane $compact={compact}>
    {compact ? null : (
      <S.Header>
        <Text variant="caption" weight="semibold" color="text.secondary">
          {title}
        </Text>
        {peakLabel ? (
          <Text variant="caption" color="text.tertiary" numeric>
            {peakLabel}
          </Text>
        ) : null}
      </S.Header>
    )}
    <S.Chart $compact={compact} role="img" aria-label={ariaLabel} onClick={onChartClick}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={compact ? COMPACT_MARGIN : CHART_MARGIN}>
          <XAxis
            dataKey="key"
            // A table cell names only the first and the last bucket (every tick
            // stays, so the tooltip still snaps to each bucket).
            tickFormatter={(key: string, index: number) =>
              !compact || index === 0 || index === points.length - 1 ? formatTick(key) : ''
            }
            tick={{ fontSize: colors.axisFontSize, fill: colors.axis }}
            axisLine={false}
            tickLine={false}
            interval={compact ? 0 : 'preserveStartEnd'}
            height={compact ? COMPACT_AXIS_HEIGHT : undefined}
            minTickGap={TICK_GAP}
          />
          <YAxis hide domain={Y_DOMAIN} />
          <ReferenceLine y={0} stroke={colors.grid} />
          <Tooltip
            cursor={{ stroke: colors.grid }}
            isAnimationActive={false}
            content={(tooltipProps) => {
              if (!tooltipProps.active) {
                return null;
              }
              const point = points.find((p) => p.key === String(tooltipProps.label));
              if (!point) {
                return null;
              }
              return (
                <S.TooltipCard>
                  <Text variant="caption" weight="semibold">
                    {formatTooltipTitle(point.key)}
                  </Text>
                  <S.TooltipRow>
                    <Text variant="caption" color="text.secondary">
                      {valueLabel}
                    </Text>
                    <Text variant="caption" weight="semibold" numeric>
                      {formatValue(point.value)}
                    </Text>
                  </S.TooltipRow>
                </S.TooltipCard>
              );
            }}
          />
          <Line
            type="linear"
            dataKey="value"
            stroke={colors.line}
            strokeWidth={LINE_STROKE_WIDTH}
            dot={({ cx, cy, index, value }: TrendChartDotProps) => {
              const sold = typeof value === 'number' && value !== 0;
              // In a narrow table cell only the buckets that sold carry a dot.
              const hidden = compact && !sold;
              return (
                <circle
                  key={`dot-${index ?? 0}`}
                  cx={cx}
                  cy={cy}
                  r={hidden ? 0 : sold ? SOLD_DOT_RADIUS : EMPTY_DOT_RADIUS}
                  fill={sold ? colors.line : colors.surface}
                  stroke={sold ? colors.line : colors.empty}
                  strokeWidth={DOT_STROKE_WIDTH}
                />
              );
            }}
            activeDot={{ r: ACTIVE_DOT_RADIUS, fill: colors.line, stroke: colors.surface, strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </S.Chart>
  </S.Pane>
);
