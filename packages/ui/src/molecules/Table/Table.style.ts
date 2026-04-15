import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const TableContainer = styled.div`
  width: 100%;
  overflow: visible;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.xl')};
  border: 1px solid ${tkn('colors.border.secondary')};
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
  table-layout: auto;
`;

export const Thead = styled.thead`
  background: ${tkn('colors.background.primary')};
  border-bottom: 2px solid ${tkn('colors.border.secondary')};
  position: sticky;
  top: 0;
  z-index: 10;
`;

export const Tbody = styled.tbody``;

export const Tr = styled.tr<{ $clickable?: boolean; $selected?: boolean; $index?: number }>`
  background: ${tkn('colors.surface.primary')};
  transition: background-color 0.12s ease;
  height: 3.25rem;
  border-bottom: 1px solid ${tkn('colors.border.secondary')};

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
}>`
  padding: 0.875rem ${tkn('spacing.md')};
  color: ${tkn('colors.text.tertiary')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-size: ${tkn('typography.fontSize.xs')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: left;
  cursor: default;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: ${tkn('colors.background.primary')};
  transition: color 0.12s ease;
  position: relative;
  border-right: 1px solid ${tkn('colors.border.secondary')};

  position: sticky;
  top: 0;
  z-index: ${({ $sticky }) => ($sticky ? 30 : 10)};

  ${({ $sticky, $left }) =>
    $sticky &&
    `
    left: ${($left ?? 0) / 16}rem;
  `}

  &:first-of-type {
    padding-left: ${tkn('spacing.lg')};
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

export const Td = styled.td<{
  $align?: 'left' | 'center' | 'right';
  $sticky?: boolean;
  $left?: number;
}>`
  padding: 0.75rem ${tkn('spacing.md')};
  vertical-align: middle;
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.primary')};
  text-align: left;
  background: inherit;
  transition: background-color 0.12s ease;
  overflow: visible;
  border-right: 1px solid ${tkn('colors.border.secondary')};

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

  &:first-of-type {
    padding-left: ${tkn('spacing.lg')};
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
  padding: 4rem 0;
`;

export const Toolbar = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.lg')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
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
