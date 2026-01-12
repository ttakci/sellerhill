import styled, { css } from 'styled-components';

import { tkn } from '../../theme/tkn';

import type { InputSize, InputVariant } from './Input.types';

interface StyledInputProps {
  $size?: InputSize;
  $variant?: InputVariant;
  $fullWidth?: boolean;
}

const sizeStyles = {
  sm: css`
    padding: 8px 12px;
    font-size: 13px;
    height: 36px;
  `,

  md: css`
    padding: 12px 16px;
    font-size: 15px;
    height: 48px;
  `,

  lg: css`
    padding: 16px 20px;
    font-size: 15px;
    height: 64px;
  `,
};

const variantStyles = {
  default: css`
    border-color: ${tkn('colors.border.primary')};

    &:hover:not(:disabled) {
      border-color: ${tkn('colors.brand.primary')};
    }

    &:focus {
      outline: none;
      border-color: ${tkn('colors.brand.primary')};
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
    }
  `,

  error: css`
    border-color: ${tkn('colors.semantic.error')};

    &:focus {
      outline: none;
      border-color: ${tkn('colors.semantic.error')};
      box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.1);
    }
  `,

  success: css`
    border-color: ${tkn('colors.semantic.success')};

    &:focus {
      outline: none;
      border-color: ${tkn('colors.semantic.success')};
      box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.1);
    }
  `,
};

const InputField = styled.input<StyledInputProps>`
  display: flex;
  align-items: center;
  width: ${(p) => (p.$fullWidth ? '100%' : 'auto')};
  box-sizing: border-box;

  border-radius: 8px;
  border: 1px solid;

  color: #373839;
  background: #ffffff;

  font-family:
    'Lexend',
    -apple-system,
    BlinkMacSystemFont,
    'Segoe UI',
    sans-serif;
  font-weight: 500;
  line-height: 22px;

  transition: all ${tkn('transitions.fast')};

  /* Size styles */
  ${(p) => sizeStyles[p.$size || 'md']}

  /* Variant styles */
  ${(p) => variantStyles[p.$variant || 'default']}
  
  &::placeholder {
    color: ${tkn('colors.text.secondary')};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    background: ${tkn('colors.border.primary')};
  }
`;

const InputWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

const HelperText = styled.span<{ $variant?: 'error' | 'success' }>`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${(p) =>
    p.$variant === 'error'
      ? tkn('colors.semantic.error')
      : p.$variant === 'success'
        ? tkn('colors.brand.primary')
        : tkn('colors.text.secondary')};
`;

export const S = {
  InputField,
  InputWrapper,
  HelperText,
};
