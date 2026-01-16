import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Container = styled.div<{ $fullWidth?: boolean }>`
  position: relative;
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
`;

export const StyledSelect = styled.select<{ $hasError?: boolean; $fullWidth?: boolean }>`
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.xl')} ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background-color: ${tkn('colors.background.secondary')};
  border: 1px solid ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)};
  border-radius: ${tkn('radius.lg')};
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.md')};
  appearance: none;
  outline: none;
  cursor: pointer;
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  height: 48px;

  &:hover:not(:disabled) {
    border-color: ${tkn('colors.border.focus')};
    background-color: ${tkn('colors.background.primary')};
  }

  &:focus {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: 0 0 0 4px ${tkn('colors.brand.primary')}15;
    background-color: ${tkn('colors.background.primary')};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
    background-color: ${tkn('colors.background.tertiary')};
  }
`;

export const IconContainer = styled.div`
  position: absolute;
  right: ${tkn('spacing.md')};
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: ${tkn('colors.text.tertiary')};
  display: flex;
  align-items: center;
  transition: color ${tkn('transitions.fast')};

  select:focus + & {
    color: ${tkn('colors.brand.primary')};
  }
`;
