import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: ${tkn('colors.surface.overlay')};
  display: ${({ $isOpen }) => ($isOpen ? 'block' : 'none')};
  z-index: ${tkn('zIndex.overlay')};
  animation: fadeIn ${tkn('transitions.normal')};

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export const Panel = styled.aside<{ $size: string; $isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  /*
   * lg used to resolve to 35rem — NARROWER than the 36rem md default — so
   * the three densest drawers (group wizard, bulk ASIN entry, plan comparison)
   * all opted into "more room" and got less. The scale is now monotonic.
   */
  max-width: ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return '22rem'; /* 352px — confirmations, short forms */
      case 'lg':
        return '44rem'; /* 704px — wizards, two-column content */
      case 'md':
      default:
        return '32rem'; /* 512px — single-column forms (default) */
    }
  }};
  background: ${tkn('colors.surface.primary')};
  box-shadow: ${tkn('shadows.xl')};
  display: flex;
  flex-direction: column;
  z-index: ${tkn('zIndex.drawer')};
  transform: translateX(100%);
  transition: transform ${tkn('transitions.normal')};
  ${({ $isOpen }) => $isOpen && `transform: translateX(0);`}

  @media (max-width: ${tkn('breakpoints.md')}) {
    max-width: 100%;
  }
`;

export const Header = styled.div`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.lg')} ${tkn('spacing.md+')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  flex-shrink: 0;
  background: ${tkn('colors.surface.primary')};
`;

export const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  flex: 1;
`;

/**
 * Soft canvas (not pure white) so white borderless cards read clearly.
 * Light: background.primary ≈ #f4f7ff · cards: surface.primary #fff
 * Header + footer stay surface.primary.
 */
export const Body = styled.div`
  padding: ${tkn('spacing.lg')};
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  background: ${tkn('colors.background.primary')};
`;

export const Footer = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm-md')};
  flex-shrink: 0;
  background: ${tkn('colors.surface.primary')};
`;

export const CloseButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${tkn('colors.text.tertiary')};
  transition: color ${tkn('transitions.fast')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    color: ${tkn('colors.text.primary')};
  }
`;

/**
 * Left-side back arrow for nested drawer flows. Same geometry as CloseButton
 * so the title stays vertically centered against both affordances.
 */
export const BackButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${tkn('colors.text.tertiary')};
  transition: color ${tkn('transitions.fast')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    color: ${tkn('colors.text.primary')};
  }
`;
