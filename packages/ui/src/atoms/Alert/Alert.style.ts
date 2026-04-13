import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { AlertVariant } from './Alert.types';

export const AlertContainer = styled.div<{ $variant: AlertVariant }>`
  display: flex;
  padding: 0.75rem 1rem;
  border-radius: ${tkn('radius.sm')};
  position: relative;
  overflow: hidden;
  gap: 1rem;

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'success':
        return `
          background: ${theme.colors.semantic.success}14;
          border-left: 0.375rem solid ${theme.colors.semantic.success};
          color: ${theme.colors.text.primary};
          & svg { color: ${theme.colors.semantic.success}; }
        `;
      case 'error':
        return `
          background: ${theme.colors.semantic.error}14;
          border-left: 0.375rem solid ${theme.colors.semantic.error};
          color: ${theme.colors.text.primary};
          & svg { color: ${theme.colors.semantic.error}; }
        `;
      case 'warning':
        return `
          background: ${theme.colors.semantic.warning}14;
          border-left: 0.375rem solid ${theme.colors.semantic.warning};
          color: ${theme.colors.text.primary};
          & svg { color: ${theme.colors.semantic.warning}; }
        `;
      case 'info':
        return `
          background: ${theme.colors.brand.primary}14;
          border-left: 0.375rem solid ${theme.colors.brand.primary};
          color: ${theme.colors.text.primary};
          & svg { color: ${theme.colors.brand.primary}; }
        `;
      default:
        return '';
    }
  }}
`;

export const IconSection = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.full')};
`;

export const ContentSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
`;

export const CloseButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.25rem;
  color: inherit;
  opacity: 0.6;
  transition: opacity ${tkn('transitions.fast')};
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    opacity: 1;
  }
`;
