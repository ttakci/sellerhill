import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

export const Form = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  overflow-wrap: anywhere;
`;
export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  @media (max-width: ${tkn('breakpoints.sm')}) {
    flex-wrap: wrap;
  }
`;
