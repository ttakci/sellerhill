import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Container = styled.label<{ $disabled?: boolean }>`
  display: flex;
  align-items: center;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  user-select: none;
  gap: ${tkn('spacing.sm')};
  opacity: ${({ $disabled }) => ($disabled ? 0.7 : 1)};
`;

export const HiddenCheckbox = styled.input`
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
`;

export const StyledCheckbox = styled.div<{ $checked?: boolean; $disabled?: boolean }>`
  box-sizing: border-box;
  flex-shrink: 0;
  width: 1.125rem; /* 18px including border */
  height: 1.125rem;
  border: 0.0625rem solid
    ${({ theme, $checked }) => ($checked ? theme.colors.brand.primary : theme.colors.border.primary)};
  border-radius: ${tkn('radius.sm')};
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    border-color ${tkn('transitions.fast')},
    background-color ${tkn('transitions.fast')};
  background-color: ${({ theme, $checked }) =>
    $checked ? theme.colors.brand.primary : theme.colors.background.secondary};

  &::after {
    content: '';
    box-sizing: border-box;
    width: 0.3125rem;
    height: 0.5625rem;
    border: solid ${tkn('colors.text.inverse')};
    border-width: 0 0.09375rem 0.09375rem 0;
    transform: rotate(45deg) scale(${({ $checked }) => ($checked ? 1 : 0.5)});
    opacity: ${({ $checked }) => ($checked ? 1 : 0)};
    transition:
      opacity ${tkn('transitions.fast')},
      transform ${tkn('transitions.fast')};
    margin-bottom: 0.125rem;
  }

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    background-color: ${({ $checked, theme }) =>
      $checked ? theme.colors.brand.primary : theme.colors.background.tertiary};
  }

  /* The real <input> is visually hidden, so without this a keyboard user gets no
     focus feedback at all. Plain sibling selector — an Emotion component selector
     would need the babel plugin and crashes at runtime without it. */
  input:focus-visible + & {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const Label = styled.span`
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
`;
