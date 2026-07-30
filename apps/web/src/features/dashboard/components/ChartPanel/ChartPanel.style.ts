/**
 * ChartPanel styles — chart canvas, legend chips and the P&L summary rail.
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(15rem, 19rem);
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.md')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.lgBelow')}) {
    grid-template-columns: 1fr;
  }
`;

export const ChartColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const LegendRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;

export const LegendChip = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm-md')};
  border-radius: ${tkn('radius.full')};
  border: 0.0625rem solid
    ${({ $active, theme }) => ($active ? theme.colors.border.primary : theme.colors.border.secondary)};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.surface.secondary : 'transparent'};
  cursor: pointer;
  font: inherit;
  opacity: ${({ $active }) => ($active ? 1 : 0.45)};
  transition:
    opacity ${tkn('transitions.fast')},
    background ${tkn('transitions.fast')};

  &:hover {
    opacity: 1;
  }
`;

export const LegendDot = styled.span<{ $color: string }>`
  width: 0.625rem;
  height: 0.625rem;
  border-radius: ${tkn('radius.full')};
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

export const ChartCanvas = styled.div`
  width: 100%;
  height: 22rem;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    height: 15rem;
  }
`;

export const EmptyState = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 22rem;
  border: 0.0625rem dashed ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    height: 15rem;
  }
`;

export const SummaryRail = styled.aside`
  display: flex;
  flex-direction: column;
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  background: ${tkn('colors.surface.secondary')};
  overflow: hidden;
  align-self: start;
`;

export const SummaryTitle = styled.div`
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.surface.primary')};
`;

export const SummarySection = styled.div`
  display: flex;
  flex-direction: column;

  & + & {
    border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  }
`;

export const SummaryGroupLabel = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')} ${tkn('spacing.2xs')};
`;

export const SummaryRow = styled.div<{ $emphasis: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  font-variant-numeric: tabular-nums;
  background: ${({ $emphasis, theme }) =>
    $emphasis ? theme.colors.surface.primary : 'transparent'};

  &:last-of-type {
    padding-bottom: ${tkn('spacing.sm')};
  }
`;

export const TooltipCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.sm-md')};
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('shadows.lg')};
  min-width: 10rem;
`;

export const TooltipRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  font-variant-numeric: tabular-nums;
`;

export const TooltipLabel = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;
