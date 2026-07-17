import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const TableContainer = styled.div`
  width: 100%;
  overflow: visible;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.sm')};
`;

export const OverflowWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  cursor: grab;
  user-select: none;

  &:active {
    cursor: grabbing;
  }

  &::-webkit-scrollbar {
    height: 0.25rem;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${tkn('colors.border.primary')};
    border-radius: ${tkn('radius.full')};
  }
  &::-webkit-scrollbar-thumb:hover {
    background: ${tkn('colors.text.tertiary')};
  }
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  /* fixed: honors col/th widths so selection column cannot auto-expand */
  table-layout: fixed;
`;

/** First col = selection checkbox */
export const ColSelection = styled.col`
  width: 3.25rem;
`;

export const ColAuto = styled.col<{ $width?: string | number }>`
  ${({ $width }) =>
    $width
      ? `
    width: ${$width};
  `
      : ''}
`;

export const Thead = styled.thead`
  background: ${tkn('colors.background.primary')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  position: sticky;
  top: 0;
  z-index: 10;
`;

export const Tbody = styled.tbody``;

export const Tr = styled.tr<{ $clickable?: boolean; $selected?: boolean; $index?: number }>`
  background: ${tkn('colors.surface.primary')};
  transition: background-color ${tkn('transitions.fast')};
  height: 3.25rem;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  &:nth-of-type(even) {
    background: ${tkn('colors.background.tertiary')};
  }

  &:hover {
    background: ${tkn('colors.background.secondary')};
  }

  ${({ $selected, theme }) =>
    $selected &&
    `
    background: ${tkn('colors.semanticTint.info')({ theme })} !important;
  `}

  &:last-child {
    border-bottom: none;
  }

  ${({ $clickable }) =>
    $clickable &&
    `
    cursor: pointer;
  `}
`;

export const Th = styled.th<{
  $align?: 'left' | 'center' | 'right';
  $sticky?: boolean;
  $left?: number;
  $width?: string | number;
  $noPadding?: boolean;
  /** Checkbox/select column — hard-cap width so table-layout:auto cannot stretch it */
  $selection?: boolean;
}>`
  padding: ${tkn('spacing.sm-md+')} ${tkn('spacing.md')};
  color: ${tkn('colors.text.secondary')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-size: ${tkn('typography.fontSize.xs')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
  text-align: left;
  cursor: default;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: ${tkn('colors.background.primary')};
  transition: color 0.12s ease;
  position: relative;
  border-right: 0.0625rem solid ${tkn('colors.border.primary')};

  position: sticky;
  top: 0;
  z-index: ${({ $sticky }) => ($sticky ? 30 : 10)};

  ${({ $sticky, $left }) =>
    $sticky &&
    `
    left: ${($left ?? 0) / 16}rem;
  `}

  ${({ $width }) =>
    $width &&
    `
    width: ${$width};
    min-width: ${$width};
  `}

  ${({ $noPadding, theme }) =>
    $noPadding &&
    `
    padding-left: ${tkn('spacing.sm')({ theme })} !important;
    padding-right: ${tkn('spacing.sm')({ theme })} !important;
    text-align: center;
  `}

  ${({ $selection, theme }) =>
    $selection &&
    `
    width: 3.25rem;
    min-width: 3.25rem;
    max-width: 3.25rem;
    box-sizing: border-box;
    padding: ${tkn('spacing.sm-md+')({ theme })} ${tkn('spacing.xs')({ theme })} !important;
    text-align: center;
  `}

  &:first-of-type {
    ${({ $selection, theme }) =>
      !$selection &&
      `
      padding-left: ${tkn('spacing.lg')({ theme })};
    `}
    ${({ $sticky }) =>
      $sticky &&
      `
      z-index: 30;
      left: 0;
    `}
  }
  &:last-of-type {
    padding-right: ${tkn('spacing.lg')};
    border-right: none;
  }
`;

export const CheckboxCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  /* Room for checkbox box + 1px border on all sides (overflow:hidden clipped hover) */
  min-height: 1.375rem;
  overflow: visible;

  /* Checkbox root is a <label> flex — strip gap so it cannot inflate the col */
  & > label {
    gap: 0;
    margin: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: visible;
  }
`;

export const ThContent = styled.div<{ $align?: 'left' | 'center' | 'right' }>`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: ${tkn('spacing.2xs')};
`;

export const SortIconWrapper = styled.div<{ $sortable?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.brand.primary')};
  cursor: pointer;
  padding: ${tkn('spacing.xs')};
  margin: -${tkn('spacing.xs')};
  border-radius: ${tkn('radius.md')};
  transition: background-color 0.12s ease;

  &:hover {
    background: ${tkn('colors.background.secondary')};
  }

  &:active {
    background: ${tkn('colors.background.tertiary')};
  }
`;

export const SortIcon = styled.div<{ $active: boolean; $rotated: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  transform: ${(props) => (props.$rotated ? 'rotate(180deg)' : 'rotate(0deg)')};
  opacity: ${(props) => (props.$active ? 1 : 0.3)};
  transition: transform 0.2s ease, opacity 0.2s ease;
`;

export const Td = styled.td<{
  $align?: 'left' | 'center' | 'right';
  $sticky?: boolean;
  $left?: number;
  $width?: string | number;
  $noPadding?: boolean;
  /** Checkbox/select column — hard-cap width so table-layout:auto cannot stretch it */
  $selection?: boolean;
}>`
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  vertical-align: middle;
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.primary')};
  text-align: left;
  background: inherit;
  transition: background-color 0.12s ease;
  overflow: visible;
  border-right: 0.0625rem solid ${tkn('colors.border.primary')};

  ${({ $sticky, $left, theme }) =>
    $sticky &&
    `
    position: sticky;
    left: ${($left ?? 0) / 16}rem;
    z-index: 20;
    background: ${tkn('colors.surface.primary')({ theme })};

    tr:hover & {
      background: ${tkn('colors.background.secondary')({ theme })};
    }

    tr[data-selected="true"] & {
      background: ${tkn('colors.semanticTint.info')({ theme })};
    }
  `}

  ${({ $width }) =>
    $width &&
    `
    width: ${$width};
    min-width: ${$width};
  `}

  ${({ $noPadding, theme }) =>
    $noPadding &&
    `
    padding-left: ${tkn('spacing.sm')({ theme })} !important;
    padding-right: ${tkn('spacing.sm')({ theme })} !important;
    text-align: center;
  `}

  ${({ $selection, theme }) =>
    $selection &&
    `
    width: 3.25rem;
    min-width: 3.25rem;
    max-width: 3.25rem;
    box-sizing: border-box;
    padding: ${tkn('spacing.sm-md')({ theme })} ${tkn('spacing.xs')({ theme })} !important;
    text-align: center;
  `}

  &:first-of-type {
    ${({ $selection, theme }) =>
      !$selection &&
      `
      padding-left: ${tkn('spacing.lg')({ theme })};
    `}
  }
  &:last-of-type {
    padding-right: ${tkn('spacing.lg')};
    border-right: none;
  }
`;

export const EmptyRow = styled.tr``;

export const EmptyCell = styled(Td)`
  text-align: center;
  color: ${tkn('colors.text.tertiary')};
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.lg')};
`;

export const Toolbar = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.lg')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  background: ${tkn('colors.surface.primary')};
`;

export const ToolbarSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const BulkSelectWrapper = styled.div`
  min-width: 10rem;
`;

export const ToolbarButton = styled.button`
  padding: ${tkn('spacing.xs')};
  color: ${tkn('colors.text.tertiary')};
  background: transparent;
  border: 0.0625rem solid transparent;
  border-radius: ${tkn('radius.md')};
  transition: all 0.12s ease;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: ${tkn('colors.background.tertiary')};
    border-color: ${tkn('colors.border.primary')};
    color: ${tkn('colors.text.secondary')};
  }
`;

export const StyledFooter = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.lg')};
  background: ${tkn('colors.surface.primary')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
