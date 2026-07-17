import styled from '@emotion/styled';
import { Text as UIText, tkn, type AppTheme } from '@repo/ui';

// --- Custom paginated carousel (content-height, not stretch-to-sibling) ---

export const CarouselWrapper = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;

  &:hover .carousel-arrow {
    opacity: 1;
  }
`;

export const CarouselViewport = styled.div`
  position: relative;
  overflow: hidden;
  min-width: 0;
`;

/**
 * Active slide stays in document flow so the viewport gets natural card height.
 * Inactive slides are absolutely positioned for enter/exit animation only.
 */
export const CarouselSlide = styled.div<{ $isActive?: boolean }>`
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
    const t = theme as AppTheme;
    return $active ? t.colors.brand.primary : t.colors.border.primary;
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
  min-height: 12rem;
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-style: dashed;
  border-radius: ${tkn('radius.sm')};

  svg {
    color: ${tkn('colors.text.secondary')};
  }
`;

export const SliderEmptyText = styled(UIText)``;

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
