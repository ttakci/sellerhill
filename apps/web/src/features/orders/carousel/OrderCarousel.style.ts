import styled from '@emotion/styled';
import { Button, IconButton, Text as UIText, tkn } from '@repo/ui';

/** Same carousel chrome as listings overview — shared UX language. */
export const CarouselWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
  /* Fill the section when the parent gives us a height (dashboard Cards tab
     renders this beside ListingCarousel in an equal-height grid row) so both
     cards render at the SAME height and the prev/next arrows line up. Where the
     parent is content-height this is a no-op. */
  flex: 1 1 auto;
  min-height: 0;

  &:hover .carousel-arrow {
    opacity: 1;
  }
`;

export const CarouselViewport = styled.div`
  position: relative;
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1 1 auto;
  min-height: 0;
`;

/**
 * Active slide stays in document flow so the viewport follows the visible card.
 * Inactive slides remain absolute for enter/exit animation only.
 */
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

/*
 * Was a raw styled.button re-implementing hover/focus/disabled by hand. Extends
 * the IconButton atom so it inherits the shared focus ring; only positioning and
 * the brand fill (which no IconButton variant expresses) stay local.
 */
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
  padding-top: ${tkn('spacing.sm')};
  flex-shrink: 0;
`;

/*
 * 1.5rem hit area with a small visual dot inside — the dot itself used to BE the
 * button at 0.5rem, which is far below a usable/accessible target size.
 */
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

export const CarouselTopBar = styled.div`
  display: flex;
  justify-content: flex-end;
  padding-bottom: ${tkn('spacing.xs')};
`;

export const SliderEmpty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.xxl')} ${tkn('spacing.lg')};
  text-align: center;
  flex: 1;
  min-height: 12rem;
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem dashed ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};

  svg {
    color: ${tkn('colors.text.secondary')};
  }
`;

export const SliderEmptyText = styled(UIText)``;

/** Same hover treatment as listings overview “View all” control */
/* Extends the Button atom (use variant="text"); was a hand-styled link-button. */
export const ViewAllButton = styled(Button)`
  align-self: flex-end;
`;
