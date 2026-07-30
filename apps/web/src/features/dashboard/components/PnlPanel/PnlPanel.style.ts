/**
 * PnlPanel styles — sticky P&L matrix with an optional heat map overlay.
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

export const Scroll = styled.div`
  width: 100%;
  overflow-x: auto;
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
`;

export const Table = styled.table`
  width: max-content;
  min-width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  font-variant-numeric: tabular-nums;
`;

export const Th = styled.th<{ $current?: boolean }>`
  position: sticky;
  top: 0;
  z-index: 2;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  text-align: right;
  white-space: nowrap;
  background: ${({ $current, theme }) =>
    $current ? theme.colors.brand.secondary : theme.colors.surface.secondary};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  &:first-of-type {
    left: 0;
    z-index: 3;
    text-align: left;
    min-width: 12rem;
    background: ${tkn('colors.surface.secondary')};
    border-right: 0.0625rem solid ${tkn('colors.border.primary')};
  }
`;

export const GroupRow = styled.tr`
  td {
    padding: ${tkn('spacing.sm')} ${tkn('spacing.md')} ${tkn('spacing.2xs')};
    background: ${tkn('colors.surface.secondary')};
    border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  }

  /* The cell spans every column, so pin the label itself — otherwise the group
     name scrolls out of view as soon as the month columns are scrolled. */
  td > * {
    position: sticky;
    left: ${tkn('spacing.md')};
    display: inline-block;
  }
`;

export const Row = styled.tr<{ $emphasis: boolean }>`
  td {
    border-top: ${({ $emphasis, theme }) =>
      $emphasis ? `0.0625rem solid ${theme.colors.border.primary}` : 'none'};
  }

  &:hover td {
    background: ${tkn('colors.surface.secondary')};
  }
`;

export const LabelCell = styled.td`
  position: sticky;
  left: 0;
  z-index: 1;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  text-align: left;
  white-space: nowrap;
  background: ${tkn('colors.surface.primary')};
  border-right: 0.0625rem solid ${tkn('colors.border.primary')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const ValueCell = styled.td<{ $intensity: number; $positive: boolean }>`
  position: relative;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  text-align: right;
  white-space: nowrap;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};

  &::before {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: ${({ $positive, theme }) =>
      $positive ? theme.colors.dashboard.heatPositive : theme.colors.dashboard.heatNegative};
    opacity: ${({ $intensity }) => $intensity};
  }

  & > * {
    position: relative;
  }
`;

export const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 12rem;
  padding: ${tkn('spacing.lg')};
`;
