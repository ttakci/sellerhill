import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/**
 * Layout only — the surrounding sidebar card (desktop) or the Drawer body
 * (mobile) owns the surface/border/sticky positioning, since this component
 * renders inside both.
 */
export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-height: 0;
`;

/**
 * The search box never shrinks. It shares a flex column with the scrolling
 * list, and a flex item's default `flex-shrink: 1` squeezed it down to its
 * text height once the list overflowed — which is what made it look tiny.
 */
export const SearchSlot = styled.div`
  flex-shrink: 0;
`;

export const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  overflow-y: auto;
  min-height: 0;
`;

/**
 * One tree row. Depth drives the indent; a sub-category (depth 1) has no
 * chevron slot, so its label starts flush with its parent's label, not with
 * the parent's chevron.
 *
 * The active row uses the table's own selected-row language (`colors.table.*`
 * tint + a left accent bar), so "where am I" reads the same here as a picked
 * row anywhere else. `brand.secondary` was near-white on the white sidebar
 * card, and the hover shade (`background.secondary`) is pure white — neither
 * was visible. The accent is an inset shadow, not a border, so the label never
 * shifts when a row becomes active.
 */
export const Row = styled.div<{ $depth: 0 | 1; $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-height: 2.25rem;
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.sm')};
  padding-left: ${({ $depth, theme }) => ($depth === 1 ? `calc(${tkn('spacing.sm')({ theme })} + 1.5rem)` : tkn('spacing.sm')({ theme }))};
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
  user-select: none;
  box-sizing: border-box;
  background: ${({ $active, theme }) => ($active ? theme.colors.table.rowSelected : 'transparent')};
  box-shadow: ${({ $active, theme }) => ($active ? `inset 0.1875rem 0 0 ${theme.colors.table.rowSelectedAccent}` : 'none')};
  transition:
    background ${tkn('transitions.fast')},
    color ${tkn('transitions.fast')};

  &:hover {
    background: ${({ $active, theme }) => ($active ? theme.colors.table.rowSelectedHover : theme.colors.table.rowHover)};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.border.focus')};
    outline-offset: -0.125rem;
  }
`;

export const RowLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
`;

/** Fixed slot so every row's label starts at the same x whether or not it has a chevron. */
export const ChevronSlot = styled.button<{ $isOpen: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: ${tkn('radius.sm')};
  color: ${tkn('colors.text.tertiary')};
  background: transparent;
  border: none;
  padding: 0;
  cursor: pointer;
  transition: transform ${tkn('transitions.normal')}, background ${tkn('transitions.fast')};
  transform: ${({ $isOpen }) => ($isOpen ? 'rotate(90deg)' : 'rotate(0deg)')};

  &:hover {
    background: ${tkn('colors.table.rowSelectedHover')};
    color: ${tkn('colors.brand.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.border.focus')};
  }
`;

export const ChevronPlaceholder = styled.div`
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
`;

export const EmptyHint = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.sm')};
  text-align: center;
`;
