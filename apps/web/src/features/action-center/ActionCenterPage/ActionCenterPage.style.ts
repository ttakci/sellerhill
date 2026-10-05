import styled from '@emotion/styled';
import { ActionCenterSeverity } from '@repo/shared';
import {
  type AppTheme,
  Badge,
  Card,
  PageContainer,
  SettingsCard,
  TabNav,
  Text,
  tkn,
} from '@repo/ui';

const severityColor = (severity: ActionCenterSeverity, theme: AppTheme) => {
  if (severity === ActionCenterSeverity.CRITICAL) {
    return theme.colors.semantic.error;
  }
  if (severity === ActionCenterSeverity.WARNING) {
    return theme.colors.semantic.warning;
  }
  return theme.colors.semantic.info;
};

const severityTint = (severity: ActionCenterSeverity, theme: AppTheme) => {
  if (severity === ActionCenterSeverity.CRITICAL) {
    return theme.colors.semanticTint.error;
  }
  if (severity === ActionCenterSeverity.WARNING) {
    return theme.colors.semanticTint.warning;
  }
  return theme.colors.semanticTint.info;
};

export const Container = PageContainer;

/** Compact counted filters; the shared TabNav owns wrapping and keyboard focus. */
export const Toolbar = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
`;

/**
 * Severity is the filter's information, so colour belongs here. Counts use a
 * solid semantic badge with white bold numerals; the selected tab gets only a
 * quiet tint, keeping the row useful without turning it into four CTA buttons.
 */
export const FilterTabs = styled(TabNav)`
  gap: ${tkn('spacing.xs')};

  > [role='tab'] {
    border: 0.0625rem solid transparent;
  }

  > [role='tab'] > span:last-child {
    color: ${tkn('colors.text.inverse')};
    font-weight: ${tkn('typography.fontWeight.bold')};
    box-shadow: 0 0 0 0.0625rem ${tkn('colors.glass.edge')};
  }

  > [role='tab']:nth-of-type(1) > span:last-child {
    background: ${tkn('colors.brand.primary')};
  }

  > [role='tab']:nth-of-type(2) {
    color: ${tkn('colors.semantic.error')};

    &[aria-selected='true'] {
      background: ${tkn('colors.semanticTint.error')};
      border-color: ${tkn('colors.semanticTintBorder.error')};
    }

    > span:last-child {
      background: ${tkn('colors.semantic.error')};
    }
  }

  > [role='tab']:nth-of-type(3) {
    color: ${tkn('colors.semantic.warning')};

    &[aria-selected='true'] {
      background: ${tkn('colors.semanticTint.warning')};
      border-color: ${tkn('colors.semanticTintBorder.warning')};
    }

    > span:last-child {
      background: ${tkn('colors.semantic.warning')};
    }
  }

  > [role='tab']:nth-of-type(4) {
    color: ${tkn('colors.semantic.info')};

    &[aria-selected='true'] {
      background: ${tkn('colors.semanticTint.info')};
      border-color: ${tkn('colors.semanticTintBorder.info')};
    }

    > span:last-child {
      background: ${tkn('colors.semantic.info')};
    }
  }
`;

export const SummaryList = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.xs+')};
  border: 0.0625rem solid ${tkn('colors.glass.edge')};
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.glass.surfaceStrong')};
  box-shadow: ${tkn('shadows.sm')};
  white-space: nowrap;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    width: 100%;
    justify-content: space-between;
    white-space: normal;
  }
`;

export const SummaryItem = styled.span<{ $severity: ActionCenterSeverity }>`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding: 0 ${tkn('spacing.sm')};
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-variant-numeric: tabular-nums;

  & + & {
    border-left: 0.0625rem solid ${tkn('colors.border.primary')};
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    padding: 0 ${tkn('spacing.xs')};
  }
`;

export const SummaryDot = styled.span<{ $severity: ActionCenterSeverity }>`
  width: 0.375rem;
  height: 0.375rem;
  border-radius: ${tkn('radius.full')};
  background: ${({ $severity, theme }) => severityColor($severity, theme)};
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

export const GroupCard = styled(SettingsCard)<{ $severity: ActionCenterSeverity }>`
  height: auto;
  border-left: 0.1875rem solid ${({ $severity, theme }) => severityColor($severity, theme)};
  transition:
    transform ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};

  @media (hover: hover) {
    &:hover {
      transform: translateY(-0.125rem);
      box-shadow: ${tkn('shadows.glassHover')};
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover {
      transform: none;
    }
  }
`;

export const GroupHeading = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const GroupIcon = styled.div<{ $severity: ActionCenterSeverity }>`
  width: ${tkn('controls.height.small')};
  height: ${tkn('controls.height.small')};
  display: grid;
  place-items: center;
  flex-shrink: 0;
  border-radius: ${tkn('radius.md')};
  color: ${({ $severity, theme }) => severityColor($severity, theme)};
  background: ${({ $severity, theme }) => severityTint($severity, theme)};
`;

export const GroupHeadingCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const ItemStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

/**
 * One pending action on a quiet inset surface. A real button is used whenever
 * the item has a destination, so the whole row remains the click/tap target.
 */
export const ItemRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.surface.secondary')};
  width: 100%;
  text-align: left;
  color: inherit;
  font: inherit;
  cursor: default;

`;

export const ItemRowButton = styled(ItemRow.withComponent('button'))`
  cursor: pointer;
  transition:
    border-color ${tkn('transitions.fast')},
    background ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};

  &:hover {
    border-color: ${tkn('colors.semanticTintBorder.info')};
    background: ${tkn('colors.semanticTint.info')};
    transform: translateX(0.125rem);
  }

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

  @media (prefers-reduced-motion: reduce) {
    transition: none;

    &:hover,
    &:hover > :last-child {
      transform: none;
    }
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

/** The item's real action label plus the app-wide trailing-arrow affordance. */
export const ItemAction = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  flex-shrink: 0;
  transition: transform ${tkn('transitions.fast')};
  color: ${tkn('colors.brand.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
`;


/** The stores a connection item is about, as wrapping tags under its description. */
export const StoreList = styled.ul`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
  margin: 0;
  padding: 0;
  list-style: none;
`;

export const StoreListItem = styled.li`
  display: inline-flex;
  min-width: 0;
`;

/** "Applies to your whole account" — shown on plan and setup items in every store view. */
export const AccountWideNote = styled.div`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

/** Empty and first-load states share one surface so they read as one screen. */
export const StateCard = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: center;
`;
