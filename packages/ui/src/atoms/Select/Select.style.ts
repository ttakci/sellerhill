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
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.md')};
  appearance: none;
  outline: none;
  cursor: pointer;
  transition: all ${tkn('transitions.fast')};

  &:focus {
    border-color: ${tkn('colors.brand.primary')};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
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
`;
