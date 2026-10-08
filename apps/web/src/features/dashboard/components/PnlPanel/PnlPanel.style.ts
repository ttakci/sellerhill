/**
 * PnlPanel styles — sticky P&L matrix with an optional heat map overlay.
 */

import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/**
 * The metric column has a FIXED width, so the space the table gains from
 * `min-width: 100%` goes to the value columns. Left on auto, a range with one
 * or two columns (Today, Yesterday) handed all of it to this column and the
 * labels sat in a half-empty band. Long labels wrap instead of widening it.
 */
const metricColumn = css`
  width: 11rem;
  min-width: 11rem;
  white-space: normal;
`;

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
    ${metricColumn};
    left: 0;
    z-index: 3;
    text-align: left;
    background: ${tkn('colors.surface.secondary')};
    border-right: 0.0625rem solid ${tkn('colors.border.primary')};
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    padding: ${tkn('spacing.sm')};

    &:first-of-type {
      width: 7.5rem;
      min-width: 7.5rem;
    }
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
  ${metricColumn};
  position: sticky;
  left: 0;
  z-index: 1;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  text-align: left;
  background: ${tkn('colors.surface.primary')};
  border-right: 0.0625rem solid ${tkn('colors.border.primary')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    width: 7.5rem;
    min-width: 7.5rem;
    padding: ${tkn('spacing.sm')};
  }
`;

export const ValueCell = styled.td<{ $intensity: number; $positive: boolean }>`
  position: relative;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  text-align: right;
  white-space: nowrap;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    padding: ${tkn('spacing.sm')};
  }

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
