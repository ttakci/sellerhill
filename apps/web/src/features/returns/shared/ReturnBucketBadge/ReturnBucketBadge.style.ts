import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/** Icon + label inside the Badge, on one line. */
export const Inner = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  white-space: nowrap;
`;
