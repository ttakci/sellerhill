import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Editor = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
`;

export const RowList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

/** One proxy's inputs plus its test result, kept together so the badge sits under ITS row. */
export const RowBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

/** A row-direction flex parent lets the badge shrink to its content instead of stretching. */
export const StatusSlot = styled.div`
  display: flex;
  justify-content: flex-start;

  &:empty {
    display: none;
  }
`;

export const ProxyRow = styled.div`
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr) 5.5rem minmax(0, 1fr) minmax(0, 1fr) auto auto;
  align-items: end;
  gap: ${tkn('spacing.xs')};

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const AddRow = styled.div`
  display: flex;
`;

export const SavedTest = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding-top: ${tkn('spacing.xs')};
  border-top: 1px dashed ${tkn('colors.border.primary')};
`;

export const SavedTestHeader = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
`;

export const SavedResultList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const SavedResultRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
`;
