import type { EbayReturnAction, ReturnBucket, ReturnTab } from '@repo/shared';

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

export type ReturnsUrlParam = 'tab' | 'page' | 'store' | 'q' | 'r';

export interface ReturnsUrlState {
  tab: ReturnTab;
  page: number;
  /** eBay account id, or '' for all stores. */
  store: string;
  /** The applied (debounced) search term. */
  search: string;
  /** The return open in the detail drawer (`?r=`), or '' for none. */
  selected: string;
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
  /** Opens (or, with null, closes) the detail drawer. Not a filter — it never resets the page. */
  setSelected: (id: string | null) => void;
}

/** Who did a step of the return's history, as eBay names the author — drives the marker colour. */
export type ReturnHistoryActor = 'buyer' | 'seller' | 'ebay';

export interface ReturnHistoryRowView {
  id: string;
  actor: ReturnHistoryActor;
  /** The step, localized (past tense). */
  label: string;
  author: string | null;
  at: string | null;
  notes: string | null;
  /** "Offered a partial refund of X" — the amount, formatted. */
  partialRefund: string | null;
  trackingNumber: string | null;
  rma: string | null;
}

export interface ReturnShipmentRowView {
  id: string;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  /** eBay's delivery status, localized where known. */
  statusLabel: string | null;
  markedReceived: boolean;
}

/**
 * One return in full, presentation-ready for the detail drawer. `row` is the
 * same view the list renders, so the two can never disagree about the bucket,
 * what is due or the refund.
 */
export interface ReturnDetailView {
  row: ReturnRowView;
  /** False = eBay could not be read; the drawer shows the stored row and offers no action. */
  live: boolean;
  /** In-app actions eBay lists right now (and the operator's switch allows). */
  actions: EbayReturnAction[];
  /** The refund the "Issue refund" action would send, formatted — eBay's own estimate. */
  refundToIssue: string | null;
  /** The eBay page for the return, when eBay gave one. */
  ebayUrl: string | null;
  /** What eBay lists that is NOT an in-app action (decline, message, label…), localized. */
  optionsOnEbay: string[];
  buyerLoginName: string | null;
  quantity: number | null;
  returnTypeLabel: string | null;
  itemPrice: string | null;
  estimatedRefund: string | null;
  actualRefund: string | null;
  closeReasonLabel: string | null;
  closedAt: string | null;
  history: ReturnHistoryRowView[];
  shipments: ReturnShipmentRowView[];
}

/** What the DTO → view mapper needs from its caller. */
export interface ReturnRowContext {
  translate: (key: string, options?: Record<string, unknown>) => string;
  locale: string;
  /** Marketplace currency of a store — the fallback when eBay sent no currency on the return. */
  currencyFor: (ebayAccountId: string) => string;
}
