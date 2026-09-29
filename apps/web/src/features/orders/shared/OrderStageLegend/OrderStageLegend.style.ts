import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Panel = styled.div`
  width: min(32rem, calc(100vw - 2 * ${tkn('spacing.md')}));
  max-height: 70vh;
  overflow: auto;
  padding: ${tkn('spacing.md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: minmax(9rem, auto) 1fr 1fr;
  gap: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  align-items: start;

  @media (max-width: ${tkn('breakpoints.sm')}) {
    grid-template-columns: 1fr;
  }
`;
