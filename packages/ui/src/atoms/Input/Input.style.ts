import { Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { InputSize, InputVariant } from './Input.types';

interface StyledInputProps {
  $size?: InputSize;
  $variant?: InputVariant;
  $fullWidth?: boolean;
}

const sizeStyles = {
  sm: (theme: Theme) => `
    padding: 8px 12px;
    font-size: ${theme.typography.fontSize.xs};
    height: 38px;
  `,

  md: (theme: Theme) => `
    padding: 10px 16px;
    font-size: ${theme.typography.fontSize.sm};
    height: 44px;
  `,

  lg: (theme: Theme) => `
    padding: 14px 20px;
    font-size: ${theme.typography.fontSize.md};
    height: 54px;
    font-weight: ${theme.typography.fontWeight.medium};
  `,
};

const variantStyles = {
  default: (theme: Theme) => `
    border-color: ${theme.colors.border.primary};
    background: ${theme.colors.background.secondary};

    &:hover:not(:disabled) {
      border-color: ${theme.colors.border.focus};
    }

    &:focus {
      outline: none;
      border-color: ${theme.colors.border.focus};
      box-shadow: 0 0 0 3px ${theme.colors.brand.secondary};
    }
  `,

  error: (theme: Theme) => `
    border-color: ${theme.colors.semantic.error};
    background: ${theme.colors.surface.primary};

    &:focus {
      outline: none;
      border-color: ${theme.colors.semantic.error};
      box-shadow: 0 0 0 3px ${theme.colors.semantic.error}20;
    }
  `,

  success: (theme: Theme) => `
    border-color: ${theme.colors.semantic.success};
    background: ${theme.colors.surface.primary};

    &:focus {
      outline: none;
      border-color: ${theme.colors.semantic.success};
      box-shadow: 0 0 0 3px ${theme.colors.semantic.success}20;
    }
  `,
};

const InputField = styled.input<StyledInputProps>`
  display: flex;
  align-items: center;
  width: ${(p) => (p.$fullWidth ? '100%' : 'auto')};
  box-sizing: border-box;

  border-radius: ${(p) => tkn('radius.sm')(p as any)};
  border: 1px solid;

  color: ${(p) => tkn('colors.text.primary')(p as any)};
  background: ${(p) => tkn('colors.background.secondary')(p as any)};

  font-family: ${(p) => tkn('typography.fontFamily.sans')(p as any)};
  font-weight: ${(p) => tkn('typography.fontWeight.normal')(p as any)};
  font-size: ${(p) => tkn('typography.fontSize.sm')(p as any)};
  line-height: ${(p) => tkn('typography.lineHeight.normal')(p as any)};

  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);

  /* Size styles */
  ${(p) => sizeStyles[p.$size || 'md'](p.theme as Theme)}

  /* Variant styles */
  ${(p) => variantStyles[p.$variant || 'default'](p.theme as Theme)}
  
  &::placeholder {
    color: ${(p) => tkn('colors.text.tertiary')(p as any)};
    transition: color ${tkn('transitions.fast')};
  }
  
  &:focus::placeholder {
    color: ${(p) => tkn('colors.text.disabled')(p as any)};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
    background: ${(p) => tkn('colors.background.tertiary')(p as any)};
    border-color: ${(p) => tkn('colors.border.primary')(p as any)};
  }

  &:-webkit-autofill,
  &:-webkit-autofill:hover,
  &:-webkit-autofill:focus,
  &:-webkit-autofill:active {
    transition: background-color 5000s ease-in-out 0s;
    -webkit-text-fill-color: ${(p) => tkn('colors.text.primary')(p as any)};
    caret-color: ${(p) => tkn('colors.text.primary')(p as any)};
  }
`;

const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => tkn('spacing.xs')(p as any)};
  width: 100%;
`;

const HelperText = styled.span<{ $variant?: 'error' | 'success' }>`
  font-size: ${(p) => tkn('typography.fontSize.xs')(p as any)};
  margin-top: ${(p) => tkn('spacing.xs')(p as any)};
  color: ${(p) => {
    const variant = p.$variant;
    if (variant === 'error') return tkn('colors.semantic.error')(p as any);
    if (variant === 'success') return tkn('colors.semantic.success')(p as any);
    return tkn('colors.text.secondary')(p as any);
  }};
  font-weight: ${(p) => tkn('typography.fontWeight.medium')(p as any)};
`;

export const S = {
  InputField,
  InputWrapper,
  HelperText,
};
