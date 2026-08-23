// apps/web/src/features/billing/components/InvoiceHistoryCard/InvoiceHistoryCard.style.ts

import styled from '@emotion/styled';
import { Card as UICard, SettingsCard, tkn } from '@repo/ui';

export const Card = styled(SettingsCard)`
  width: 100%;
`;

export const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  justify-content: flex-end;
`;

export const MoreRow = styled.div`
  display: flex;
  justify-content: center;
  margin-top: ${tkn('spacing.md')};
`;

/** The inline load-more-failed notice stretches to the row's full width
 *  (matches `BillingPage.style.ts`'s `NoticeRow` pattern) — the plain "Show
 *  more" button beside it in `MoreRow` stays a centered, content-sized pill. */
export const LoadMoreErrorRow = styled(MoreRow)`
  & > * {
    flex: 1;
    width: 100%;
  }
`;

/**
 * Grid-view invoice tile — mirrors ListingJobsPage's JobCard layout
 * (header row / body / footer) so the invoice history's card view reads
 * like every other DataTable grid in the app, not a one-off shape.
 * `bordered` (not `elevated`/`interactive`): the card itself isn't
 * clickable — only its footer buttons are — so it must not carry the
 * hover/shadow affordance of a clickable tile.
 */
export const InvoiceGridCard = styled(UICard)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
`;

export const InvoiceCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
`;

export const InvoiceCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const InvoiceCardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
  margin-top: auto;
  padding-top: ${tkn('spacing.xs')};
`;
