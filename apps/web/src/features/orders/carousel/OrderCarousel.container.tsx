import React, { useCallback, useMemo, useState } from 'react';

import { OrderCarouselComponent } from './OrderCarousel.component';
import type { OrderCarouselProps } from './OrderCarousel.types';

export const OrderCarousel: React.FC<OrderCarouselProps> = ({
  orders,
  onViewAll,
  viewAllLabel,
  showViewAll,
  onOrderClick,
  formatCurrency,
  formatDate,
  emptyTitle,
  emptySubtitle,
}) => {
  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 3),
    [orders]
  );

  const [currentSlide, setCurrentSlide] = useState(0);

  const goToSlide = useCallback((index: number) => setCurrentSlide(index), []);
  const nextSlide = useCallback(
    () => setCurrentSlide((prev) => Math.min(prev + 1, recentOrders.length - 1)),
    [recentOrders.length]
  );
  const prevSlide = useCallback(() => setCurrentSlide((prev) => Math.max(prev - 1, 0)), []);

  return (
    <OrderCarouselComponent
      orders={recentOrders}
      onViewAll={onViewAll}
      viewAllLabel={viewAllLabel}
      showViewAll={showViewAll}
      onOrderClick={onOrderClick}
      formatCurrency={formatCurrency}
      formatDate={formatDate}
      emptyTitle={emptyTitle}
      emptySubtitle={emptySubtitle}
      currentSlide={currentSlide}
      onNext={nextSlide}
      onPrev={prevSlide}
      onGoTo={goToSlide}
    />
  );
};
