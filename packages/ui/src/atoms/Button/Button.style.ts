import { css } from '@emotion/react';
import styled from '@emotion/styled';

import { controlTokens, spacingTokens, typographyTokens } from '../../theme/designTokens';
import { tkn } from '../../theme/tkn';

import { ActionSurfaceProps, ButtonSize } from './Button.types';

/**
 * Align with the shared control geometry so a Button always sits flush with the
 * field beside (or above) it. `large` deliberately matches `mediumLabeled` —
 * that is the auth-form pairing: labeled TextInput above, primary submit below.
 */
const getBaseHeight = (size: ButtonSize) => {
  switch (size) {
    case 'xsmall':
      return '2rem'; /* 32px — inline/table actions */
    case 'small':
      return controlTokens.height.small; /* 40px — matches control small compact */
    case 'large':
      return controlTokens.height.mediumLabeled; /* 56px — matches labeled field */
    case 'medium':
    default:
      return controlTokens.height.medium; /* 44px — matches control medium compact */
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

/**
 * Button labels stay on the documented type scale. The previous 15px/17px steps
 * existed nowhere else in the system — an invented 13th/14th scale step.
 * 14px is the dense-SaaS default; only `large` (hero/auth CTAs) steps up.
 */
const getFontSize = (size: ButtonSize): string =>
  size === 'large' ? typographyTokens.fontSize.md : typographyTokens.fontSize.sm;

/**
 * Colored elevation for filled variants. Neutral `shadowTokens` can't express a
 * brand-tinted glow, so the formula lives here once instead of being retyped
 * per variant per state (which is how primary and danger drifted apart).
 */
const glow = (color: string, level: 'rest' | 'hover' | 'press'): string => {
  switch (level) {
    case 'hover':
      return `0 0.5rem 1.5rem 0 ${color}50`;
    case 'press':
      return `0 0.125rem 0.5rem 0 ${color}40`;
    case 'rest':
    default:
      return `0 0.25rem 0.875rem 0 ${color}40`;
  }
};

/** Soft tinted lift for outline variants. */
const outlineGlow = (color: string): string => `0 0.25rem 0.625rem 0 ${color}18`;

export const ActionSurface = styled.button<ActionSurfaceProps>`
  all: unset;
  /* all:unset above also resets user-select, and Chrome does NOT make button text
     unselectable on its own — so pressing a button and moving the mouse a pixel
     selected its label and painted it with the OS selection colour (purple on a
     Windows accent theme). A label is not content anyone copies; the press must
     look like a press. */
  user-select: none;
  -webkit-user-select: none;
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

  transition: all ${tkn('transitions.fast')};

  /* all:unset strips the native focus ring, so keyboard users had NO visible
     focus on the most-used interactive atom in the app. Outline (not box-shadow)
     so it survives the variant-specific shadows below, with an offset that keeps
     it legible on both filled and outline variants. */
  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }

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
          box-shadow: ${glow(theme.colors.brand.primary, 'rest')};

          &:hover:not(:disabled) {
            background-color: ${theme.colors.brand.primaryHover};
            filter: ${theme.mode === 'dark' ? 'brightness(1.08)' : 'brightness(0.92)'};
            box-shadow: ${glow(theme.colors.brand.primary, 'hover')};
          }

          &:active:not(:disabled) {
            filter: brightness(1);
            box-shadow: ${glow(theme.colors.brand.primary, 'press')};
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
            box-shadow: ${outlineGlow(theme.colors.brand.primary)};
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
            box-shadow: ${outlineGlow(theme.colors.brand.primary)};
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
          padding: 0 ${spacingTokens['sm-md']};
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
          box-shadow: ${glow(theme.colors.semantic.error, 'rest')};

          &:hover:not(:disabled) {
            filter: ${theme.mode === 'dark' ? 'brightness(1.1)' : 'brightness(0.92)'};
            box-shadow: ${glow(theme.colors.semantic.error, 'hover')};
          }

          &:active:not(:disabled) {
            filter: brightness(1);
            box-shadow: ${glow(theme.colors.semantic.error, 'press')};
          }
        `;
      case 'danger-tint':
        /* Light fill, error-toned label — the same tint/border pair Badge's
           error variant uses, so a "cancel" action reads as related-but-lighter
           than the solid `danger` (delete-class) fill. */
        return css`
          background-color: ${theme.colors.semanticTint.error};
          color: ${theme.colors.semantic.error};
          border: 0.0625rem solid ${theme.colors.semanticTintBorder.error};

          &:hover:not(:disabled) {
            background-color: ${theme.colors.semanticTintBorder.error};
          }

          &:active:not(:disabled) {
            filter: brightness(0.97);
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
