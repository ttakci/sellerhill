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
  /* Same 4px gap and surface as Select's option list, so a menu and a
     select read as one family. */
  ${({ $direction }) => ($direction === 'up' ? 'bottom: calc(100% + 0.25rem);' : 'top: calc(100% + 0.25rem);')}
  ${({ $align }) => ($align === 'left' ? 'left: 0;' : 'right: 0;')};
  z-index: ${tkn('zIndex.dropdown')};
  display: ${({ $isOpen }) => ($isOpen ? 'flex' : 'none')};
  flex-direction: column;
  ${({ $width }) => ($width ? `width: ${$width}; min-width: unset;` : 'min-width: 16.25rem;')}; /* 260px */
  box-sizing: border-box;
  gap: ${tkn('spacing.2xs')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  border-radius: ${tkn('radius.md')};
  padding: ${tkn('spacing.xs')};
  box-shadow: ${tkn('shadows.lg')};
  /* A long menu (16 languages) scrolls inside itself instead of running off the screen. */
  max-height: min(70vh, 26rem);
  overflow-y: auto;
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
  /* The menu is inset by spacing.xs; the header's rule still spans edge to edge. */
  margin: calc(-1 * ${tkn('spacing.xs')}) calc(-1 * ${tkn('spacing.xs')}) ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
`;

export const ItemLabel = styled.span`
  flex: 1;
  min-width: 0;
  text-align: left;
`;

export const MenuItem = styled.button<{ $variant?: 'default' | 'danger'; $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  width: 100%;
  /* Select's option geometry: inset rounded rows, never edge-to-edge strips.
     A fixed row height keeps Arabic / Devanagari labels (taller fallback
     fonts) from making their rows taller than the Latin ones. */
  min-height: 2.25rem;
  flex-shrink: 0;
  box-sizing: border-box;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm+')};
  line-height: ${tkn('typography.lineHeight.tight')};
  border: none;
  border-radius: ${tkn('radius.sm')};
  background: transparent;
  cursor: pointer;

  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  transition: background-color ${tkn('transitions.fast')};
  color: ${({ $variant, theme }) => ($variant === 'danger' ? theme.colors.semantic.error : theme.colors.text.primary)};

  ${({ $selected, theme }) =>
    $selected ? `background: ${theme.colors.brand.primary}10; color: ${theme.colors.brand.primary};` : ''}

  &:hover {
    background: ${({ $selected, $variant, theme }) =>
      $selected
        ? `${theme.colors.brand.primary}15`
        : $variant === 'danger'
          ? theme.colors.semanticTint.error
          : theme.colors.background.tertiary};
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

export const MobileMenuItem = styled.button<{ $variant?: 'default' | 'danger'; $selected?: boolean }>`
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

  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.base')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${({ $variant, theme }) => ($variant === 'danger' ? theme.colors.semantic.error : theme.colors.text.primary)};

  ${({ $selected, theme }) =>
    $selected ? `background: ${theme.colors.brand.primary}10; color: ${theme.colors.brand.primary};` : ''}

  &:active {
    background: ${tkn('colors.background.tertiary')};
  }
`;

export const MobileSafeAreaSpacer = styled.div`
  height: max(${tkn('spacing.md')}, env(safe-area-inset-bottom));
  flex-shrink: 0;
`;
