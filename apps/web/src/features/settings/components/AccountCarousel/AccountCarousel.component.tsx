import { Icon, Text } from '@repo/ui';
import React from 'react';
import { useTranslation } from 'react-i18next';

import * as S from './AccountCarousel.style';
import type { AccountCarouselComponentProps } from './AccountCarousel.types';

/**
 * Item-count-driven display: a single visible item renders as a plain card
 * (no carousel chrome); 2..maxVisible items render as a paginated carousel.
 * Beyond maxVisible, a "view all" link appears top-right (matching
 * ListingCarousel/OrderCarousel) instead of growing the carousel — the rest
 * live in the "all" drawer.
 */
export const AccountCarouselComponent = <T,>({
  items,
  keyExtractor,
  renderCard,
  maxVisible,
  onViewAll,
  viewAllLabel,
  currentSlide,
  onNext,
  onPrev,
  onGoTo,
}: AccountCarouselComponentProps<T>): React.ReactElement | null => {
  const { t } = useTranslation(['translation']);

  if (items.length === 0) {
    return null;
  }

  const visibleItems = items.slice(0, maxVisible);
  const hasMore = items.length > maxVisible;
  const isCarousel = visibleItems.length > 1;

  return (
    <S.Root>
      {hasMore && (
        <S.CarouselTopBar>
          <S.ViewAllButton variant="text" size="small" onClick={onViewAll}>
            <Text variant="body-sm" weight="semibold">{viewAllLabel}</Text>
          </S.ViewAllButton>
        </S.CarouselTopBar>
      )}
      {isCarousel ? (
        <S.CarouselWrapper>
          <S.CarouselCardArea>
            <S.CarouselViewport>
              {visibleItems.map((item, index) => (
                <S.CarouselSlide
                  key={keyExtractor(item)}
                  className={index === currentSlide ? 'active' : index < currentSlide ? 'prev' : ''}
                >
                  {renderCard(item)}
                </S.CarouselSlide>
              ))}
            </S.CarouselViewport>
            {currentSlide > 0 && (
              <S.CarouselArrow $side="left" variant="elevated" className="carousel-arrow" onClick={onPrev} aria-label={t('translation:common.previous')}>
                <Icon name="chevron-left" size={20} />
              </S.CarouselArrow>
            )}
            {currentSlide < visibleItems.length - 1 && (
              <S.CarouselArrow $side="right" variant="elevated" className="carousel-arrow" onClick={onNext} aria-label={t('translation:common.next')}>
                <Icon name="chevron-right" size={20} />
              </S.CarouselArrow>
            )}
          </S.CarouselCardArea>
          <S.CarouselPagination>
            {visibleItems.map((_, index) => (
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
        </S.CarouselWrapper>
      ) : (
        <>{renderCard(visibleItems[0])}</>
      )}
    </S.Root>
  );
};

AccountCarouselComponent.displayName = 'AccountCarouselComponent';
