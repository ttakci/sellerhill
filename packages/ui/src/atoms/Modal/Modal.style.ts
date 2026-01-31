import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';

export const Overlay = styled.div<{ $isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: ${({ $isOpen }) => ($isOpen ? 'flex' : 'none')};
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1.25rem; /* 20px */
  backdrop-filter: blur(0.25rem); /* 4px */
  animation: fadeIn 0.2s ease-out;

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
  border-radius: ${tkn('radius.lg')};
  width: 100%;
  max-width: ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return '25rem'; /* 400px */
      case 'md':
        return '37.5rem'; /* 600px */
      case 'lg':
        return '50rem'; /* 800px */
      case 'xl':
        return '75rem'; /* 1200px */
      default:
        return '37.5rem'; /* 600px */
    }
  }};
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  box-shadow: ${tkn('shadows.xl')};
  animation: slideDown 0.3s cubic-bezier(0.4, 0, 0.2, 1);

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

export const Header = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const Body = styled.div`
  padding: ${tkn('spacing.lg')};
  overflow-y: auto;
  flex: 1;
`;

export const Footer = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem; /* 12px */
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
