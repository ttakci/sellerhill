/**
 * DashboardPage Styles — Sellerboard-style
 * Toolbar (search + period) → Period cards → Chart → Listings table
 */

import styled from '@emotion/styled';
import { Card, Text, tkn } from '@repo/ui';

/* ─── Main Layout ─── */

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.lg')};

  @media (max-width: 48rem) {
    padding: ${tkn('spacing.md')};
  }
`;

/* ─── Toolbar (search + period selector) ─── */

export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

export const SearchWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 12rem;
  max-width: 20rem;
`;

/* ─── Search Dropdown (overlay) ─── */

export const SearchDropdownPanel = styled.div`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 50;
  max-height: 20rem;
  overflow-y: auto;
  background: ${tkn('colors.surface.primary')};
  border-radius: 0 0 ${tkn('radius.sm')} ${tkn('radius.sm')};
  border: 1px solid ${tkn('colors.border.primary')};
  border-top: none;
  box-shadow: ${tkn('shadows.lg')};
`;

export const SearchDropdownHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
`;

export const SearchDropdownRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  cursor: pointer;
`;

export const SearchDropdownInfo = styled.div`
  min-width: 0;
  flex: 1;
`;

export const SearchDropdownTitle = styled(Text)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/* ─── Active Filter Banner ─── */

export const FilterBanner = styled.div<{ $bg: string }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm+')};
  background: ${({ $bg }) => $bg};
  border-radius: ${tkn('radius.md')};
`;

export const ListingInfo = styled.div`
  min-width: 0;
`;

export const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const StoreSelectorTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.sm-md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  cursor: pointer;
  color: ${tkn('colors.text.primary')};
  font: inherit;
  transition: border-color 0.2s, background 0.2s;
  white-space: nowrap;

  &:hover {
    background: ${tkn('colors.surface.secondary')};
    border-color: ${tkn('colors.brand.primary')};
  }
`;

export const StoreSelectorLabel = styled(Text)`
  max-width: 9.375rem; /* 150px */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/* ─── Period Cards Grid ─── */

export const PeriodCardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: ${tkn('spacing.sm')};

  @media (max-width: 75rem) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 48rem) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 30rem) {
    grid-template-columns: 1fr;
  }
`;

/* ─── Period Card ─── */

export const PeriodCard = styled(Card)<{ $accentColor: string; $active: boolean }>`
  border-top: 3px solid ${({ $accentColor }) => $accentColor};
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: box-shadow ${tkn('transitions.fast')}, transform ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-0.0625rem);
  }
`;

export const PeriodCardHeader = styled.div<{ $bgColor: string }>`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background: ${({ $bgColor }) => $bgColor};
`;

export const PeriodTitle = styled(Text)``;

export const PeriodDate = styled(Text)`
  margin-top: ${tkn('spacing.2xs')};
`;

export const PeriodCardBody = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')} ${tkn('spacing.sm')};
  display: flex;
  flex-direction: column;
`;

export const HeroMetricLabel = styled(Text)``;

export const HeroMetricValue = styled.div`
  font-size: ${tkn('typography.fontSize.xl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  line-height: ${tkn('typography.lineHeight.tight')};
  letter-spacing: ${tkn('typography.letterSpacing.tighter')};
  margin-bottom: ${tkn('spacing.xs')};
`;

export const MetricRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: ${tkn('spacing.2xs')} 0;
  border-top: 1px solid ${tkn('colors.border.secondary')};
`;

export const MetricLabel = styled(Text)`
  flex-shrink: 0;
`;

export const MetricValue = styled(Text)`
  font-weight: ${tkn('typography.fontWeight.medium')};
  text-align: right;
`;

export const TrendBadge = styled.span<{ $positive: boolean }>`
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${({ $positive, theme }) =>
    $positive ? theme.colors.semantic.success : theme.colors.semantic.error};
  margin-left: ${tkn('spacing.xs')};
`;

/* ─── Chart ─── */

export const ChartLegend = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
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
  height: 16rem;
  padding: ${tkn('spacing.md')};

  @media (max-width: 48rem) {
    height: 12rem;
  }
`;

/* ─── Listings Table ─── */

export const ListingsTableWrapper = styled.div`
  overflow-x: auto;
`;

export const ListingsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: ${tkn('typography.fontSize.sm')};
`;

export const Th = styled.th`
  text-align: left;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  color: ${tkn('colors.text.secondary')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  font-size: ${tkn('typography.fontSize.xs')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  white-space: nowrap;
`;

export const Td = styled.td`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  white-space: nowrap;
`;

export const Tr = styled.tr`
  cursor: pointer;
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.surface.secondary')};
  }

  &:last-child td {
    border-bottom: none;
  }
`;

export const ListingTitleCell = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const ListingThumb = styled.div<{ $imageUrl?: string }>`
  width: 2rem;
  height: 2rem;
  border-radius: ${tkn('radius.sm')};
  background: ${({ $imageUrl, theme }) =>
    $imageUrl ? `url(${$imageUrl}) center/cover` : theme.colors.surface.secondary};
  flex-shrink: 0;
`;

export const ListingName = styled(Text)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 16rem;
`;

export const ProfitPositive = styled(Text)`
  color: ${tkn('colors.semantic.success')};
`;

export const ProfitNegative = styled(Text)`
  color: ${tkn('colors.semantic.error')};
`;
