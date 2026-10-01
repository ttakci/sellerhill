/**
 * MessagesPage styles.
 *
 * The inbox is ONE bordered/elevated shell (`Shell`) — rail, list and thread
 * are divider-separated panes inside it, never three separate floating
 * cards. That's what makes it read as a single mail surface instead of
 * three boxes glued together with gaps. The filter row above it uses the
 * same bordered/shadowed bar every other list page's toolbar does (see
 * `OrdersAllPage.style.ts` `FilterBar`), so the page matches the rest of
 * the app instead of inventing its own chrome.
 *
 *   ≥ xl      folder rail | conversation list | thread
 *   md – xl   type + folder switch above  list | thread
 *   < md      one column: the list, or (with `?c=`) the thread
 *
 * The rail waits for `xl`, not `lg`: at `lg` the content area beside the app
 * sidebar is ~45rem, and three panes left the thread ~16rem wide.
 *
 * AppLayout ContentInner owns the page gutter — never pad here. Nothing is
 * absolutely positioned (RTL mirrors by document direction).
 */

import styled from '@emotion/styled';
import { Card, PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;

/** Store filter row (and, below `xl`, the type/folder switches) — on the
 * page canvas, like every other list page's filter row. */
export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  min-width: 0;
`;

/** The rail's stand-in below `xl`; hidden once the rail itself is shown. */
export const CompactFilters = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
  min-width: 0;

  @media (min-width: ${tkn('breakpoints.xl')}) {
    display: none;
  }
`;

/** Shrink-wraps the Dropdown (its own container is `width: 100%`). */
export const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  margin-left: auto;
`;

/** Long store names truncate instead of widening the toolbar; the trigger itself is the Button atom. */
export const StoreLabel = styled.span`
  min-width: 0;
  max-width: 12rem;
  overflow: hidden;
`;

/**
 * The whole inbox — one Card. `grid-template-rows: minmax(0, 1fr)` (not the
 * implicit default) is load-bearing: it's what lets a grid item declare its
 * own `min-height: 0` and scroll internally instead of stretching the whole
 * shell to its content height.
 */
export const Shell = styled(Card)<{ $threadOpen: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  height: 74vh;
  min-height: 32rem;

  & > [data-pane='list'] {
    display: ${({ $threadOpen }) => ($threadOpen ? 'none' : 'flex')};
  }

  & > [data-pane='thread'] {
    display: ${({ $threadOpen }) => ($threadOpen ? 'flex' : 'none')};
  }

  & > [data-pane='rail'] {
    display: none;
  }

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: minmax(18rem, 28rem) minmax(0, 1fr);

    & > [data-pane='list'],
    & > [data-pane='thread'] {
      display: flex;
    }
  }

  @media (min-width: ${tkn('breakpoints.xl')}) {
    grid-template-columns: 11rem minmax(24rem, 28rem) minmax(0, 1fr);

    & > [data-pane='rail'] {
      display: flex;
    }
  }
`;

/** Tinted so the rail reads as a sidebar-within-the-card, not a fourth
 * white box — the same `background.secondary` the thread's message canvas
 * already uses for the same reason. */
export const RailPane = styled.div`
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  min-height: 0;
  padding: ${tkn('spacing.md')} ${tkn('spacing.sm')};
  overflow-y: auto;
  background: ${tkn('colors.background.secondary')};
  border-right: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const RailGroup = styled.nav`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const RailGroupLabel = styled.div`
  padding: 0 ${tkn('spacing.sm')} ${tkn('spacing.xs')};
`;

export const RailItem = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  width: 100%;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.sm')};
  border: none;
  border-radius: ${tkn('radius.md')};
  background: ${({ $active, theme }) => ($active ? theme.colors.table.rowSelected : 'transparent')};
  color: ${({ $active, theme }) => ($active ? theme.colors.brand.primary : theme.colors.text.primary)};
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.table.rowSelectedHover : theme.colors.table.rowHover};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.0625rem;
  }
`;

/** The scrolling conversation list plus its own footer pagination — both
 * live inside the shell's own border, never a detached card underneath. */
export const ListColumn = styled.div`
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  border-right: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const ListScroll = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
`;

/** Rightmost pane — no divider of its own. */
export const ThreadPane = styled.div`
  flex-direction: column;
  min-width: 0;
  min-height: 0;
`;

export const StateCard = styled(Card)`
  display: flex;
  justify-content: center;
`;
