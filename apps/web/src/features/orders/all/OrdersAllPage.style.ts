import styled from '@emotion/styled';
import { PageContainer, TabNav, Text, tkn } from '@repo/ui';

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
  flex-wrap: wrap;
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

/**
 * Stage rail: underline variant with severity accent ONLY on the selected tab,
 * mirroring `ActionCenterPage.style.ts:FilterTabs`. Inactive tabs inherit
 * `TabNav` defaults (text.secondary, hover → brand.primary).
 */
export const StageTabs = styled(TabNav)`
  > [role='tab']:nth-of-type(1)[aria-selected='true'] {
    color: ${tkn('colors.brand.primary')};

    &:hover {
      color: ${tkn('colors.brand.primary')};
    }

    &::after {
      background: ${tkn('colors.brand.primary')};
    }

    > span:last-child {
      background: ${tkn('colors.brand.primary')};
      color: ${tkn('colors.text.inverse')};
      font-weight: ${tkn('typography.fontWeight.bold')};
      box-shadow: 0 0 0 0.0625rem ${tkn('colors.glass.edge')};
    }
  }

  > [role='tab']:nth-of-type(2)[aria-selected='true'] {
    color: ${tkn('colors.semantic.error')};

    &:hover {
      color: ${tkn('colors.semantic.error')};
    }

    &::after {
      background: ${tkn('colors.semantic.error')};
    }

    > span:last-child {
      background: ${tkn('colors.semantic.error')};
      color: ${tkn('colors.text.inverse')};
      font-weight: ${tkn('typography.fontWeight.bold')};
      box-shadow: 0 0 0 0.0625rem ${tkn('colors.glass.edge')};
    }
  }

  > [role='tab']:nth-of-type(3)[aria-selected='true'] {
    color: ${tkn('colors.semantic.warning')};

    &:hover {
      color: ${tkn('colors.semantic.warning')};
    }

    &::after {
      background: ${tkn('colors.semantic.warning')};
    }

    > span:last-child {
      background: ${tkn('colors.semantic.warning')};
      color: ${tkn('colors.text.inverse')};
      font-weight: ${tkn('typography.fontWeight.bold')};
      box-shadow: 0 0 0 0.0625rem ${tkn('colors.glass.edge')};
    }
  }

  > [role='tab']:nth-of-type(4)[aria-selected='true'] {
    color: ${tkn('colors.semantic.info')};

    &:hover {
      color: ${tkn('colors.semantic.info')};
    }

    &::after {
      background: ${tkn('colors.semantic.info')};
    }

    > span:last-child {
      background: ${tkn('colors.semantic.info')};
      color: ${tkn('colors.text.inverse')};
      font-weight: ${tkn('typography.fontWeight.bold')};
      box-shadow: 0 0 0 0.0625rem ${tkn('colors.glass.edge')};
    }
  }

  > [role='tab']:nth-of-type(5)[aria-selected='true'] {
    color: ${tkn('colors.semantic.success')};

    &:hover {
      color: ${tkn('colors.semantic.success')};
    }

    &::after {
      background: ${tkn('colors.semantic.success')};
    }

    > span:last-child {
      background: ${tkn('colors.semantic.success')};
      color: ${tkn('colors.text.inverse')};
      font-weight: ${tkn('typography.fontWeight.bold')};
      box-shadow: 0 0 0 0.0625rem ${tkn('colors.glass.edge')};
    }
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
