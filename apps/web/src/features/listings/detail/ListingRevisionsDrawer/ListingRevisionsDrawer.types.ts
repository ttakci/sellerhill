/**
 * Identifies which product the drawer is showing. Omitted from the listing
 * detail page (the page itself already makes that obvious); set by the
 * cross-listing Revision History table, where the drawer is the only place
 * that still shows which product is open.
 */
export interface ListingRevisionsDrawerSubject {
  title: string;
  imageUrl?: string;
  asin: string;
  storeName?: string;
}

export interface ListingRevisionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string | null;
  currency: string;
  subject?: ListingRevisionsDrawerSubject | null;
  /** Renders a "go to listing" link in the subject header — only meaningful together with `subject`. */
  onViewListing?: () => void;
}

/**
 * One revision row, pre-formatted — the component renders strings only.
 *
 * `priceIncreased`/`quantityIncreased` and the `*Delta` labels are computed by
 * the container from the RAW numbers, not re-derived by parsing the formatted
 * display strings: a locale like tr-TR renders USD with localized separators,
 * so stripping non-digits from the formatted string and re-parsing it as a
 * float silently reads the wrong magnitude.
 */
export interface ListingRevisionRow {
  id: string;
  recordedAt: string;
  previousPrice: string;
  newPrice: string;
  priceChanged: boolean;
  priceIncreased: boolean;
  /** e.g. `+$7.31 (+2.4%)` — only set when the price actually moved. */
  priceDelta: string | null;
  previousQuantity: string;
  newQuantity: string;
  quantityChanged: boolean;
  quantityIncreased: boolean;
  /** e.g. `-1` — only set when the stock actually moved. */
  quantityDelta: string | null;
}

export interface ListingRevisionsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  isError: boolean;
  subject?: ListingRevisionsDrawerSubject | null;
  onViewListing?: () => void;
  rows: ListingRevisionRow[];
  /** How many rows are currently in `rows` (accumulated across "load more"). */
  shown: number;
  /** Total rows the server has for this listing. */
  total: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  /**
   * "Last checked {{date}} — no change", pre-formatted — set only when the
   * product was verified more recently than the newest revision (or nothing
   * has ever changed but a check has happened). `null` renders nothing.
   */
  lastCheckedLabel: string | null;
}
