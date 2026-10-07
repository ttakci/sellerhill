import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

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

export const SelectWrapper = styled.div`
  width: 12rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    width: 100%;
  }
`;

export const FilterActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  margin-left: auto;
  min-height: ${tkn('controls.height.medium')};

  @media (max-width: ${tkn('breakpoints.lg')}) {
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }
`;

export const ResultCount = styled(UIText)``;

/** Revision card — quiet frosted pane, harmonized with ListingCard / OrderCard / JobCard.
 *  Photo + facts above a hairline, the figures+date under it on glass.tint. */
export const RevisionCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  cursor: pointer;
  transition:
    box-shadow ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.glassHover')};
    transform: translateY(-0.125rem);
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const RevisionCardTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;
`;

export const RevisionCardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};
  flex-shrink: 0;
`;

export const FooterDate = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const DetailHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  flex-shrink: 0;
`;

export const CardChanges = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding-top: ${tkn('spacing.sm')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const ChangeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const ChangeLabel = styled.span`
  flex: 0 0 6.5rem;
`;

export const ChangeValues = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const Arrow = styled.span<{ $tone: 'up' | 'down' }>`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: ${({ $tone, theme }) => ($tone === 'up' ? theme.colors.semantic.success : theme.colors.semantic.error)};
`;

export const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};
  flex-shrink: 0;
`;

/** Compact "previous → new" cell for table view. */
export const TableChange = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

/** Layout only — no font/color of its own, so the label text inherits the
 * table header cell's own uppercase/letter-spaced styling. */
export const StockHeader = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;

/** Same idea for the grid card's own "Stok" label, next to its `Text` sibling. */
export const CardLabelRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;
