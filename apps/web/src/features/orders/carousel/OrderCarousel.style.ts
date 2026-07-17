import styled from '@emotion/styled';
import { Text as UIText, tkn, type AppTheme } from '@repo/ui';

/** Same carousel chrome as listings overview — shared UX language. */
export const CarouselWrapper = styled.div`
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  &:hover .carousel-arrow {
    opacity: 1;
  }
`;

export const CarouselViewport = styled.div`
  position: relative;
  flex: 1;
  overflow: hidden;
  /* Room for horizontal product card (image ~10.5rem + padding) */
  min-height: 16rem;
`;

export const CarouselSlide = styled.div`
  position: absolute;
  inset: 0;
  width: 100%;
  display: flex;
  transition:
    opacity 0.3s ease,
    transform 0.3s ease;
  opacity: 0;
  transform: translateX(100%);
  pointer-events: none;

  &.active {
    opacity: 1;
    transform: translateX(0);
    pointer-events: auto;
  }

  &.prev {
    opacity: 0;
    transform: translateX(-100%);
  }
`;

export const CarouselArrow = styled.button<{ $side: 'left' | 'right' }>`
  position: absolute;
  top: 50%;
  ${({ $side }) => ($side === 'left' ? 'left: -1.125rem' : 'right: -1.125rem')};
  transform: translateY(-50%);
  width: 2rem;
  height: 2rem;
  border-radius: ${tkn('radius.full')};
  border: none;
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.text.inverse')};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity ${tkn('transitions.fast')},
    background ${tkn('transitions.fast')};
  z-index: 10;
  box-shadow: ${tkn('shadows.md')};

  &:hover {
    background: ${tkn('colors.brand.primaryHover')};
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

export const PaginationDot = styled.button<{ $active: boolean }>`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  border: none;
  padding: 0;
  cursor: pointer;
  background: ${({ $active, theme }) => {
    const th = theme as AppTheme;
    return $active ? th.colors.brand.primary : th.colors.border.primary;
  }};
  transition:
    background 0.2s ease,
    transform 0.2s ease;

  &:hover {
    transform: scale(1.25);
  }
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
export const ViewAllButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: ${tkn('colors.brand.primary')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  font-family: ${tkn('typography.fontFamily.body')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  transition: color ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.brand.primaryHover')};
  }
`;
