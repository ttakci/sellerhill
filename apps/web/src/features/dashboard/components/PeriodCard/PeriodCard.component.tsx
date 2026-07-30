/**
 * PeriodCard (Presentation)
 * Sellerboard-style KPI card: colored band, headline sales, net profit,
 * compact metric grid and an expandable cost/ratio breakdown.
 */

import { Icon, Text, Tooltip } from '@repo/ui';
import React from 'react';

import * as S from './PeriodCard.style';
import type { PeriodCardComponentProps } from './PeriodCard.types';

export const PeriodCardComponent = ({
  title,
  dateRange,
  metrics,
  headerGradient,
  isActive,
  isExpanded,
  onSelect,
  onSelectKeyDown,
  onToggleDetails,
  formatters,
  labels,
  salesTrend,
  profitTrend,
  salesTrendPositive,
  profitTrendPositive,
  profitPositive,
  hasEstimated,
  hasUncosted,
}: PeriodCardComponentProps): React.ReactElement => (
  <S.Root
    variant="bordered"
    padding="none"
    $active={isActive}
    role="button"
    tabIndex={0}
    aria-pressed={isActive}
    onClick={onSelect}
    onKeyDown={onSelectKeyDown}
  >
    <S.Band $gradient={headerGradient}>
      <S.BandTitles>
        <Text variant="h5" weight="semibold" color="dashboard.periodForeground">
          {title}
        </Text>
        <Text variant="caption" color="dashboard.periodForegroundMuted">
          {dateRange}
        </Text>
      </S.BandTitles>
      {isActive && (
        <S.BandCheck>
          <Icon name="check" size={12} />
        </S.BandCheck>
      )}
    </S.Band>

    <S.Body>
      <S.Block>
        <S.BlockLabelRow>
          <Text variant="caption" color="text.secondary">
            {labels.sales}
          </Text>
          {salesTrend !== undefined && (
            <S.TrendChip $positive={salesTrendPositive}>
              <Icon name={salesTrendPositive ? 'trending-up' : 'trending-down'} size={12} />
              <Text variant="caption" weight="semibold" color="inherit">
                {salesTrend}
              </Text>
            </S.TrendChip>
          )}
        </S.BlockLabelRow>
        <Text variant="metric" weight="semibold">
          {formatters.currency(metrics.sales)}
        </Text>
      </S.Block>

      <S.Divider />

      <S.Block>
        <S.BlockLabelRow>
          <Text variant="caption" color="text.secondary">
            {labels.netProfit}
          </Text>
          {profitTrend !== undefined && (
            <S.TrendChip $positive={profitTrendPositive}>
              <Icon name={profitTrendPositive ? 'trending-up' : 'trending-down'} size={12} />
              <Text variant="caption" weight="semibold" color="inherit">
                {profitTrend}
              </Text>
            </S.TrendChip>
          )}
        </S.BlockLabelRow>
        <S.ValueRow>
          <Text
            variant="metric-sm"
            weight="semibold"
            color={profitPositive ? 'semantic.success' : 'semantic.error'}
          >
            {formatters.currency(metrics.netProfit)}
          </Text>
          <Text variant="caption" color="text.tertiary">
            {formatters.percent(metrics.margin)}
          </Text>
        </S.ValueRow>
      </S.Block>

      {(hasEstimated || hasUncosted) && (
        <S.NoteRow>
          {hasEstimated && (
            <Tooltip content={labels.estimatedTooltip} position="top" variant="dark">
              <S.NoteChip $tone="warning">
                <Text variant="caption" color="semantic.warning">
                  {labels.estimatedLabel}
                </Text>
                <Text variant="caption" weight="semibold" color="semantic.warning">
                  {formatters.currency(metrics.profitProvisional)}
                </Text>
              </S.NoteChip>
            </Tooltip>
          )}
          {hasUncosted && (
            <Tooltip content={labels.uncostedTooltip} position="top" variant="dark">
              <S.NoteChip $tone="neutral">
                <Text variant="caption" color="text.secondary">
                  {labels.uncostedLabel}
                </Text>
                <Text variant="caption" weight="semibold" color="text.secondary">
                  {formatters.currency(metrics.revenueUncosted)}
                </Text>
              </S.NoteChip>
            </Tooltip>
          )}
        </S.NoteRow>
      )}

      <S.Divider />

      <S.MiniGrid>
        <S.MiniCell>
          <Text variant="caption" color="text.secondary">
            {labels.ordersUnits}
          </Text>
          <Text variant="body-sm" weight="semibold">
            {`${formatters.number(metrics.orders)} / ${formatters.number(metrics.units)}`}
          </Text>
        </S.MiniCell>
        <S.MiniCell>
          <Text variant="caption" color="text.secondary">
            {labels.refunds}
          </Text>
          <Text variant="body-sm" weight="semibold">
            {formatters.number(metrics.refunds)}
          </Text>
        </S.MiniCell>
        <S.MiniCell>
          <Text variant="caption" color="text.secondary">
            {labels.grossProfit}
          </Text>
          <Text variant="body-sm" weight="semibold">
            {formatters.currency(metrics.grossProfit)}
          </Text>
        </S.MiniCell>
        <S.MiniCell>
          <Text variant="caption" color="text.secondary">
            {labels.roi}
          </Text>
          <Text variant="body-sm" weight="semibold">
            {formatters.percent(metrics.roi)}
          </Text>
        </S.MiniCell>
      </S.MiniGrid>

      {isExpanded && (
        <>
          <S.Divider />
          <S.DetailList>
            <S.DetailRow>
              <Text variant="caption" color="text.secondary">
                {labels.estimatedPayout}
              </Text>
              <Text variant="caption" weight="semibold">
                {formatters.currency(metrics.estimatedPayout)}
              </Text>
            </S.DetailRow>
            <S.DetailRow>
              <Text variant="caption" color="text.secondary">
                {labels.costOfGoods}
              </Text>
              <Text variant="caption" weight="semibold">
                {formatters.currency(metrics.costOfGoods)}
              </Text>
            </S.DetailRow>
            <S.DetailRow>
              <Text variant="caption" color="text.secondary">
                {labels.amazonTax}
              </Text>
              <Text variant="caption" weight="semibold">
                {formatters.currency(metrics.amazonTax)}
              </Text>
            </S.DetailRow>
            <S.DetailRow>
              <Text variant="caption" color="text.secondary">
                {labels.amazonShipping}
              </Text>
              <Text variant="caption" weight="semibold">
                {formatters.currency(metrics.amazonShipping)}
              </Text>
            </S.DetailRow>
            <S.DetailRow>
              <Text variant="caption" color="text.secondary">
                {labels.transactionFees}
              </Text>
              <Text variant="caption" weight="semibold">
                {formatters.currency(metrics.transactionFees)}
              </Text>
            </S.DetailRow>
            <S.DetailRow>
              <Text variant="caption" color="text.secondary">
                {labels.adFees}
              </Text>
              <Text variant="caption" weight="semibold">
                {formatters.currency(metrics.adFees)}
              </Text>
            </S.DetailRow>
            <S.DetailRow>
              <Text variant="caption" color="text.secondary">
                {labels.avgOrderValue}
              </Text>
              <Text variant="caption" weight="semibold">
                {formatters.currency(metrics.avgOrderValue)}
              </Text>
            </S.DetailRow>
            <S.DetailRow>
              <Text variant="caption" color="text.secondary">
                {labels.refundRate}
              </Text>
              <Text variant="caption" weight="semibold">
                {formatters.percent(metrics.refundRate)}
              </Text>
            </S.DetailRow>
          </S.DetailList>
        </>
      )}

      <S.MoreButton type="button" $expanded={isExpanded} onClick={onToggleDetails}>
        <Text variant="caption" weight="semibold" color="inherit">
          {isExpanded ? labels.showLess : labels.showMore}
        </Text>
        <Icon name="chevron-down" size={14} />
      </S.MoreButton>
    </S.Body>
  </S.Root>
);
