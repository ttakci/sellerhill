import styled from '@emotion/styled';
import { PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;

export const FilterBarWrapper = styled.div`
  margin-bottom: 0;
`;

export const FilterBar = styled.div`
  /* The controls sit on the page canvas — no card of their own, so the first
     row of data is the first surface on the page (see the orders list). */
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const FilterBarRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    flex-direction: column;
    align-items: stretch;
    gap: ${tkn('spacing.sm')};
  }
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 16rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    width: 100%;
  }
`;

export const Arrow = styled.span<{ $tone: 'up' | 'down' }>`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: ${({ $tone, theme }) => ($tone === 'up' ? theme.colors.semantic.success : theme.colors.semantic.error)};
`;

/** Compact "previous → new" cell for table view, right-aligned like every figure column. */
export const TableChange = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

