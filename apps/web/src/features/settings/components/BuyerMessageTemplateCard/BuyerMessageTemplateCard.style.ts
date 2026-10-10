import styled from '@emotion/styled';
import { IconButton, tkn } from '@repo/ui';

/** Plain trash icon in the badge row, red only on hover. */
export const DeleteButton = styled(IconButton)`
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;

  &:hover {
    color: ${tkn('colors.semantic.error')};
    background: ${tkn('colors.semanticTint.error')};
  }
`;
