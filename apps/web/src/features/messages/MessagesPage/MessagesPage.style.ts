/**
 * MessagesPage styles.
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

/** Store filter row (and, below `lg`, the type/folder switches). */
export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
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

export const StoreTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  max-width: 14rem;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm-md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  cursor: pointer;
  color: ${tkn('colors.text.primary')};
  font: inherit;
  white-space: nowrap;
  transition:
    border-color ${tkn('transitions.fast')},
    background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.surface.secondary')};
    border-color: ${tkn('colors.brand.primary')};
  }
`;

export const StoreLabel = styled.span`
  min-width: 0;
  overflow: hidden;
`;

export const Layout = styled.div<{ $threadOpen: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${tkn('spacing.md')};
  align-items: stretch;

  /* Below md: one pane at a time. */
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
    grid-template-columns: minmax(16rem, 22rem) minmax(0, 1fr);

    & > [data-pane='list'],
    & > [data-pane='thread'] {
      display: flex;
    }
  }

  @media (min-width: ${tkn('breakpoints.xl')}) {
    grid-template-columns: 12rem minmax(16rem, 20rem) minmax(0, 1fr);

    & > [data-pane='rail'] {
      display: flex;
    }
  }
`;

export const RailPane = styled(Card)`
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  align-self: start;
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

/** The list card plus its detached pagination bar. */
export const ListColumn = styled.div`
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/** List and thread panes: a card that scrolls its own content. */
export const Pane = styled(Card)`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
  height: 70vh;
  min-height: 28rem;
  overflow: hidden;
`;

export const StateCard = styled(Card)`
  display: flex;
  justify-content: center;
`;
