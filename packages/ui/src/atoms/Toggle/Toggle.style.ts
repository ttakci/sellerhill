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
  width: 0;
  height: 0;
`;

export const Switch = styled.div<{ $checked?: boolean; $disabled?: boolean }>`
  position: relative;
  width: 3rem; /* 48px */
  height: 1.5rem; /* 24px */
  background-color: ${({ theme, $checked }) => ($checked ? theme.colors.brand.primary : theme.colors.border.primary)};
  border-radius: ${tkn('radius.full')};
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);

  &::after {
    content: '';
    position: absolute;
    width: 1.125rem; /* 18px */
    height: 1.125rem; /* 18px */
    background-color: ${tkn('colors.text.inverse')};
    border-radius: ${tkn('radius.full')};
    top: 0.1875rem; /* 3px */
    left: 0.1875rem; /* 3px */
    transform: translateX(${({ $checked }) => ($checked ? '1.5rem' : '0')}); /* 24px */
    transition: transform ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: ${tkn('shadows.sm')};
  }

  &:hover {
    opacity: 0.9;
  }
`;

export const Label = styled.span`
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
`;
