import styled from '@emotion/styled';
import { Card, PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;

/**
 * How far a locked placeholder is blurred. The design system has no blur
 * token (nothing else in the app blurs content), so this is a named constant
 * rather than a `tkn()` path. It is strong enough that text could not be read
 * through it even if any were rendered — none is: the server strips locked
 * products before they reach the browser, and these slots hold skeleton bars.
 */
const LOCKED_BLUR = '0.3rem';

/** Header actions — "List selected (N)" + Clear — wrap under the title on a phone. */
export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
`;

/**
 * Sidebar (category tree) + content column. The sidebar is a real column
 * above `lg`, matching how the app's own shell collapses its sidebar at the
 * same breakpoint; below it, `SidebarPanel` hides and `MobileCategoryTrigger`
 * (a Drawer opener) takes over — see `MobileCategoryTrigger`.
 */
export const PageBody = styled.div`
  display: grid;
  grid-template-columns: 18rem minmax(0, 1fr);
  align-items: start;
  gap: ${tkn('spacing.lg')};

  @media (max-width: ${tkn('breakpoints.lgBelow')}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const SidebarPanel = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  position: sticky;
  top: ${tkn('spacing.lg')};
  max-height: calc(100vh - 9rem);
  overflow: hidden;
  box-sizing: border-box;

  @media (max-width: ${tkn('breakpoints.lgBelow')}) {
    display: none;
  }
`;

export const SidebarHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  color: ${tkn('colors.text.secondary')};
`;

/** Opens the category Drawer below `lg`; the persistent sidebar takes over above it. */
export const MobileCategoryTrigger = styled.div`
  display: none;

  @media (max-width: ${tkn('breakpoints.lgBelow')}) {
    display: flex;

    & > button {
      width: 100%;
      justify-content: space-between;
    }
  }
`;

export const MobileCategoryTriggerLabel = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
`;

export const ContentColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  min-width: 0;
`;

/* Same surface as the Listings / Orders / Products filter bars. */
export const Toolbar = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-shadow: ${tkn('shadows.sm')};
  box-sizing: border-box;
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.md')};
  }
`;

/**
 * Filters on the left, select-all pushed right; wraps on narrow widths. Widths
 * follow the Listings filter bar (Select 12rem) so the two toolbars line up.
 */
export const FilterRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    flex-direction: column;
    align-items: stretch;
  }
`;

export const FilterSelect = styled.div`
  width: 11rem;
  flex-shrink: 0;
  position: relative;
  z-index: 2;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    width: 100%;
  }
`;

export const FilterNumber = styled.div`
  width: 11rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    width: 100%;
  }
`;

export const FilterPriceRange = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  width: 18rem;
  flex-shrink: 0;
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    width: 100%;
  }
`;

export const RangeSeparator = styled.span`
  flex-shrink: 0;
`;

export const FilterSpacer = styled.div`
  flex: 1 1 auto;
`;

/** Allowance meter + its one-line explanation, muted under the filters. */
export const MetaRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: ${tkn('spacing.2xs')} ${tkn('spacing.md')};
`;

/* --- Locked placeholders ---------------------------------------------------- */

/**
 * A product the allowance did not cover. Same footprint as the listings card so
 * the grid keeps its rhythm, but it is not a tap surface: no hover lift, no
 * pointer, no selection outline. The blurred body underneath is skeleton bars
 * only; the lock badge sits on top, unblurred, so the state is legible.
 */
export const LockedCard = styled(Card)`
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  cursor: default;
  user-select: none;
  overflow: hidden;
`;

/** Same geometry as the horizontal ListingCard: 10.5rem image slot beside the content. */
export const LockedCardBody = styled.div`
  display: flex;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.lg')};
  filter: blur(${LOCKED_BLUR});
  pointer-events: none;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    flex-direction: column;
  }
`;

export const LockedImageSlot = styled.div`
  width: 10.5rem;
  height: 10.5rem;
  flex-shrink: 0;
`;

export const LockedCardLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  flex: 1;
  min-width: 0;
`;

export const LockedOverlay = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/** Round lock disc floating over the blurred card — the one unblurred element on it. */
export const LockedBadge = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.md')};
`;

/** Table product cell of a locked row: an unblurred lock glyph beside blurred title lines. */
export const LockedProductCell = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  user-select: none;
`;

export const LockedLines = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  flex: 1 1 auto;
  min-width: 0;
  filter: blur(${LOCKED_BLUR});
  pointer-events: none;
`;

/** Any other table cell of a locked row — one blurred bar, aligned like its column. */
export const LockedCell = styled.div<{ $align?: 'left' | 'center' | 'right' }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $align }) =>
    $align === 'right' ? 'flex-end' : $align === 'center' ? 'center' : 'flex-start'};
  filter: blur(${LOCKED_BLUR});
  pointer-events: none;
  user-select: none;
`;

/** One card under the locked rows: what they are and where to unlock them. */
export const UpsellCard = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

/** Every non-grid state (disabled feature, first load, refusals) shares one surface. */
export const StateCard = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: center;
`;
