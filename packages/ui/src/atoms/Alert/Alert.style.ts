import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import { AlertVariant } from './Alert.types';

export const AlertContainer = styled.div<{ $variant: AlertVariant }>`
  display: flex;
  padding: 0.75rem 1rem; /* 12px 16px */
  border-radius: ${tkn('radius.sm')};
  position: relative;
  overflow: hidden;
  gap: 1rem; /* 16px */

  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'success':
        return `
          background: #EBFDF5;
          border-left: 0.375rem solid #34D399; /* 6px */
          color: #064E3B;
          & svg { color: #34D399; }
        `;
      case 'error':
        return `
          background: #FEE2E2;
          border-left: 0.375rem solid #F87171; /* 6px */
          color: #7F1D1D;
          & svg { color: #F87171; }
        `;
      case 'warning':
        return `
          background: #FFFBEB;
          border-left: 0.375rem solid #FBBF24; /* 6px */
          color: #78350F;
          & svg { color: #FBBF24; }
        `;
      case 'info':
        return `
          background: #EFF6FF;
          border-left: 0.375rem solid #60A5FA; /* 6px */
          color: #1E3A8A;
          & svg { color: #60A5FA; }
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
  width: 1.75rem; /* 28px */
  height: 1.75rem; /* 28px */

  background: white;
  border-radius: ${tkn('radius.full')};
`;

export const ContentSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem; /* 4px */
  flex: 1;
`;

export const CloseButton = styled.button`
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0.25rem; /* 4px */
  color: inherit;
  opacity: 0.6;
  transition: opacity 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    opacity: 1;
  }
`;
