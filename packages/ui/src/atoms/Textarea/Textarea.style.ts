import styled from '@emotion/styled';

import { CONTROL_BORDER_COLOR_PATH, CONTROL_PADDING_X } from '../../styles/formControl';
import { tkn } from '../../theme/tkn';

export const StyledTextarea = styled.textarea<{
  $fullWidth?: boolean;
  $hasError?: boolean;
  $fill?: boolean;
  $mono?: boolean;
  $hasLabel?: boolean;
  $autoResize?: boolean;
}>`
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  box-sizing: border-box;
  padding: ${tkn('spacing.sm-md')} ${CONTROL_PADDING_X};
  background-color: ${tkn('colors.background.secondary')};
  border: 0.0625rem solid
    ${({ theme, $hasError }) =>
      $hasError ? theme.colors.semantic.error : tkn(CONTROL_BORDER_COLOR_PATH)({ theme })};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
  outline: none;
  transition: border-color ${tkn('transitions.normal')};
  box-shadow: none;
  min-height: 8.75rem; /* 140px */
  resize: vertical;

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }

  &:focus {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: none;
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
    background-color: ${tkn('colors.background.tertiary')};
    border-color: ${tkn('colors.border.control')};
  }

  ${({ $mono, theme }) =>
    $mono &&
    `
    font-family: ${theme.typography.fontFamily.mono};
    line-height: ${theme.typography.lineHeight.relaxed};
  `}

  /* Reserve room at the top for the floated label. */
  ${({ $hasLabel }) =>
    $hasLabel &&
    `
    padding-top: 1.5rem;
    padding-bottom: 0.5rem;
  `}

  /* Grow with content, bounded by min/max height. */
  ${({ $autoResize }) =>
    $autoResize &&
    `
    field-sizing: content;
    max-height: 22rem;
    overflow-y: auto;
    resize: none;
  `}

  /* Occupy the whole positioned parent instead of sizing to rows. */
  ${({ $fill }) =>
    $fill &&
    `
    position: absolute;
    inset: 0;
    height: 100%;
    min-height: 0;
    margin: 0;
    resize: none;
    overflow-y: auto;
  `}
`;

export const FloatingLabel = styled.label`
  position: absolute;
  top: 0;
  left: ${CONTROL_PADDING_X};
  transform: translateY(1.5rem) scale(1);
  transform-origin: top left;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: calc(100% - ${CONTROL_PADDING_X} * 2);
  color: ${tkn('colors.text.tertiary')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.normal')};
  transition:
    transform ${tkn('transitions.fast')},
    color ${tkn('transitions.fast')};
`;

export const Container = styled.div<{ $fill?: boolean }>`
  display: flex;
  flex-direction: column;
  width: 100%;

  /* In fill mode the textarea is absolutely positioned against the caller's
     own positioned card, so this wrapper must not create a new containing
     block or reserve height of its own. */
  ${({ $fill }) =>
    $fill &&
    `
    position: static;
    height: 100%;
  `}
`;

/**
 * Wraps the textarea + its floating label. The float animation is driven purely
 * by CSS state on the bare `textarea` / `label` children (scoped to this
 * wrapper), so the atom needs no focus state of its own. The textarea carries
 * `placeholder=" "` so `:placeholder-shown` reflects emptiness.
 */
export const LabeledWrapper = styled.div`
  position: relative;
  width: 100%;

  & > textarea:focus ~ label,
  & > textarea:not(:placeholder-shown) ~ label {
    transform: translateY(0.5rem) scale(0.75);
    font-weight: ${tkn('typography.fontWeight.semibold')};
  }

  & > textarea:focus ~ label {
    color: ${tkn('colors.brand.primary')};
  }
`;
