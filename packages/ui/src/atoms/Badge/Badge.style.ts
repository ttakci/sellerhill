import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import type { BadgeSize, BadgeVariant } from './Badge.types';

export const BadgeContainer = styled.span<{ $variant: BadgeVariant; $size: BadgeSize; $isPill: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${(p) => (p.$isPill ? tkn('radius.full')(p as any) : '4px')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  white-space: nowrap;
  
  ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return `
          padding: 2px 8px;
          font-size: 11px;
        `;
      case 'md':
        return `
          padding: 4px 10px;
          font-size: 12px;
        `;
      case 'lg':
        return `
          padding: 6px 14px;
          font-size: 13px;
        `;
      default:
        return '';
    }
  }}
  
  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'primary':
        return `
          background: rgba(60, 80, 224, 0.08); /* brand.primary with opacity */
          color: ${theme.colors.brand.primary};
        `;
      case 'secondary':
        return `
          background: ${theme.colors.background.tertiary};
          color: ${theme.colors.text.secondary};
        `;
      case 'success':
        return `
          background: rgba(33, 150, 83, 0.08);
          color: #219653; /* TailAdmin Success Green */
        `;
      case 'warning':
        return `
          background: rgba(240, 149, 12, 0.08);
          color: #F0950C; /* TailAdmin Warning Orange */
        `;
      case 'error':
        return `
          background: rgba(211, 64, 83, 0.08);
          color: #D34053; /* TailAdmin Error Red */
        `;
      case 'info':
        return `
          background: rgba(60, 80, 224, 0.08);
          color: ${theme.colors.brand.primary};
        `;
      default:
        return '';
    }
  }}
`;
