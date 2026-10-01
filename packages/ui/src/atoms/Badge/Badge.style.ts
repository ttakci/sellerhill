import { Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { BadgeSize, BadgeVariant } from './Badge.types';

/**
 * A badge is a small rectangle with softly rounded corners — never a pill
 * (operator decision, 2026-10-01: pills read as buttons and the oval shape
 * sits awkwardly in a table cell). `isPill` is accepted for source
 * compatibility and ignored. The text gets real room on every size: a label
 * squeezed into a 10px capsule read as an afterthought beside 14px body text.
 */
export const BadgeContainer = styled.span<{ $variant: BadgeVariant; $size: BadgeSize; $isPill: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${tkn('radius.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  white-space: nowrap;
  letter-spacing: ${tkn('typography.letterSpacing.normal')};
  border: 0.0625rem solid transparent;
  box-sizing: border-box;

  ${({ $size, theme }: { $size: BadgeSize; theme: Theme }) => {
    switch ($size) {
      case 'xs':
        return `
          padding: ${tkn('spacing.2xs+')({ theme })} ${tkn('spacing.xs+')({ theme })};
          font-size: ${tkn('typography.fontSize.xs')({ theme })};
          line-height: ${tkn('typography.lineHeight.tight')({ theme })};
        `;
      case 'sm':
        return `
          padding: ${tkn('spacing.xs')({ theme })} ${tkn('spacing.sm')({ theme })};
          font-size: ${tkn('typography.fontSize.sm')({ theme })};
          line-height: ${tkn('typography.lineHeight.tight')({ theme })};
        `;
      case 'md':
        return `
          padding: ${tkn('spacing.xs+')({ theme })} ${tkn('spacing.sm+')({ theme })};
          font-size: ${tkn('typography.fontSize.sm')({ theme })};
          line-height: ${tkn('typography.lineHeight.tight')({ theme })};
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
