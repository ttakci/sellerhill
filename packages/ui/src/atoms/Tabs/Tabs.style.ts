import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  width: 100%;
`;

export const TabList = styled.div<{ $variant: 'underline' | 'pill' }>`
  display: flex;
  align-items: center;
  gap: ${({ $variant }) => ($variant === 'pill' ? '0.5rem' : '1.5rem')}; /* 8px 24px */
  border-bottom: ${({ $variant, theme }) =>
    $variant === 'underline' ? `0.0625rem solid ${theme.colors.border.primary}` : 'none'}; /* 1px */
  padding-bottom: ${({ $variant }) => ($variant === 'underline' ? '0' : '0.75rem')}; /* 12px */
  margin-bottom: ${tkn('spacing.lg')};
`;

export const TabButton = styled.button<{ $isActive: boolean; $variant: 'underline' | 'pill' }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  padding: ${({ $variant }) => ($variant === 'pill' ? '0.375rem 0.875rem' : '0.625rem 0')}; /* 6px 14px, 10px 0 */
  transition: all 0.3s;
  position: relative;

  color: ${({ $isActive, theme }) => ($isActive ? theme.colors.brand.primary : theme.colors.text.secondary)};

  ${({ $variant, $isActive, theme }) =>
    $variant === 'underline' &&
    $isActive &&
    `
      &::after {
        content: '';
        position: absolute;
        bottom: -0.0625rem; /* 1px */
        left: 0;
        width: 100%;
        height: 0.125rem; /* 2px */
        background: ${theme.colors.brand.primary};
      }
    `}

  ${({ $variant, $isActive, theme }) =>
    $variant === 'pill' &&
    `
      border-radius: ${tkn('radius.md')({ theme })};
      background: ${$isActive ? theme.colors.brand.secondary : 'transparent'};
      &:hover {
        background: ${$isActive ? theme.colors.brand.secondary : theme.colors.background.tertiary};
      }
    `}
`;

export const Content = styled.div`
  animation: fadeIn 0.3s ease-out;

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
`;
