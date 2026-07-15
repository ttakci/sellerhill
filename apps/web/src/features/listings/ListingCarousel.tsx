import type { ListingDto } from '@repo/shared';
import { Icon, IdBadge } from '@repo/ui';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './ListingsPage.style';

interface ListingCarouselProps {
  listings: ListingDto[];
  onViewAll: () => void;
  viewAllLabel: string;
  showViewAll: boolean;
}

export const ListingCarousel: React.FC<ListingCarouselProps> = ({ listings, onViewAll, viewAllLabel, showViewAll }) => {
  const { t } = useTranslation(['listings', 'translation']);

  // Last 3 added listings sorted by createdAt descending
  const recentListings = useMemo(
    () => [...listings].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 3),
    [listings]
  );

  // Carousel pagination state — 1 card per page
  const [currentSlide, setCurrentSlide] = useState(0);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.min(prev + 1, recentListings.length - 1));
  }, [recentListings.length]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => Math.max(prev - 1, 0));
  }, []);

  if (recentListings.length === 0) {
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
        {recentListings.map((listing, index) => {
          const slideClass = index === currentSlide ? 'active' : index < currentSlide ? 'prev' : '';
          return (
            <S.CarouselSlide key={listing.id} className={slideClass} $isActive={index === currentSlide}>
              <S.CompactCard variant="interactive">
                <S.CompactImage>
                  {listing.imageUrls?.[0] ? (
                    <img src={listing.imageUrls[0]} alt={listing.title} />
                  ) : (
                    <Icon name="image" size={32} />
                  )}
                </S.CompactImage>
                <S.CompactContent>
                  <S.CompactTitle>
                    {listing.title === t('translation:common.unknownProduct') ? listing.asin : listing.title}
                  </S.CompactTitle>
                  {listing.brand && (
                    <S.CompactDetailRow>
                      <S.CompactLabel>{t('listings.table.brand')}:</S.CompactLabel>
                      <S.CompactValue>{listing.brand}</S.CompactValue>
                    </S.CompactDetailRow>
                  )}
                  {listing.category && (
                    <S.CompactDetailRow>
                      <S.CompactLabel>{t('listings.table.category')}:</S.CompactLabel>
                      <S.CompactValue>{listing.category}</S.CompactValue>
                    </S.CompactDetailRow>
                  )}
                  <S.CompactAsinRow>
                    <S.CompactAsinItem>
                      <S.CompactLabel>{t('listings.table.asin')}:</S.CompactLabel>
                      <IdBadge id={listing.asin} storeType="amazon" size="sm" />
                    </S.CompactAsinItem>
                    {listing.ebayListingId && (
                      <S.CompactAsinItem>
                        <S.CompactLabel>{t('listings.table.ebayId')}:</S.CompactLabel>
                        <IdBadge id={listing.ebayListingId} storeType="ebay" size="sm" />
                      </S.CompactAsinItem>
                    )}
                  </S.CompactAsinRow>
                  {(listing.soldCount ?? 0) > 0 || (listing.watchCount ?? 0) > 0 ? (
                    <S.CompactExtraFields>
                      {(listing.soldCount ?? 0) > 0 && (
                        <S.CompactFieldItem>
                          <Icon name="shopping-cart" size={12} />
                          <S.CompactFieldValue>
                            {listing.soldCount} {t('listings.table.sold')}
                          </S.CompactFieldValue>
                        </S.CompactFieldItem>
                      )}
                      {(listing.watchCount ?? 0) > 0 && (
                        <S.CompactFieldItem>
                          <Icon name="visibility" size={12} />
                          <S.CompactFieldValue>
                            {listing.watchCount} {t('listings.table.watchers')}
                          </S.CompactFieldValue>
                        </S.CompactFieldItem>
                      )}
                    </S.CompactExtraFields>
                  ) : null}
                  <S.CompactProfitRow>
                    <S.CompactProfitItem>
                      <S.CompactLabel>{t('listings.table.estimatedProfit')}</S.CompactLabel>
                      <S.CompactProfitValue
                        $positive={(listing.estimatedProfit ?? 0) >= 0}
                        $negative={(listing.estimatedProfit ?? 0) < 0}
                      >
                        {(listing.estimatedProfit ?? 0) >= 0 ? '+' : ''}${(listing.estimatedProfit ?? 0).toFixed(2)}
                      </S.CompactProfitValue>
                    </S.CompactProfitItem>
                    <S.CompactProfitItem>
                      <S.CompactLabel>{t('listings.table.roi')}</S.CompactLabel>
                      <S.CompactProfitValue $positive={(listing.roi ?? 0) >= 0} $negative={(listing.roi ?? 0) < 0}>
                        {listing.roi !== null
                          ? `${(listing.roi ?? 0) >= 0 ? '+' : ''}${(listing.roi ?? 0).toFixed(1)}%`
                          : '—'}
                      </S.CompactProfitValue>
                    </S.CompactProfitItem>
                    <S.CompactProfitItem>
                      <S.CompactLabel>{t('listings.table.stock')}</S.CompactLabel>
                      <S.CompactProfitValue $negative={listing.quantity === 0}>{listing.quantity}</S.CompactProfitValue>
                    </S.CompactProfitItem>
                  </S.CompactProfitRow>
                  <S.CardFooter>
                    <S.StockLabel>
                      {t('listings.table.price')}: ${listing.price.toFixed(2)}
                    </S.StockLabel>
                    <S.StatusBadge $status={listing.status}>
                      {t(`listings.status.${listing.status.toLowerCase()}`)}
                    </S.StatusBadge>
                  </S.CardFooter>
                </S.CompactContent>
              </S.CompactCard>
            </S.CarouselSlide>
          );
        })}
      </S.CarouselViewport>

      {currentSlide > 0 && (
        <S.CarouselArrow $side="left" className="carousel-arrow" onClick={prevSlide} aria-label={t('listings.carousel.previous')}>
          <Icon name="chevron-left" size={20} />
        </S.CarouselArrow>
      )}
      {currentSlide < recentListings.length - 1 && (
        <S.CarouselArrow $side="right" className="carousel-arrow" onClick={nextSlide} aria-label={t('listings.carousel.next')}>
          <Icon name="chevron-right" size={20} />
        </S.CarouselArrow>
      )}

      {recentListings.length > 1 && (
        <S.CarouselPagination>
          {recentListings.map((_, index) => (
            <S.PaginationDot key={index} $active={index === currentSlide} onClick={() => goToSlide(index)} />
          ))}
        </S.CarouselPagination>
      )}
    </S.CarouselWrapper>
  );
};
