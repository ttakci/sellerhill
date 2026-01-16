import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.label<{ disabled?: boolean }>`
  display: flex;
  align-items: center;
  cursor: ${({ disabled }) => (disabled ? 'not-allowed' : 'pointer')};
  user-select: none;
  gap: ${tkn('spacing.sm')};
  opacity: ${({ disabled }) => (disabled ? 0.6 : 1)};
`;

export const HiddenCheckbox = styled.input`
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
`;

export const Switch = styled.div<{ checked?: boolean; disabled?: boolean }>`
  position: relative;
  width: 44px;
  height: 24px;
  background-color: ${({ theme, checked }) => (checked ? theme.colors.brand.primary : theme.colors.border.primary)};
  border-radius: ${tkn('radius.full')};
  transition: background-color ${tkn('transitions.fast')};

  &::after {
    content: '';
    position: absolute;
    width: 20px;
    height: 20px;
    background-color: ${tkn('colors.text.inverse')};
    border-radius: ${tkn('radius.full')};
    top: 2px;
    left: ${({ checked }) => (checked ? '22px' : '2px')};
    transition: left ${tkn('transitions.fast')};
    box-shadow: ${tkn('shadows.sm')};
  }
`;

export const Label = styled.span`
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.md')};
`;
