import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/** Stacks the change summary above the optional listing-limit warning. */
export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;
