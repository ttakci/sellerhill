import { Icon } from '../../atoms/Icon';

import * as S from './Slider.style';
import type { SliderComponentProps } from './Slider.types';

export const SliderComponent = ({
  children,
  itemsToShow = 3,
  ariaLabel,
  onPrev,
  onNext,
  canScrollLeft,
  canScrollRight,
  scrollRef,
}: SliderComponentProps) => {
  return (
    <S.SliderWrapper>
      <S.SliderNavButton
        variant="ghost"
        onClick={onPrev}
        $disabled={!canScrollLeft}
        disabled={!canScrollLeft}
        aria-label="Previous"
      >
        <Icon name="chevron-left" size={20} />
      </S.SliderNavButton>

      <S.SliderScrollContainer
        ref={scrollRef as React.RefObject<HTMLDivElement>}
        $itemsToShow={itemsToShow}
        aria-label={ariaLabel}
      >
        {children}
      </S.SliderScrollContainer>

      <S.SliderNavButton
        variant="ghost"
        onClick={onNext}
        $disabled={!canScrollRight}
        disabled={!canScrollRight}
        aria-label="Next"
      >
        <Icon name="chevron-right" size={20} />
      </S.SliderNavButton>
    </S.SliderWrapper>
  );
};
