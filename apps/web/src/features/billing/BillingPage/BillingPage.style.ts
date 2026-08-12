// apps/web/src/features/billing/BillingPage/BillingPage.style.ts
//
// All styled(...) calls for the standalone Billing page. No JSX, no logic.
// Layout CSS only in templates — colors, typography, and radii come from
// atom/molecule props and tkn() tokens.

import styled from '@emotion/styled';
import { Card, PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;

/** Wrapper for the shared EmptyState on the loading / unavailable states. */
export const StateCard = styled(Card)`
  width: 100%;
`;

/** Header row of the current-plan section: name + status badge. */
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

export const ManageButtonRow = styled.div`
  display: flex;
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

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
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

/** Segmented control slot in the plans section header. */
export const CompareControlSlot = styled.div`
  display: flex;
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
export const PlanCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

/** Header row of a plan card: name + price. */
export const PlanCardHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
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
