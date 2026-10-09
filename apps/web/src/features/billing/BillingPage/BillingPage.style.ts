// apps/web/src/features/billing/BillingPage/BillingPage.style.ts
//
// All styled(...) calls for the standalone Billing page. No JSX, no logic.
// Layout CSS only in templates — colors, typography, and radii come from
// atom/molecule props and tkn() tokens.

import type { Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

import type { BillingFactTone as FactTone } from './BillingPage.types';

export const Container = PageContainer;

/** Wrapper for the shared EmptyState on the loading / unavailable states. */
export const StateCard = styled(Card)`
  width: 100%;
  box-sizing: border-box;
`;

const toneInk = (tone: FactTone, theme: Theme): string => {
  if (tone === 'positive') {return theme.colors.semantic.success;}
  if (tone === 'negative') {return theme.colors.semantic.error;}
  if (tone === 'warning') {return theme.colors.semantic.warning;}
  if (tone === 'brand') {return theme.colors.brand.primary;}
  return theme.colors.text.primary;
};

/*
 * The summary is the listing detail page's hero (ListingDetailPage): a blue
 * wash over the glass whatever the status (operator choice), the status badge
 * in its own row at the top-left, the plan's name as the heading, label /
 * value fact rows, and one blue money strip with a brand bar on its leading
 * edge. The page's actions sit inside the card on its right (the listing and
 * order detail pattern), so the two pages read the same way.
 */
export const Hero = styled(Card)`
  background-image: linear-gradient(135deg, ${tkn('colors.semanticTint.infoStrong')} 0%, transparent 65%);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'badge'
    'title'
    'facts'
    'actions'
    'kpi'
    'notices';
  align-content: start;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: minmax(0, 1fr) 19rem;
    grid-template-areas:
      'badge badge'
      'title actions'
      'facts actions'
      'kpi kpi'
      'notices notices';
    column-gap: ${tkn('spacing.xl')};
    padding: ${tkn('spacing.xl')};
  }
`;

/**
 * Update payment method / Manage subscription: stacked full width on a phone,
 * and from `md` in the card's own right column with a hairline on its left,
 * level with the plan's name — the listing / order detail's HeroActions.
 */
export const HeroActions = styled.div`
  grid-area: actions;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;

  & > * {
    width: 100%;
  }

  @media (min-width: ${tkn('breakpoints.md')}) {
    padding-left: ${tkn('spacing.xl')};
    border-left: 0.0625rem solid ${tkn('colors.border.primary')};
  }
`;

/** The status badge — its own row at the hero's top-left, in flow (card standard). */
export const StatusBadgeSlot = styled.div`
  grid-area: badge;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const TitleRow = styled.div`
  grid-area: title;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/** The plan's name heads the hero; from `lg` it takes the page-title size, like the listing title. */
export const PlanTitle = styled(UIText)`
  min-width: 0;
  line-height: ${tkn('typography.lineHeight.tight')};

  @media (min-width: ${tkn('breakpoints.lg')}) {
    font-size: ${tkn('typography.fontSize.xxl')};
  }
`;

/** Fact rows: a fixed label track so every value starts on the same x. */
export const FactList = styled.div`
  grid-area: facts;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const FactItem = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 11rem) minmax(0, 1fr);
  gap: ${tkn('spacing.sm')};
  align-items: center;
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.2xs')};
  }
`;

export const FactValue = styled(UIText)<{ $tone: FactTone }>`
  color: ${({ $tone, theme }) => toneInk($tone, theme)};
`;

/**
 * The money and usage story as ONE strip — next charge, then each quota — on
 * a blue tint with a solid brand-blue bar on its leading edge (the listing
 * hero's KpiStrip). A quota near or at its limit keeps its amber / red.
 */
export const KpiStrip = styled.div`
  grid-area: kpi;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: ${tkn('spacing.md')};
  margin-top: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  padding-left: ${tkn('spacing.lg')};
  border: 0.0625rem solid ${tkn('colors.semanticTintBorder.info')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.semanticTint.infoStrong')};
  box-shadow:
    inset 0.25rem 0 0 ${tkn('colors.brand.primary')},
    ${tkn('shadows.sm')};
`;

export const KpiItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const KpiLabel = styled(UIText)`
  line-height: ${tkn('typography.lineHeight.tight')};
`;

/** A quota's figure: what is used (coloured), then the ceiling in muted ink. */
export const UsageFigure = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

/** A quota's used figure — the page-title size, so it reads at a glance. */
export const UsageUsed = styled(FactValue)`
  font-size: ${tkn('typography.fontSize.xxl')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;

/** The quota's ceiling beside it, muted and smaller. */
export const UsageLimit = styled(UIText)`
  font-size: ${tkn('typography.fontSize.lg')};
`;

/** Notices that close the hero (pending downgrade, cancellation, past due, card expiring). */
export const SummaryNotices = styled.div`
  grid-area: notices;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  width: 100%;

  & > * {
    width: 100%;
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
