import type { ReturnBucket, ReturnTab } from '@repo/shared';

import type { ProductTableCellMetaRow } from '@/domain-ui';

/**
 * One return, presentation-ready: every string is already localized and
 * formatted, so the table columns and the grid card render the same values and
 * neither needs a formatter of its own.
 */
export interface ReturnRowView {
  id: string;
  /** The order row we hold for it — null when that eBay order is not one of ours (the row is then not clickable). */
  orderId: string | null;
  /** The return id eBay assigned. */
  returnId: string;
  ebayOrderId: string | null;
  bucket: ReturnBucket;
  productTitle: string;
  imageUrl?: string;
  /** ASIN / eBay item id rows under the title. */
  productMeta: ProductTableCellMetaRow[];
  /** What eBay expects from the seller next — null when nothing is due. */
  dueLabel: string | null;
  /** "by <date>" for that action, when eBay set a deadline. */
  dueBy: string | null;
  isOverdue: boolean;
  reasonLabel: string;
  /** The buyer's own words. */
  buyerComment: string | null;
  refundAmount: string | null;
  /** "Refunded" once a refund was issued, otherwise "Estimated". */
  refundLabel: string | null;
  openedAt: string | null;
}

export type ReturnsUrlParam = 'tab' | 'page' | 'store' | 'q';

export interface ReturnsUrlState {
  tab: ReturnTab;
  page: number;
  /** eBay account id, or '' for all stores. */
  store: string;
  /** The applied (debounced) search term. */
  search: string;
}

export interface UseReturnsUrlStateResult {
  state: ReturnsUrlState;
  /** What the search box shows — ahead of `state.search` by the debounce. */
  searchInput: string;
  rowsPerPage: number;
  hasActiveFilters: boolean;
  /** True when the page was OPENED on a URL that already chose something. */
  openedWithSelection: boolean;
  setTab: (tab: ReturnTab) => void;
  setPage: (page: number) => void;
  setStore: (store: string) => void;
  setSearchInput: (value: string) => void;
  setRowsPerPage: (rows: number) => void;
  clearFilters: () => void;
}

/** What the DTO → view mapper needs from its caller. */
export interface ReturnRowContext {
  translate: (key: string, options?: Record<string, unknown>) => string;
  locale: string;
  /** Marketplace currency of a store — the fallback when eBay sent no currency on the return. */
  currencyFor: (ebayAccountId: string) => string;
}
