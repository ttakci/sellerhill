import styled from '@emotion/styled';

import { controlFocusShadow, CONTROL_PADDING_X } from '../../styles/formControl';
import { tkn } from '../../theme/tkn';

export const StyledTextarea = styled.textarea<{
  $fullWidth?: boolean;
  $hasError?: boolean;
  $fill?: boolean;
  $mono?: boolean;
}>`
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  box-sizing: border-box;
  padding: ${tkn('spacing.sm-md')} ${CONTROL_PADDING_X};
  background-color: ${tkn('colors.background.secondary')};
  border: 0.0625rem solid
    ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)}; /* 1px */
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
  outline: none;
  transition:
    border-color ${tkn('transitions.normal')},
    box-shadow ${tkn('transitions.normal')};
  min-height: 8.75rem; /* 140px */
  resize: vertical;

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }

  &:hover:not(:disabled) {
    border-color: ${tkn('colors.brand.primary')};
  }

  /* Was a bespoke 4px/8%-alpha ring off border.focus, while TextInput, Select and
     SearchField all use the shared 3px/12.5% formula off brand.primary — so a
     focused Textarea rang differently from every other field beside it. */
  &:focus {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: ${({ theme }) => controlFocusShadow(theme.colors.brand.primary)};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
    background-color: ${tkn('colors.background.tertiary')};
    border-color: ${tkn('colors.border.primary')};
  }

  ${({ $mono, theme }) =>
    $mono &&
    `
    font-family: ${theme.typography.fontFamily.mono};
    line-height: ${theme.typography.lineHeight.relaxed};
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

export const HelperText = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.semantic.error')};
  margin-top: ${tkn('spacing.xs')};
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
