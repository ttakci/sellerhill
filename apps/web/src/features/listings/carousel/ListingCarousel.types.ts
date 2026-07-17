import type { ListingDto } from '@repo/shared';

/**
 * Public props for the ListingCarousel container.
 * Consumed by the overview page (Task 4) — slide state is owned internally.
 */
export interface ListingCarouselProps {
  listings: ListingDto[];
  onViewAll: () => void;
  viewAllLabel: string;
  showViewAll: boolean;
  onListingClick?: (listingId: string) => void;
  /** Override empty-state copy (e.g. dashboard period sales context) */
  emptyTitle?: string;
  emptySubtitle?: string;
}

/**
 * Internal props for the presentational component. Extends the public props
 * with carousel-slide state that the container owns and passes down.
 */
export interface ListingCarouselComponentProps extends ListingCarouselProps {
  currentSlide: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (index: number) => void;
}
