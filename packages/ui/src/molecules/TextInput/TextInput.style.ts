import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

interface FieldContainerProps {
  $isFocused: boolean;
  $hasError: boolean;
  $isDisabled: boolean;
  $fullWidth?: boolean;
  $size?: 'small' | 'medium' | 'large';
}

export const Container = styled.div<{ $fullWidth?: boolean }>`
  display: flex;
  flex-direction: column;
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  gap: ${tkn('spacing.xs')};
`;

export const FieldWrapper = styled.div<FieldContainerProps>`
  display: flex;
  position: relative;
  flex-direction: column;
  width: 100%;
  overflow: hidden;
  height: ${({ $size }) => ($size === 'small' ? '3.25rem' : $size === 'large' ? '4.25rem' : '3.75rem')};
  background-color: ${({ theme, $isDisabled }) =>
    $isDisabled ? theme.colors.background.tertiary : theme.colors.background.secondary};
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid; /* 1px */
  border-color: ${({ theme, $hasError, $isFocused }) => {
    if ($hasError && !$isFocused) {return theme.colors.semantic.error;}
    if ($isFocused) {return theme.colors.brand.primary;}
    return theme.colors.border.primary;
  }};
  transition:
    border-color 0.25s ease,
    box-shadow 0.25s ease;
  box-shadow: inset 0 0.0625rem 0.125rem ${tkn('colors.border.secondary')}; /* 1px 2px */
  cursor: ${({ $isDisabled }) => ($isDisabled ? 'not-allowed' : 'text')};

  &:focus-within {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow:
      inset 0 0.0625rem 0.125rem ${tkn('colors.border.secondary')},
      /* 1px 2px */ 0 0 0 0.0625rem ${tkn('colors.brand.primary')}20; /* 1px */
  }
`;

interface LabelProps {
  $isFocused: boolean;
  $hasValue: boolean;
  $isDisabled: boolean;
  $hasIconLeft: boolean;
  $hasError: boolean;
  $size?: 'small' | 'medium' | 'large';
}

const ICON_CONTAINER_WIDTH = '3rem'; /* 48px */

export const FloatingLabel = styled.label<LabelProps>`
  position: absolute;
  top: 0;
  left: ${({ $hasIconLeft }) => ($hasIconLeft ? ICON_CONTAINER_WIDTH : '1.125rem')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  transition:
    transform 0.2s ease,
    color 0.2s ease,
    font-size 0.2s ease;
  transform-origin: top left;

  color: ${({ theme, $isFocused, $hasError, $isDisabled }) => {
    if ($isDisabled) {return theme.colors.text.disabled;}
    if ($hasError) {return theme.colors.semantic.error;}
    if ($isFocused) {return theme.colors.brand.primary;}
    return theme.colors.text.tertiary;
  }};

  ${({ $isFocused, $hasValue, $size, theme }) => {
    const isSmall = $size === 'small';
    const isLarge = $size === 'large';
    const isActive = $isFocused || $hasValue;

    if (isActive) {
      const y = isSmall ? '0.625rem' : isLarge ? '0.875rem' : '0.75rem';
      return `
        transform: translateY(${y}) scale(0.75);
        font-weight: ${tkn('typography.fontWeight.semibold')({ theme })};
      `;
    }

    const y = isSmall ? '1rem' : isLarge ? '1.5rem' : '1.25rem';
    return `
      transform: translateY(${y}) scale(1);
      font-weight: ${tkn('typography.fontWeight.normal')({ theme })};
    `;
  }}

  font-size: ${tkn('typography.fontSize.sm')};
`;

export const Input = styled.input<{
  $hasIconLeft: boolean;
  $hasIconRight: boolean;
  $hasLabel: boolean;
  $size?: 'small' | 'medium' | 'large';
}>`
  border: none;
  background: transparent;
  width: 100%;
  height: 100%;
  padding-top: ${({ $hasLabel, $size }) => {
    if (!$hasLabel) {return '0';}
    if ($size === 'small') {return '1rem';}
    if ($size === 'large') {return '1.375rem';}
    return '1.125rem';
  }};
  padding-bottom: 0;
  padding-left: ${({ $hasIconLeft }) => ($hasIconLeft ? ICON_CONTAINER_WIDTH : '1.125rem')};
  padding-right: ${({ $hasIconRight }) => ($hasIconRight ? ICON_CONTAINER_WIDTH : '1.125rem')};

  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
  outline: none;
  opacity: 1;

  &:disabled {
    cursor: not-allowed;
  }

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const DecorationWrapper = styled.div<{ $side: 'left' | 'right'; $size?: 'small' | 'medium' | 'large' }>`
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${ICON_CONTAINER_WIDTH};
  color: ${tkn('colors.text.secondary')};
  ${({ $side }) => ($side === 'left' ? 'left: 0;' : 'right: 0;')};
  z-index: 2;
`;

export const SuffixText = styled.span`
  margin-right: ${tkn('spacing.md')};
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
`;

export const ErrorText = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.semantic.error')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  margin-top: 0.125rem; /* 2px */
  margin-left: 0.125rem; /* 2px */
`;

export const ToggleButton = styled.button`
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  width: 100%;
  height: 100%;
  transition:
    color 0.2s ease,
    transform 0.2s ease;
  opacity: 0.7;

  &:hover {
    color: ${tkn('colors.brand.primary')};
    opacity: 1;
    transform: scale(1.1);
  }

  &:active {
    transform: scale(0.95);
  }
`;
