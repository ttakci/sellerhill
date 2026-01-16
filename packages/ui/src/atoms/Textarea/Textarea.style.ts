import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const StyledTextarea = styled.textarea<{ $fullWidth?: boolean; $hasError?: boolean }>`
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  padding: 12px 16px;
  background-color: ${tkn('colors.background.secondary')};
  border: 1px solid ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)};
  border-radius: ${tkn('radius.sm')};
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
  outline: none;
  transition: all ${tkn('transitions.normal')} cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 120px;
  resize: vertical;

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }

  &:hover:not(:disabled) {
    border-color: ${tkn('colors.border.focus')};
  }

  &:focus {
    border-color: ${tkn('colors.border.focus')};
    box-shadow: 0 0 0 3px ${tkn('colors.brand.secondary')};
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.7;
    background-color: ${tkn('colors.background.tertiary')};
    border-color: ${tkn('colors.border.primary')};
  }
`;

export const HelperText = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.semantic.error')};
  margin-top: 4px;
`;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;
