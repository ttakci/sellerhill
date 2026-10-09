import styled from '@emotion/styled';
import { Card, IconButton, PageContainer, TabNav, tkn, type AppTheme } from '@repo/ui';

export const Container = PageContainer;

/**
 * How far a locked placeholder is blurred. The design system has no blur
 * token (nothing else in the app blurs content), so this is a named constant
 * rather than a `tkn()` path. It is strong enough that text could not be read
 * through it even if any were rendered — none is: the server strips locked
 * products before they reach the browser, and these slots hold skeleton bars.
 */
const LOCKED_BLUR = '0.3rem';

/*
 * Same column as the Orders / Listings pages: title → tab rail → controls →
 * rows, all on the page canvas. The rail holds the five Amazon lists; the
 * allowance meter sits at its far end, where Orders keeps its stage legend.
 */
export const TabsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/**
 * The selected tab takes its list's colour — rail, label and icon — the way
 * the Orders stage rail colours each stage. Positions follow
 * `BEST_SELLERS_LIST_TYPE_ORDER`: Best Sellers (brand blue), New Releases
 * (teal), Movers & Shakers (green), Most Wished For (red), Most Gifted (amber).
 */
const LIST_TAB_COLORS = [
  'colors.brand.primary',
  'colors.badge.teal',
  'colors.semantic.success',
  'colors.semantic.error',
  'colors.semantic.warning',
] as const;

const selectedTabColor = (theme: AppTheme, position: number, color: (typeof LIST_TAB_COLORS)[number]): string => {
  const value = String(tkn(color)({ theme }));
  return `
    > [role='tab']:nth-of-type(${position})[aria-selected='true'] {
      color: ${value};
    }
    > [role='tab']:nth-of-type(${position})[aria-selected='true']:hover {
      color: ${value};
    }
    > [role='tab']:nth-of-type(${position})[aria-selected='true']::after {
      background: ${value};
    }
  `;
};

export const ListTabs = styled(TabNav)`
  ${({ theme }) => LIST_TAB_COLORS.map((color, index) => selectedTabColor(theme as AppTheme, index + 1, color)).join('')}
`;

/** "13,760 of 15,000 products left" + the info glyph explaining how it is counted. */
export const Allowance = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/**
 * Category tree + content. The tree is a real column from `lg`; below it the
 * sidebar hides and the filter row's category button opens it in a Drawer.
 */
export const PageBody = styled.div`
  display: grid;
  grid-template-columns: 17rem minmax(0, 1fr);
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

export const ContentColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

/** The Orders filter row: compact controls of one height, "clear all" pushed right. */
export const FilterRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    flex-direction: column;
    align-items: stretch;
  }
`;

/** Opens the category Drawer below `lg`; the persistent sidebar takes over above it. */
export const MobileCategoryTrigger = styled.div`
  display: none;

  @media (max-width: ${tkn('breakpoints.lgBelow')}) {
    display: flex;
    width: 100%;

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

/* The search takes what the fixed-width controls leave, so the row fits the
   content column beside the category tree on one line at desktop widths. */
export const SearchWrapper = styled.div`
  flex: 1 1 11rem;
  min-width: 11rem;
  max-width: 18rem;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    /* The row is a column here, so a flex-basis would become a height. */
    flex: none;
    width: 100%;
    max-width: none;
  }
`;

export const SelectWrapper = styled.div`
  width: 9rem;
  flex-shrink: 0;
  position: relative;
  z-index: 2;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    width: 100%;
  }
`;

export const RangeSeparator = styled.span`
  flex-shrink: 0;
`;

export const FilterActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  margin-left: auto;

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    margin-left: 0;
  }
`;

/* --- Advanced filters (the Listings page's section) --------------------- */

export const FilterBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

/** Applied filters, one removable chip each. */
export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const ChipInner = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

/** The chip's own remove control — an IconButton shrunk to the chip's line height. */
export const ChipRemove = styled(IconButton)`
  width: 1.25rem;
  height: 1.25rem;
  min-width: 0;
  padding: 0;
`;

export const AdvancedDivider = styled.div`
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
`;

export const AdvancedHeaderRow = styled.div`
  display: flex;
  align-items: center;
`;

export const AdvancedChevron = styled.span<{ $isOpen: boolean }>`
  display: inline-flex;
  transition: transform ${tkn('transitions.fast')};
  transform: rotate(${({ $isOpen }) => ($isOpen ? '180deg' : '0deg')});
`;

export const RangeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.md')} ${tkn('spacing.lg')};

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

export const RangeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/** "50 products listed · 3 selected" — the selected count rides beside the result label. */
export const ResultLabel = styled.span`
  display: inline-flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;

/* --- Table cells ------------------------------------------------------------ */

/** Numeric cells stay on one line and stack their digits down the column. */
export const CompactMetric = styled.div`
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

/** Filled star beside the average, flush right with the other figures. */
export const RatingValue = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.2xs')};
  white-space: nowrap;
`;

/* --- Locked placeholders ---------------------------------------------------- */

/**
 * A product the allowance did not cover, drawn in the listings card's own
 * anatomy — title row, 9rem image beside the facts, figures row — so the grid
 * keeps one rhythm. It is not a tap surface. The blurred body underneath is
 * skeleton bars only; the lock disc sits on top, unblurred.
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

export const LockedCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md+')};
  filter: blur(${LOCKED_BLUR});
  pointer-events: none;
`;

export const LockedCardRow = styled.div`
  display: flex;
  gap: ${tkn('spacing.md')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    flex-direction: column;
  }
`;

export const LockedImageSlot = styled.div`
  width: 9rem;
  height: 9rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    width: 100%;
    height: 10rem;
  }
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

/** Any other table cell of a locked row — one blurred bar, flush right with its figure column. */
export const LockedCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
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

/** The switched-off feature gets one surface of its own. */
export const StateCard = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: center;
`;
