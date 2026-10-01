import styled from '@emotion/styled';

import { glassSurfaceStrong } from '../../styles/glass';
import { tkn } from '../../theme/tkn';

export const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: ${tkn('colors.surface.overlay')};
  /* Dimmed a notch, never blurred: the page behind stays recognisable. */
  display: ${({ $isOpen }) => ($isOpen ? 'block' : 'none')};
  z-index: ${tkn('zIndex.overlay')};
  animation: fadeIn ${tkn('transitions.normal')};

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export const Panel = styled.aside<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  /*
   * One application-wide drawer shell. Content density must adapt inside this
   * width rather than changing the surrounding panel between flows; otherwise
   * headers, body canvas and footer actions appear to belong to different
   * products as users move from one drawer to another.
   */
  max-width: 32rem; /* 512px — canonical drawer width */
  /*
   * The panel (2026-10-01, round 5): 94 % white plus the blur, so the page
   * behind is only a faint wash and never legible text under a form. The
   * header and footer sit on the panel; the BODY is a cool slate canvas
   * (glass.panelCanvas) so the cards inside it lift off the way page cards
   * lift off the aurora — white cards on a 76 % white pane read as "faint".
   */
  ${({ theme }) => glassSurfaceStrong(theme)}
  background: ${tkn('colors.glass.sheen')}, ${tkn('colors.glass.panel')};
  border-width: 0 0 0 0.0625rem;
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
  background: transparent;
`;

export const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  flex: 1;
`;

/**
 * The body canvas: a cool slate wash on the panel, so the cards inside it
 * (`glassSurface`, white) lift off it the way page cards lift off the aurora.
 */
export const Body = styled.div`
  padding: ${tkn('spacing.lg')};
  overflow-y: auto;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  background: ${tkn('colors.glass.panelCanvas')};
`;

export const Footer = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm-md')};
  flex-shrink: 0;
  background: transparent;
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
