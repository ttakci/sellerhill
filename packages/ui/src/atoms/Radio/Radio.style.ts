import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Container = styled.label<{ $disabled?: boolean }>`
  display: inline-flex;
  align-items: center;
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  user-select: none;
  gap: ${tkn('spacing.sm')};
  opacity: ${({ $disabled }) => ($disabled ? 0.7 : 1)};
`;

export const HiddenRadio = styled.input`
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
`;

/** The visible circle — the same size, border and brand fill as the Checkbox box. */
export const StyledRadio = styled.span<{ $checked: boolean }>`
  box-sizing: border-box;
  flex-shrink: 0;
  width: 1.125rem; /* 18px including border */
  height: 1.125rem;
  border: 0.09375rem solid ${tkn('colors.brand.primary')};
  border-radius: ${tkn('radius.full')};
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: ${tkn('colors.background.secondary')};
  transition: background-color ${tkn('transitions.fast')};

  &::after {
    content: '';
    width: 0.5rem;
    height: 0.5rem;
    border-radius: ${tkn('radius.full')};
    background-color: ${tkn('colors.brand.primary')};
    transform: scale(${({ $checked }) => ($checked ? 1 : 0)});
    transition: transform ${tkn('transitions.fast')};
  }

  &:hover {
    background-color: ${tkn('colors.background.tertiary')};
  }

  /* The real <input> is visually hidden; mirror its keyboard focus onto the circle.
     Plain sibling selector — an Emotion component selector crashes without the babel plugin. */
  input:focus-visible + & {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const Label = styled.span`
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.base')};
  font-family: ${tkn('typography.fontFamily.sans')};
`;
