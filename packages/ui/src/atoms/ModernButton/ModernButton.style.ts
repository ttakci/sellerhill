import { css } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import { ModernButtonSize, ModernButtonVariant } from './ModernButton.types';

interface ActionSurfaceProps {
  $variant: ModernButtonVariant;
  $size: ModernButtonSize;
  $fullWidth?: boolean;
  $isLoading?: boolean;
  $iconColor?: string;
}

const getBaseHeight = (size: ModernButtonSize) => {
  switch (size) {
    case 'xsmall':
      return '2rem'; /* 32px */
    case 'small':
      return '2.5rem'; /* 40px */
    case 'large':
      return '3.25rem'; /* 52px */
    case 'medium':
    default:
      return '2.75rem'; /* 44px */
  }
};

const getPadding = (size: ModernButtonSize) => {
  switch (size) {
    case 'xsmall':
      return '0 0.75rem'; /* 12px */
    case 'small':
      return '0 1rem'; /* 16px */
    case 'large':
      return '0 1.5rem'; /* 24px */
    case 'medium':
    default:
      return '0 1.25rem'; /* 20px */
  }
};

export const ActionSurface = styled.button<ActionSurfaceProps>`
  all: unset;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  cursor: pointer;
  white-space: nowrap;
  position: relative;
  overflow: hidden;

  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  height: ${({ $size }) => getBaseHeight($size)};
  padding: ${({ $size }) => getPadding($size)};
  gap: ${tkn('spacing.sm')};

  border-radius: ${tkn('radius.md')};
  font-family: ${tkn('typography.fontFamily.sans')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-size: ${({ $size }) => ($size === 'large' ? '1rem' : '0.875rem')};

  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'primary':
        return css`
          background-color: ${theme.colors.brand.primary};
          color: ${theme.colors.text.inverse};
          box-shadow: 0 0.25rem 0.875rem 0 ${theme.colors.brand.primary}40; /* 4px 14px */

          &:hover:not(:disabled) {
            background-color: ${theme.colors.brand.primary}ee;
            transform: translateY(-0.0625rem); /* 1px */
            box-shadow: 0 0.375rem 1.25rem 0 ${theme.colors.brand.primary}50; /* 6px 20px */
          }

          &:active:not(:disabled) {
            transform: translateY(0.0625rem); /* 1px */
            box-shadow: 0 0.125rem 0.5rem 0 ${theme.colors.brand.primary}40; /* 2px 8px */
          }
        `;
      case 'secondary':
        return css`
          background-color: ${theme.colors.background.secondary};
          color: ${theme.colors.text.primary};
          border: 0.0625rem solid ${theme.colors.border.primary}; /* 1px */

          &:hover:not(:disabled) {
            background-color: ${theme.colors.background.primary};
            border-color: ${theme.colors.brand.primary}80;
          }
        `;
      case 'tertiary':
        return css`
          background-color: transparent;
          color: ${theme.colors.brand.primary};
          border: 0.0625rem solid ${theme.colors.brand.primary}; /* 1px */

          &:hover:not(:disabled) {
            background-color: ${theme.colors.brand.primary}10;
          }
        `;
      case 'text':
        return css`
          background-color: transparent;
          color: ${theme.colors.text.secondary};
          padding: 0 0.75rem; /* 12px */
          height: auto;
          min-height: 2rem; /* 32px */

          &:hover:not(:disabled) {
            color: ${theme.colors.brand.primary};
            background-color: ${theme.colors.brand.primary}08;
          }
        `;
      case 'danger':
        return css`
          background-color: ${theme.colors.background.secondary};
          color: ${theme.colors.semantic.error};
          border: 0.0625rem solid ${theme.colors.semantic.error}40;

          &:hover:not(:disabled) {
            background-color: ${theme.colors.semantic.error}08;
            border-color: ${theme.colors.semantic.error};
          }
        `;
    }
  }}

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    filter: grayscale(0.5);
    box-shadow: none !important;
    transform: none !important;
  }

  ${({ $isLoading }) =>
    $isLoading &&
    css`
      pointer-events: none;
      & > *:not(.loader) {
        opacity: 0;
      }
    `}
`;

export const ButtonLabel = styled.span`
  display: flex;
  align-items: center;
  gap: inherit;
`;

export const LoadingContainer = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  gap: 0.25rem; /* 4px */
`;

export const LoadingDot = styled.div<{ $delay: string }>`
  width: 0.375rem; /* 6px */
  height: 0.375rem; /* 6px */
  background-color: currentColor;
  border-radius: 50%;
  animation: bounce 1.2s infinite ease-in-out both;
  animation-delay: ${({ $delay }) => $delay};

  @keyframes bounce {
    0%,
    80%,
    100% {
      transform: scale(0);
    }
    40% {
      transform: scale(1);
    }
  }
`;
