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
      transform: translateY(-0.0625rem); /* 1px */
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
      transform: translateY(-0.0625rem); /* 1px */
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
      transform: translateY(-0.0625rem); /* 1px */
      box-shadow: ${theme.shadows.sm};
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  `,

  success: (theme: Theme) => `
    background: ${theme.colors.semantic.success};
    color: ${theme.colors.text.inverse};
    border-color: ${theme.colors.semantic.success};

    &:hover:not(:disabled) {
      opacity: 0.9;
      transform: translateY(-0.0625rem); /* 1px */
      box-shadow: ${theme.shadows.sm};
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }
  `,
};

const sizeStyles = {
  sm: (theme: Theme) => `
    padding: 0.5rem 1rem;
    font-size: ${theme.typography.fontSize.xs};
    height: 2.125rem;
  `,

  md: (theme: Theme) => `
    padding: 0.625rem 1.25rem;
    font-size: ${theme.typography.fontSize.sm};
    height: 2.625rem;
  `,

  lg: (theme: Theme) => `
    padding: 0.875rem 1.75rem;
    font-size: ${theme.typography.fontSize.md};
    height: 3.25rem;
    font-weight: ${theme.typography.fontWeight.semibold};
  `,
};

const ButtonContainer = styled.button<StyledButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${(p) => tkn('spacing.sm')(p as any)};

  border-radius: ${(p) => (p.$isPill ? tkn('radius.full')(p as any) : tkn('radius.sm')(p as any))};
  border: 0.0625rem solid transparent; /* 1px */
  font-weight: ${(p) => tkn('typography.fontWeight.medium')(p as any)};
  font-family: ${(p) => tkn('typography.fontFamily.sans')(p as any)};

  cursor: pointer;
  white-space: nowrap;
  transition:
    transform ${tkn('transitions.normal')},
    background-color ${tkn('transitions.normal')},
    border-color ${tkn('transitions.normal')},
    box-shadow ${tkn('transitions.normal')};

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
        width: 1.25rem;
        height: 1.25rem;
        top: 50%;
        left: 50%;
        margin-left: -0.625rem;
        margin-top: -0.625rem;
        border: 0.125rem solid currentColor;
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
    box-shadow: 0 0 0 0.1875rem ${(p) => p.theme.colors.brand.secondary}; /* 3px */
  }
`;

export const S = {
  ButtonContainer,
};
