// apps/web/src/features/billing/components/InvoiceHistoryCard/InvoiceHistoryCard.types.ts

import type { BillingInvoiceDto } from '@repo/shared';

export interface InvoiceHistoryCardProps {
  invoices: BillingInvoiceDto[];
  isLoading: boolean;
  isError: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  locale: string;
  onShowMore: () => void;
  onRetry: () => void;
}
