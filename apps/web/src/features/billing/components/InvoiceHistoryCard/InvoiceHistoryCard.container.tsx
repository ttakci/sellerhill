// apps/web/src/features/billing/components/InvoiceHistoryCard/InvoiceHistoryCard.container.tsx
//
// Stateful — owns its own paging cursor and accumulated invoice list, so it
// gets the full 4-file split (unlike the stateless PaymentMethodCard beside
// it).

import type { BillingInvoiceDto } from '@repo/shared';
import { getLocaleConfig } from '@repo/ui';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useGetBillingInvoicesQuery } from '../../api/billing.api';

import { InvoiceHistoryCard as View } from './InvoiceHistoryCard.component';

export const InvoiceHistoryCard = (): React.ReactElement => {
  const { i18n } = useTranslation();
  const localeCfg = getLocaleConfig(i18n.language);
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [accumulated, setAccumulated] = useState<BillingInvoiceDto[]>([]);

  const { data, isFetching, isError, refetch } = useGetBillingInvoicesQuery(
    cursor ? { startingAfter: cursor } : undefined,
  );

  // Append rather than replace, so "Show more" grows the list instead of
  // paging it — this is a history, and jumping between pages of a history is
  // worse than scrolling one. This syncs local accumulated state from the
  // RTK Query cache (an external source), which is exactly what an effect is
  // for — same justification as the other set-state-in-effect disables in
  // this codebase (ListingDetailPage.container.tsx, AppLayout.container.tsx).
  //
  // MERGE by id, never skip an id already seen. The rows most likely to
  // change are the unpaid ones, and "Pay now" opens Stripe's hosted page in a
  // NEW tab — so a seller who pays a past-due invoice there and comes back to
  // this tab needs the refreshed status, not the open/unpaid snapshot this
  // card first fetched. A dedupe-by-id-forever (the previous behaviour) froze
  // every invoice at whatever it looked like on first load, so a paid invoice
  // kept rendering "open" with Pay Now still offered, indefinitely.
  useEffect(() => {
    if (!data) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync local accumulated list from the RTK Query cache
    setAccumulated((prev) => {
      const incoming = new Map(data.items.map((invoice) => [invoice.id, invoice]));
      // Existing rows are updated in place (order preserved) so a refetched
      // page's fresher copy replaces the stale one; only genuinely new ids
      // from this page are appended at the end.
      const merged = prev.map((invoice) => incoming.get(invoice.id) ?? invoice);
      const seenIds = new Set(prev.map((invoice) => invoice.id));
      const appended = data.items.filter((invoice) => !seenIds.has(invoice.id));
      return [...merged, ...appended];
    });
  }, [data]);

  // Refresh the first page on window focus, so a payment completed in the
  // Pay Now tab (or Stripe's own portal) shows up without a manual reload.
  // Scoped to this component only — the RTK Query store-wide focus-refetch
  // listener (setupListeners) is not wired up anywhere in this app, and
  // adding it here would change refetch behaviour for every query, not just
  // this card.
  useEffect(() => {
    const handleFocus = (): void => {
      void refetch();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetch]);

  const handleShowMore = useCallback(() => {
    if (data?.nextCursor) {
      setCursor(data.nextCursor);
    }
  }, [data]);

  const handleRetry = useCallback(() => {
    void refetch();
  }, [refetch]);

  return (
    <View
      invoices={accumulated}
      isLoading={isFetching && accumulated.length === 0}
      isError={isError}
      hasMore={Boolean(data?.hasMore)}
      isLoadingMore={isFetching && accumulated.length > 0}
      locale={localeCfg.locale}
      onShowMore={handleShowMore}
      onRetry={handleRetry}
    />
  );
};

InvoiceHistoryCard.displayName = 'InvoiceHistoryCard';
