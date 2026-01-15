import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  font-size: ${tkn('typography.fontSize.sm')};
`;

export const Thead = styled.thead``;

export const Tbody = styled.tbody``;

export const Tr = styled.tr<{ $clickable?: boolean }>`
  ${({ $clickable }) =>
    $clickable &&
    `
    cursor: pointer;
    transition: background ${tkn('transitions.fast')};
    
    &:hover {
      background: ${tkn('colors.background.secondary')};
    }
  `}
`;

export const Th = styled.th<{ $align?: 'left' | 'center' | 'right'; $sortable?: boolean }>`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.lg')};
  background: ${tkn('colors.background.primary')};
  color: ${tkn('colors.text.secondary')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  text-transform: uppercase;
  font-size: ${tkn('typography.fontSize.xs')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  text-align: ${({ $align }) => $align || 'left'};
  cursor: ${({ $sortable }) => ($sortable ? 'pointer' : 'default')};
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${({ $sortable, theme }) =>
      $sortable ? tkn('colors.background.secondary')({ theme }) : tkn('colors.background.primary')({ theme })};
  }
`;

export const ThContent = styled.div<{ $align?: 'left' | 'center' | 'right' }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $align }) =>
    $align === 'right' ? 'flex-end' : $align === 'center' ? 'center' : 'flex-start'};
  gap: ${tkn('spacing.xs')};
`;

export const SortIconWrapper = styled.div`
  display: flex;
  align-items: center;
`;

export const Td = styled.td<{ $align?: 'left' | 'center' | 'right' }>`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: 1px solid ${tkn('colors.background.secondary')};
  vertical-align: middle;
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.primary')};
  text-align: ${({ $align }) => $align || 'left'};
`;

export const EmptyRow = styled.tr``;

export const EmptyCell = styled(Td)`
  text-align: center;
  color: ${tkn('colors.text.secondary')};
  padding: ${tkn('spacing.xxl')};
  font-weight: ${tkn('typography.fontWeight.normal')};
`;

export const StyledFooter = styled.div`
  background: ${tkn('colors.background.primary')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-top: 1px solid ${tkn('colors.border.secondary')};
`;
