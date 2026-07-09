import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const ErrorText = styled(Text)`
  color: ${tkn('colors.semantic.error')};
`;
