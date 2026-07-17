/**
 * DashboardPage Styles
 * Layout wrappers. Surfaces via Card/Text/Badge + shared carousels.
 */

import styled from '@emotion/styled';
import { Card, PageContainer, tkn } from '@repo/ui';

/** AppLayout ContentInner owns page gutter — do not pad here */
export const Container = PageContainer;

/** Tabs on the left, store filter on the right — shared across all 3 tabs */
export const TabsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  margin-bottom: ${tkn('spacing.lg')};
`;

export const TabList = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.lg')};
  min-width: 0;
`;

export const TabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  background: transparent;
  border: none;
  cursor: pointer;
  font: inherit;
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  padding: ${tkn('spacing.sm')} 0;
  margin-bottom: -0.0625rem;
  position: relative;
  color: ${({ $active, theme }) =>
    $active ? theme.colors.brand.primary : theme.colors.text.secondary};
  transition: color ${tkn('transitions.fast')};

  &::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 0.125rem;
    background: ${({ $active, theme }) =>
      $active ? theme.colors.brand.primary : 'transparent'};
    transition: background ${tkn('transitions.fast')};
  }

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const StoreSelectorTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  cursor: pointer;
  color: ${tkn('colors.text.primary')};
  font: inherit;
  transition:
    border-color ${tkn('transitions.fast')},
    background ${tkn('transitions.fast')};
  white-space: nowrap;

  &:hover {
    background: ${tkn('colors.surface.secondary')};
    border-color: ${tkn('colors.brand.primary')};
  }
`;

export const PeriodCardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${tkn('spacing.sm')};

  @media (max-width: 75rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: 30rem) {
    grid-template-columns: 1fr;
  }
`;

export const PeriodCard = styled(Card)<{ $active: boolean }>`
  cursor: pointer;
  overflow: hidden;
  border-bottom: ${({ $active, theme }) =>
    $active ? `0.1875rem solid ${theme.colors.brand.primary}` : `0.0625rem solid ${theme.colors.border.primary}`};
  box-shadow: ${({ $active, theme }) => ($active ? theme.shadows.md : 'none')};
  transition:
    box-shadow ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')},
    border-color ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-0.0625rem);
  }
`;

export const PeriodCardHeader = styled.div<{ $bgColor: string }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background: ${({ $bgColor }) => $bgColor};
  min-height: 3.5rem;
  justify-content: center;
`;

export const PeriodCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')} ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
`;

export const HeroBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding-bottom: ${tkn('spacing.sm')};
`;

export const HeroLabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.xs')};
`;

export const MetricPair = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} 0;
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const MetricCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const MetricCellValue = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: ${tkn('spacing.2xs')};
  font-variant-numeric: tabular-nums;
`;

export const FullMetricRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding-top: ${tkn('spacing.sm')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

/** Side-by-side carousels on desktop */
export const CarouselRow = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${tkn('spacing.lg')};
  min-width: 0;

  @media (max-width: 56rem) {
    grid-template-columns: 1fr;
  }
`;

export const CarouselSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const CarouselSectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
`;

export const ChartLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr minmax(12rem, 16rem);
  gap: ${tkn('spacing.lg')};
  min-width: 0;

  @media (max-width: 56rem) {
    grid-template-columns: 1fr;
  }
`;

export const ChartMain = styled.div`
  min-width: 0;
`;

export const ChartSummary = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.surface.primary')};
  overflow: hidden;
`;

export const ChartSummaryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  font-variant-numeric: tabular-nums;

  &:last-child {
    border-bottom: none;
  }
`;

export const ChartLegend = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

export const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const LegendDot = styled.div<{ $color: string }>`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${({ $color }) => $color};
`;

export const ChartContainer = styled.div`
  width: 100%;
  height: 20rem;
  padding: ${tkn('spacing.sm')};

  @media (max-width: 48rem) {
    height: 14rem;
  }
`;

export const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 8rem;
  padding: ${tkn('spacing.lg')};
`;

export const HistoryScroll = styled.div`
  width: 100%;
  overflow-x: auto;
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.surface.primary')};
`;

export const HistoryTable = styled.table`
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
`;

export const HistoryTh = styled.th`
  position: sticky;
  top: 0;
  z-index: 1;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  text-align: right;
  background: ${tkn('colors.surface.secondary')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  white-space: nowrap;
  font-weight: ${tkn('typography.fontWeight.semibold')};

  &:first-of-type {
    position: sticky;
    left: 0;
    z-index: 2;
    text-align: left;
    min-width: 10rem;
  }
`;

export const HistoryTd = styled.td`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  text-align: right;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  white-space: nowrap;

  &:first-of-type {
    position: sticky;
    left: 0;
    z-index: 1;
    text-align: left;
    background: ${tkn('colors.surface.primary')};
    font-weight: ${tkn('typography.fontWeight.medium')};
  }
`;

export const HistoryTr = styled.tr`
  &:hover td {
    background: ${tkn('colors.surface.secondary')};
  }

  &:hover td:first-of-type {
    background: ${tkn('colors.surface.secondary')};
  }
`;

export const TabPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  min-width: 0;
`;
