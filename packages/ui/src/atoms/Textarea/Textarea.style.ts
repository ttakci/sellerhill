import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const StyledTextarea = styled.textarea<{ $fullWidth?: boolean; $hasError?: boolean }>`
  width: ${({ $fullWidth }) => ($fullWidth ? '100%' : 'auto')};
  padding: ${tkn('spacing.sm-md+')} 1.125rem;
  background-color: ${tkn('colors.background.secondary')};
  border: 0.0625rem solid
    ${({ theme, $hasError }) => ($hasError ? theme.colors.semantic.error : theme.colors.border.primary)}; /* 1px */
  border-radius: 0.5rem; /* 8px — matches Button */
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.sans')};
  outline: none;
  transition:
    border-color ${tkn('transitions.normal')},
    box-shadow ${tkn('transitions.normal')};
  min-height: 8.75rem; /* 140px */
  resize: vertical;

  &::placeholder {
    color: ${tkn('colors.text.tertiary')};
  }

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

export const HelperText = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.semantic.error')};
  margin-top: ${tkn('spacing.xs')};
`;

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
`;
