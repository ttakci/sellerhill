import { keyframes } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { ToastType } from './Toast.types';

const slideIn = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const getTypeStyles = (type: ToastType) => {
  const map = {
    success: {
      bg: (p: any) => p.theme.colors.semanticTint.success,
      border: (p: any) => p.theme.colors.semanticTintBorder.success,
      icon: (p: any) => p.theme.colors.semantic.success,
    },
    error: {
      bg: (p: any) => p.theme.colors.semanticTint.error,
      border: (p: any) => p.theme.colors.semanticTintBorder.error,
      icon: (p: any) => p.theme.colors.semantic.error,
    },
    warning: {
      bg: (p: any) => p.theme.colors.semanticTint.warning,
      border: (p: any) => p.theme.colors.semanticTintBorder.warning,
      icon: (p: any) => p.theme.colors.semantic.warning,
    },
    info: {
      bg: (p: any) => p.theme.colors.semanticTint.info,
      border: (p: any) => p.theme.colors.semanticTintBorder.info,
      icon: (p: any) => p.theme.colors.semantic.info,
    },
  };
  return map[type];
};

export const ToastContainer = styled.div<{ $type: ToastType }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid ${(props) => getTypeStyles(props.$type).border(props)};
  background: ${(props) => getTypeStyles(props.$type).bg(props)};
  animation: ${slideIn} 0.3s ease-out;
  min-width: 18rem;
  max-width: 24rem;
  box-shadow: ${tkn('shadows.lg')};
`;

export const ToastIconWrapper = styled.div<{ $type: ToastType }>`
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${(props) => getTypeStyles(props.$type).icon(props)};
  flex-shrink: 0;
`;

export const ToastMessage = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.primary')};
  line-height: ${tkn('typography.lineHeight.normal')};
  flex: 1;
`;

export const ToastCloseButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: ${tkn('spacing.2xs')};
  color: ${tkn('colors.text.tertiary')};
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.sm')};

  &:hover {
    color: ${tkn('colors.text.secondary')};
  }
`;

export const ToastListContainer = styled.div`
  position: fixed;
  top: ${tkn('spacing.md')};
  right: ${tkn('spacing.md')};
  z-index: 2000;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;
