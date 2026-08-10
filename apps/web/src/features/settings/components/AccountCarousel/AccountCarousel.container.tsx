import React, { useCallback, useState } from 'react';

import { AccountCarouselComponent } from './AccountCarousel.component';
import type { AccountCarouselProps } from './AccountCarousel.types';

export const AccountCarousel = <T,>({
  items,
  keyExtractor,
  renderCard,
  maxVisible = 3,
  onViewAll,
  viewAllLabel,
}: AccountCarouselProps<T>): React.ReactElement | null => {
  const visibleCount = Math.min(items.length, maxVisible);

  const [currentSlide, setCurrentSlide] = useState(0);

  const goToSlide = useCallback((index: number) => setCurrentSlide(index), []);
  const nextSlide = useCallback(
    () => setCurrentSlide((prev) => Math.min(prev + 1, visibleCount - 1)),
    [visibleCount],
  );
  const prevSlide = useCallback(() => setCurrentSlide((prev) => Math.max(prev - 1, 0)), []);

  return (
    <AccountCarouselComponent
      items={items}
      keyExtractor={keyExtractor}
      renderCard={renderCard}
      maxVisible={maxVisible}
      onViewAll={onViewAll}
      viewAllLabel={viewAllLabel}
      currentSlide={currentSlide}
      onNext={nextSlide}
      onPrev={prevSlide}
      onGoTo={goToSlide}
    />
  );
};

AccountCarousel.displayName = 'AccountCarousel';
