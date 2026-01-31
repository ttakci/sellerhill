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

export const HiddenRadio = styled.input`
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
`;

export const StyledRadio = styled.div<{ $checked?: boolean; $disabled?: boolean }>`
  width: 1.125rem; /* 18px */
  height: 1.125rem; /* 18px */
  background-color: ${tkn('colors.background.secondary')};
  border: 0.0625rem solid
    ${({ theme, $checked }) => ($checked ? theme.colors.brand.primary : theme.colors.border.primary)}; /* 1px */
  border-radius: ${tkn('radius.full')};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);

  &::after {
    content: '';
    width: 0.5rem; /* 8px */
    height: 0.5rem; /* 8px */
    background-color: ${tkn('colors.brand.primary')};
    border-radius: ${tkn('radius.full')};
    transform: scale(${({ $checked }) => ($checked ? 1 : 0)});
    transition: transform ${tkn('transitions.fast')} cubic-bezier(0.175, 0.885, 0.32, 1.275);
    opacity: ${({ $checked }) => ($checked ? 1 : 0)};
  }

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    background-color: ${tkn('colors.background.tertiary')};
  }
`;

export const Label = styled.span`
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
`;
