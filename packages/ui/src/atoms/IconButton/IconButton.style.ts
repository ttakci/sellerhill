import { css } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { IconButtonVariant } from './IconButton.types';

export const IconButtonContainer = styled.button<{ $variant: IconButtonVariant }>`
  padding: ${tkn('spacing.sm')};
  background: transparent;
  border: 0.0625rem solid transparent;
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all ${tkn('transitions.fast')};
  color: ${tkn('colors.text.tertiary')};

  & svg {
    width: 1.25rem;
    height: 1.25rem;
  }

  &:hover {
    color: ${tkn('colors.text.primary')};
  }

  /* brand.primary, not border.focus — every other interactive atom rings on the
     brand colour, and the two tokens had drifted apart in dark mode. */
  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'outlined':
        return css`
          border-color: ${tkn('colors.border.primary')({ theme })};
          &:hover {
            background: ${tkn('colors.background.tertiary')({ theme })};
            border-color: ${tkn('colors.text.tertiary')({ theme })};
          }
        `;
      case 'elevated':
        return css`
          background: ${tkn('colors.surface.primary')({ theme })};
          box-shadow: ${tkn('shadows.sm')({ theme })};
          border-color: ${tkn('colors.border.primary')({ theme })};
          &:hover {
            background: ${tkn('colors.background.tertiary')({ theme })};
            box-shadow: ${tkn('shadows.md')({ theme })};
          }
        `;
      case 'ghost':
      default:
        return css`
          &:hover {
            background: ${tkn('colors.background.tertiary')({ theme })};
          }
        `;
    }
  }}
`;
