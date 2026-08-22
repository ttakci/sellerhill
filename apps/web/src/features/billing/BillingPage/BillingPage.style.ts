// apps/web/src/features/billing/BillingPage/BillingPage.style.ts
//
// All styled(...) calls for the standalone Billing page. No JSX, no logic.
// Layout CSS only in templates — colors, typography, and radii come from
// atom/molecule props and tkn() tokens.

import styled from '@emotion/styled';
import { Card, PageContainer, SettingsCard, tkn } from '@repo/ui';

export const Container = PageContainer;

/** Wrapper for the shared EmptyState on the loading / unavailable states. */
export const StateCard = styled(Card)`
  width: 100%;
`;

/**
 * The "Aboneliğiniz" card, capped rather than stretched full-width.
 *
 * `PageContainer` is a column flex with the default `align-items: stretch`,
 * so every direct child fills its width by default — fine for the plans and
 * add-ons grids, which have enough content to earn the space, but this card
 * holds a plan name, one meta line and three compact rings: on a wide screen
 * it read as mostly empty white space. `align-self: flex-start` opts out of
 * the stretch so `max-width` can actually take effect; `width: 100%` under
 * that ceiling keeps it filling the row on any viewport narrower than the cap.
 *
 * `40rem` specifically: below that the three usage rings (see `UsageGrid`'s
 * own `11rem` floor) don't all fit on one row and the middle one drops to a
 * second line — the card was still too narrow to earn the row-of-3 grid was
 * built for.
 */
export const SubscriptionCard = styled(SettingsCard)`
  width: 100%;
  max-width: 40rem;
  align-self: flex-start;
`;

/**
 * Top row of the plan card: just the identity now.
 *
 * The status badge used to live here, next to the plan name, and the manage
 * button lived in a row of its own below the usage — three separate places
 * for what is really two pieces of chrome. The badge is now the SettingsCard
 * header's `headerRight` (top-right of the whole card, the conventional badge
 * corner — see the listing-detail hero card's StatusBadgeSlot), and the manage
 * action lives inside the notice box at the bottom. This row is left with only
 * the plan name and its one muted meta line.
 */
export const PlanHeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

/** Plan name + meta line, stacked. */
export const PlanNameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/** The single muted line carrying interval + renewal/expiry. */
export const PlanMetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  flex-wrap: wrap;
`;

/** Separates the quota block from the plan identity above it inside one card. */
export const PlanDivider = styled.div`
  height: 1px;
  width: 100%;
  background: ${tkn('colors.border.secondary')};
`;

/**
 * Quota rows, three across on desktop.
 *
 * `auto-fit`/`minmax` rather than a fixed `repeat(3, 1fr)`: the same pattern
 * `DataTable`'s card grid uses, so a row never needs a hand-picked breakpoint
 * to reflow — it collapses to fewer columns, then one, purely from available
 * width. `11rem` (down from `13rem`) is sized to actually fit 3 across inside
 * `SubscriptionCard`'s own `40rem` cap — the floor and the card width are a
 * matched pair, not independent numbers.
 */
export const UsageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
  gap: ${tkn('spacing.md')};
  width: 100%;

  & > * {
    min-width: 0;
  }
`;

/** One quota row: ring on the left, label and figures beside it. */
export const UsageCell = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

/** Label + figures, right of the ring. */
export const UsageTextStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

/** Row showing used / limit values inline. */
export const UsageValueRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${tkn('spacing.xs')};
  flex-wrap: wrap;
`;

/** Segmented control slot in the plans section header. */
export const CompareControlSlot = styled.div`
  display: flex;
`;

/**
 * Grid of plan comparison cards — fixed at 3 columns on desktop so the 12-tier
 * catalog reads as 4 rows of 3 rather than reflowing into an unpredictable
 * number of columns per viewport. `auto-fit` was fine at 3 plans; at 12 it
 * produced 5-6 narrow columns on a wide screen, which is a catalog rather than
 * a comparison. Steps down to 2 and then 1 so a card never falls below a
 * readable width.
 */
export const PricingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: ${tkn('spacing.md')};
  width: 100%;

  & > * {
    min-width: 0;
  }

  @media (max-width: ${tkn('breakpoints.lgBelow')}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
  }
`;

/** Feature list in a plan card. */
export const PlanFeatureList = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  margin: 0;
  padding: 0;
  list-style: none;
`;

/** One feature item with a check icon. */
export const PlanFeatureItem = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.xs')};
`;

/**
 * Footer of a plan card holding the CTA button.
 *
 * A real top margin, not `margin-top: auto` — these cards stack in a single
 * column (`DrawerPlanList`) and size to their own content, so an auto margin
 * had no free space to consume and the button sat flush against the feature
 * list above it.
 */
export const PlanCardFooter = styled.div`
  margin-top: ${tkn('spacing.lg')};
  display: flex;
`;

/**
 * Grid of top-up packs. Narrower minimum than the plan grid: a pack card
 * carries one number and one price, not a feature list.
 */
export const AddonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: ${tkn('spacing.md')};
  width: 100%;

  & > * {
    min-width: 0;
  }
`;

/** One top-up pack. */
export const AddonCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

/** Quantity + price stack inside a pack card. */
export const AddonHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const AddonFooter = styled.div`
  margin-top: auto;
  display: flex;
`;

/**
 * The usage block, set apart from the plan identity above it.
 *
 * Its own row with real separation rather than another line in the stack:
 * "what plan am I on" and "how much have I used" are two questions, and running
 * them together made the card read as one undifferentiated column of text.
 */
export const UsageSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
  margin-top: ${tkn('spacing.sm')};
`;

/** Callout row for the "no active subscription" notice. */
/**
 * Wraps the notice InfoMessage and stretches it to the row's full width.
 *
 * `width: 100%` on the row alone was not enough — InfoMessage's own container
 * is a flex child with no `flex-grow`, so it sized to its content and stopped
 * well short of the usage grid's right edge above it. `& > *` reaches through
 * to the actual box and gives it `flex: 1`, so it ends exactly where the grid
 * does instead of at an unrelated width.
 */
/**
 * `margin-top: spacing.lg` — the notice sat almost flush against the usage
 * grid above it at `spacing.xs` (4px), reading as glued on rather than as its
 * own closing element of the card. `lg` matches the breathing room a new
 * section gets elsewhere on this card (`UsageSection`'s own internal gap).
 */
export const NoticeRow = styled.div`
  display: flex;
  width: 100%;
  margin-top: ${tkn('spacing.lg')};

  & > * {
    flex: 1;
    width: 100%;
  }
`;

/** Plan cards inside the drawer — always one per row at drawer width. */
export const DrawerPlanList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
`;

/** Section heading inside the plans drawer. */
export const DrawerSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  width: 100%;
`;
