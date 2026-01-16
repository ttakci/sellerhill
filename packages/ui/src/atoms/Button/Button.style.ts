import { css, Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { ButtonSize, ButtonVariant } from './Button.types';

interface StyledButtonProps {
  $variant?: ButtonVariant;
  $size?: ButtonSize;
  $fullWidth?: boolean;
  $isLoading?: boolean;
  $isPill?: boolean;
}

const variantStyles = {
  primary: (theme: Theme) => `
    background: ${theme.colors.brand.primary};
    color: ${theme.colors.text.inverse};
    border-color: ${theme.colors.brand.primary};

    &:hover:not(:disabled) {
      background: ${theme.colors.brand.primaryHover};
      border-color: ${theme.colors.brand.primaryHover};
      transform: translateY(-1px);
      box-shadow: ${theme.shadows.sm};
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: none;
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
      transform: translateY(-1px);
      box-shadow: ${theme.shadows.sm};
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  `,

  danger: (theme: Theme) => `
    background: ${theme.colors.semantic.error};
    color: ${theme.colors.text.inverse};
    border-color: ${theme.colors.semantic.error};

    &:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-1px);
      box-shadow: ${theme.shadows.sm};
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  `,
};

const sizeStyles = {
  sm: (theme: Theme) => `
    padding: 8px 16px;
    font-size: ${theme.typography.fontSize.xs};
    height: 34px;
  `,

  md: (theme: Theme) => `
    padding: 10px 20px;
    font-size: ${theme.typography.fontSize.sm};
    height: 42px;
  `,

  lg: (theme: Theme) => `
    padding: 14px 28px;
    font-size: ${theme.typography.fontSize.md};
    height: 52px;
    font-weight: ${theme.typography.fontWeight.semibold};
  `,
};

const ButtonContainer = styled.button<StyledButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => tkn('spacing.sm')(p as any)};

  border-radius: ${(p) => (p.$isPill ? tkn('radius.full')(p as any) : tkn('radius.sm')(p as any))};
  border: 1px solid transparent;
  font-weight: ${(p) => tkn('typography.fontWeight.medium')(p as any)};
  font-family: ${(p) => tkn('typography.fontFamily.sans')(p as any)};

  cursor: pointer;
  white-space: nowrap;
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);

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
        width: 20px;
        height: 20px;
        top: 50%;
        left: 50%;
        margin-left: -10px;
        margin-top: -10px;
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
    background: ${tkn('colors.border.secondary')};
    border-color: ${tkn('colors.border.primary')};
    color: ${tkn('colors.text.tertiary')};
    box-shadow: none !important;
    transform: none !important;
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px ${(p) => p.theme.colors.brand.secondary};
  }
`;

export const S = {
  ButtonContainer,
};
