import { css, Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { ButtonSize, ButtonVariant } from './Button.types';

interface StyledButtonProps {
  $variant?: ButtonVariant;
  $size?: ButtonSize;
  $fullWidth?: boolean;
  $isLoading?: boolean;
}

const variantStyles = {
  primary: (theme: Theme) => `
    background: ${theme.colors.brand.primary};
    color: #ffffff;
    border-color: ${theme.colors.brand.primary};

    &:hover:not(:disabled) {
      background: ${theme.colors.brand.primaryHover};
      border-color: ${theme.colors.brand.primaryHover};
    }

    &:active:not(:disabled) {
      opacity: 0.9;
    }
  `,

  secondary: (theme: Theme) => `
    background: ${theme.colors.background.secondary};
    color: ${theme.colors.text.primary};
    border-color: ${theme.colors.border.primary};

    &:hover:not(:disabled) {
      background: ${theme.colors.background.primary};
      border-color: ${theme.colors.border.primary};
      color: ${theme.colors.brand.primary};
    }
  `,

  danger: (theme: Theme) => `
    background: ${theme.colors.semantic.error};
    color: #ffffff;
    border-color: ${theme.colors.semantic.error};

    &:hover:not(:disabled) {
      opacity: 0.9;
    }
  `,
};

const sizeStyles = {
  sm: (theme: Theme) => `
    padding: 6px 12px;
    font-size: ${theme.typography.fontSize.sm};
    height: 36px;
  `,

  md: (theme: Theme) => `
    padding: 10px 20px;
    font-size: ${theme.typography.fontSize.md};
    height: 44px;
  `,

  lg: (theme: Theme) => `
    padding: 12px 24px;
    font-size: ${theme.typography.fontSize.md};
    height: 50px;
    font-weight: ${theme.typography.fontWeight.semibold};
  `,
};

const ButtonContainer = styled.button<StyledButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => tkn('spacing.xs')(p as any)};

  border-radius: ${(p) => tkn('radius.md')(p as any)};
  border: 1px solid transparent;
  font-weight: ${(p) => tkn('typography.fontWeight.medium')(p as any)};

  cursor: pointer;
  transition: all ${(p) => tkn('transitions.fast')(p as any)};

  /* Size styles */
  ${(p) => sizeStyles[p.$size || 'md'](p.theme as Theme)}

  /* Variant styles */
  ${(p) => variantStyles[p.$variant || 'secondary'](p.theme as Theme)}
  
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
      color: transparent !important;
      pointer-events: none;

      &::after {
        content: '';
        position: absolute;
        width: 18px;
        height: 18px;
        top: 50%;
        left: 50%;
        margin-left: -9px;
        margin-top: -9px;
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
    opacity: 0.5;
  }
`;

export const S = {
  ButtonContainer,
};
