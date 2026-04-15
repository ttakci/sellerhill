import { Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { BadgeSize, BadgeVariant } from './Badge.types';

export const BadgeContainer = styled.span<{ $variant: BadgeVariant; $size: BadgeSize; $isPill: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ $isPill, theme }: { $isPill: boolean; theme: Theme }) =>
    $isPill ? tkn('radius.full')({ theme }) : tkn('radius.md')({ theme })};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  white-space: nowrap;
  letter-spacing: 0.01em;
  border: 0.0625rem solid transparent;

  ${({ $size, theme }: { $size: BadgeSize; theme: Theme }) => {
    switch ($size) {
      case 'xs':
        return `
          padding: 0.0625rem 0.375rem;
          font-size: ${tkn('typography.fontSize.2xs')({ theme })};
          line-height: 1.5;
        `;
      case 'sm':
        return `
          padding: 0.125rem 0.5rem;
          font-size: ${tkn('typography.fontSize.xs')({ theme })};
          line-height: 1.5;
        `;
      case 'md':
        return `
          padding: 0.1875rem 0.625rem;
          font-size: ${tkn('typography.fontSize.xs')({ theme })};
          line-height: 1.5;
        `;
      default:
        return '';
    }
  }}

  ${({ $variant, theme }: { $variant: BadgeVariant; theme: Theme }) => {
    const t = theme;
    switch ($variant) {
      case 'primary':
        return `
          background: ${t.colors.brand.secondary};
          color: ${t.colors.brand.primary};
          border-color: ${t.colors.brand.primary + '30'};
        `;
      case 'secondary':
        return `
          background: ${t.colors.background.tertiary};
          color: ${t.colors.text.secondary};
          border-color: ${t.colors.border.primary};
        `;
      case 'success':
        return `
          background: ${t.colors.semanticTint.success};
          color: ${t.colors.semantic.success};
          border-color: ${t.colors.semanticTintBorder.success};
        `;
      case 'warning':
        return `
          background: ${t.colors.semanticTint.warning};
          color: ${t.colors.semantic.warning};
          border-color: ${t.colors.semanticTintBorder.warning};
        `;
      case 'error':
        return `
          background: ${t.colors.semanticTint.error};
          color: ${t.colors.semantic.error};
          border-color: ${t.colors.semanticTintBorder.error};
        `;
      case 'info':
        return `
          background: ${t.colors.semanticTint.info};
          color: ${t.colors.semantic.info};
          border-color: ${t.colors.semanticTintBorder.info};
        `;
      case 'neutral':
        return `
          background: ${t.colors.semanticTint.neutral};
          color: ${t.colors.text.secondary};
          border-color: ${t.colors.semanticTintBorder.neutral};
        `;
      default:
        return '';
    }
  }}
`;
