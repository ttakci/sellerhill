import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  inset: 0;
  background: ${tkn('colors.surface.overlay')};
  display: ${({ $isOpen }) => ($isOpen ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: ${tkn('spacing.md')};
  animation: fadeIn 0.2s ease-out;

  @media (max-width: 48rem) { /* 768px */
    padding: ${tkn('spacing.sm')};
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;

export const ModalContainer = styled.div<{ $size: string }>`
  background: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.xl')};
  width: 100%;
  margin: auto;
  max-width: ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return '22.5rem'; /* 360px */
      case 'md':
        return '30rem'; /* 480px */
      case 'lg':
        return '40rem'; /* 640px */
      case 'xl':
        return '60rem'; /* 960px */
      default:
        return '30rem'; /* 480px */
    }
  }};
  display: flex;
  flex-direction: column;
  max-height: calc(100% - 2rem);
  box-shadow: ${tkn('shadows.xl')};
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);

  @media (max-width: 48rem) {
    max-width: calc(100% - ${tkn('spacing.md')});
    border-radius: ${tkn('radius.lg')};
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-1.25rem); /* 20px */
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

export const Header = styled.div<{ $showDivider?: boolean }>`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: ${({ $showDivider, theme }) =>
    $showDivider ? `0.0625rem solid ${tkn('colors.border.primary')({ theme })}` : 'none'}; /* 1px */
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const Body = styled.div<{ $noPadding?: boolean }>`
  padding: ${({ $noPadding }) => ($noPadding ? '0' : tkn('spacing.lg'))};
  overflow-y: auto;
  flex: 1;
`;

export const Footer = styled.div<{ $showDivider?: boolean }>`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-top: ${({ $showDivider, theme }) =>
    $showDivider ? `0.0625rem solid ${tkn('colors.border.primary')({ theme })}` : 'none'}; /* 1px */
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm-md')};
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

  &:hover {
    color: ${tkn('colors.text.primary')};
  }
`;
