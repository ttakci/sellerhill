import { ListingStatus, type ListingDto } from '@repo/shared';
import { Icon, ListingCard, type ListingCardProps } from '@repo/ui';
import type { TFunction } from 'i18next';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingCarousel.style';
import type { ListingCarouselComponentProps } from './ListingCarousel.types';

/**
 * Pure presentation mapping from ListingDto → ListingCardProps.
 * Omits `orientation` (the component sets it on the JSX). Takes `t` as a
 * parameter so it stays hook-free and testable.
 */
const toCardProps = (listing: ListingDto, t: TFunction): Omit<ListingCardProps, 'orientation'> => {
  const title = listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title;
  const profit = listing.estimatedProfit ?? 0;
  const roi = listing.roi ?? 0;
  const isActive = listing.status === ListingStatus.ACTIVE;
  return {
    title,
    imageUrl: listing.imageUrls?.[0],
    brand: listing.brand,
    primaryBadge: { id: listing.asin, storeType: 'amazon' },
    secondaryBadge: listing.ebayListingId ? { id: listing.ebayListingId, storeType: 'ebay' } : undefined,
    soldCount: listing.soldCount,
    watchCount: listing.watchCount,
    stats: [
      {
        label: t('listings.table.estimatedProfit'),
        value: `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`,
        tone: profit >= 0 ? 'positive' : 'negative',
      },
      {
        label: t('listings.table.roi'),
        value: `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`,
        tone: roi >= 0 ? 'positive' : 'negative',
      },
      {
        label: t('listings.table.stock'),
        value: String(listing.quantity),
        tone: listing.quantity === 0 ? 'negative' : 'default',
      },
    ],
    status: {
      label: t(`listings.status.${listing.status.toLowerCase()}`),
      tone: isActive ? 'active' : 'neutral',
    },
  };
};

export const ListingCarouselComponent: React.FC<ListingCarouselComponentProps> = ({
  listings,
  onViewAll,
  viewAllLabel,
  showViewAll,
  currentSlide,
  onNext,
  onPrev,
  onGoTo,
}) => {
  const { t } = useTranslation(['listings', 'translation']);

  if (listings.length === 0) {
    return (
      <S.SliderEmpty>
        <Icon name="inventory" size={40} />
        <S.SliderEmptyText variant="body" weight="semibold">
          {t('listings.overview.emptyTitle')}
        </S.SliderEmptyText>
        <S.SliderEmptyText variant="body-sm" color="text.tertiary">
          {t('listings.overview.emptySubtitle')}
        </S.SliderEmptyText>
      </S.SliderEmpty>
    );
  }

  return (
    <S.CarouselWrapper>
      {showViewAll && (
        <S.CarouselTopBar>
          <S.ViewAllButton onClick={onViewAll}>{viewAllLabel}</S.ViewAllButton>
        </S.CarouselTopBar>
      )}
      <S.CarouselViewport>
        {listings.map((listing, index) => {
          const slideClass = index === currentSlide ? 'active' : index < currentSlide ? 'prev' : '';
          const card = toCardProps(listing, t);
          return (
            <S.CarouselSlide key={listing.id} className={slideClass} $isActive={index === currentSlide}>
              <ListingCard {...card} orientation="horizontal" />
            </S.CarouselSlide>
          );
        })}
      </S.CarouselViewport>
      {currentSlide > 0 && (
        <S.CarouselArrow $side="left" className="carousel-arrow" onClick={onPrev} aria-label="Previous">
          <Icon name="chevron-left" size={20} />
        </S.CarouselArrow>
      )}
      {currentSlide < listings.length - 1 && (
        <S.CarouselArrow $side="right" className="carousel-arrow" onClick={onNext} aria-label="Next">
          <Icon name="chevron-right" size={20} />
        </S.CarouselArrow>
      )}
      {listings.length > 1 && (
        <S.CarouselPagination>
          {listings.map((_, index) => (
            <S.PaginationDot key={index} $active={index === currentSlide} onClick={() => onGoTo(index)} />
          ))}
        </S.CarouselPagination>
      )}
    </S.CarouselWrapper>
  );
};
