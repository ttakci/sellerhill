import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

/** An inline span that reads as a plain value until hovered/focused. */
export const Trigger = styled.span`
  border-radius: ${tkn('radius.sm')};
  padding: 0 ${tkn('spacing.2xs')};
  margin: 0 -${tkn('spacing.2xs')};
  cursor: pointer;
  transition: background-color 0.12s ease;

  &:hover,
  &:focus-visible {
    background: ${tkn('colors.background.tertiary')};
    outline: none;
  }

  &:focus-visible {
    box-shadow: 0 0 0 2px ${tkn('colors.brand.primary')};
  }
`;
