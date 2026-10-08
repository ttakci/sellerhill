import type { CancellationBucket, CancellationTab, EbayCancellationAction } from '@repo/shared';
import type { BadgeVariant, IconName } from '@repo/ui';

import type { ProductTableCellMetaRow } from '@/domain-ui';

/** How a cancellation bucket renders: the badge colour family and its literal icon. */
export interface CancellationBucketPresentation {
  variant: BadgeVariant;
  icon: IconName;
}

/**
 * One cancellation request, presentation-ready: every string is already
 * localized and formatted, so the table columns and the grid card render the
 * same values and neither needs a formatter of its own.
 */
export interface CancellationRowView {
  id: string;
  /** The order row we hold for it — null when that eBay order is not one of ours. */
  orderId: string | null;
  cancelId: string;
  ebayOrderId: string | null;
  bucket: CancellationBucket;
  bucketLabel: string;
  bucketHint: string;
  bucketVariant: BadgeVariant;
  bucketIcon: IconName;
  productTitle: string;
  imageUrl?: string;
  productMeta: ProductTableCellMetaRow[];
  buyerLoginName: string | null;
  /** What eBay expects from the seller next — null when nothing is due. */
  dueLabel: string | null;
  /** "by <date>", when eBay set a deadline. */
  dueBy: string | null;
  /** The deadline alone, formatted — where the label ("Deadline") is printed beside it. */
  dueDate: string | null;
  isOverdue: boolean;
  reasonLabel: string;
  /** eBay's own value, kept only when the page has no label for it. */
  reasonRaw: string | null;
  refundAmount: string | null;
  requestedAt: string | null;
}

export type CancellationsUrlParam = 'tab' | 'page' | 'q' | 'c';

export interface CancellationsUrlState {
  tab: CancellationTab;
  page: number;
  /** The active store (top bar), or '' while the stores load. */
  store: string;
  /** The applied (debounced) search term. */
  search: string;
  /** The request open in the detail drawer (`?c=`), or '' for none. */
  selected: string;
}

export interface UseCancellationsUrlStateResult {
  state: CancellationsUrlState;
  /** What the search box shows — ahead of `state.search` by the debounce. */
  searchInput: string;
  rowsPerPage: number;
  hasActiveFilters: boolean;
  /** True when the page was OPENED on a URL that already chose something. */
  openedWithSelection: boolean;
  setTab: (tab: CancellationTab) => void;
  setPage: (page: number) => void;
  setSearchInput: (value: string) => void;
  setRowsPerPage: (rows: number) => void;
  clearFilters: () => void;
  /** Opens (or, with null, closes) the detail drawer. Not a filter — it never resets the page. */
  setSelected: (id: string | null) => void;
}

/** Who did a step of the journey — named under the step. */
export type CancellationHistoryActor = 'buyer' | 'seller' | 'ebay';

/** A step an open request still has ahead of it (`cancellations.history.upcoming.<key>`). */
export type CancellationUpcomingStep = 'answer' | 'refund' | 'close';

export interface CancellationHistoryRowView {
  id: string;
  actor: CancellationHistoryActor;
  label: string;
  /** Null for an upcoming step. */
  at: string | null;
  /** Not happened yet: drawn faded with a hollow marker; a step eBay recorded is green. */
  upcoming: boolean;
}

/** One request in full, presentation-ready for the detail drawer. */
export interface CancellationDetailView {
  row: CancellationRowView;
  /** False = eBay could not be read; the drawer shows the stored row and offers no answer. */
  live: boolean;
  actionsEnabled: boolean;
  /** Answers eBay lists right now (and the operator's switch allows). */
  actions: EbayCancellationAction[];
  ebayUrl: string | null;
  /** The order on eBay's Seller Hub; null when the request names no order. */
  ebayOrderUrl: string | null;
  requestedRefund: string | null;
  actualRefund: string | null;
  amountOwed: string | null;
  paymentStatus: string | null;
  closedAt: string | null;
  history: CancellationHistoryRowView[];
}

/** What the DTO → view mappers need from their caller. */
export interface CancellationRowContext {
  translate: (key: string, options?: Record<string, unknown>) => string;
  locale: string;
  /** Marketplace currency of a store — the fallback when eBay sent no currency on the request. */
  currencyFor: (ebayAccountId: string) => string;
}
