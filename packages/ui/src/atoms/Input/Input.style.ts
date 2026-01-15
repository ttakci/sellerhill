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
    font-size: ${theme.typography.fontSize.sm};
    height: 38px;
  `,

  md: (theme: Theme) => `
    padding: 10px 16px;
    font-size: ${theme.typography.fontSize.md};
    height: 48px;
  `,

  lg: (theme: Theme) => `
    padding: 12px 20px;
    font-size: ${theme.typography.fontSize.md};
    height: 56px;
    font-weight: ${theme.typography.fontWeight.medium};
  `,
};

const variantStyles = {
  default: (theme: Theme) => `
    border-color: ${theme.colors.border.primary};
    background: ${theme.colors.background.secondary};

    &:hover:not(:disabled) {
      border-color: ${theme.colors.brand.primary};
    }

    &:focus {
      outline: none;
      border-color: ${theme.colors.brand.primary};
      box-shadow: ${theme.shadows.sm};
    }
  `,

  error: (theme: Theme) => `
    border-color: ${theme.colors.semantic.error};

    &:focus {
      outline: none;
      border-color: ${theme.colors.semantic.error};
    }
  `,

  success: (theme: Theme) => `
    border-color: ${theme.colors.semantic.success};

    &:focus {
      outline: none;
      border-color: ${theme.colors.semantic.success};
    }
  `,
};

const InputField = styled.input<StyledInputProps>`
  display: flex;
  align-items: center;
  width: ${(p) => (p.$fullWidth ? '100%' : 'auto')};
  box-sizing: border-box;

  border-radius: ${(p) => tkn('radius.md')(p as any)};
  border: 1px solid;

  color: ${(p) => tkn('colors.text.primary')(p as any)};
  background: ${(p) => tkn('colors.background.secondary')(p as any)};

  font-family: ${(p) => tkn('typography.fontFamily.sans')(p as any)};
  font-weight: ${(p) => tkn('typography.fontWeight.normal')(p as any)};
  line-height: ${(p) => tkn('typography.lineHeight.normal')(p as any)};

  transition: all ${(p) => tkn('transitions.fast')(p as any)};

  /* Size styles */
  ${(p) => sizeStyles[p.$size || 'md'](p.theme as Theme)}

  /* Variant styles */
  ${(p) => variantStyles[p.$variant || 'default'](p.theme as Theme)}
  
  &::placeholder {
    color: ${(p) => tkn('colors.text.tertiary')(p as any)};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    background: ${(p) => tkn('colors.background.tertiary')(p as any)};
  }
`;

const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${(p) => tkn('spacing.xs')(p as any)};
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
`;

export const S = {
  InputField,
  InputWrapper,
  HelperText,
};
