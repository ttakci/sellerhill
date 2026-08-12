import styled from '@emotion/styled';
import { Card, PageContainer, SettingsCard, tkn } from '@repo/ui';

export const Container = PageContainer;

/**
 * Filter rail. `nowrap` + horizontal scroll rather than wrapping, for the same
 * reason the dashboard toolbar does it: a control that reflows onto a second
 * line on a narrow screen shifts every card below it.
 */
export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: nowrap;
  overflow-x: auto;
  gap: ${tkn('spacing.md')};
  margin-bottom: ${tkn('spacing.lg')};

  /* The rail scrolls; it must not paint its own scrollbar over the page. */
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
  }
`;

export const GroupStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const GroupCard = styled(SettingsCard)`
  height: auto;
`;

export const ItemStack = styled.div`
  display: flex;
  flex-direction: column;
`;

/**
 * One pending action — a settings-hub row, not a card.
 *
 * Same shape as `SettingsActionRow`/`SettingsInfoRow`: a bottom divider only,
 * no box/border/background of its own. `ItemRowButton` (`.withComponent`,
 * shares this exact style) renders as a real `<button>` when the item has a
 * navigation target, so the whole row is the click/tap surface (matches
 * `SettingsActionRow`'s "full row is a button" pattern); plain `ItemRow`
 * stays a `div` for a row with nothing to act on.
 */
export const ItemRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')} 0;
  border: none;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
  background: transparent;
  width: 100%;
  text-align: left;
  color: inherit;
  font: inherit;
  cursor: default;

  &:last-child {
    border-bottom: none;
  }

  &:hover > :last-child {
    transform: translateX(0.125rem);
  }

  @media (max-width: ${tkn('breakpoints.mdBelow')}) {
    flex-direction: column;
    align-items: stretch;
  }
`;

export const ItemRowButton = styled(ItemRow.withComponent('button'))`
  cursor: pointer;

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: -0.125rem;
  }
`;

/**
 * Severity glyph — an inline row icon like `SettingsInfoRow`'s `RowIcon`,
 * colored by severity instead of the fixed brand tint (color is what tells
 * critical/warning/info apart here, same role `brand.primary` plays there).
 */
export const SeverityMark = styled.span<{ $tone: 'critical' | 'warning' | 'info' }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${({ theme, $tone }) =>
    $tone === 'critical'
      ? theme.colors.semantic.error
      : $tone === 'warning'
        ? theme.colors.semantic.warning
        : theme.colors.semantic.info};
`;

export const ItemBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  flex: 1;
  min-width: 0;
`;

export const ItemTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
  margin-top: ${tkn('spacing.xs')};
`;

/**
 * Trailing chevron — same "row navigates" affordance as `SettingsActionRow`'s
 * `Arrow`. Animated via `ItemRow`'s own `&:hover > :last-child` rule (a plain
 * CSS combinator, not an Emotion component selector — those need the babel
 * plugin this monorepo doesn't have and crash at runtime).
 */
export const ItemAction = styled.span`
  display: inline-flex;
  align-items: center;
  align-self: center;
  flex-shrink: 0;
  transition: transform ${tkn('transitions.fast')};
`;

/** Empty and first-load states share one surface so they read as one screen. */
export const StateCard = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: center;
`;
