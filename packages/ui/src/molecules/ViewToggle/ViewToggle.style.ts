import styled from '@emotion/styled';

import type { AppTheme } from '../../theme/theme.types';
import { tkn } from '../../theme/tkn';

export const ViewToggleGroup = styled.div`
  display: flex;
  align-items: center;
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  padding: ${tkn('spacing.xs')};
  border-radius: ${tkn('radius.md')};
  gap: ${tkn('spacing.xs')};
`;

export const ToggleButton = styled.button<{ $active?: boolean }>`
  padding: ${tkn('spacing.xs+')};
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
    transform: none;
  }
`;

export const ViewLabel = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  margin-left: ${tkn('spacing.sm')};

  strong {
    color: ${tkn('colors.text.primary')};
    font-weight: 600;
  }
`;
