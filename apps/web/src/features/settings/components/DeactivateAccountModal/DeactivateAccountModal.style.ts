import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/** Form fields inside Dialog body slot (left-aligned). */
export const FieldBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  width: 100%;
`;
