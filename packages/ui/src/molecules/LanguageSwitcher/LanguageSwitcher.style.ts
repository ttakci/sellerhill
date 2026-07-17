import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

/**
 * Segmented language control — pairs with header ActionIcon / ThemeToggle height.
 */
export const Segmented = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.2xs')};
  height: 2.5rem;
  box-sizing: border-box;
  background: ${tkn('colors.background.secondary')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
`;

export const Segment = styled.button<{ $active?: boolean }>`
  appearance: none;
  border: none;
  cursor: pointer;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  letter-spacing: ${tkn('typography.letterSpacing.wide')};
  line-height: 1;
  height: 100%;
  min-width: 2.25rem;
  padding: 0 ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${({ $active }) =>
    $active ? tkn('colors.brand.primary') : tkn('colors.text.tertiary')};
  background: ${({ $active }) =>
    $active ? tkn('colors.surface.primary') : 'transparent'};
  font-weight: ${({ $active, theme }) =>
    $active ? theme.typography.fontWeight.semibold : theme.typography.fontWeight.medium};
  box-shadow: ${({ $active }) => ($active ? tkn('shadows.sm') : 'none')};
  transition:
    background ${tkn('transitions.fast')},
    color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};

  &:hover {
    color: ${({ $active }) =>
      $active ? tkn('colors.brand.primary') : tkn('colors.text.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.border.focus')};
    outline-offset: 0.0625rem;
  }

  &:disabled {
    cursor: default;
    opacity: 1;
  }
`;
