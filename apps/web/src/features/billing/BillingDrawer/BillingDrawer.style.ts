// apps/web/src/features/billing/BillingDrawer/BillingDrawer.style.ts
//
// All styled(...) calls for the BillingDrawer. No JSX, no logic. Layout CSS
// only in templates (gap/flex/grid/padding) — colors, typography, and radii
// come from atom/molecule props and tkn() tokens.

import styled from '@emotion/styled';
import { Card, Text, tkn } from '@repo/ui';

/** Vertical stack of the drawer body sections. */
export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  padding-bottom: ${tkn('spacing.lg')};
`;

/** Section card wrapper — uses the design system Card with section variant. */
export const SectionCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')};
`;

/** Header row of the current-plan card: name + status badge. */
export const PlanHeaderRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

/** Stack for plan name + period info. */
export const PlanNameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

/** Grid of usage cells (2 per row on desktop, 1 on mobile). */
export const UsageGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.md')};
  width: 100%;

  & > * {
    min-width: 0;
  }

  @media (max-width: 36rem) {
    grid-template-columns: 1fr;
  }
`;

/** One usage cell: label, used/limit row, progress bar. */
export const UsageCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

/** Row showing used / limit values inline. */
export const UsageValueRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${tkn('spacing.xs')};
`;

/** Grid of plan comparison cards. */
export const PricingGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: ${tkn('spacing.md')};
  width: 100%;

  & > * {
    min-width: 0;
  }
`;

/** One plan comparison card. */
export const PlanCard = styled(Card)<{ $highlight: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.lg')};
  border-width: ${({ $highlight }) => ($highlight ? '0.125rem' : '0.0625rem')};
  border-style: solid;
`;

/** Header row of a plan card: name + optional "popular" badge. */
export const PlanCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
`;

/** Price row: amount + period. */
export const PlanPriceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${tkn('spacing.xs')};
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

/** Footer of a plan card holding the CTA button. */
export const PlanCardFooter = styled.div`
  margin-top: auto;
  display: flex;
`;

/** Row of compare-interval toggle + manage button. */
export const CompareHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

/** Notice shown when the provider is unconfigured. */
export const ProviderNotice = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

/** Small stack inside a usage cell for the period note. */
export const UsagePeriodNote = styled(Text)`
  margin-top: ${tkn('spacing.xs')};
`;
