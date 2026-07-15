import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: ${tkn('colors.surface.overlay')};
  display: ${({ $isOpen }) => ($isOpen ? 'block' : 'none')};
  z-index: 9998;
  animation: fadeIn 0.2s ease-out;

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
  max-width: ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return '20rem'; /* 320px */
      case 'lg':
        return '35rem'; /* 560px */
      case 'md':
      default:
        return '36rem'; /* 576px */
    }
  }};
  background: ${tkn('colors.background.primary')};
  box-shadow: ${tkn('shadows.xl')};
  display: flex;
  flex-direction: column;
  z-index: 9999;
  transform: translateX(100%);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  ${({ $isOpen }) => $isOpen && `transform: translateX(0);`}

  @media (max-width: 48rem) { /* 768px */
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
`;

export const HeaderText = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  flex: 1;
`;

export const Body = styled.div`
  padding: ${tkn('spacing.lg')};
  overflow-y: auto;
  flex: 1;
`;

export const Footer = styled.div`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.lg')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm-md')};
  flex-shrink: 0;
`;

export const CloseButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  color: ${tkn('colors.text.tertiary')};
  transition: color 0.2s;
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
  transition: color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &:hover {
    color: ${tkn('colors.text.primary')};
  }
`;
