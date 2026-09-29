import { getLocaleConfig } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListingCarouselComponent } from './ListingCarousel.component';
import type { ListingCarouselProps } from './ListingCarousel.types';

export const ListingCarousel: React.FC<ListingCarouselProps> = ({
  listings,
  onViewAll,
  viewAllLabel,
  showViewAll,
  onListingClick,
  emptyTitle,
  emptySubtitle,
}) => {
  const { i18n } = useTranslation();
  /* Card price stat needs a locale for separators — currency itself comes
     from each listing's own `currency`, never the UI language. */
  const locale = useMemo(() => getLocaleConfig(i18n.language).locale, [i18n.language]);

  // Last 3 added listings sorted by createdAt descending.
  const recentListings = useMemo(
    () => [...listings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3),
    [listings],
  );

  // Carousel pagination state — 1 card per page.
  const [currentSlide, setCurrentSlide] = useState(0);

  const goToSlide = useCallback((index: number) => setCurrentSlide(index), []);
  const nextSlide = useCallback(
    () => setCurrentSlide((prev) => Math.min(prev + 1, recentListings.length - 1)),
    [recentListings.length],
  );
  const prevSlide = useCallback(() => setCurrentSlide((prev) => Math.max(prev - 1, 0)), []);

  return (
    <ListingCarouselComponent
      listings={recentListings}
      onViewAll={onViewAll}
      viewAllLabel={viewAllLabel}
      showViewAll={showViewAll}
      onListingClick={onListingClick}
      emptyTitle={emptyTitle}
      emptySubtitle={emptySubtitle}
      locale={locale}
      currentSlide={currentSlide}
      onNext={nextSlide}
      onPrev={prevSlide}
      onGoTo={goToSlide}
    />
  );
};
