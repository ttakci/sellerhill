import type { OrderDto } from '@repo/shared';

export interface OrderCarouselProps {
  orders: OrderDto[];
  onViewAll: () => void;
  viewAllLabel: string;
  showViewAll: boolean;
  onOrderClick?: (orderId: string) => void;
  formatCurrency: (value: number) => string;
  formatDate: (value: string) => string;
  /** Override empty-state copy (e.g. dashboard period context) */
  emptyTitle?: string;
  emptySubtitle?: string;
}

export interface OrderCarouselComponentProps extends OrderCarouselProps {
  currentSlide: number;
  onNext: () => void;
  onPrev: () => void;
  onGoTo: (index: number) => void;
}
