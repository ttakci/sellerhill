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
    padding: 0.5rem 0.75rem; /* 8px 12px */
    font-size: ${theme.typography.fontSize.xs};
    height: 2.375rem; /* 38px */
  `,

  md: (theme: Theme) => `
    padding: 0.625rem 1rem; /* 10px 16px */
    font-size: ${theme.typography.fontSize.sm};
    height: 2.75rem; /* 44px */
  `,

  lg: (theme: Theme) => `
    padding: 0.875rem 1.25rem; /* 14px 20px */
    font-size: ${theme.typography.fontSize.md};
    height: 3.375rem; /* 54px */
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
      box-shadow: 0 0 0 0.25rem ${theme.colors.brand.primary}15; /* 4px */
    }
  `,

  error: (theme: Theme) => `
    border-color: ${theme.colors.semantic.error};
    background: ${theme.colors.surface.primary};

    &:focus {
      outline: none;
      border-color: ${theme.colors.semantic.error};
      box-shadow: 0 0 0 0.1875rem ${theme.colors.semantic.error}20; /* 3px */
    }
  `,

  success: (theme: Theme) => `
    border-color: ${theme.colors.semantic.success};
    background: ${theme.colors.surface.primary};

    &:focus {
      outline: none;
      border-color: ${theme.colors.semantic.success};
      box-shadow: 0 0 0 0.1875rem ${theme.colors.semantic.success}20; /* 3px */
    }
  `,
};

const ControlWrapper = styled.div<{ $fullWidth?: boolean }>`
  position: relative;
  display: flex;
  align-items: center;
  width: ${(p) => (p.$fullWidth ? '100%' : 'auto')};
`;

const IconWrapper = styled.div<{ $position: 'left' | 'right'; $size: InputSize }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  color: ${(p) => tkn('colors.text.tertiary')(p as any)};

  ${(p) => (p.$position === 'left' ? `left: 0.75rem; /* 12px */` : `right: 0.75rem; /* 12px */`)}

  svg {
    width: ${(p) => (p.$size === 'lg' ? '1.5rem' : '1.25rem')}; /* 24px : 20px */
    height: ${(p) => (p.$size === 'lg' ? '1.5rem' : '1.25rem')}; /* 24px : 20px */
  }
`;

const InputField = styled.input<StyledInputProps & { $hasLeftIcon?: boolean; $hasRightIcon?: boolean }>`
  display: flex;
  align-items: center;
  width: ${(p) => (p.$fullWidth ? '100%' : 'auto')};
  box-sizing: border-box;

  border-radius: ${(p) => tkn('radius.sm')(p as any)};
  border: 0.0625rem solid; /* 1px */

  color: ${(p) => tkn('colors.text.primary')(p as any)};
  background: ${(p) => tkn('colors.background.secondary')(p as any)};

  font-family: ${(p) => tkn('typography.fontFamily.sans')(p as any)};
  font-weight: ${(p) => tkn('typography.fontWeight.normal')(p as any)};
  font-size: ${(p) => tkn('typography.fontSize.sm')(p as any)};
  line-height: ${(p) => tkn('typography.lineHeight.normal')(p as any)};

  transition:
    border-color ${tkn('transitions.normal')},
    background-color ${tkn('transitions.normal')},
    box-shadow ${tkn('transitions.normal')};

  /* Size styles */
  ${(p) => sizeStyles[p.$size || 'md'](p.theme as Theme)}

  /* Variant styles */
  ${(p) => variantStyles[p.$variant || 'default'](p.theme as Theme)}
  
  /* Icon paddings */
  ${(p) => p.$hasLeftIcon && `padding-left: 2.5rem !important; /* 40px */`}
  ${(p) => p.$hasRightIcon && `padding-right: 2.5rem !important; /* 40px */`}
  
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
  ControlWrapper,
  IconWrapper,
  InputField,
  InputWrapper,
  HelperText,
};
