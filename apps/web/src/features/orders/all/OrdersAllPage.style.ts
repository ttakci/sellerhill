import styled from '@emotion/styled';
import { PageContainer, Text, tkn } from '@repo/ui';

export const Container = PageContainer;

/*
 * The controls sit on the page canvas, not in a card of their own. The page
 * used to stack three chrome layers before the first row — a tab rail, a
 * white filter card and the table's own toolbar — and the data was the
 * fourth surface down. Now the rail, the filter row and the table are one
 * column: title → rail → controls → rows.
 */
export const Toolbar = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

/** The counted stage tabs on the left, the legend trigger on the right. */
export const TabsRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    flex-direction: column;
    align-items: stretch;
  }
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 17rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    width: 100%;
  }
`;

export const SelectWrapper = styled.div`
  width: 11.5rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    width: 100%;
  }
`;

/** View toggle, export and "clear" — pushed to the row's far end. */
export const FilterActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  margin-left: auto;
  flex-wrap: wrap;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    margin-left: 0;
    justify-content: space-between;
  }
`;

/** Order number over its date — one column answers "which sale, when". */
export const OrderCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  /* An eBay order id never wraps — split across two lines it stops reading as one id. */
  white-space: nowrap;
`;

/** The seller's note under the order number: one line, the rest on the tooltip. */
export const NoteLine = styled(Text)`
  display: block;
  max-width: 9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const BuyerCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

/** Signed profit over its margin, both flush right with the money columns. */
export const ProfitCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const StageCell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;
