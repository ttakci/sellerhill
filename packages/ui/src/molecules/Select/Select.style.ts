import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div<{ $fullWidth?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  position: relative;
  box-sizing: border-box;
`;

export const FieldWrapper = styled.div<{
  $isFocused: boolean;
  $hasError: boolean;
  $isDisabled: boolean;
  $fullWidth?: boolean;
  $size?: 'small' | 'medium' | 'large';
  $hasLabel?: boolean;
}>`
  display: flex;
  align-items: center;
  position: relative;
  height: ${({ $size }) => ($size === 'small' ? '2.25rem' : $size === 'large' ? '3rem' : '2.5rem')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid
    ${({ $isFocused, $hasError, theme }) =>
      $hasError
        ? theme.colors.semantic.error
        : $isFocused
          ? theme.colors.brand.primary
          : theme.colors.border.primary};
  border-radius: ${tkn('radius.md')};
  padding: 0 ${({ $size }) => ($size === 'small' ? tkn('spacing.sm') : tkn('spacing.md'))};
  transition: all ${tkn('transitions.fast')};
  cursor: ${({ $isDisabled }) => ($isDisabled ? 'not-allowed' : 'pointer')};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  opacity: ${({ $isDisabled }) => ($isDisabled ? 0.5 : 1)};
  box-shadow: ${({ $isFocused, theme }) =>
    $isFocused ? `0 0 0 0.1875rem ${theme.colors.brand.primary}15` : 'none'};
  box-sizing: border-box;

  &:hover {
    border-color: ${({ $isFocused, $hasError, $isDisabled, theme }) =>
      !$isDisabled && !$isFocused && !$hasError ? theme.colors.text.tertiary : 'inherit'};
  }
`;

export const ValueDisplay = styled.div<{ $hasIconLeft: boolean; $hasLabel: boolean; $size?: string }>`
  flex: 1;
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.primary')};
  padding-top: ${({ $hasLabel, $size }) => {
    if (!$hasLabel) return '0';
    if ($size === 'small') return '0.75rem';
    if ($size === 'large') return '1rem';
    return '0.875rem';
  }};
  padding-left: ${({ $hasIconLeft, $size }) => ($hasIconLeft ? ($size === 'small' ? '1.5rem' : '2rem') : '0')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: ${tkn('typography.fontWeight.normal')};
`;

export const FloatingLabel = styled.label<{
  $isFocused: boolean;
  $hasValue: boolean;
  $isDisabled: boolean;
  $hasIconLeft: boolean;
  $hasError: boolean;
  $size?: string;
}>`
  position: absolute;
  top: 0;
  left: ${({ $hasIconLeft, $size }) =>
    $hasIconLeft
      ? $size === 'small'
        ? '2rem'
        : '2.75rem'
      : $size === 'small'
        ? tkn('spacing.sm')
        : tkn('spacing.md')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  transition:
    transform 0.15s ease,
    color 0.15s ease,
    font-size 0.15s ease;
  transform-origin: top left;
  z-index: 1;

  color: ${({ theme, $isFocused, $hasError, $isDisabled }) => {
    if ($isDisabled) return theme.colors.text.disabled;
    if ($hasError) return theme.colors.semantic.error;
    if ($isFocused) return theme.colors.brand.primary;
    return theme.colors.text.tertiary;
  }};

  ${({ $isFocused, $hasValue, $size }) => {
    const isSmall = $size === 'small';
    const isActive = $isFocused || $hasValue;

    if (isActive) {
      const y = isSmall ? '0.375rem' : '0.5rem';
      return `
        transform: translateY(${y}) scale(0.75);
        font-weight: ${tkn('typography.fontWeight.semibold')};
      `;
    }

    const y = isSmall ? '0.5rem' : '1rem';
    return `
      transform: translateY(${y}) scale(1);
      font-weight: ${tkn('typography.fontWeight.normal')};
    `;
  }}

  font-size: ${tkn('typography.fontSize.sm')};
`;

export const DecorationWrapper = styled.div<{ $side: 'left' | 'right'; $size?: string }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${({ $side, $size }) =>
    $side === 'left'
      ? `left: ${$size === 'small' ? '0.5rem' : '0.75rem'};`
      : `right: ${$size === 'small' ? '0.5rem' : '0.75rem'};`}
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.text.tertiary')};
  pointer-events: none;
`;

export const DropdownContainer = styled.div<{ $placement?: 'bottom' | 'top' }>`
  position: absolute;
  top: calc(100% + 0.25rem);
  left: 0;
  right: 0;
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  box-shadow: ${tkn('shadows.lg')};
  z-index: 1000;
  overflow: hidden;
  animation: ${({ $placement }) => ($placement === 'top' ? 'slideFadeUp' : 'slideFadeDown')} ${tkn('transitions.fast')};

  @keyframes slideFadeDown {
    from {
      opacity: 0;
      transform: translateY(-0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideFadeUp {
    from {
      opacity: 0;
      transform: translateY(0.5rem);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

export const SearchWrapper = styled.div`
  padding: ${tkn('spacing.sm')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const SearchInput = styled.input`
  width: 100%;
  padding: 0.375rem 0.625rem;
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.background.tertiary')};
  font-size: ${tkn('typography.fontSize.sm')};
  outline: none;
  color: ${tkn('colors.text.primary')};

  &:focus {
    border-color: ${tkn('colors.brand.primary')};
  }
`;

export const OptionsList = styled.div`
  max-height: 15rem;
  overflow-y: auto;
  padding: 0.25rem;

  &::-webkit-scrollbar {
    width: 0.25rem;
  }
  &::-webkit-scrollbar-thumb {
    background: ${tkn('colors.border.primary')};
    border-radius: 0.5rem;
  }
`;

export const OptionItem = styled.div<{ $isSelected: boolean; $isFocused: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.625rem;
  border-radius: ${tkn('radius.sm')};
  cursor: pointer;
  background: ${({ $isSelected, $isFocused, theme }) =>
    $isSelected ? `${theme.colors.brand.primary}10` : $isFocused ? theme.colors.background.tertiary : 'transparent'};
  color: ${({ $isSelected, theme }) => ($isSelected ? theme.colors.brand.primary : theme.colors.text.primary)};
  transition: background-color 0.1s ease;

  &:hover {
    background: ${({ $isSelected, theme }) =>
      $isSelected ? `${theme.colors.brand.primary}15` : theme.colors.background.tertiary};
  }
`;

export const OptionContent = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
`;

export const ErrorText = styled.span`
  color: ${tkn('colors.semantic.error')};
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  margin-left: ${tkn('spacing.xs')};
`;

/* Bottom Sheet Styles */
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 2000;
  display: flex;
  align-items: flex-end;
  animation: fadeIn ${tkn('transitions.fast')};

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

export const BottomSheet = styled.div`
  width: 100%;
  background: ${tkn('colors.surface.primary')};
  border-top-left-radius: ${tkn('radius.xl')};
  border-top-right-radius: ${tkn('radius.xl')};
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  animation: slideUp ${tkn('transitions.normal')};

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;

export const BottomSheetHeader = styled.div`
  padding: ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const BottomSheetTitle = styled.h3`
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  margin: 0;
`;

export const CloseButton = styled.button`
  background: ${tkn('colors.background.tertiary')};
  border: none;
  width: 1.75rem;
  height: 1.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${tkn('colors.text.secondary')};
  cursor: pointer;
  transition: background-color ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.border.primary')};
  }
`;

export const Handle = styled.div`
  width: 2.5rem;
  height: 0.25rem;
  background: ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  margin: 0.625rem auto 0;
`;
