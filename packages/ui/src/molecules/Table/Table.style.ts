import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const TableContainer = styled.div`
  width: 100%;
  overflow-x: auto;
  background: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.lg')};
  border: 1px solid ${tkn('colors.border.primary')};
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
`;

export const Thead = styled.thead`
  border-bottom: 1px solid ${tkn('colors.border.primary')};
`;

export const Tbody = styled.tbody``;

export const Tr = styled.tr<{ $clickable?: boolean }>`
  background: transparent;
  transition: all ${tkn('transitions.normal')} ease;
  
  &:hover {
    background: ${tkn('colors.background.tertiary')};
  }

  &:not(:last-child) {
    border-bottom: 1px solid ${tkn('colors.border.secondary')};
  }

  ${({ $clickable }) =>
    $clickable &&
    `
    cursor: pointer;
  `}
`;

export const Th = styled.th<{ $align?: 'left' | 'center' | 'right'; $sortable?: boolean }>`
  padding: 1rem 1.5rem;
  color: ${tkn('colors.text.secondary')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  font-size: ${tkn('typography.fontSize.xs')};
  text-transform: uppercase;
  letter-spacing: 1px;
  text-align: ${({ $align }) => $align || 'left'};
  cursor: ${({ $sortable }) => ($sortable ? 'pointer' : 'default')};
  white-space: nowrap;

  &:hover {
    color: ${({ $sortable, theme }) => ($sortable ? theme.colors.text.primary : theme.colors.text.secondary)};
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
  color: ${tkn('colors.brand.primary')};
`;

export const Td = styled.td<{ $align?: 'left' | 'center' | 'right' }>`
  padding: 1rem 1.5rem;
  vertical-align: middle;
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.normal')};
  color: ${tkn('colors.text.primary')};
  text-align: ${({ $align }) => $align || 'left'};
`;

export const EmptyRow = styled.tr``;

export const EmptyCell = styled(Td)`
  text-align: center;
  color: ${tkn('colors.text.tertiary')};
  padding: 4rem 0;
`;

export const StyledFooter = styled.div`
  padding: 1rem 1.5rem;
  border-top: 1px solid ${tkn('colors.border.primary')};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
