import styled from '@emotion/styled';

export const PaginationContainer = styled.div`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  font-size: 0.8125rem; /* 13px */
  padding: 1rem 1.5rem; /* 16px 24px */
  background: rgba(248, 250, 252, 0.3);
  border-top: 0.0625rem solid #f1f5f9; /* 1px */

  .dark & {
    background: rgba(30, 41, 59, 0.3);
    border-color: #1e293b;
  }

  @media (min-width: 40rem) {
    /* 640px */
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

export const RowsPerPage = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem; /* 12px */
  color: #64748b;

  .dark & {
    color: #94a3b8;
  }
`;

export const PaginationLabel = styled.span`
  font-size: 0.8125rem; /* 13px */
  color: #64748b;
  font-weight: 500;

  span {
    font-weight: 600;
    color: #334155;
    .dark & {
      color: #cbd5e1;
    }
  }

  .dark & {
    color: #94a3b8;
  }
`;

export const SelectWrapper = styled.div`
  width: 4.5rem; /* 72px */
  position: relative;
`;

export const PageInfo = styled.div`
  display: flex;
  align-items: center;
`;

export const NavigationWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem; /* 24px */
`;

export const Navigation = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem; /* 4px */
`;

export const NavButton = styled.button`
  background: white;
  border: 0.0625rem solid #e2e8f0; /* 1px */
  cursor: pointer;
  padding: 0.375rem; /* 6px */
  border-radius: 0.5rem; /* 8px */
  display: flex;
  align-items: center;
  justify-content: center;
  color: #334155;
  transition: all 0.2s;
  box-shadow: 0 0.0625rem 0.125rem rgba(0, 0, 0, 0.05); /* 1px 2px */

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
    .dark & {
      background: #1e293b;
    }
  }
`;
