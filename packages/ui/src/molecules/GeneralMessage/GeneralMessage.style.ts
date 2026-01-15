import { Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import type { MessageType } from './GeneralMessage.types';

export const Overlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease-in;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

export const Container = styled.div`
  background: ${(p) => tkn('colors.surface.primary')(p as any)};
  border-radius: ${(p) => tkn('radius.xl')(p as any)};
  padding: ${(p) => tkn('spacing.lg')(p as any)};
  max-width: 480px;
  width: 90%;
  box-shadow: ${(p) => tkn('shadows.xl')(p as any)};
  animation: slideUp 0.3s ease-out;

  @keyframes slideUp {
    from {
      transform: translateY(20px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }
`;

export const Header = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${(p) => tkn('spacing.md')(p as any)};
  margin-bottom: ${(p) => tkn('spacing.md')(p as any)};
`;

export const IconWrapper = styled.div<{ type: MessageType }>`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  ${(props) => {
    const theme = props.theme as Theme;
    switch (props.type) {
      case 'success':
        return `
          background-color: rgba(16, 185, 129, 0.1);
          color: ${theme.colors.semantic.success};
        `;
      case 'error':
        return `
          background-color: rgba(244, 63, 94, 0.1);
          color: ${theme.colors.semantic.error};
        `;
      case 'warning':
        return `
          background-color: rgba(245, 158, 11, 0.1);
          color: ${theme.colors.semantic.warning};
        `;
      case 'info':
      default:
        return `
          background-color: rgba(59, 130, 246, 0.1);
          color: ${theme.colors.semantic.info};
        `;
    }
  }}

  svg {
    width: 24px;
    height: 24px;
  }
`;

export const Content = styled.div`
  flex: 1;
`;

export const Title = styled.h3`
  margin: 0 0 ${(p) => tkn('spacing.sm')(p as any)} 0;
  font-size: ${(p) => tkn('typography.fontSize.lg')(p as any)};
  font-weight: ${(p) => tkn('typography.fontWeight.semibold')(p as any)};
  color: ${(p) => tkn('colors.text.primary')(p as any)};
`;

export const Description = styled.p`
  margin: 0;
  font-size: ${(p) => tkn('typography.fontSize.sm')(p as any)};
  line-height: ${(p) => tkn('typography.lineHeight.normal')(p as any)};
  color: ${(p) => tkn('colors.text.secondary')(p as any)};
`;

export const ButtonGroup = styled.div`
  display: flex;
  gap: ${(p) => tkn('spacing.md')(p as any)};
  margin-top: ${(p) => tkn('spacing.lg')(p as any)};
  justify-content: flex-end;
`;
