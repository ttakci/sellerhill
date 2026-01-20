import styled from '@emotion/styled';

export const PaginationContainer = styled.div`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  font-size: 13px;
  padding: 16px 24px;
  background: rgba(248, 250, 252, 0.3);
  border-top: 1px solid #f1f5f9;

  .dark & {
    background: rgba(30, 41, 59, 0.3);
    border-color: #1e293b;
  }

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

export const RowsPerPage = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  color: #64748b;

  .dark & {
    color: #94a3b8;
  }
`;

export const PaginationLabel = styled.span`
  font-size: 13px;
  color: #64748b;
  font-weight: 500;

  span {
    font-weight: 600;
    color: #334155;
    .dark & { color: #cbd5e1; }
  }

  .dark & {
    color: #94a3b8;
  }
`;

export const SelectWrapper = styled.div`
  width: 72px;
  position: relative;
`;

export const PageInfo = styled.div`
  display: flex;
  align-items: center;
`;

export const NavigationWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 24px;
`;

export const Navigation = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
`;

export const NavButton = styled.button`
  background: white;
  border: 1px solid #e2e8f0;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #334155;
  transition: all 0.2s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  
  .dark & {
    background: #1e293b;
    border-color: #334159;
    color: #cbd5e1;
  }

  &:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #cbd5e1;
    .dark & {
      background: #334159;
      color: #ffffff;
    }
  }

  &:disabled {
    opacity: 0.3;
    cursor: default;
    color: #94a3b8;
    background: white;
    .dark & { background: #1e293b; }
  }
`;
