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
  background: ${tkn('colors.glass.surface')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  backdrop-filter: blur(8px);
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
  background: ${tkn('colors.brand.gradient')};
  color: ${tkn('colors.text.inverse')};
  box-shadow: 0 2px 10px ${tkn('colors.glass.glowBlue')};
`;

export const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  flex: 1 1 8rem;
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

/**
 * eBay keeps the item being discussed visible above the transcript. This is
 * an information strip rather than another card: it belongs to the thread
 * chrome and does not compete with the actual messages.
 */
export const ContextBar = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')};
  min-width: 0;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  background: ${tkn('colors.glass.panelCanvas')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const ContextImage = styled.img`
  display: block;
  flex: 0 0 auto;
  width: 3.5rem;
  height: 3.5rem;
  object-fit: contain;
  background: transparent;
  border-radius: ${tkn('radius.md')};
`;

export const ContextIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 3.5rem;
  height: 3.5rem;
  color: ${tkn('colors.brand.primary')};
  background: ${tkn('colors.brand.secondary')};
  border-radius: ${tkn('radius.md')};
`;

export const ContextText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  flex: 1 1 auto;
  min-width: 0;
`;

export const Messages = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: ${tkn('spacing.lg')};
  background: ${tkn('colors.glass.panelCanvas')};
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

/**
 * The 36rem chat-bubble cap fits a short reply, but eBay's own system
 * notices are a full inline-styled e-mail template (see \`SafeHtmlFrame\`) —
 * clamping one into chat-bubble width left most of the e-mail's own layout
 * squeezed into a narrow column with dead space around it. Those get the
 * full row width instead, like an e-mail client would give them.
 */
export const Bubble = styled.div<{ $mine: boolean; $wide?: boolean; $tone?: 'brand' | 'amber' }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  align-self: ${({ $mine }) => ($mine ? 'flex-end' : 'flex-start')};
  max-width: ${({ $wide }) => ($wide ? '100%' : 'min(100%, 42rem)')};
  width: ${({ $wide }) => ($wide ? '100%' : 'auto')};
  min-width: 0;
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  border-bottom-right-radius: ${({ $mine, theme }) => ($mine ? theme.radius.sm : theme.radius.lg)};
  border-bottom-left-radius: ${({ $mine, theme }) => ($mine ? theme.radius.lg : theme.radius.sm)};
  background: ${({ $mine, $tone, theme }) => {
    if ($mine) {
      return theme.colors.brand.secondary;
    }
    if ($tone === 'amber') {
      return theme.colors.semanticTint.warning;
    }
    return theme.colors.surface.primary;
  }};
  border: 0.0625rem solid
    ${({ $mine, $tone, theme }) => {
      if ($mine) {
        return `${theme.colors.brand.primary}22`;
      }
      if ($tone === 'amber') {
        return theme.colors.semanticTintBorder.warning;
      }
      return theme.colors.border.primary;
    }};
  border-left: 0.1875rem solid
    ${({ $mine, $tone, theme }) => {
      if ($tone === 'amber' && !$mine) {
        return theme.colors.semantic.warning;
      }
      if ($mine) {
        return theme.colors.brand.primary;
      }
      return 'transparent';
    }};
  box-shadow: ${({ $mine, theme }) => ($mine ? `0 2px 12px ${theme.colors.glass.glowBlue}` : theme.shadows.sm)};
  transition: all ${tkn('transitions.fast')};

  &:hover {
    border-color: ${({ $mine, $tone, theme }) => {
      if ($mine) {
        return theme.colors.brand.primary;
      }
      if ($tone === 'amber') {
        return theme.colors.semantic.warning;
      }
      return theme.colors.border.focus;
    }};
    transform: translateY(-1px);
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    padding: ${tkn('spacing.sm-md')};
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
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
  background: ${tkn('colors.glass.surface')};
  backdrop-filter: blur(8px);

  &:focus-within {
    box-shadow: 0 0 0 0.1875rem ${tkn('colors.brand.secondary')};
  }
`;

export const StateSlot = styled.div`
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: ${tkn('spacing.lg')} ${tkn('spacing.md')};
`;
