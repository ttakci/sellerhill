/**
 * ConversationList styles — header (select all / bulk bar), scrolling rows.
 * Row states reuse the `colors.table.*` group so an open conversation reads
 * like a selected table row everywhere else in the app.
 */

import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

const rowIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(0.375rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const dotPulse = keyframes`
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.35);
    opacity: 0.65;
  }
`;

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
  backdrop-filter: blur(8px);
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
  scrollbar-width: thin;
  scrollbar-color: ${tkn('colors.border.control')} transparent;

  &::-webkit-scrollbar {
    width: 0.375rem;
  }

  &::-webkit-scrollbar-thumb {
    background: ${tkn('colors.border.control')};
    border-radius: ${tkn('radius.full')};
  }

  &::-webkit-scrollbar-thumb:hover {
    background: ${tkn('colors.brand.primary')};
  }
`;

export const Row = styled.div<{ $active: boolean; $unread?: boolean; $tone?: 'brand' | 'amber'; $index?: number }>`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-left: 0.1875rem solid transparent;
  background: ${({ $active, $unread, theme }) => {
    if ($active) {
      return theme.colors.table.rowSelected;
    }
    if ($unread) {
      return theme.mode === 'dark' ? `${theme.colors.brand.primary}14` : `${theme.colors.brand.primary}0b`;
    }
    return 'transparent';
  }};
  border-left-color: ${({ $active, $unread, $tone, theme }) => {
    if ($active) {
      return $tone === 'amber' ? theme.colors.semantic.warning : theme.colors.table.rowSelectedAccent;
    }
    if ($unread) {
      return $tone === 'amber' ? theme.colors.semantic.warning : theme.colors.brand.primary;
    }
    return 'transparent';
  }};
  box-shadow: ${({ $active, theme }) =>
    $active ? `inset 0.1875rem 0 0 ${theme.colors.table.rowSelectedAccent}` : 'none'};
  transition:
    background ${tkn('transitions.fast')},
    border-color ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};
  animation: ${rowIn} 220ms ease both;
  /* stylelint-disable-next-line property-no-unknown */
  animation-delay: ${({ $index }) => `${Math.min($index ?? 0, 8) * 22}ms`};

  &:hover {
    background: ${({ $active, theme }) =>
      $active ? theme.colors.table.rowSelectedHover : theme.colors.table.rowHover};
    transform: translateX(0.0625rem);
  }

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transition: none;
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    animation-delay: 0ms;
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
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  box-shadow: ${tkn('shadows.sm')};
`;

export const Avatar = styled.div<{ $unread: boolean; $large?: boolean; $tone?: 'brand' | 'amber' }>`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: ${({ $large }) => ($large ? '3.5rem' : '1.5rem')};
  height: ${({ $large }) => ($large ? '3.5rem' : '1.5rem')};
  border-radius: ${tkn('radius.full')};
  background: ${({ $unread, $tone, theme }) => {
    if ($unread) {
      return $tone === 'amber' ? theme.colors.semantic.warning : theme.colors.brand.primary;
    }
    return theme.colors.brand.secondary;
  }};
  ${({ $large, theme }) => ($large ? '' : `border: 0.125rem solid ${theme.colors.surface.primary};`)}
  box-sizing: border-box;
  box-shadow: ${({ $unread, theme }) => ($unread ? `0 2px 8px ${theme.colors.glass.glowBlue}` : 'none')};
`;

export const AvatarBadge = styled.div`
  position: absolute;
  inset-inline-end: -0.25rem;
  inset-block-end: -0.25rem;
`;

/** Marks an unread conversation next to the sender's name. */
export const UnreadDot = styled.span<{ $tone?: 'brand' | 'amber' }>`
  flex: 0 0 auto;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: ${tkn('radius.full')};
  background: ${({ $tone, theme }) => ($tone === 'amber' ? theme.colors.semantic.warning : theme.colors.brand.primary)};
  box-shadow: 0 0 0 0.1875rem
    ${({ $tone }) => ($tone === 'amber' ? 'rgba(217, 119, 6, 0.18)' : 'rgba(37, 99, 235, 0.18)')};
  animation: ${dotPulse} 1.8s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
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
