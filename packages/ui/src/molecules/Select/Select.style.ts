import styled from '@emotion/styled';

import {
  CONTROL_ICON_WIDTH,
  CONTROL_PADDING_X,
  controlFocusShadow,
  controlHeight,
  type ControlSize,
} from '../../styles/formControl';
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
  $size?: ControlSize;
  $hasLabel?: boolean;
}>`
  display: flex;
  align-items: center;
  position: relative;
  height: ${({ $size = 'medium', $hasLabel }) => controlHeight($size, !!$hasLabel)};
  background: ${({ theme, $isDisabled }) =>
    $isDisabled ? theme.colors.background.tertiary : theme.colors.surface.primary};
  border: 0.0625rem solid
    ${({ $isFocused, $hasError, theme }) =>
      $hasError
        ? theme.colors.semantic.error
        : $isFocused
          ? theme.colors.brand.primary
          : theme.colors.border.primary};
  border-radius: ${tkn('radius.md')};
  padding: 0 ${CONTROL_PADDING_X};
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};
  cursor: ${({ $isDisabled }) => ($isDisabled ? 'not-allowed' : 'pointer')};
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  opacity: ${({ $isDisabled }) => ($isDisabled ? 0.5 : 1)};
  box-shadow: ${({ $isFocused, theme }) =>
    $isFocused ? controlFocusShadow(theme.colors.brand.primary) : 'none'};
  box-sizing: border-box;

  &:hover {
    border-color: ${({ $isFocused, $hasError, $isDisabled, theme }) =>
      !$isDisabled && !$isFocused && !$hasError ? theme.colors.text.tertiary : undefined};
  }
`;

export const ValueDisplay = styled.div<{ $hasIconLeft: boolean; $hasLabel: boolean; $size?: string }>`
  flex: 1;
  font-size: ${tkn('typography.fontSize.md')};
  font-family: ${tkn('typography.fontFamily.body')};
  color: ${tkn('colors.text.primary')};
  /* Push value down so it clears the floated label with comfortable gap */
  padding-top: ${({ $hasLabel, $size }) => {
    if (!$hasLabel) {
      return '0';
    }
    if ($size === 'small') {
      return '1.125rem';
    }
    if ($size === 'large') {
      return '1.5rem';
    }
    return '1.375rem'; /* medium — ~8–10px below scaled label */
  }};
  padding-bottom: ${({ $hasLabel }) => ($hasLabel ? '0.25rem' : '0')};
  padding-left: ${({ $hasIconLeft }) => ($hasIconLeft ? CONTROL_ICON_WIDTH : '0')};
  line-height: ${tkn('typography.lineHeight.tight')};
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
  left: ${({ $hasIconLeft }) => ($hasIconLeft ? CONTROL_ICON_WIDTH : CONTROL_PADDING_X)};
  right: ${CONTROL_PADDING_X};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  transition:
    transform ${tkn('transitions.fast')},
    color ${tkn('transitions.fast')},
    font-size ${tkn('transitions.fast')};
  transform-origin: top left;
  z-index: 1;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};

  color: ${({ theme, $isFocused, $hasError, $isDisabled }) => {
    if ($isDisabled) {
      return theme.colors.text.disabled;
    }
    if ($hasError) {
      return theme.colors.semantic.error;
    }
    if ($isFocused) {
      return theme.colors.brand.primary;
    }
    return theme.colors.text.tertiary;
  }};

  ${({ $isFocused, $hasValue, $size, theme }) => {
    const isSmall = $size === 'small';
    const isLarge = $size === 'large';
    const isActive = $isFocused || $hasValue;

    if (isActive) {
      /* Sit near the top edge so value has clear breathing room below */
      const y = isSmall ? '0.375rem' : isLarge ? '0.5rem' : '0.4375rem';
      return `
        transform: translateY(${y}) scale(0.75);
        font-weight: ${tkn('typography.fontWeight.semibold')({ theme })};
      `;
    }

    const y = isSmall ? '0.875rem' : isLarge ? '1.375rem' : '1.125rem';
    return `
      transform: translateY(${y}) scale(1);
      font-weight: ${tkn('typography.fontWeight.normal')({ theme })};
    `;
  }}
`;

export const DecorationWrapper = styled.div<{ $side: 'left' | 'right'; $size?: string }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  ${({ $side }) => ($side === 'left' ? 'left: 0;' : 'right: 0;')}
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${CONTROL_ICON_WIDTH};
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
  padding: ${tkn('spacing.xs+')} ${tkn('spacing.sm+')};
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
  padding: ${tkn('spacing.xs')};

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
  padding: ${tkn('spacing.sm')} ${tkn('spacing.sm+')};
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
  gap: ${tkn('spacing.sm')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
`;

export const ErrorText = styled.span`
  color: ${tkn('colors.semantic.error')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  font-family: ${tkn('typography.fontFamily.body')};
  margin-top: ${tkn('spacing.2xs')};
  margin-left: ${tkn('spacing.2xs')};
`;

export const NoResultsMessage = styled.div`
  padding: ${tkn('spacing.md')};
  text-align: center;
  opacity: 0.5;
`;

export const SafeAreaSpacer = styled.div`
  height: 2rem;
  flex-shrink: 0;
`;

/* Bottom Sheet Styles */
export const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${tkn('colors.surface.overlay')};
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
  max-height: 70vh;
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

export const BottomSheetTitle = styled.div`
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
  width: 2rem;
  height: 0.25rem;
  background: ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.full')};
  margin: ${tkn('spacing.sm')} auto ${tkn('spacing.md')};
  flex-shrink: 0;
`;

export const MobileOption = styled.div<{ $isSelected: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 3.25rem;
  padding: 0 ${tkn('spacing.sm')};
  width: 100%;
  border: none;
  background: transparent;
  color: ${({ theme, $isSelected }) =>
    $isSelected ? theme.colors.brand.primary : theme.colors.text.primary};
  font-size: ${tkn('typography.fontSize.md')};
  cursor: pointer;

  &:active {
    background-color: ${({ theme }) => theme.colors.background.tertiary};
  }
`;
