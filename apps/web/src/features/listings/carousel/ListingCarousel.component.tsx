import { EmptyState, Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';


import { toListingCardProps } from '../shared/listing-card.mapper';

import * as S from './ListingCarousel.style';
import type { ListingCarouselComponentProps } from './ListingCarousel.types';

import { ListingCard } from '@/domain-ui';

export const ListingCarouselComponent: React.FC<ListingCarouselComponentProps> = ({
  listings,
  onViewAll,
  viewAllLabel,
  showViewAll,
  onListingClick,
  emptyTitle,
  emptySubtitle,
  currentSlide,
  onNext,
  onPrev,
  onGoTo,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  if (listings.length === 0) {
    return (
      /* Shared EmptyState — this was a bespoke icon+title+subtitle block. */
      <EmptyState
        icon="inventory"
        title={emptyTitle ?? t('listings.overview.emptyTitle')}
        description={emptySubtitle ?? t('listings.overview.emptySubtitle')}
        size="md"
      />
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
        {listings.map((listing, index) => {
          const slideClass = index === currentSlide ? 'active' : index < currentSlide ? 'prev' : '';
          const card = toListingCardProps(listing, t);
          return (
            <S.CarouselSlide key={listing.id} className={slideClass} $isActive={index === currentSlide}>
              <ListingCard
                {...card}
                orientation="horizontal"
                onClick={onListingClick ? () => onListingClick(listing.id) : undefined}
              />
            </S.CarouselSlide>
          );
        })}
      </S.CarouselViewport>
      {currentSlide > 0 && (
        <S.CarouselArrow $side="left" variant="elevated" className="carousel-arrow" onClick={onPrev} aria-label={t('listings.carousel.previous')}>
          <Icon name="chevron-left" size={20} />
        </S.CarouselArrow>
      )}
      {currentSlide < listings.length - 1 && (
        <S.CarouselArrow $side="right" variant="elevated" className="carousel-arrow" onClick={onNext} aria-label={t('listings.carousel.next')}>
          <Icon name="chevron-right" size={20} />
        </S.CarouselArrow>
      )}
      {listings.length > 1 && (
        <S.CarouselPagination>
          {listings.map((_, index) => (
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
