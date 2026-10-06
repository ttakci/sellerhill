import styled from '@emotion/styled';
import { Card, tkn } from '@repo/ui';

export const Form = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  overflow-wrap: anywhere;
`;
