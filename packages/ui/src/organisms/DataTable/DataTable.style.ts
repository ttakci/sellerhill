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
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  box-sizing: border-box;
`;

export const ColumnManagerContent = styled.div`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.sm-md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;
