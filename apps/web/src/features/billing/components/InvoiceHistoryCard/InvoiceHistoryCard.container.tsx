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
  useEffect(() => {
    if (!data) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync local accumulated list from the RTK Query cache
    setAccumulated((prev) => {
      const seen = new Set(prev.map((invoice) => invoice.id));
      return [...prev, ...data.items.filter((invoice) => !seen.has(invoice.id))];
    });
  }, [data]);

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
