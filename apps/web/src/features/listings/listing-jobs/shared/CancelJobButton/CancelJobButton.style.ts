import styled from '@emotion/styled';
import { IconButton, tkn } from '@repo/ui';

/**
 * Cancel a listing job: a solid red X drawn like the status badge beside it
 * (red fill, white cross, badge corners and height) — operator, 2026-10-09.
 * A full red "Cancel" button was the loudest thing on a card whose action is
 * rarely needed. Card, table row and job detail all use this one control.
 */
export const CancelX = styled(IconButton)`
  && {
    padding: ${tkn('spacing.xs')};
    color: ${tkn('colors.text.inverse')};
    background: ${tkn('colors.semantic.error')};
    border-color: ${tkn('colors.semantic.error')};
    border-radius: ${tkn('radius.sm')};
  }

  && svg {
    width: 1rem;
    height: 1rem;
  }

  &&:hover:not(:disabled) {
    color: ${tkn('colors.text.inverse')};
    background: ${tkn('colors.semantic.error')};
    box-shadow: ${tkn('shadows.md')};
  }
`;
