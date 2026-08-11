import styled from '@emotion/styled';

import { IconButton } from '../../atoms/IconButton';
import { tkn } from '../../theme/tkn';

import type { TablePaginationVariant } from './TablePagination.types';

export const PaginationContainer = styled.div<{ $variant: TablePaginationVariant }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  box-sizing: border-box;
  width: 100%;
  font-size: ${tkn('typography.fontSize.sm')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  background: ${tkn('colors.surface.primary')};

  ${({ $variant, theme }) =>
    $variant === 'detached'
      ? `
        border: 0.0625rem solid ${theme.colors.border.primary};
        border-radius: ${theme.radius.lg};
        box-shadow: ${theme.shadows.sm};
      `
      : `
        border-top: 0.0625rem solid ${theme.colors.border.secondary};
      `}

  @media (min-width: ${tkn('breakpoints.sm')}) {
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
  white-space: nowrap;

  span {
    font-weight: ${tkn('typography.fontWeight.semibold')};
    color: ${tkn('colors.text.primary')};
  }
`;

/*
 * Wide enough for the widest option ("100") plus the chevron. It was 4.5rem with
 * an auto-width Select inside, so the control neither filled its slot nor had
 * room for a three-digit value.
 */
export const SelectWrapper = styled.div`
  width: 5.5rem;
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

/** Page N of M — chevrons alone never said how much further the list goes. */
export const PageCounter = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  font-variant-numeric: tabular-nums;
  padding: 0 ${tkn('spacing.xs')};
  white-space: nowrap;
`;

/*
 * Extends the IconButton atom — this was a raw styled.button re-implementing
 * hover/disabled by hand and carrying no :focus-visible ring at all.
 */
export const NavButton = styled(IconButton)`
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;
