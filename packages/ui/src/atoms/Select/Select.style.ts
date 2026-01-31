import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div<{ $fullWidth?: boolean }>`
  position: relative;
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
`;

export const StyledSelect = styled.select<{ $hasError?: boolean; $fullWidth?: boolean }>`
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  padding: 0 ${tkn('spacing.xxl')} 0 ${tkn('spacing.md')};
  background-color: transparent;
  border: 0.0625rem solid
    ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)}; /* 1px */
  border-radius: ${tkn('radius.sm')};
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
  appearance: none;
  outline: none;
  cursor: pointer;
  transition:
    border-color ${tkn('transitions.normal')},
    box-shadow ${tkn('transitions.normal')};
  height: 2.375rem; /* 38px */

  &:hover:not(:disabled) {
    border-color: ${tkn('colors.border.focus')};
  }

  &:focus {
    border-color: ${tkn('colors.border.focus')};
    box-shadow: 0 0 0 0.25rem ${tkn('colors.brand.primary')}15; /* 4px */
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
    background-color: ${tkn('colors.background.tertiary')};
    border-color: ${tkn('colors.border.primary')};
  }
`;

export const IconContainer = styled.div`
  position: absolute;
  right: ${tkn('spacing.md')};
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: ${tkn('colors.text.secondary')};
  display: flex;
  align-items: center;
  transition: color ${tkn('transitions.fast')};

  select:focus + & {
    color: ${tkn('colors.brand.primary')};
  }
`;
