import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import type { IconButtonVariant } from './IconButton.types';

export const IconButtonContainer = styled.button<{ $variant: IconButtonVariant }>`
  padding: 0.5rem;
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

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.border.focus')};
    outline-offset: 0.125rem;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  ${({ $variant }) => {
    switch ($variant) {
      case 'outlined':
        return `
          border-color: ${tkn('colors.border.primary')};
          &:hover {
            background: ${tkn('colors.background.tertiary')};
            border-color: ${tkn('colors.text.tertiary')};
          }
        `;
      case 'elevated':
        return `
          background: ${tkn('colors.surface.primary')};
          box-shadow: ${tkn('shadows.sm')};
          border-color: ${tkn('colors.border.primary')};
          &:hover {
            background: ${tkn('colors.background.tertiary')};
            box-shadow: ${tkn('shadows.md')};
          }
        `;
      case 'ghost':
      default:
        return `
          &:hover {
            background: ${tkn('colors.background.tertiary')};
          }
        `;
    }
  }}
`;
