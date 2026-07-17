import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const DataTableContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
`;

export const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  margin-bottom: ${tkn('spacing.lg')};
`;

export const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const BulkSelectWrapper = styled.div`
  min-width: 10rem;
`;

export const GridContainer = styled.div`
  display: grid;
  /* minmax(0, 1fr) prevents grid items from overflowing / stacking into each other */
  grid-template-columns: minmax(0, 1fr);
  gap: ${tkn('spacing.md')};
  align-items: stretch;
  width: 100%;

  @media (min-width: 40rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: 75rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  & > * {
    min-width: 0;
    max-width: 100%;
  }
`;

export const GridEmptyState = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 18rem;
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.lg')};
  color: ${tkn('colors.text.tertiary')};
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  box-sizing: border-box;
`;

export const ColumnManagerContent = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.sm-md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;
