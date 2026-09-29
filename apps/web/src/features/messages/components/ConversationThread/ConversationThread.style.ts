/**
 * ConversationThread styles — header, scrolling bubbles, pinned composer.
 *
 * RTL: nothing here is absolutely positioned. Bubbles align with
 * `align-self: flex-start|flex-end`, which already follows the document
 * direction, and the Emotion RTL plugin mirrors the asymmetric corner radii.
 */

import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
`;

export const Header = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  background: ${tkn('colors.surface.secondary')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

/** Same disc language as the list row avatar, one size up for the header. */
export const HeaderAvatar = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 2.75rem;
  height: 2.75rem;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.brand.secondary')};
`;

export const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  flex: 1 1 12rem;
  min-width: 0;
`;

export const HeaderMeta = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;

export const Messages = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.background.secondary')};
`;

export const Bubble = styled.div<{ $mine: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  align-self: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
  max-width: min(100%, 36rem);
  min-width: 0;
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  border-bottom-right-radius: ${({ $mine, theme }) => ($mine ? theme.radius.sm : theme.radius.lg)};
  border-bottom-left-radius: ${({ $mine, theme }) => ($mine ? theme.radius.lg : theme.radius.sm)};
  background: ${({ $mine, theme }) => ($mine ? theme.colors.table.rowSelected : theme.colors.surface.primary)};
  border: 0.0625rem solid ${({ $mine, theme }) => ($mine ? theme.colors.table.rowSelectedAccent : theme.colors.border.primary)};
`;

export const BubbleMeta = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
`;

/** eBay message text is plain text with line breaks; keep them. */
export const BubbleBody = styled.div`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  min-width: 0;
`;

export const MediaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const MediaLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  max-width: 100%;
  color: ${tkn('colors.brand.primary')};
  text-decoration: none;
  transition: opacity ${tkn('transitions.fast')};

  &:hover {
    text-decoration: underline;
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const MediaImage = styled.img`
  display: block;
  max-width: 100%;
  max-height: 16rem;
  height: auto;
  border-radius: ${tkn('radius.md')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const Composer = styled.div`
  margin-top: auto;
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const StateSlot = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: ${tkn('spacing.lg')} ${tkn('spacing.md')};
`;
