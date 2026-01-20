import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const TableContainer = styled.div`
  width: 100%;
  overflow: hidden;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1);

  .dark & {
    background: #0f172a;
    border-color: #1e293b;
  }
`;

export const OverflowWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  min-width: 800px;
`;

export const Thead = styled.thead`
  background: white;
  border-bottom: 1px solid #f1f5f9;

  .dark & {
    background: #0f172a;
    border-color: #1e293b;
  }
`;

export const Tbody = styled.tbody``;

export const Tr = styled.tr<{ $clickable?: boolean }>`
  background: white;
  transition: all 0.2s ease;
  height: 72px;
  border-bottom: 1px solid #f1f5f9;
  
  &:hover {
    background: rgba(248, 250, 252, 0.5);
  }

  &:last-child {
    border-bottom: none;
  }

  .dark & {
    background: #0f172a;
    border-color: #1e293b;
    &:hover {
      background: rgba(30, 41, 59, 0.5);
    }
  }

  ${({ $clickable }) =>
    $clickable &&
    `
    cursor: pointer;
  `}
`;

export const Th = styled.th<{ $align?: 'left' | 'center' | 'right'; $sortable?: boolean }>`
  padding: 16px 12px;
  color: #94a3b8;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: ${({ $align }) => $align || 'left'};
  cursor: ${({ $sortable }) => ($sortable ? 'pointer' : 'default')};
  white-space: nowrap;

  &:first-of-type { padding-left: 24px; }
  &:last-of-type { padding-right: 24px; }

  &:hover {
    color: ${({ $sortable }) => ($sortable ? '#334155' : '#94a3b8')};
  }

  .dark & {
    color: #64748b;
    &:hover {
      color: ${({ $sortable }) => ($sortable ? '#cbd5e1' : '#64748b')};
    }
  }
`;

export const ThContent = styled.div<{ $align?: 'left' | 'center' | 'right' }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $align }) =>
    $align === 'right' ? 'flex-end' : $align === 'center' ? 'center' : 'flex-start'};
  gap: 8px;
`;

export const SortIconWrapper = styled.div`
  display: flex;
  align-items: center;
  color: ${tkn('colors.brand.primary')};
`;

export const Td = styled.td<{ $align?: 'left' | 'center' | 'right' }>`
  padding: 12px;
  vertical-align: middle;
  font-size: 14px;
  color: #0f172a;
  text-align: ${({ $align }) => $align || 'left'};

  &:first-of-type { padding-left: 24px; }
  &:last-of-type { padding-right: 24px; }

  .dark & {
    color: #cbd5e1;
  }
`;

export const EmptyRow = styled.tr``;

export const EmptyCell = styled(Td)`
  text-align: center;
  color: #94a3b8;
  padding: 80px 0;
`;

export const StyledFooter = styled.div`
  padding: 16px 24px;
  background: rgba(248, 250, 252, 0.3);
  border-top: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .dark & {
    background: rgba(30, 41, 59, 0.3);
    border-color: #1e293b;
  }
`;
