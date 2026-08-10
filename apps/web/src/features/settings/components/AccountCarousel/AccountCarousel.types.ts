import type React from 'react';

export interface AccountCarouselProps<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  renderCard: (item: T) => React.ReactNode;
  /** Max slides shown before a top-right "view all" link appears. Default 3. */
  maxVisible?: number;
  onViewAll: () => void;
  viewAllLabel: string;
}

export interface AccountCarouselComponentProps<T> extends Required<Pick<AccountCarouselProps<T>, 'items' | 'keyExtractor' | 'renderCard' | 'maxVisible' | 'onViewAll' | 'viewAllLabel'>> {
  currentSlide: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (index: number) => void;
}
