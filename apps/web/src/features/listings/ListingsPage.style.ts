import styled from '@emotion/styled';

export const Container = styled.div`
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  gap: 24px;
  margin-bottom: 32px;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: flex-end;
  }
`;

export const HeaderContent = styled.div`
  display: flex;
  flex-direction: column;
`;

export const PageTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
  margin: 0;
`;

export const PageSubtitle = styled.p`
  font-size: 14px;
  color: #64748b;
  margin-top: 4px;

  span {
    font-weight: 600;
    color: #334155;
  }
`;

export const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const StyledButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  display: inline-flex;
  align-items: center;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.25rem;
  transition: all 0.2s;
  cursor: pointer;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  gap: 8px;

  ${({ $variant }) =>
    $variant === 'primary'
      ? `
    background: #2563eb;
    color: white;
    border: none;
    box-shadow: 0 1px 2px 0 rgba(37, 99, 235, 0.2);
    &:hover { background: #1d4ed8; }
  `
      : $variant === 'danger'
        ? `
    background: #ef4444;
    color: white;
    border: none;
    &:hover { background: #dc2626; }
  `
        : `
    background: white;
    color: #334155;
    border: 1px solid #e2e8f0;
    &:hover { background: #f8fafc; }
  `}

  & svg {
    width: 20px;
    height: 20px;
  }
`;

export const TableWrapper = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow:
    0 1px 3px 0 rgba(0, 0, 0, 0.1),
    0 1px 2px -1px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

export const TableToolbar = styled.div`
  padding: 16px 24px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: rgba(248, 250, 252, 0.3);
`;

export const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`;

export const StyledSelect = styled.div`
  position: relative;

  select {
    appearance: none;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 6px 32px 6px 12px;
    font-size: 13px;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    outline: none;

    &:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 1px #3b82f6;
    }
  }

  span {
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: #94a3b8;
    display: flex;
    align-items: center;
  }
`;

export const IconButton = styled.button`
  padding: 8px;
  color: #64748b;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  transition: all 0.2s;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: white;
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    border-color: #e2e8f0;
  }

  & svg {
    width: 20px;
    height: 20px;
  }
`;

export const TableContainer = styled.div`
  overflow-x: auto;
`;

export const StyledTable = styled.table`
  width: 100%;
  text-align: left;
  border-collapse: collapse;
`;

export const THead = styled.thead`
  background: white;
  border-bottom: 1px solid #f1f5f9;
`;

export const TH = styled.th`
  padding: 16px 12px;
  font-size: 12px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &:first-of-type {
    padding-left: 24px;
    width: 48px;
  }
  &:last-of-type {
    padding-right: 24px;
    text-align: right;
  }
`;

export const TBody = styled.tbody`
  & tr {
    border-bottom: 1px solid #f1f5f9;
    transition: background 0.2s;
    height: 72px;

    &:hover {
      background: rgba(248, 250, 252, 0.5);
    }

    &:hover .more-btn {
      opacity: 1;
    }
  }
`;

export const TD = styled.td`
  padding: 12px;

  &:first-of-type {
    padding-left: 24px;
  }
  &:last-of-type {
    padding-right: 24px;
    text-align: right;
  }
`;

export const ProductCell = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
`;

export const ProductImageWrapper = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 6px;
  flex-shrink: 0;

  svg {
    color: #cbd5e1;
  }
`;

export const ProductImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

export const ProductMainInfo = styled.div`
  min-width: 0;
`;

export const ProductTitle = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
`;

export const ProductSubtitle = styled.div`
  font-size: 12px;
  color: #94a3b8;
`;

export const ProductMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
`;

export const IDLink = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;

  span {
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    color: #475569;
  }

  a {
    color: #93c5fd;
    transition: color 0.2s;
    &:hover {
      color: #2563eb;
    }
    display: flex;
    align-items: center;
  }
`;

export const MonoText = styled.span`
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: #64748b;
`;

export const PriceText = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
`;

export const StockBadge = styled.span<{ $outOfStock?: boolean }>`
  font-size: 13px;
  font-weight: 500;
  color: ${({ $outOfStock }) => ($outOfStock ? '#94a3b8' : '#334155')};
  background: ${({ $outOfStock }) => ($outOfStock ? '#f8fafc' : '#f1f5f9')};
  padding: 2px 10px;
  border-radius: 9999px;
  display: inline-block;
  min-width: 32px;
  text-align: center;
`;

export const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  border: 1px solid transparent;

  ${({ $status }) =>
    $status === 'active' || $status === 'ACTIVE'
      ? `
    background: #ecfdf5;
    color: #059669;
    border-color: #d1fae5;
  `
      : `
    background: #f1f5f9;
    color: #64748b;
    border-color: #e2e8f0;
  `}

  .dark & {
    ${({ $status }) =>
      $status === 'active' || $status === 'ACTIVE'
        ? `
      background: rgba(16, 185, 129, 0.1);
      color: #34d399;
      border-color: rgba(16, 185, 129, 0.2);
    `
        : `
      background: rgba(148, 163, 184, 0.1);
      color: #94a3b8;
      border-color: rgba(148, 163, 184, 0.2);
    `}
  }
`;

export const TablePagination = styled.div`
  padding: 16px 24px;
  background: rgba(248, 250, 252, 0.3);
  border-top: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  gap: 16px;

  @media (min-width: 640px) {
    flex-direction: row;
  }
`;

export const PaginationInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: #64748b;
  font-size: 13px;

  span {
    font-weight: 600;
    color: #334155;
  }
`;

export const PaginationActions = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
`;

export const PageControls = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

export const PageButton = styled.button`
  padding: 6px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;

  &:hover:not(:disabled) {
    background: #f8fafc;
    color: #334155;
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
  }

  & svg {
    width: 20px;
    height: 20px;
  }
`;

export const MoreButton = styled.button`
  padding: 6px;
  color: #94a3b8;
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  opacity: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: #475569;
    background: #f1f5f9;
  }
`;

export const MetricValue = styled.span<{ $positive?: boolean; $negative?: boolean; $bold?: boolean }>`
  font-size: 13px;
  font-weight: ${({ $bold }) => ($bold ? '700' : '600')};
  color: ${({ $positive, $negative }) => ($positive ? '#059669' : $negative ? '#dc2626' : '#475569')};
`;

export const StatBadge = styled.div`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
`;

export const StatMain = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  line-height: 1;
`;

export const StatSub = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  margin-top: 2px;
`;

export const CompactText = styled.div`
  font-size: 0.875rem;
  color: ${({ theme }) => (theme as any).colors.text.secondary};
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const ColumnSettingsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 8px 0;
`;

export const FilterWrapper = styled.div`
  position: relative;
  display: inline-block;
`;

export const PopoverContainer = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 4px;
  width: 280px;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow:
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
  z-index: 50;
  overflow: hidden;

  .dark & {
    background: #1e293b;
    border-color: #334155;
  }
`;

export const PopoverHeader = styled.div`
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  font-weight: 600;
  color: #0f172a;
  font-size: 14px;
  background: #f8fafc;

  .dark & {
    border-color: #334155;
    background: #0f172a;
    color: #f1f5f9;
  }
`;

export const PopoverContent = styled.div`
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 400px;
  overflow-y: auto;
`;
