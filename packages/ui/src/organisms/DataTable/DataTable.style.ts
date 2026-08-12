import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const DataTableContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0;
`;

export const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  margin-bottom: ${tkn('spacing.lg')};
`;

export const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const BulkSelectWrapper = styled.div`
  min-width: 10rem;
`;

/**
 * Card grid. Column count is derived from a minimum track width instead of
 * hardcoded breakpoints: fixed `repeat(3, 1fr)` at 75rem gave a wide horizontal
 * card (image + content side by side) roughly 380px of track, which is not
 * enough for its own contents — the card visibly crushed. `auto-fill` +
 * `minmax` lets each surface declare the narrowest track its card can survive,
 * and the column count then follows the viewport on its own.
 */
export const GridContainer = styled.div<{ $minItemWidth: string; $maxColumns?: number }>`
  display: grid;
  /*
   * Track floor = the larger of the caller's minimum and an equal share of the
   * row split maxColumns ways. Raising the floor is what caps the column count
   * (CSS has no direct cap on auto-fill), and it still collapses to fewer
   * columns on narrow viewports because the caller's minimum wins there.
   */
  grid-template-columns: repeat(
    auto-fill,
    minmax(
      min(
        100%,
        ${({ $minItemWidth, $maxColumns, theme }) =>
          $maxColumns && $maxColumns > 1
            ? `max(${$minItemWidth}, calc((100% - ${$maxColumns - 1} * ${theme.spacing.md}) / ${$maxColumns}))`
            : $minItemWidth}
      ),
      1fr
    )
  );
  gap: ${tkn('spacing.md')};
  align-items: stretch;
  width: 100%;

  & > * {
    min-width: 0;
    max-width: 100%;
  }
`;

/**
 * The pagination is a sibling of the table card / card grid, so it needs real
 * separation. It used to butt straight against the last row of cards (container
 * gap was 0), which read as the bar being part of the grid.
 */
export const PaginationSlot = styled.div`
  margin-top: ${tkn('spacing.lg')};
`;

/* Card tier (border + radius.lg + sm elevation), matching TableContainer — this
   was on the badge radius with no border, so empty grid and empty table looked
   like two different surfaces. */
export const GridEmptyState = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 18rem;
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.lg')};
  color: ${tkn('colors.text.tertiary')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.sm')};
  box-sizing: border-box;
`;

/* Table-mode skeleton — same card tier as TableContainer so the loading and
   loaded states read as the same surface, not two different screens. */
export const SkeletonTableCard = styled.div`
  width: 100%;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;
`;

export const SkeletonRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  min-height: 2.5rem;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  &:last-of-type {
    border-bottom: none;
  }
`;

/* Grid-mode skeleton card — generic thumbnail + text-line shape. Sits inside
   the same GridContainer as real cards, so it inherits the exact column
   count/track width the real grid would use for this page. */
export const SkeletonGridCard = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.sm')};
  min-height: 6rem;
`;

export const SkeletonGridCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  flex: 1;
  min-width: 0;
`;

export const ColumnManagerContent = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.sm-md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;
