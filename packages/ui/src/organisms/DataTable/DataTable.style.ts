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
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};

  @media (min-width: 48rem) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 64rem) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 80rem) {
    grid-template-columns: repeat(4, 1fr);
  }
`;
