import type { ViewMode } from '@repo/ui';
import type { ChangeEvent } from 'react';

import type { ListingRevisionsDrawerSubject } from '@/features/listings/detail/ListingRevisionsDrawer';

/**
 * One price/quantity change, pre-formatted for display — the same "container
 * formats, component only renders" split `ListingRevisionRow` uses.
 */
export interface RevisionHistoryRow {
  id: string;
  listingId: string;
  title: string;
  imageUrl?: string;
  asin: string;
  storeName?: string;
  currency: string;
  recordedAt: string;
  previousPrice: string;
  newPrice: string;
  priceChanged: boolean;
  priceIncreased: boolean;
  previousQuantity: string;
  newQuantity: string;
  quantityChanged: boolean;
  quantityIncreased: boolean;
  /** Amazon stock at this check, formatted; `null` on rows older than migration 134. */
  previousSourceStock: string | null;
  newSourceStock: string | null;
  sourceStockChanged: boolean;
  sourceStockIncreased: boolean;
}

/** State for the "all revisions of this listing" drawer, opened from a row. */
export interface RevisionHistoryDrawerState {
  isOpen: boolean;
  listingId: string | null;
  currency: string;
  subject: ListingRevisionsDrawerSubject | null;
}

export interface RevisionHistoryPageComponentProps {
  rows: RevisionHistoryRow[];
  totalCount: number;
  isInitialLoading: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  search: string;
  onSearchChange: (e: ChangeEvent<HTMLInputElement>) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onRowClick: (row: RevisionHistoryRow) => void;
  onBack: () => void;
  drawer: RevisionHistoryDrawerState;
  onCloseDrawer: () => void;
  onViewListing: () => void;
  pagination: {
    count: number;
    page: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rowsPerPage: number) => void;
    labelRowsPerPage: string;
    labelInfo: string;
  };
}
