/**
 * PeriodCard styles — Sellerboard-style band + metric stack.
 */

import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

export const Root = styled(Card)<{ $active: boolean }>`
  position: relative;
  cursor: pointer;
  overflow: hidden;
  padding: 0;
  display: flex;
  flex-direction: column;
  border-color: ${({ $active, theme }) => ($active ? theme.colors.brand.primary : theme.colors.glass.edge)};
  box-shadow: ${({ $active, theme }) => ($active ? theme.shadows.glassHover : theme.shadows.glass)};
  transition:
    box-shadow ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')},
    border-color ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.glassHover')};
    transform: translateY(-0.125rem);
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.border.focus')};
    outline-offset: 0.125rem;
  }
`;

export const Band = styled.div<{ $gradient: string }>`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  background: ${({ $gradient }) => $gradient};
  min-height: 3.25rem;
`;

export const BandTitles = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const BandCheck = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.dashboard.periodForegroundMuted')};
  color: ${tkn('colors.text.primary')};
  flex-shrink: 0;
`;

export const Body = styled.div`
  display: flex;
  flex-direction: column;
  padding: ${tkn('spacing.md')};
  gap: ${tkn('spacing.sm-md')};
  /* Transparent: the pane's own frosted surface shows through. */
  flex: 1;
`;

export const Block = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const BlockLabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.xs')};
`;

export const ValueRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
  font-variant-numeric: tabular-nums;
`;

export const TrendChip = styled.span<{ $positive: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  padding: 0 ${tkn('spacing.xs')};
  height: 1.25rem;
  border-radius: ${tkn('radius.sm')};
  background: ${({ $positive, theme }) =>
    $positive ? theme.colors.semanticTint.success : theme.colors.semanticTint.error};
  color: ${({ $positive, theme }) =>
    $positive ? theme.colors.semantic.success : theme.colors.semantic.error};
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
`;

export const Divider = styled.div`
  height: 0.0625rem;
  background: ${tkn('colors.border.primary')};
`;

export const MiniGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
`;

export const MiniCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  font-variant-numeric: tabular-nums;
`;

export const NoteRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;

export const NoteChip = styled.span<{ $tone: 'warning' | 'neutral' }>`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.xs+')};
  border-radius: ${tkn('radius.sm')};
  background: ${({ $tone, theme }) =>
    $tone === 'warning' ? theme.colors.semanticTint.warning : theme.colors.semanticTint.neutral};
  border: 0.0625rem solid
    ${({ $tone, theme }) =>
      $tone === 'warning'
        ? theme.colors.semanticTintBorder.warning
        : theme.colors.semanticTintBorder.neutral};
  font-variant-numeric: tabular-nums;
`;

export const DetailList = styled.dl`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  margin: 0;
`;

export const DetailRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  font-variant-numeric: tabular-nums;
`;

/** The expand control is the Button atom; this row only draws the hairline above it. */
export const MoreRow = styled.div`
  padding-top: ${tkn('spacing.2xs')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
`;

export const MoreChevron = styled.span<{ $expanded: boolean }>`
  display: inline-flex;
  transition: transform ${tkn('transitions.fast')};
  transform: ${({ $expanded }) => ($expanded ? 'rotate(180deg)' : 'none')};
`;
