import type { ViewMode } from '@repo/ui';
import type { ChangeEvent } from 'react';

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
  recordedAt: string;
  previousPrice: string;
  newPrice: string;
  priceChanged: boolean;
  priceIncreased: boolean;
  previousQuantity: string;
  newQuantity: string;
  quantityChanged: boolean;
  quantityIncreased: boolean;
}

export interface RevisionHistoryPageComponentProps {
  rows: RevisionHistoryRow[];
  totalCount: number;
  isInitialLoading: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  search: string;
  onSearchChange: (e: ChangeEvent<HTMLInputElement>) => void;
  storeFilter: string;
  onStoreFilterChange: (value: string | number) => void;
  storeOptions: { value: string; label: string }[];
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  onRowClick: (row: RevisionHistoryRow) => void;
  onBack: () => void;
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
