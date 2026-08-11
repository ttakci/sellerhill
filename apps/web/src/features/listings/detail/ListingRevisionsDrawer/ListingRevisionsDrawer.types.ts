export interface ListingRevisionsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string | null;
  currency: string;
}

/**
 * One revision row, pre-formatted — the component renders strings only.
 *
 * `priceIncreased`/`quantityIncreased` are computed by the container from the
 * RAW numbers, not re-derived by parsing the formatted display strings: a
 * locale like tr-TR renders USD with localized separators, so stripping
 * non-digits from the formatted string and
 * re-parsing it as a float silently reads the wrong magnitude.
 */
export interface ListingRevisionRow {
  id: string;
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

export interface ListingRevisionsDrawerComponentProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  isError: boolean;
  rows: ListingRevisionRow[];
  page: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}
