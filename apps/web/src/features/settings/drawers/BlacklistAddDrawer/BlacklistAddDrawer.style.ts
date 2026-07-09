import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.4')};
`;

export const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.4')};
  @media (min-width: 600px) {
    grid-template-columns: 2fr 1fr;
    align-items: end;
  }
`;
