import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const PaginationContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  width: 100%;
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};

  @media (min-width: 640px) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;


export const RowsPerPage = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const PaginationLabel = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  font-weight: ${tkn('typography.fontWeight.medium')};
`;

export const SelectWrapper = styled.div`
  width: 70px;
`;

export const PageInfo = styled.div`
  display: flex;
  align-items: center;
`;

export const Navigation = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const NavButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0 12px;
  height: 36px;
  min-width: 36px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.text.secondary')};
  transition: all ${tkn('transitions.fast')};
  font-weight: 500;
  
  &:hover:not(:disabled) {
    background: ${tkn('colors.brand.primary')};
    color: #FFFFFF;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    background: transparent;
    color: ${tkn('colors.text.tertiary')};
  }
`;
