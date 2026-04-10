import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import type { AppTheme } from '../../theme/theme.types';

export const ViewToggleGroup = styled.div`
  display: flex;
  align-items: center;
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  padding: 0.25rem;
  border-radius: ${tkn('radius.md')};
  gap: 0.25rem;
`;

export const ToggleButton = styled.button<{ $active?: boolean }>`
  padding: 0.375rem;
  border-radius: 0.375rem;
  border: none;
  background: ${({ $active, theme }: { $active?: boolean; theme: AppTheme }) =>
    $active ? theme.colors.brand.secondary : 'transparent'};
  color: ${({ $active, theme }: { $active?: boolean; theme: AppTheme }) =>
    $active ? theme.colors.brand.primary : theme.colors.text.tertiary};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const ViewLabel = styled.span`
  font-size: 0.875rem;
  color: ${tkn('colors.text.secondary')};
  margin-left: ${tkn('spacing.sm')};

  strong {
    color: ${tkn('colors.text.primary')};
    font-weight: 600;
  }
`;
