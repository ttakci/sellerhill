import styled from '@emotion/styled';

import {
  CONTROL_BORDER_COLOR_PATH,
  CONTROL_ICON_WIDTH,
  CONTROL_PADDING_X,
  controlHeight,
  type ControlSize,
} from '../../styles/formControl';
import { tkn } from '../../theme/tkn';

interface FieldContainerProps {
  $isFocused: boolean;
  $hasError: boolean;
  $isDisabled: boolean;
  $fullWidth?: boolean;
  $size?: ControlSize;
  $hasLabel?: boolean;
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
  /* border-box so the 1px border sits inside the fixed height (otherwise every
     field is 2px taller than controlHeight and misaligns with Select /
     SearchField, which already do this), and 100% width never overflows the
     flex parent. */
  box-sizing: border-box;
  /* A flex item's default min-width is its content's min-content size. A long
     unbroken value (a pasted 2FA key, a URL) gives the inner input a large
     min-content, which - without this - pushes the wrapper past its flex
     parent, so the field renders wider than its siblings with the label and
     padding visibly misaligned. Pinning it to 0 lets overflow:hidden do its
     job and the value just scrolls inside a fixed-width field. */
  min-width: 0;
  overflow: hidden;
  height: ${({ $size = 'medium', $hasLabel }) => controlHeight($size, !!$hasLabel)};
  background-color: ${({ theme, $isDisabled }) =>
    $isDisabled ? theme.colors.background.tertiary : theme.colors.surface.primary};
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid;
  border-color: ${({ theme, $hasError, $isFocused }) => {
    if ($hasError && !$isFocused) {
      return theme.colors.semantic.error;
    }
    if ($isFocused) {
      return theme.colors.brand.primary;
    }
    return tkn(CONTROL_BORDER_COLOR_PATH)({ theme });
  }};
  transition: border-color ${tkn('transitions.fast')};
  box-shadow: none;
  cursor: ${({ $isDisabled }) => ($isDisabled ? 'not-allowed' : 'text')};

  &:focus-within {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: none;
  }
`;

interface LabelProps {
  $isFocused: boolean;
  $hasValue: boolean;
  $isDisabled: boolean;
  $hasIconLeft: boolean;
  $hasIconRight?: boolean;
  $hasError: boolean;
  $size?: ControlSize;
}

export const FloatingLabel = styled.label<LabelProps>`
  position: absolute;
  top: 0;
  left: ${({ $hasIconLeft }) => ($hasIconLeft ? CONTROL_ICON_WIDTH : CONTROL_PADDING_X)};
  /* Bound the right edge too, so a long label truncates with an ellipsis
     inside the field instead of running to the field's edge (where the
     wrapper's overflow: hidden hard-clips it with no ellipsis) or under a
     right-side icon. Without this the declared text-overflow: ellipsis never
     fires — the label element otherwise sizes to its own content. */
  right: ${({ $hasIconRight }) => ($hasIconRight ? CONTROL_ICON_WIDTH : CONTROL_PADDING_X)};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  transition:
    transform ${tkn('transitions.fast')},
    color ${tkn('transitions.fast')},
    font-size ${tkn('transitions.fast')};
  transform-origin: top left;
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

export const Input = styled.input<{
  $hasIconLeft: boolean;
  $hasIconRight: boolean;
  $hasLabel: boolean;
  $size?: ControlSize;
}>`
  border: none;
  background: transparent;
  width: 100%;
  /* THE fix for "a long value breaks the field padding": a bare input element
     is content-box (there is no global reset), so width 100% plus horizontal
     padding makes its border box wider than the wrapper. That turns the
     overflow:hidden wrapper into a scroll container, and on focus the browser
     scrolls it - dragging the absolutely-positioned label AND the input left
     until the left inset visibly collapses. border-box folds the padding into
     the 100%, so nothing ever overflows. */
  box-sizing: border-box;
  /* Same flexbox guard as FieldWrapper: an <input> in a flex container keeps
     its intrinsic (size-attr / content) min-width unless this is set, so a
     long value would otherwise stretch the field. */
  min-width: 0;
  height: 100%;
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
    return '1.375rem';
  }};
  padding-bottom: ${({ $hasLabel }) => ($hasLabel ? '0.25rem' : '0')};
  padding-left: ${({ $hasIconLeft }) => ($hasIconLeft ? CONTROL_ICON_WIDTH : CONTROL_PADDING_X)};
  padding-right: ${({ $hasIconRight }) => ($hasIconRight ? CONTROL_ICON_WIDTH : CONTROL_PADDING_X)};

  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.base')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-weight: ${tkn('typography.fontWeight.normal')};
  outline: none;
  opacity: 1;

  &:disabled {
    cursor: not-allowed;
  }

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }

  /* Native number-stepper buttons are browser chrome the design system does not
     own — every other affordance on this control is ours. Hide them so a
     type="number" field reads like every other input; a field that needs
     stepping renders its own controls. */
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  &[type='number'] {
    -moz-appearance: textfield;
    appearance: textfield;
  }
`;

export const DecorationWrapper = styled.div<{ $side: 'left' | 'right'; $size?: ControlSize }>`
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${CONTROL_ICON_WIDTH};
  color: ${tkn('colors.text.secondary')};
  ${({ $side }) => ($side === 'left' ? 'left: 0;' : 'right: 0;')};
  z-index: 2;
`;

export const SuffixText = styled.span`
  margin-right: ${tkn('spacing.md')};
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  font-family: ${tkn('typography.fontFamily.body')};
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
    color ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};
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
