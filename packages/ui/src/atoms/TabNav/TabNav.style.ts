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

  /* Phones too: one row that swipes sideways (operator, 2026-10-09). The
     2026-10-01 rule that wrapped the rail onto a second row below sm is gone;
     the container keeps the selected tab in view instead. */
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;

  /*
   * As a flex item of a COLUMN-direction parent (a toolbar stacking the rail
   * over its filter row), the cross-axis 'automatic minimum size' rule that
   * zeroes an overflowing item's floor only reliably kicks in along the flex
   * container's main axis. Without an explicit min-width: 0 here, a rail
   * wider than its column keeps its full content width instead of clipping
   * to its own overflow-x: auto, and that width leaks into every ancestor up
   * to the page's own scroll container — a real page-level horizontal
   * scrollbar on narrow viewports, not just a rail that quietly grew past
   * its card.
   */
  min-width: 0;
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
    $variant === 'pill' ? `${theme.spacing['xs+']} ${theme.spacing['sm-md+']}` : `${theme.spacing['sm+']} 0`};
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

/** The count pill beside a tab label — tabular figures on a quiet surface,
 *  brand-tinted on the selected tab so the figure and the underline agree.
 *  Metrics mirror Badge size xs so header filter counts read at the same
 *  visual weight as the row-level CountBadge/ChipCount badges. */
export const TabCount = styled.span<{ $isActive: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  padding: ${tkn('spacing.2xs+')} ${tkn('spacing.xs+')};
  box-sizing: border-box;
  border: 0.0625rem solid transparent;
  border-radius: ${tkn('radius.sm')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  line-height: ${tkn('typography.lineHeight.tight')};
  letter-spacing: ${tkn('typography.letterSpacing.normal')};
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
  background: ${({ $isActive, theme }) => ($isActive ? theme.colors.brand.secondary : theme.colors.background.tertiary)};
  color: ${({ $isActive, theme }) => ($isActive ? theme.colors.brand.primary : theme.colors.text.secondary)};
  border-color: ${({ $isActive, theme }) =>
    $isActive ? `${theme.colors.brand.primary}30` : theme.colors.border.primary};
  transition: all ${tkn('transitions.fast')};
`;
