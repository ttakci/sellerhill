import { useCallback, useEffect, useRef, useState } from 'react';

import { SliderComponent } from './Slider.component';
import type { SliderProps } from './Slider.types';

export const Slider = ({ children, itemsToShow = 3, ariaLabel }: SliderProps) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    el.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState]);

  const handlePrev = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const cardWidth = el.clientWidth / itemsToShow;
    el.scrollBy({ left: -cardWidth, behavior: 'smooth' });
  }, [itemsToShow]);

  const handleNext = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const cardWidth = el.clientWidth / itemsToShow;
    el.scrollBy({ left: cardWidth, behavior: 'smooth' });
  }, [itemsToShow]);

  return (
    <SliderComponent
      itemsToShow={itemsToShow}
      ariaLabel={ariaLabel}
      onPrev={handlePrev}
      onNext={handleNext}
      canScrollLeft={canScrollLeft}
      canScrollRight={canScrollRight}
      scrollRef={scrollRef}
    >
      {children}
    </SliderComponent>
  );
};
