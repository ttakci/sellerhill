import styled from '@emotion/styled';

import { IconButton } from '../../atoms/IconButton';
import { glassSurface } from '../../styles/glass';
import { tkn } from '../../theme/tkn';

import type { TablePaginationVariant } from './TablePagination.types';

export const PaginationContainer = styled.div<{ $variant: TablePaginationVariant; $compact: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  box-sizing: border-box;
  width: 100%;
  font-size: ${tkn('typography.fontSize.sm')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};

  ${({ $variant, theme }) =>
    $variant === 'detached'
      ? `
        ${glassSurface(theme)}
        border-radius: ${theme.radius.lg};
      `
      : `
        background: transparent;
        border-top: 0.0625rem solid ${theme.colors.border.secondary};
      `}

  /*
   * The row layout assumes the bar spans close to the full viewport, but this
   * breakpoint is a VIEWPORT media query while the bar's actual available
   * width is whatever its container gives it — narrower on any page that
   * shares the row with a sidebar or a card rail. The flex-wrap below is the
   * fallback for that mismatch: side by side when there's room, the rows-per-
   * page control above the page nav when there isn't, instead of the two
   * groups forcing the bar (and its scrolling ancestor) wider than the page.
   */
  @media (min-width: ${tkn('breakpoints.sm')}) {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
  }

  ${({ $compact }) =>
    $compact
      ? `
        flex-direction: row;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
      `
      : ''}
`;

export const RowsPerPage = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  color: ${tkn('colors.text.tertiary')};
`;

export const PaginationLabel = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.tertiary')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  white-space: nowrap;

  span {
    font-weight: ${tkn('typography.fontWeight.semibold')};
    color: ${tkn('colors.text.primary')};
  }
`;

/*
 * Wide enough for the widest option ("100") plus the chevron. It was 4.5rem with
 * an auto-width Select inside, so the control neither filled its slot nor had
 * room for a three-digit value.
 */
export const SelectWrapper = styled.div`
  width: 5.5rem;
  position: relative;
`;

export const PageInfo = styled.div<{ $compact: boolean }>`
  display: flex;
  align-items: center;
  ${({ $compact }) => ($compact ? 'order: 3; flex: 1 0 100%;' : '')}
`;

/*
 * `flex-wrap` is load-bearing on a narrow container (e.g. the Messages page's
 * ~16-22rem list column): the info label plus the nav buttons are each
 * `white-space: nowrap`, so without a wrap here the row simply overflowed
 * its column and the page-nav controls bled visually into whatever sits
 * beside it.
 */
export const NavigationWrapper = styled.div<{ $compact: boolean }>`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.md')};
  /* Compact: dissolve the wrapper so the page nav and the info label become
     direct flex items of the container and can sit on different rows. */
  ${({ $compact }) => ($compact ? 'display: contents;' : '')}
`;

export const Navigation = styled.div<{ $compact: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  ${({ $compact }) => ($compact ? 'order: 2;' : '')}
`;

/** Page N of M — chevrons alone never said how much further the list goes. */
export const PageCounter = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  font-variant-numeric: tabular-nums;
  padding: 0 ${tkn('spacing.xs')};
  white-space: nowrap;
`;

/*
 * Extends the IconButton atom — this was a raw styled.button re-implementing
 * hover/disabled by hand and carrying no :focus-visible ring at all.
 */
export const NavButton = styled(IconButton)`
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};

  &:disabled {
    opacity: 0.35;
    cursor: default;
  }
`;
