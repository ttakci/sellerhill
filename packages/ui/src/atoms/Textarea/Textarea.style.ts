import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const StyledTextarea = styled.textarea<{ $hasError?: boolean; $fullWidth?: boolean }>`
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  padding: ${tkn('spacing.md')};
  background-color: ${tkn('colors.background.secondary')};
  border: 1px solid ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.md')};
  outline: none;
  resize: vertical;
  min-height: 120px;
  transition: all ${tkn('transitions.fast')};

  &:focus {
    border-color: ${tkn('colors.brand.primary')};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &::placeholder {
    color: ${tkn('colors.text.secondary')};
  }
`;
