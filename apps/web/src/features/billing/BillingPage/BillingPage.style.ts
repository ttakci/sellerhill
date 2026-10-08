// apps/web/src/features/billing/BillingPage/BillingPage.style.ts
//
// All styled(...) calls for the standalone Billing page. No JSX, no logic.
// Layout CSS only in templates — colors, typography, and radii come from
// atom/molecule props and tkn() tokens.

import type { Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

import type { BillingFactTone as FactTone, BillingSummaryTone as SummaryTone } from './BillingPage.types';

export const Container = PageContainer;

/** Wrapper for the shared EmptyState on the loading / unavailable states. */
export const StateCard = styled(Card)`
  width: 100%;
  box-sizing: border-box;
`;

const toneInk = (tone: SummaryTone | FactTone, theme: Theme): string => {
  if (tone === 'positive') {return theme.colors.semantic.success;}
  if (tone === 'negative') {return theme.colors.semantic.error;}
  if (tone === 'warning') {return theme.colors.semantic.warning;}
  if (tone === 'active') {return theme.colors.brand.primary;}
  return theme.colors.text.primary;
};

/*
 * The summary card is the job page's summary pane (ListingJobDetailsPage):
 * full width, a faint wash of the subscription's state hue over the glass,
 * status + actions on one row, then label / value lists with the one headline
 * figure on the right. Both pages read the same way on purpose.
 */
export const SummaryCard = styled(Card)<{ $tone: SummaryTone }>`
  padding: 0;
  overflow: hidden;
  background-image: linear-gradient(
    135deg,
    ${({ $tone, theme }) => {
      if ($tone === 'positive') {return theme.colors.semanticTint.success;}
      if ($tone === 'negative') {return theme.colors.semanticTint.error;}
      if ($tone === 'warning') {return theme.colors.semanticTint.warning;}
      if ($tone === 'active') {return theme.colors.semanticTint.info;}
      return theme.colors.semanticTint.neutral;
    }} 0%,
    transparent 65%
  );
`;

export const SummaryTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
`;

/** Status badge on the left, the page's actions on the right. */
export const SummaryHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
  min-width: 0;
`;

export const SummaryActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    width: 100%;
    & > * {
      flex: 1 1 auto;
    }
  }
`;

export const SummaryBody = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1.15fr) minmax(9rem, 0.7fr);
  align-items: start;
  gap: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
`;

/** One column: a small caption heading over its label / value list. */
export const FactColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const MetaList = styled.dl`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: ${tkn('spacing.md')};
  row-gap: ${tkn('spacing.xs')};
  align-items: baseline;
  margin: 0;
  min-width: 0;
`;

export const MetaRow = styled.div`
  display: contents;
`;

export const MetaLabel = styled.dt`
  margin: 0;
  min-width: 0;
`;

export const MetaValue = styled.dd`
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
`;

export const FactValue = styled(UIText)<{ $tone: FactTone }>`
  color: ${({ $tone, theme }) => toneInk($tone, theme)};
`;

/** The headline figure, right-aligned like the job page's progress. */
export const Headline = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  align-self: center;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    grid-column: 1 / -1;
    justify-content: flex-start;
    align-self: stretch;
  }
`;

export const HeadlineDot = styled.span<{ $tone: SummaryTone }>`
  width: ${tkn('spacing.sm')};
  height: ${tkn('spacing.sm')};
  flex: 0 0 auto;
  border-radius: ${tkn('radius.full')};
  background: ${({ $tone, theme }) =>
    $tone === 'default' ? theme.colors.text.tertiary : toneInk($tone, theme)};
`;

export const HeadlineCopy = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    align-items: flex-start;
  }
`;

export const HeadlineValue = styled(UIText)<{ $tone: SummaryTone }>`
  color: ${({ $tone, theme }) => toneInk($tone, theme)};
`;

/** Notices that close the summary card (cancellation, past due, card expiring). */
export const SummaryNotices = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  width: 100%;

  & > * {
    width: 100%;
  }
`;

/** The invoice list sits on the canvas, like the job page's item list. */
export const InvoicesSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
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

/** Pending-downgrade row: the copy on the left, Cancel on the right. */
export const ScheduledChangeRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
  width: 100%;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.semanticTint.infoStrong')};
`;
