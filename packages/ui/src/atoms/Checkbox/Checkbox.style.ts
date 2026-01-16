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
  cursor: pointer;
  height: 0;
  width: 0;
`;

export const StyledCheckbox = styled.div<{ checked?: boolean; disabled?: boolean }>`
  width: 20px;
  height: 20px;
  background-color: transparent;
  border: 1px solid ${({ theme, checked }) => (checked ? theme.colors.brand.primary : theme.colors.border.primary)};
  border-radius: ${tkn('radius.sm')};
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${tkn('transitions.fast')};
  background-color: ${({ theme, checked }) => (checked ? theme.colors.brand.primary : 'transparent')};

  &::after {
    content: '';
    width: 6px;
    height: 10px;
    border: solid ${({ theme }) => theme.colors.text.inverse};
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
    display: ${({ checked }) => (checked ? 'block' : 'none')};
    margin-bottom: 2px;
  }

  ${Container}:hover & {
    border-color: ${tkn('colors.brand.primary')};
  }
`;

export const Label = styled.span`
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.md')};
`;
