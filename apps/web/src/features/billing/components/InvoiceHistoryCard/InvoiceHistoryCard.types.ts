// apps/web/src/features/billing/components/InvoiceHistoryCard/InvoiceHistoryCard.types.ts

import type { BillingInvoiceDto } from '@repo/shared';

export interface InvoiceHistoryCardProps {
  invoices: BillingInvoiceDto[];
  isLoading: boolean;
  /** Nothing has ever loaded and the fetch failed — the whole card renders
   *  the error EmptyState. False whenever `invoices` already has rows, even
   *  if the most recent page fetch failed (see `hasLoadMoreError`). */
  isError: boolean;
  /** The invoices already on screen fetched fine; a LATER page (a "Show
   *  more" click, or its retry) failed. The table + accumulated rows stay
   *  rendered; only the load-more row switches to an inline error + retry,
   *  so a transient failure never discards what already loaded. */
  hasLoadMoreError: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  locale: string;
  onShowMore: () => void;
  onRetry: () => void;
}
