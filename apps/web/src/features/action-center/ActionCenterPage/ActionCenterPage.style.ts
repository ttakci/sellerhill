import styled from '@emotion/styled';
import { Badge, Card, PageContainer, SettingsCard, Text, tkn } from '@repo/ui';

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

/**
 * Two independent flex columns, NOT a CSS grid. A grid aligns cards into
 * rows — with a 2-column `auto-fit` track, the row holding the tallest card
 * (e.g. "Plan ve kapasite") stretches to that height, which pushes every
 * card below it in the OTHER column down too, even though that column's own
 * content is short. Two flex columns stack purely by their own content
 * height, so the left column's second card sits directly under the first
 * with a fixed gap regardless of what the right column is doing.
 *
 * `flex-wrap` + `min()` in `GroupColumn`'s basis (not a manual breakpoint)
 * is what collapses to one column on narrow viewports, mirroring
 * `DataTable`'s `minmax(min(100%, ...), 1fr)` idiom for a flex context.
 */
export const GroupStack = styled.div`
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: ${tkn('spacing.lg')};
`;

/**
 * One column of stacked group cards. Gap between cards in the SAME column is
 * `spacing.md` — a step tighter than the `spacing.lg` between columns, and
 * fixed: it no longer depends on `align-items: start` row math, so it can't
 * be stretched by a sibling column's height.
 */
export const GroupColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  flex: 1 1 min(26rem, 100%);
  min-width: 0;
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
 * no box/border/background of its own; same vertical `spacing.md` padding
 * both of those use, kept unchanged so the row rhythm stays aligned with the
 * rest of the Settings surface. `ItemRowButton` (`.withComponent`, shares
 * this exact style) renders as a real `<button>` when the item has a
 * navigation target, so the whole row is the click/tap surface (matches
 * `SettingsActionRow`'s "full row is a button" pattern); plain `ItemRow`
 * stays a `div` for a row with nothing to act on.
 *
 * Column, not row: the body (title/description/chip list) stacks above a
 * right-aligned "Detay ->" footer — see `ItemFooter` — instead of a bare
 * arrow pinned to the vertical center of a multi-line row.
 */
export const ItemRow = styled.div`
  display: flex;
  flex-direction: column;
  /* Bigger than ItemBody's own internal spacing.sm rhythm, and a step up from
     spacing.md — the "Detay ->" footer needs clear air above it so it reads
     as trailing the content, not as one more line of it. This gap only ever
     separates ItemBody from ItemFooter (the row's only two children), so
     raising it is exactly "more padding above the footer" without touching
     any other rhythm on the row. */
  gap: ${tkn('spacing.lg')};
  /* A tick more than SettingsInfoRow/SettingsActionRow's plain spacing.md —
     those rows are a single line; this one carries a title, a description
     and a chip list, so the same padding read as rows glued together. The
     extra padding is also what gives the card itself a bit more height. */
  padding: ${tkn('spacing.md+')} 0;
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
`;

export const ItemRowButton = styled(ItemRow.withComponent('button'))`
  cursor: pointer;

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: -0.125rem;
  }

  /*
   * Nudges the "Detay ->" footer on hover — a plain CSS combinator on the
   * button's own last child, not an Emotion component selector (those need
   * the babel plugin this monorepo doesn't have and crash at runtime). Scoped
   * to the button variant only: a non-clickable ItemRow has no footer to
   * nudge and no click affordance to hint at.
   */
  &:hover > :last-child {
    transform: translateX(0.125rem);
  }
`;

/** Title, description and chip list — more room between them than the old
 * `spacing.2xs` gave, which read as one crowded paragraph rather than three
 * distinct lines. */
export const ItemBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  flex: 1;
  min-width: 0;
`;

/**
 * Title + count badge, wrapping onto a second line together (not truncated)
 * when a long title doesn't fit — an ellipsis mid-word on a title read worse
 * than the wrap. `align-items: center` keeps the badge vertically centered on
 * whichever line it lands on.
 */
export const ItemTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const ItemTitle = styled(Text)`
  min-width: 0;
`;

export const CountBadge = styled(Badge)`
  flex-shrink: 0;
`;

/**
 * Breakdown reasons, stacked as wrapping text lines — NOT pill badges.
 * `Badge` is `white-space: nowrap` by design (it's tuned for short tags), but
 * these values are reused verbatim from `orders:orders.autoFulfill.reason.*` /
 * `listings:listings.jobs.failure.*` (see the container), which are full
 * sentences ("your blacklist blocked this (keyword: …)"). A nowrap pill forced
 * that sentence to its natural width, overflowing the card. This mirrors
 * `ListingJobDetailsPage`'s own failure-reason cell, which renders the same
 * strings as plain wrapping `<Text variant="body-sm">` — same tokens, same
 * pattern, just listed instead of tabled.
 */
export const ChipList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  margin: 0;
  padding: 0;
  list-style: none;
`;

export const ChipListItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/**
 * Purely decorative marker — never a text bullet character, so it carries no
 * i18n weight. `margin-right` (on top of `ChipListItem`'s own `gap`) is
 * deliberately separate from the label↔count gap: the dot sat almost flush
 * against its label text, so it needs its own breathing room while the
 * "label · count" pairing stays tight.
 */
export const ChipDot = styled.span`
  flex-shrink: 0;
  width: 0.25rem;
  height: 0.25rem;
  margin-top: 0.5rem;
  margin-right: ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.text.tertiary')};
`;

export const ChipLabel = styled(Text)`
  flex: 1 1 0%;
  min-width: 0;
  overflow-wrap: break-word;
`;

/**
 * Same round-badge language as the item's own `CountBadge` — a short number
 * is exactly what `Badge`'s `white-space: nowrap` is meant for (see the
 * `ChipList` note above: it was misused on the long label, never on this).
 * `neutral` keeps it a step quieter than the item-level severity badge, since
 * this is a sub-reason count, not the row's own headline number.
 */
export const ChipCount = styled(Badge)`
  flex-shrink: 0;
`;

/**
 * Right-aligned footer holding the "Detay ->" affordance — same placement as
 * `ListingCard`/`OrderCard`/`ListingJobsPage`'s own card `Footer`, so a
 * pending-action row reads like every other clickable card in the app instead
 * of inventing a second "this row navigates" convention.
 */
export const ItemFooter = styled.div`
  display: flex;
  justify-content: flex-end;
`;

/**
 * "Detay" label + arrow — the same trailing affordance the Settings
 * carousels' cards use. Animated via `ItemRowButton`'s own
 * `&:hover > :last-child` rule (a plain CSS combinator, not an Emotion
 * component selector — those need the babel plugin this monorepo doesn't
 * have and crash at runtime).
 */
export const ItemAction = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  flex-shrink: 0;
  transition: transform ${tkn('transitions.fast')};
`;

/** Empty and first-load states share one surface so they read as one screen. */
export const StateCard = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: center;
`;
