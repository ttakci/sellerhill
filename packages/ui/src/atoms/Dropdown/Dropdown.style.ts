import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const TriggerWrapper = styled.div`
  cursor: pointer;
`;

export const Container = styled.div`
  position: relative;
  display: block;
  width: 100%;
`;

export const Menu = styled.div<{
  $isOpen: boolean;
  $align: 'left' | 'right';
  $direction?: 'up' | 'down';
  $width?: string;
}>`
  position: absolute;
  ${({ $direction }) => ($direction === 'up' ? 'bottom: 120%;' : 'top: 120%;')}
  ${({ $align }) => ($align === 'left' ? 'left: 0;' : 'right: 0;')};
  z-index: ${tkn('zIndex.dropdown')};
  display: ${({ $isOpen }) => ($isOpen ? 'flex' : 'none')};
  flex-direction: column;
  ${({ $width }) => ($width ? `width: ${$width}; min-width: unset;` : 'min-width: 16.25rem;')}; /* 260px */
  background: ${tkn('colors.background.secondary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  border-radius: ${tkn('radius.md')};
  padding: ${tkn('spacing.sm')} 0;
  box-shadow: ${tkn('shadows.lg')};
  animation: ${({ $direction }) => ($direction === 'up' ? 'fadeInUp' : 'fadeIn')} 0.2s ease-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-0.625rem);
    } /* 10px */
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeInUp {
    from {
      opacity: 0;
      transform: translateY(0.625rem);
    } /* 10px */
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

export const DropdownHeader = styled.div`
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  margin-bottom: ${tkn('spacing.sm')};
`;

export const MenuItem = styled.button<{ $variant?: 'default' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')};
  width: 100%;
  padding: ${tkn('spacing.sm+')} ${tkn('spacing.sm-md')};
  border: none;
  background: transparent;
  cursor: pointer;

  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  transition: all ${tkn('transitions.fast')};
  color: ${({ $variant, theme }) => ($variant === 'danger' ? theme.colors.semantic.error : theme.colors.text.primary)};

  &:hover {
    background: ${tkn('colors.background.tertiary')};
    color: ${({ $variant, theme }) =>
      $variant === 'danger' ? theme.colors.semantic.error : theme.colors.brand.primary};
  }

  /* Menu items are real <button>s but had hover only — arrow-keying through an
     open menu gave no visible position. Inset ring so it reads inside the menu. */
  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: -0.125rem;
    background: ${tkn('colors.background.tertiary')};
  }
`;

/* Mobile bottom sheet — mirrors Select.style.ts's bottom-sheet block so the
   two atoms' mobile menus are visually identical. */
export const MobileOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: ${tkn('colors.surface.overlay')};
  z-index: ${tkn('zIndex.modal')};
  display: flex;
  align-items: flex-end;
  animation: dropdownFadeIn ${tkn('transitions.fast')};

  @keyframes dropdownFadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

export const BottomSheet = styled.div`
  width: 100%;
  background: ${tkn('colors.surface.primary')};
  border-top-left-radius: ${tkn('radius.xl')};
  border-top-right-radius: ${tkn('radius.xl')};
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  animation: dropdownSlideUp ${tkn('transitions.normal')};

  @keyframes dropdownSlideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }
`;

export const BottomSheetHandle = styled.div`
  width: 2rem;
  height: 0.25rem;
  background: ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.full')};
  margin: ${tkn('spacing.sm')} auto ${tkn('spacing.md')};
  flex-shrink: 0;
`;

export const BottomSheetHeader = styled.div`
  padding: 0 ${tkn('spacing.md')} ${tkn('spacing.sm-md')};
`;

export const BottomSheetItems = styled.div`
  overflow-y: auto;
  padding: ${tkn('spacing.xs')};
`;

export const MobileMenuItem = styled.button<{ $variant?: 'default' | 'danger' }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm-md')};
  width: 100%;
  min-height: 3.25rem;
  padding: 0 ${tkn('spacing.sm-md')};
  border: none;
  border-radius: ${tkn('radius.sm')};
  background: transparent;
  cursor: pointer;

  font-size: ${tkn('typography.fontSize.base')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${({ $variant, theme }) => ($variant === 'danger' ? theme.colors.semantic.error : theme.colors.text.primary)};

  &:active {
    background: ${tkn('colors.background.tertiary')};
  }
`;

export const MobileSafeAreaSpacer = styled.div`
  height: max(${tkn('spacing.md')}, env(safe-area-inset-bottom));
  flex-shrink: 0;
`;
