import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import type { BadgeSize, BadgeVariant } from './Badge.types';

export const BadgeContainer = styled.span<{ $variant: BadgeVariant; $size: BadgeSize }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.lg')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
  border: 1px solid transparent;
  
  ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return `
          padding: 0.125rem ${tkn('spacing.xs')};
          font-size: 0.625rem;
        `;
      case 'md':
        return `
          padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
          font-size: 0.75rem;
        `;
      case 'lg':
        return `
          padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
          font-size: ${tkn('typography.fontSize.xs')};
        `;
      default:
        return '';
    }
  }}
  
  ${({ $variant, theme }) => {
    switch ($variant) {
      case 'primary':
        return `
          background: ${tkn('colors.brand.secondary')({ theme })};
          color: ${tkn('colors.brand.primary')({ theme })};
        `;
      case 'secondary':
        return `
          background: ${tkn('colors.background.tertiary')({ theme })};
          color: ${tkn('colors.text.secondary')({ theme })};
        `;
      case 'success':
        return `
          background: ${tkn('colors.background.tertiary')({ theme })};
          color: ${tkn('colors.semantic.success')({ theme })};
        `;
      case 'warning':
        return `
          background: transparent;
          border: 1px solid ${tkn('colors.semantic.warning')({ theme })};
          color: ${tkn('colors.semantic.warning')({ theme })};
        `;
      case 'error':
        return `
          background: transparent;
          border: 1px solid ${tkn('colors.semantic.error')({ theme })};
          color: ${tkn('colors.semantic.error')({ theme })};
        `;
      case 'info':
        return `
          background: transparent;
          border: 1px solid ${tkn('colors.semantic.info')({ theme })};
          color: ${tkn('colors.semantic.info')({ theme })};
        `;
      default:
        return '';
    }
  }}
`;
