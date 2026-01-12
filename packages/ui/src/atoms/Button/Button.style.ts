import styled, { css } from 'styled-components';

import { tkn } from '../../theme/tkn';

import type { ButtonVariant, ButtonSize } from './Button.types';

interface StyledButtonProps {
  $variant?: ButtonVariant;
  $size?: ButtonSize;
  $fullWidth?: boolean;
  $isLoading?: boolean;
}

const variantStyles = {
  primary: css`
    background: ${tkn('colors.brand.primary')};
    color: #ffffff;
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: ${tkn('shadows.sm')};

    &:hover:not(:disabled) {
      background: ${tkn('colors.brand.primaryHover')};
      border-color: ${tkn('colors.brand.primaryHover')};
      box-shadow: ${tkn('shadows.md')};
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: ${tkn('shadows.sm')};
    }
  `,

  secondary: css`
    background: ${tkn('colors.surface.primary')};
    color: ${tkn('colors.text.primary')};
    border-color: ${tkn('colors.border.primary')};

    &:hover:not(:disabled) {
      background: ${tkn('colors.background.primary')};
      border-color: ${tkn('colors.brand.primary')};
      color: ${tkn('colors.brand.primary')};
    }
  `,

  danger: css`
    background: ${tkn('colors.semantic.error')};
    color: #ffffff;
    border-color: ${tkn('colors.semantic.error')};
    box-shadow: ${tkn('shadows.sm')};

    &:hover:not(:disabled) {
      background: ${tkn('colors.semantic.error')};
      border-color: ${tkn('colors.semantic.error')};
      box-shadow: ${tkn('shadows.md')};
      transform: translateY(-1px);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: ${tkn('shadows.sm')};
    }
  `,
};

const sizeStyles = {
  sm: css`
    padding: ${tkn('spacing.sm')} ${tkn('spacing.lg')};
    font-size: ${tkn('typography.fontSize.sm')};
    height: 36px;
  `,

  md: css`
    padding: ${tkn('spacing.md')} ${tkn('spacing.xl')};
    font-size: ${tkn('typography.fontSize.md')};
    height: 42px;
  `,

  lg: css`
    padding: ${tkn('spacing.lg')} ${tkn('spacing.xxl')};
    font-size: ${tkn('typography.fontSize.md')};
    height: 48px;
    font-weight: ${tkn('typography.fontWeight.semibold')};
  `,
};

const ButtonContainer = styled.button<StyledButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.xs')};

  border-radius: ${tkn('radius.md')};
  border: 1px solid ${tkn('colors.border.primary')};
  font-weight: ${tkn('typography.fontWeight.medium')};

  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  /* Size styles */
  ${(p) => sizeStyles[p.$size || 'md']}

  /* Variant styles */
  ${(p) => variantStyles[p.$variant || 'secondary']}
  
  /* Full width */
  ${(p) =>
    p.$fullWidth &&
    css`
      width: 100%;
    `}
  
  /* Loading state */
  ${(p) =>
    p.$isLoading &&
    css`
      position: relative;
      color: transparent;
      pointer-events: none;

      &::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        top: 50%;
        left: 50%;
        margin-left: -8px;
        margin-top: -8px;
        border: 2px solid currentColor;
        border-radius: 50%;
        border-top-color: transparent;
        animation: button-loading-spinner 0.6s linear infinite;
      }

      @keyframes button-loading-spinner {
        from {
          transform: rotate(0turn);
        }
        to {
          transform: rotate(1turn);
        }
      }
    `}
  
  /* Disabled state */
  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

export const S = {
  ButtonContainer,
};
