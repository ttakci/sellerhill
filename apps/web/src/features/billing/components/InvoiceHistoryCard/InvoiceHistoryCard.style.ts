// apps/web/src/features/billing/components/InvoiceHistoryCard/InvoiceHistoryCard.style.ts

import styled from '@emotion/styled';
import { SettingsCard, tkn } from '@repo/ui';

export const Card = styled(SettingsCard)`
  width: 100%;
`;

/** Wide content gets its own scroll container rather than overflowing the
 *  page — the repo's Table.style.ts OverflowWrapper convention. */
export const TableScroll = styled.div`
  width: 100%;
  overflow-x: auto;
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
