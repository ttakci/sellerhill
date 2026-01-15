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

export const HiddenRadio = styled.input`
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
`;

export const StyledRadio = styled.div<{ checked?: boolean; disabled?: boolean }>`
  width: 20px;
  height: 20px;
  background-color: transparent;
  border: 1px solid ${({ theme, checked }) => (checked ? theme.colors.brand.primary : theme.colors.border.primary)};
  border-radius: ${tkn('radius.full')};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${tkn('transitions.fast')};

  &::after {
    content: '';
    width: 10px;
    height: 10px;
    background-color: ${tkn('colors.brand.primary')};
    border-radius: ${tkn('radius.full')};
    display: ${({ checked }) => (checked ? 'block' : 'none')};
  }

  ${Container}:hover & {
    border-color: ${tkn('colors.brand.primary')};
  }
`;

export const Label = styled.span`
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.md')};
`;
