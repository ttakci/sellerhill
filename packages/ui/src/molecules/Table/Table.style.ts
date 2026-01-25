import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const TableContainer = styled.div`
  width: 100%;
  overflow: hidden;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px -1px rgba(0, 0, 0, 0.1);

  .dark & {
    background: #0f172a;
    border-color: #1e293b;
  }
`;

export const OverflowWrapper = styled.div`
  width: 100%;
  overflow-x: auto;
  overflow-y: visible;

  &::-webkit-scrollbar {
    height: 8px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }

  .dark &::-webkit-scrollbar-thumb {
    background: #475569;
  }
  .dark &::-webkit-scrollbar-thumb:hover {
    background: #64748b;
  }
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
  min-width: 100%;
  /* Force columns to respect content width */
  width: max-content;
`;

export const Thead = styled.thead`
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 10;

  .dark & {
    background: #1e293b;
    border-color: #334155;
  }
`;

export const Tbody = styled.tbody``;

export const Tr = styled.tr<{ $clickable?: boolean; $selected?: boolean; $index?: number }>`
  background: white;
  transition:
    background-color 0.2s ease,
    box-shadow 0.2s ease;
  height: 72px;
  border-bottom: 1px solid #f1f5f9;

  /* Striped rows - alternating background */
  &:nth-of-type(even) {
    background: rgba(248, 250, 252, 0.5);
  }

  /* Hover effect - smooth and subtle */
  &:hover {
    background: rgba(59, 130, 246, 0.04);
    box-shadow: inset 3px 0 0 0 #3b82f6;
  }

  /* Selected row styling */
  ${({ $selected }) =>
    $selected &&
    `
    background: rgba(59, 130, 246, 0.08) !important;
    box-shadow: inset 3px 0 0 0 #3b82f6;
    
    &:hover {
      background: rgba(59, 130, 246, 0.11) !important;
    }
  `}

  &:last-child {
    border-bottom: none;
  }

  .dark & {
    background: #0f172a;
    border-color: #1e293b;

    &:nth-of-type(even) {
      background: rgba(30, 41, 59, 0.3);
    }

    &:hover {
      background: rgba(59, 130, 246, 0.08);
      box-shadow: inset 3px 0 0 0 #60a5fa;
    }

    ${({ $selected }) =>
      $selected &&
      `
      background: rgba(59, 130, 246, 0.12) !important;
      box-shadow: inset 3px 0 0 0 #60a5fa;
      
      &:hover {
        background: rgba(59, 130, 246, 0.16) !important;
      }
    `}
  }

  ${({ $clickable }) =>
    $clickable &&
    `
    cursor: pointer;
  `}
`;

export const Th = styled.th<{
  $align?: 'left' | 'center' | 'right';
  $sortable?: boolean;
  $sticky?: boolean;
  $left?: number;
}>`
  padding: 16px 12px;
  color: #64748b;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: ${({ $align }) => $align || 'left'};
  cursor: ${({ $sortable }) => ($sortable ? 'pointer' : 'default')};
  white-space: nowrap;
  background: #f8fafc;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;

  position: sticky;
  top: 0;
  z-index: ${({ $sticky }) => ($sticky ? 30 : 10)};

  ${({ $sticky, $left }) =>
    $sticky &&
    `
    left: ${$left ?? 0}px;
    border-right: 1px solid #e2e8f0;
  `}

  &:first-of-type {
    padding-left: 24px;
    ${({ $sticky }) =>
      $sticky &&
      `
      z-index: 30;
      left: 0;
    `}
  }
  &:last-of-type {
    padding-right: 24px;
  }

  &:hover {
    ${({ $sortable }) =>
      $sortable &&
      `
      color: #334155;
      background: #f1f5f9;
    `}
  }

  .dark & {
    color: #94a3b8;
    background: #1e293b;

    ${({ $sticky }) =>
      $sticky &&
      `
      border-color: #334155;
    `}

    &:hover {
      ${({ $sortable }) =>
        $sortable &&
        `
        color: #cbd5e1;
        background: #334155;
      `}
    }
  }
`;

export const ThContent = styled.div<{ $align?: 'left' | 'center' | 'right' }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $align }) => ($align === 'right' ? 'flex-end' : $align === 'center' ? 'center' : 'flex-start')};
  gap: 8px;
`;

export const SortIconWrapper = styled.div`
  display: flex;
  align-items: center;
  color: ${tkn('colors.brand.primary')};
`;

export const Td = styled.td<{
  $align?: 'left' | 'center' | 'right';
  $sticky?: boolean;
  $left?: number;
}>`
  padding: 12px;
  vertical-align: middle;
  font-size: 14px;
  color: #0f172a;
  text-align: ${({ $align }) => $align || 'left'};
  background: inherit;
  transition: background-color 0.2s ease;

  ${({ $sticky, $left }) =>
    $sticky &&
    `
    position: sticky;
    left: ${$left ?? 0}px;
    z-index: 20;
    border-right: 1px solid #e2e8f0;
    background: white;
    
    /* Ensure sticky cells match row background on hover/selected */
    tr:hover & {
      background: rgba(59, 130, 246, 0.04);
    }
    
    tr[data-selected="true"] & {
      background: rgba(59, 130, 246, 0.08);
    }
    
    tr[data-selected="true"]:hover & {
      background: rgba(59, 130, 246, 0.11);
    }
  `}

  &:first-of-type {
    padding-left: 24px;
  }
  &:last-of-type {
    padding-right: 24px;
  }

  .dark & {
    color: #cbd5e1;

    ${({ $sticky }) =>
      $sticky &&
      `
      background: #0f172a;
      border-color: #1e293b;
      
      tr:hover & {
        background: rgba(59, 130, 246, 0.08);
      }
      
      tr[data-selected="true"] & {
        background: rgba(59, 130, 246, 0.12);
      }
      
      tr[data-selected="true"]:hover & {
        background: rgba(59, 130, 246, 0.16);
      }
    `}
  }
`;

export const EmptyRow = styled.tr``;

export const EmptyCell = styled(Td)`
  text-align: center;
  color: #94a3b8;
  padding: 80px 0;
`;

export const Toolbar = styled.div`
  padding: 16px 24px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: rgba(248, 250, 252, 0.3);

  .dark & {
    background: rgba(30, 41, 59, 0.3);
    border-color: #1e293b;
  }
`;

export const ToolbarSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const BulkSelectWrapper = styled.div`
  position: relative;
`;

export const BulkSelect = styled.select`
  appearance: none;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 6px 32px 6px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: 0 0 0 2px ${tkn('colors.brand.primary')}20;
  }

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;
  }
`;

export const BulkSelectIcon = styled.div`
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
  display: flex;
  align-items: center;
`;

export const ToolbarButton = styled.button`
  padding: 8px;
  color: #64748b;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: white;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    border-color: #e2e8f0;
    color: #475569;
  }

  .dark & {
    color: #94a3b8;
    &:hover {
      background: #1e293b;
      border-color: #334155;
      color: #cbd5e1;
    }
  }
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
