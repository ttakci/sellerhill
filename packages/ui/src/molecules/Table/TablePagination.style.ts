import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const PaginationContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.lg')};
  width: 100%;
  font-size: ${tkn('typography.fontSize.sm')};
`;

import { Text } from '../../atoms/Text';

export const RowsPerPage = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const PaginationLabel = styled(Text)`
  text-transform: uppercase;
  letter-spacing: 0.05em;
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
  padding: ${tkn('spacing.xs')};
  border-radius: ${tkn('radius.full')};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.text.secondary')};
  transition: all ${tkn('transitions.fast')};

  &:hover:not(:disabled) {
    background: ${tkn('colors.background.secondary')};
    color: ${tkn('colors.text.primary')};
  }

  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }
`;
