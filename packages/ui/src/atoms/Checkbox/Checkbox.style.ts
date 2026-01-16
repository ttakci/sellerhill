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
  width: 18px;
  height: 18px;
  border: 1px solid ${({ theme, $checked }) => ($checked ? theme.colors.brand.primary : theme.colors.border.primary)};
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  background-color: ${({ theme, $checked }) => ($checked ? theme.colors.brand.primary : theme.colors.background.secondary)};

  &::after {
    content: '';
    width: 5px;
    height: 9px;
    border: solid ${tkn('colors.text.inverse')};
    border-width: 0 1.5px 1.5px 0;
    transform: rotate(45deg) scale(${({ $checked }) => ($checked ? 1 : 0.5)});
    opacity: ${({ $checked }) => ($checked ? 1 : 0)};
    transition: all ${tkn('transitions.fast')};
    margin-bottom: 2px;
  }

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
    background-color: ${({ $checked, theme }) => ($checked ? theme.colors.brand.primary : theme.colors.background.tertiary)};
  }
`;

export const Label = styled.span`
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
`;
