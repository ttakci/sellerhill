/**
 * ConversationList styles — header (select all / bulk bar), scrolling rows.
 * Row states reuse the `colors.table.*` group so an open conversation reads
 * like a selected table row everywhere else in the app.
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
`;

/** Select-all row; becomes the bulk bar while rows are selected. A faint
 * tint sets it apart from the rows below as the list's own toolbar. */
export const ListHeader = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
  min-height: 3rem;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  background: ${tkn('colors.glass.tint')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const BulkActions = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
  margin-left: auto;
`;

export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
`;

export const Row = styled.div<{ $active: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  background: ${({ $active, theme }) => ($active ? theme.colors.table.rowSelected : 'transparent')};
  box-shadow: ${({ $active, theme }) =>
    $active ? `inset 0.1875rem 0 0 ${theme.colors.table.rowSelectedAccent}` : 'none'};
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.table.rowSelectedHover : theme.colors.table.rowHover};
  }
`;

export const RowCheck = styled.div`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  padding-top: ${tkn('spacing.2xs')};
`;

/**
 * Initials avatar. Unread rows get the SOLID brand fill (the same
 * treatment `table.rowSelectedAccent`-style emphasis uses elsewhere) so an
 * unread conversation reads at a glance without relying on bold text alone;
 * read rows get the quiet tint every brand-tinted disc in this app uses
 * (`EmptyState`'s icon circle, `CardStat`'s icon tile).
 */
export const Avatar = styled.div<{ $unread: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: ${tkn('radius.full')};
  background: ${({ $unread, theme }) => ($unread ? theme.colors.brand.primary : theme.colors.brand.secondary)};
`;

export const RowMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  flex: 1 1 auto;
  min-width: 0;
`;

/** The clickable body of a row. A real button so keyboard users can open a thread. */
export const RowButton = styled.button`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  width: 100%;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  border-radius: ${tkn('radius.sm')};

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const RowLine = styled.span`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;

  & > *:first-of-type {
    flex: 1 1 auto;
    min-width: 0;
  }
`;

export const RowMeta = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
`;

export const StateSlot = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: ${tkn('spacing.lg')} ${tkn('spacing.md')};
`;
