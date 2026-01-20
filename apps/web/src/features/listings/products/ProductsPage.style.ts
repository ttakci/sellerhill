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

export const TitleSection = styled.div`
  display: flex;
  flex-direction: column;

  h1 {
    font-size: 24px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.025em;
    margin: 0;
    .dark & { color: white; }
  }

  p {
    font-size: 14px;
    color: #64748b;
    margin-top: 4px;
    .dark & { color: #94a3b8; }
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: 12px;
`;

export const RefreshButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);

  &:hover {
    background: #f8fafc;
  }

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #e2e8f0;
    &:hover { background: #334155; }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

export const Card = styled.div`
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  overflow: hidden;

  .dark & {
    background: #0f172a;
    border-color: #1e293b;
  }
`;

export const TableWrapper = styled.div`
  overflow-x: auto;
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
`;

export const THead = styled.thead`
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  
  .dark & {
    background: rgba(30, 41, 59, 0.5);
    border-color: #1e293b;
  }
`;

export const TH = styled.th`
  padding: 16px 24px;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  .dark & {
    color: #64748b;
  }
`;

export const TBody = styled.tbody`
  & > tr {
    border-bottom: 1px solid #e2e8f0;
    transition: background 0.2s;

    &:hover {
      background: #f8fafc;
    }

    .dark & {
      border-color: #1e293b;
      &:hover { background: rgba(30, 41, 59, 0.5); }
    }
  }
`;

export const TD = styled.td`
  padding: 20px 24px;
  vertical-align: middle;
`;

export const ProductCell = styled.div`
  display: flex;
  align-items: center;
  gap: 16px;
`;

export const ProductImageWrapper = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  flex-shrink: 0;

  .dark & {
    background: #1e293b;
    border-color: #334155;
  }

  svg, .material-symbols-outlined {
    font-size: 20px;
    color: #94a3b8;
  }
`;

export const ProductImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

export const ProductMainInfo = styled.div`
  display: flex;
  flex-direction: column;
`;

export const ProductTitle = styled.div`
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  max-width: 400px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  .dark & { color: white; }
`;

export const ProductBrand = styled.div`
  font-size: 12px;
  color: #64748b;
  margin-top: 2px;
`;

export const ASINBadge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #475569;
  font-family: 'JetBrains Mono', monospace;

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #94a3b8;
  }
`;

export const CategoryText = styled.span`
  font-size: 14px;
  color: #475569;
  .dark & { color: #94a3b8; }
`;

export const PriceText = styled.span`
  font-size: 14px;
  font-weight: 700;
  color: #10b981;
`;

export const DateText = styled.span`
  font-size: 14px;
  color: #64748b;
`;

export const PaginationFooter = styled.div`
  padding: 16px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .dark & {
    background: rgba(30, 41, 59, 0.3);
    border-color: #1e293b;
  }
`;

export const PaginationInfo = styled.p`
  font-size: 12px;
  color: #64748b;
  margin: 0;
`;

export const PaginationActions = styled.div`
  display: flex;
  gap: 8px;
`;

export const PageNumberButton = styled.button<{ $active?: boolean }>`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid ${({ $active }) => ($active ? '#2563eb' : '#e2e8f0')};
  background: ${({ $active }) => ($active ? '#2563eb' : 'white')};
  color: ${({ $active }) => ($active ? 'white' : '#475569')};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: #2563eb;
    color: ${({ $active }) => ($active ? 'white' : '#2563eb')};
  }

  .dark & {
    background: ${({ $active }) => ($active ? '#2563eb' : '#1e293b')};
    border-color: ${({ $active }) => ($active ? '#2563eb' : '#334155')};
    color: ${({ $active }) => ($active ? 'white' : '#94a3b8')};
  }
`;

export const PageNavButton = styled.button`
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: white;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #334155;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dark & {
    background: #1e293b;
    border-color: #334155;
    color: #64748b;
  }

  svg { font-size: 18px; }
`;

export const EmptyState = styled.div`
  padding: 80px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #94a3b8;
`;
