/**
 * The seller shell and the operator shell are the same chrome with different
 * navigation, so the chrome lives once in `layouts/shell/AppShell.style.ts`
 * and both layouts re-export it. Anything genuinely seller-specific belongs
 * here, below the re-export.
 */
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export * from '../shell/AppShell.style';

/**
 * Billing-usage block inside the top-right profile dropdown — a glanceable
 * shortcut to the same three meters the Billing page shows. Seller-only, so it
 * lives here rather than in the shared shell style (the operator console has no
 * billing).
 *
 * The negative horizontal margin cancels `DropdownHeader`'s own side padding so
 * the collapse toggle and its rows line up flush with the real menu items
 * rendered below the header; the negative bottom margin pulls the block down to
 * the header's own border so that rule doubles as this block's separator.
 */
export const ProfileUsageBlock = styled.div`
  margin: ${tkn('spacing.sm-md')} calc(-1 * ${tkn('spacing.md')}) calc(-1 * ${tkn('spacing.sm-md')});
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
`;

/**
 * The collapse toggle, styled to read as one of the menu items below it: same
 * icon size, gap, padding, resting colour and hover wash as `Dropdown`'s own
 * `MenuItem`. Plan name on the left, chevron pinned right.
 */
export const ProfileUsageToggle = styled.button`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')};
  width: 100%;
  padding: ${tkn('spacing.sm+')} ${tkn('spacing.sm-md')};
  border: none;
  background: transparent;
  cursor: pointer;
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.background.tertiary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: -0.125rem;
    background: ${tkn('colors.background.tertiary')};
  }
`;

/** Grows to fill the toggle row so the chevron sits hard against the right edge. */
export const ProfileUsageToggleLabel = styled.span`
  flex: 1;
  min-width: 0;
  text-align: left;
`;

/** The three meters, shown only while expanded. Roomy top padding so the first
 *  ring is not jammed against the toggle row. */
export const ProfileUsageList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
`;

/** One quota row: ring on the left, label + figures stacked beside it. */
export const ProfileUsageRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')};
  min-width: 0;
`;

export const ProfileUsageText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

/**
 * A sidebar group's heading doubles as its fold toggle (operator request,
 * 2026-10-08 — the earlier "never an accordion" rule was the same operator's
 * and is withdrawn). The label keeps the old overline look; a small chevron on
 * the right says it can fold.
 */
export const NavGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  color: ${tkn('colors.sidebar.textMuted')};
  cursor: pointer;
  user-select: none;
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.sidebar.hover')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.0625rem;
  }
`;

export const NavGroupChevron = styled.span<{ $open: boolean }>`
  display: inline-flex;
  color: ${tkn('colors.sidebar.textMuted')};
  transform: rotate(${({ $open }) => ($open ? '0deg' : '-90deg')});
  transition: transform ${tkn('transitions.fast')};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

/** Folds with a height transition (0fr ↔ 1fr), and a folded group's items are
 *  `visibility: hidden` so the keyboard cannot tab into them. */
export const NavGroupItems = styled.div<{ $open: boolean }>`
  display: grid;
  grid-template-rows: ${({ $open }) => ($open ? '1fr' : '0fr')};
  visibility: ${({ $open }) => ($open ? 'visible' : 'hidden')};
  transition:
    grid-template-rows ${tkn('transitions.normal')},
    visibility ${tkn('transitions.normal')};

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const NavGroupInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-height: 0;
  overflow: hidden;
`;
