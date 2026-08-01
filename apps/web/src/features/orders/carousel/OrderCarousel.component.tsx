import { EmptyState, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { toOrderCardProps } from '../shared/order-card.mapper';
import { OrderCard } from '../shared/OrderCard';

import * as S from './OrderCarousel.style';
import type { OrderCarouselComponentProps } from './OrderCarousel.types';

export const OrderCarouselComponent: React.FC<OrderCarouselComponentProps> = ({
  orders,
  onViewAll,
  viewAllLabel,
  showViewAll,
  onOrderClick,
  formatCurrency,
  formatDate,
  emptyTitle,
  emptySubtitle,
  currentSlide,
  onNext,
  onPrev,
  onGoTo,
}) => {
  const { t } = useTranslation(['orders', 'translation']);

  if (orders.length === 0) {
    return (
      <S.CarouselWrapper>
        {/* Shared EmptyState — this was a bespoke icon+title+subtitle block. */}
        <EmptyState
          icon="shopping-bag"
          title={emptyTitle ?? t('orders.overview.emptyTitle')}
          description={emptySubtitle ?? t('orders.overview.emptySubtitle')}
          size="md"
        />
      </S.CarouselWrapper>
    );
  }

  return (
    <S.CarouselWrapper>
      {showViewAll && (
        <S.CarouselTopBar>
          <S.ViewAllButton variant="text" size="small" onClick={onViewAll}>
            <Text variant="body-sm" weight="semibold">{viewAllLabel}</Text>
          </S.ViewAllButton>
        </S.CarouselTopBar>
      )}
      <S.CarouselViewport>
        {orders.map((order, index) => {
          const slideClass = index === currentSlide ? 'active' : index < currentSlide ? 'prev' : '';
          const card = toOrderCardProps(order, t, formatCurrency, formatDate);
          return (
            <S.CarouselSlide key={order.id} className={slideClass}>
              <OrderCard
                {...card}
                onClick={onOrderClick ? () => onOrderClick(order.id) : undefined}
              />
            </S.CarouselSlide>
          );
        })}
      </S.CarouselViewport>
      {currentSlide > 0 && (
        <S.CarouselArrow
          type="button"
          $side="left"
          className="carousel-arrow"
          onClick={onPrev}
          aria-label={t('orders.carousel.previous')}
        >
          <Icon name="chevron-left" size={20} />
        </S.CarouselArrow>
      )}
      {currentSlide < orders.length - 1 && (
        <S.CarouselArrow
          type="button"
          $side="right"
          className="carousel-arrow"
          onClick={onNext}
          aria-label={t('orders.carousel.next')}
        >
          <Icon name="chevron-right" size={20} />
        </S.CarouselArrow>
      )}
      {orders.length > 1 && (
        <S.CarouselPagination>
          {orders.map((_, index) => (
            <S.PaginationDot
              key={index}
              variant="ghost"
              $active={index === currentSlide}
              onClick={() => onGoTo(index)}
              aria-label={String(index + 1)}
              aria-current={index === currentSlide}
            >
              <S.PaginationDotMark $active={index === currentSlide} />
            </S.PaginationDot>
          ))}
        </S.CarouselPagination>
      )}
    </S.CarouselWrapper>
  );
};
