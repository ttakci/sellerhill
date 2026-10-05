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
  transition: all ${tkn('transitions.fast')};

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.table.rowSelectedHover : theme.colors.table.rowHover};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

export const RowCheck = styled.div`
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  padding-top: ${tkn('spacing.2xs')};
`;

/**
 * The row's leading visual: the photo of the item the buyer is writing about
 * (transparent plate, like every product image in the app) with the buyer's
 * initial as a small badge on its corner — or, with no photo, the initial
 * disc on its own. Unread rows get the SOLID brand fill so unread reads at a
 * glance without relying on bold text alone; read rows get the quiet tint
 * every brand-tinted disc in this app uses (`EmptyState`'s icon circle).
 * The badge sits on logical insets so RTL mirrors it by document direction.
 */
export const Thumb = styled.div`
  position: relative;
  flex: 0 0 auto;
  width: 3.5rem;
  height: 3.5rem;
`;

export const ThumbImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: transparent;
  border-radius: ${tkn('radius.md')};
`;

export const Avatar = styled.div<{ $unread: boolean; $large?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: ${({ $large }) => ($large ? '3.5rem' : '1.5rem')};
  height: ${({ $large }) => ($large ? '3.5rem' : '1.5rem')};
  border-radius: ${tkn('radius.full')};
  background: ${({ $unread, theme }) => ($unread ? theme.colors.brand.primary : theme.colors.brand.secondary)};
  ${({ $large, theme }) => ($large ? '' : `border: 0.125rem solid ${theme.colors.surface.primary};`)}
  box-sizing: border-box;
`;

export const AvatarBadge = styled.div`
  position: absolute;
  inset-inline-end: -0.25rem;
  inset-block-end: -0.25rem;
`;

/** Marks an unread conversation next to the sender's name. */
export const UnreadDot = styled.span`
  flex: 0 0 auto;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.brand.primary')};
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

/** Name line: the unread dot, the name (takes the slack) and the date. */
export const NameLine = styled.span`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const NameText = styled.span`
  flex: 1 1 auto;
  min-width: 0;
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
