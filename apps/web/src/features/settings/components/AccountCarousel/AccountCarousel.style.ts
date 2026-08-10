import styled from '@emotion/styled';
import { Button, IconButton, tkn } from '@repo/ui';

// Mirrors the ListingCarousel/OrderCarousel chrome (content-height paginated
// carousel, not stretch-to-sibling) — no shared design-system Carousel exists
// yet, so this is the third feature-level instance of the same pattern.

/** Single wrapper so the "view all" top bar and the card/carousel below it
 *  count as ONE flex child of the drawer's BodyStack — otherwise BodyStack's
 *  own (large) gap would land between the bar and the carousel too. */
export const Root = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

/** Matches ListingCarousel/OrderCarousel: "view all" is a small top-right
 *  link above the carousel, not a slide — never a bulky CTA card. */
export const CarouselTopBar = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-bottom: ${tkn('spacing.xs')};
`;

export const ViewAllButton = styled(Button)`
  align-self: flex-end;
`;

export const CarouselWrapper = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  &:hover .carousel-arrow {
    opacity: 1;
  }
`;

/**
 * Positioning context for the arrows, separate from `CarouselWrapper`. Its
 * height is exactly the card's height (it holds only `CarouselViewport`, a
 * normal-flow child — the arrows are `position: absolute` and don't add to
 * it), so `top: 50%` centers the arrows on the CARD. If the arrows were
 * positioned against `CarouselWrapper` instead, that box also includes
 * `CarouselPagination` below, which pulls the vertical center down past the
 * card. Arrows are siblings of `CarouselViewport`, not its children, so
 * `CarouselViewport`'s own `overflow: hidden` (needed for the slide
 * crossfade) never clips them.
 */
export const CarouselCardArea = styled.div`
  position: relative;
  min-width: 0;
`;

export const CarouselViewport = styled.div`
  position: relative;
  overflow: hidden;
  min-width: 0;
`;

export const CarouselSlide = styled.div`
  width: 100%;
  display: flex;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;

  &:not(.active) {
    position: absolute;
    inset: 0;
    opacity: 0;
    transform: translateX(100%);
    pointer-events: none;
  }

  &.prev {
    position: absolute;
    inset: 0;
    opacity: 0;
    transform: translateX(-100%);
    pointer-events: none;
  }

  &.active {
    position: relative;
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }
`;

export const CarouselArrow = styled(IconButton)<{ $side: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  ${({ $side }) => ($side === 'left' ? 'left: -1.125rem' : 'right: -1.125rem')};
  transform: translateY(-50%);
  width: 2rem;
  height: 2rem;
  padding: 0;
  border-radius: ${tkn('radius.full')};
  background: ${tkn('colors.brand.primary')};
  border-color: transparent;
  color: ${tkn('colors.text.inverse')};
  opacity: 0;
  z-index: 1;
  box-shadow: ${tkn('shadows.md')};

  & svg {
    width: 1.125rem;
    height: 1.125rem;
  }

  &:hover {
    background: ${tkn('colors.brand.primaryHover')};
    color: ${tkn('colors.text.inverse')};
  }

  &:disabled {
    opacity: 0;
    cursor: default;
    pointer-events: none;
  }
`;

export const CarouselPagination = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.xs')};
  padding-top: ${tkn('spacing.md')};
  flex-shrink: 0;
`;

export const PaginationDot = styled(IconButton)<{ $active: boolean }>`
  width: 1.5rem;
  height: 1.5rem;
  padding: 0;
  border-radius: ${tkn('radius.full')};
  color: inherit;
`;

export const PaginationDotMark = styled.span<{ $active: boolean }>`
  width: ${({ $active }) => ($active ? '1.25rem' : '0.5rem')};
  height: 0.5rem;
  border-radius: ${tkn('radius.full')};
  background: ${({ $active, theme }) =>
    $active ? theme.colors.brand.primary : theme.colors.border.primary};
  transition: all ${tkn('transitions.fast')};
`;
