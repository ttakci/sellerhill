import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

/**
 * The canonical tab rail. Dashboard hand-rolled this, Admin and Support faked it
 * with `Button variant="primary|secondary"` (which reads as a call to action,
 * not a location), and the `Tabs` atom's own rail was a fourth copy. One rail now.
 */
export const TabList = styled.div<{ $variant: 'underline' | 'pill' }>`
  display: flex;
  align-items: center;
  gap: ${({ $variant, theme }) => ($variant === 'pill' ? theme.spacing.xs : theme.spacing.lg)};
  border-bottom: ${({ $variant, theme }) =>
    $variant === 'underline' ? `0.0625rem solid ${theme.colors.border.primary}` : 'none'};

  /* Many tabs must scroll, never wrap onto a second row — a wrapped rail breaks
     the header/right-hand-filter alignment on every page that has one. */
  flex-wrap: nowrap;
  overflow-x: auto;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

export const TabButton = styled.button<{ $isActive: boolean; $variant: 'underline' | 'pill' }>`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: ${tkn('spacing.sm')};
  background: transparent;
  border: none;
  cursor: pointer;
  white-space: nowrap;
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  padding: ${({ $variant, theme }) =>
    $variant === 'pill'
      ? `${theme.spacing['xs+']} ${theme.spacing['sm-md+']}`
      : `${theme.spacing['sm+']} 0`};
  transition: all ${tkn('transitions.fast')};
  position: relative;

  color: ${({ $isActive, theme }) => ($isActive ? theme.colors.brand.primary : theme.colors.text.secondary)};

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: -0.125rem;
    border-radius: ${tkn('radius.sm')};
  }

  ${({ $variant, $isActive, theme }) =>
    $variant === 'underline' &&
    $isActive &&
    `
      &::after {
        content: '';
        position: absolute;
        bottom: -0.0625rem;
        left: 0;
        width: 100%;
        height: 0.125rem;
        background: ${theme.colors.brand.primary};
      }
    `}

  ${({ $variant, $isActive, theme }) =>
    $variant === 'pill' &&
    `
      border-radius: ${theme.radius.md};
      background: ${$isActive ? theme.colors.brand.secondary : 'transparent'};
      &:hover {
        background: ${$isActive ? theme.colors.brand.secondary : theme.colors.background.tertiary};
      }
    `}
`;
