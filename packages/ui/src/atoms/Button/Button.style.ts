import { css } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import { ActionSurfaceProps, ButtonSize } from './Button.types';

/** Align medium/small with compact form-control heights (SearchField / Select). */
const getBaseHeight = (size: ButtonSize) => {
  switch (size) {
    case 'xsmall':
      return '2rem'; /* 32px */
    case 'small':
      return '2.5rem'; /* 40px — matches control small compact */
    case 'large':
      return '3.25rem'; /* 52px — matches control medium labeled */
    case 'medium':
    default:
      return '2.75rem'; /* 44px — matches control medium compact */
  }
};

const getPadding = (size: ButtonSize) => {
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

const getMinWidth = (size: ButtonSize): string => {
  switch (size) {
    case 'xsmall':
      return '5rem'; /* 80px */
    case 'small':
      return '6.25rem'; /* 100px */
    case 'large':
      return '9rem'; /* 144px */
    case 'medium':
    default:
      return '7.5rem'; /* 120px */
  }
};

const getFontSize = (size: ButtonSize): string => {
  switch (size) {
    case 'xsmall':
      return '0.875rem'; /* 14px */
    case 'small':
      return '0.9375rem'; /* 15px */
    case 'large':
      return '1.0625rem'; /* 17px */
    case 'medium':
    default:
      return '1rem'; /* 16px — primary UI actions */
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

  ${({ $fullWidth, $iconOnly, $size, $variant }) => {
    if ($fullWidth) {return 'width: 100%;';}
    if ($iconOnly) {return `width: ${getBaseHeight($size)};`;}
    if ($variant === 'text') {return 'width: auto;';}
    return `min-width: ${getMinWidth($size)}; width: auto;`;
  }}
  height: ${({ $size }) => getBaseHeight($size)};
  padding: ${({ $iconOnly, $size }) => ($iconOnly ? '0' : getPadding($size))};
  gap: ${tkn('spacing.sm')};

  border-radius: ${tkn('radius.md')};
  font-family: ${tkn('typography.fontFamily.sans')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-size: ${({ $size }) => getFontSize($size)};
  letter-spacing: ${tkn('typography.letterSpacing.normal')};

  transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);

  /* Force nested content (Text spans, Icon wrappers) to inherit the button's
     variant color, so Text's default text.primary doesn't override it.
     Descendant combinator (not direct-child) because children are wrapped in
     ButtonLabel — a direct-child selector would miss the Text span inside. */
  & span,
  & div {
    color: inherit;
  }

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'primary':
        return css`
          background-color: ${theme.colors.brand.primary};
          color: ${theme.colors.text.inverse};
          box-shadow: 0 0.25rem 0.875rem 0 ${theme.colors.brand.primary}40;

          &:hover:not(:disabled) {
            background-color: ${theme.colors.brand.primaryHover};
            filter: ${theme.mode === 'dark' ? 'brightness(1.08)' : 'brightness(0.92)'};
            box-shadow: 0 0.5rem 1.5rem 0 ${theme.colors.brand.primary}50;
          }

          &:active:not(:disabled) {
            filter: brightness(1);
            box-shadow: 0 0.125rem 0.5rem 0 ${theme.colors.brand.primary}40;
            background-color: ${theme.colors.brand.primary};
          }
        `;
      case 'secondary':
        /* Outline: blue border + blue text, transparent/surface fill (dialog reference) */
        return css`
          background-color: ${theme.colors.surface.primary};
          color: ${theme.colors.brand.primary};
          border: 0.0625rem solid ${theme.colors.brand.primary};

          &:hover:not(:disabled) {
            background-color: ${theme.mode === 'dark'
              ? `${theme.colors.brand.primary}18`
              : theme.colors.brand.secondary};
            border-color: ${theme.colors.brand.primaryHover};
            color: ${theme.colors.brand.primaryHover};
            box-shadow: 0 0.25rem 0.625rem 0 ${theme.colors.brand.primary}18;
          }

          &:active:not(:disabled) {
            box-shadow: none;
            background-color: ${theme.mode === 'dark'
              ? `${theme.colors.brand.primary}12`
              : theme.colors.brand.secondary};
          }
        `;
      case 'tertiary':
        /* Alias of outline secondary — keep for existing call sites */
        return css`
          background-color: transparent;
          color: ${theme.colors.brand.primary};
          border: 0.0625rem solid ${theme.colors.brand.primary};

          &:hover:not(:disabled) {
            background-color: ${theme.mode === 'dark'
              ? `${theme.colors.brand.primary}18`
              : `${theme.colors.brand.primary}15`};
            box-shadow: 0 0.25rem 0.625rem 0 ${theme.colors.brand.primary}18;
          }

          &:active:not(:disabled) {
            box-shadow: none;
            background-color: ${theme.mode === 'dark'
              ? `${theme.colors.brand.primary}12`
              : `${theme.colors.brand.primary}08`};
          }
        `;
      case 'text':
        return css`
          background-color: transparent;
          color: ${theme.colors.text.secondary};
          padding: 0 0.75rem;
          height: auto;
          min-height: 2rem;

          &:hover:not(:disabled) {
            color: ${theme.colors.brand.primary};
            background-color: ${theme.colors.brand.primary}10;
            filter: ${theme.mode === 'dark' ? 'brightness(1.08)' : 'brightness(0.92)'};
          }

          &:active:not(:disabled) {
            filter: brightness(1);
            background-color: ${theme.colors.brand.primary}05;
          }
        `;
      case 'danger':
        /* Filled danger (solid) — white label on error tone */
        return css`
          background-color: ${theme.colors.semantic.error};
          color: ${theme.colors.text.inverse};
          border: 0.0625rem solid ${theme.colors.semantic.error};
          box-shadow: 0 0.25rem 0.875rem 0 ${theme.colors.semantic.error}40;

          &:hover:not(:disabled) {
            filter: ${theme.mode === 'dark' ? 'brightness(1.1)' : 'brightness(0.92)'};
            box-shadow: 0 0.5rem 1.5rem 0 ${theme.colors.semantic.error}45;
          }

          &:active:not(:disabled) {
            filter: brightness(1);
            box-shadow: 0 0.125rem 0.5rem 0 ${theme.colors.semantic.error}35;
          }
        `;
    }
  }}

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    filter: grayscale(0.5);
    box-shadow: none !important;
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
  gap: ${tkn('spacing.xs')};
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
