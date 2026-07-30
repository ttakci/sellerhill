import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const PaginationContainer = styled.div`
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  font-size: ${tkn('typography.fontSize.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md+')};
  background: ${tkn('colors.surface.primary')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};

  @media (min-width: 40rem) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

export const RowsPerPage = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  color: ${tkn('colors.text.tertiary')};
`;

export const PaginationLabel = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.tertiary')};
  font-weight: ${tkn('typography.fontWeight.medium')};

  span {
    font-weight: ${tkn('typography.fontWeight.semibold')};
    color: ${tkn('colors.text.primary')};
  }
`;

export const SelectWrapper = styled.div`
  width: 4.5rem;
  position: relative;
`;

export const PageInfo = styled.div`
  display: flex;
  align-items: center;
`;

export const NavigationWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const Navigation = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;

export const NavButton = styled.button`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  cursor: pointer;
  padding: ${tkn('spacing.xs')};
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.text.secondary')};
  transition: all ${tkn('transitions.fast')};

  &:hover:not(:disabled) {
    background: ${tkn('colors.background.tertiary')};
    border-color: ${tkn('colors.text.tertiary')};
    color: ${tkn('colors.text.primary')};
  }

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;
