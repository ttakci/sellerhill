import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const TableContainer = styled.div`
  width: 100%;
  overflow: hidden;
  background: white;
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid #e2e8f0; /* 1px */
  box-shadow:
    0 0.0625rem 0.1875rem 0 rgba(0, 0, 0, 0.1),
    /* 1px 3px */ 0 0.0625rem 0.125rem -0.0625rem rgba(0, 0, 0, 0.1); /* 1px 2px 1px */

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
    height: 0.5rem; /* 8px */
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 0.25rem; /* 4px */
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
  border-bottom: 0.0625rem solid #e2e8f0; /* 1px */
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
  height: 3.75rem; /* 60px */
  border-bottom: 0.0625rem solid #f1f5f9; /* 1px */

  /* Striped rows - alternating background */
  &:nth-of-type(even) {
    background: rgba(248, 250, 252, 0.5);
  }

  /* Hover effect - smooth and subtle */
  &:hover {
    background: rgba(59, 130, 246, 0.04);
    box-shadow: inset 0.1875rem 0 0 0 #3b82f6; /* 3px */
  }

  /* Selected row styling */
  ${({ $selected }) =>
    $selected &&
    `
    background: rgba(59, 130, 246, 0.08) !important;
    box-shadow: inset 0.1875rem 0 0 0 #3b82f6; /* 3px */
    
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
      box-shadow: inset 0.1875rem 0 0 0 #60a5fa; /* 3px */
    }

    ${({ $selected }) =>
      $selected &&
      `
      background: rgba(59, 130, 246, 0.12) !important;
      box-shadow: inset 0.1875rem 0 0 0 #60a5fa; /* 3px */
      
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
  padding: ${tkn('spacing.md')} ${tkn('spacing.sm')};
  color: #64748b;
  font-weight: 700;
  font-size: 0.75rem; /* 12px */
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
    left: ${($left ?? 0) / 16}rem;
    border-right: 0.0625rem solid #e2e8f0; /* 1px */
  `}

  &:first-of-type {
    padding-left: 1.5rem; /* 24px */
    ${({ $sticky }) =>
      $sticky &&
      `
      z-index: 30;
      left: 0;
    `}
  }
  &:last-of-type {
    padding-right: 1.5rem; /* 24px */
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
  gap: 0.5rem; /* 8px */
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
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  vertical-align: middle;
  font-size: 0.875rem; /* 14px */
  color: #0f172a;
  text-align: ${({ $align }) => $align || 'left'};
  background: inherit;
  transition: background-color 0.2s ease;

  ${({ $sticky, $left }) =>
    $sticky &&
    `
    position: sticky;
    left: ${($left ?? 0) / 16}rem;
    z-index: 20;
    border-right: 0.0625rem solid #e2e8f0; /* 1px */
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
    padding-left: 1.5rem; /* 24px */
  }
  &:last-of-type {
    padding-right: 1.5rem; /* 24px */
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
  padding: 5rem 0; /* 80px */
`;

export const Toolbar = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: 0.0625rem solid #f1f5f9; /* 1px */
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem; /* 16px */
  background: rgba(248, 250, 252, 0.3);

  .dark & {
    background: rgba(30, 41, 59, 0.3);
    border-color: #1e293b;
  }
`;

export const ToolbarSection = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
`;

export const BulkSelectWrapper = styled.div`
  position: relative;
`;

export const BulkSelect = styled.select`
  appearance: none;
  background: white;
  border: 0.0625rem solid #e2e8f0; /* 1px */
  border-radius: ${tkn('radius.md')};
  padding: 0.375rem 2rem 0.375rem 0.75rem; /* 6px 32px 6px 12px */
  font-size: 0.8125rem; /* 13px */
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: 0 0 0 0.125rem ${tkn('colors.brand.primary')}20; /* 2px */
  }

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #cbd5e1;
  }
`;

export const BulkSelectIcon = styled.div`
  position: absolute;
  right: 0.5rem; /* 8px */
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
  display: flex;
  align-items: center;
`;

export const ToolbarButton = styled.button`
  padding: 0.5rem; /* 8px */
  color: #64748b;
  background: transparent;
  border: 0.0625rem solid transparent; /* 1px */
  border-radius: ${tkn('radius.md')};
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: white;
    box-shadow: 0 0.0625rem 0.125rem 0 rgba(0, 0, 0, 0.05); /* 1px 2px */
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
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  background: rgba(248, 250, 252, 0.3);
  border-top: 0.0625rem solid #f1f5f9; /* 1px */
  display: flex;
  align-items: center;
  justify-content: space-between;

  .dark & {
    background: rgba(30, 41, 59, 0.3);
    border-color: #1e293b;
  }
`;
