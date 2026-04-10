import { css } from '@emotion/react';
import styled from '@emotion/styled';

import type { TextAlign, TextVariant, TextWeight } from './Text.types';

interface StyledTextProps {
  $variant?: TextVariant;
  $weight?: TextWeight;
  $align?: TextAlign;
  $muted?: boolean;
  $truncate?: boolean;
  $color?: string;
}

const variantStyles = {
  display: (theme: any) => `
    font-size: ${theme.typography.fontSize['3xl']};
    line-height: ${theme.typography.lineHeight.tight};
    font-weight: ${theme.typography.fontWeight.bold};
  `,
  h1: (theme: any) => `
    font-size: ${theme.typography.fontSize.xxl};
    line-height: ${theme.typography.lineHeight.tight};
  `,
  h2: (theme: any) => `
    font-size: ${theme.typography.fontSize.xl};
    line-height: ${theme.typography.lineHeight.tight};
  `,
  h3: (theme: any) => `
    font-size: ${theme.typography.fontSize.lg};
    line-height: ${theme.typography.lineHeight.tight};
  `,
  h4: (theme: any) => `
    font-size: ${theme.typography.fontSize.md};
    line-height: ${theme.typography.lineHeight.tight};
  `,
  h5: (theme: any) => `
    font-size: ${theme.typography.fontSize.sm};
    line-height: ${theme.typography.lineHeight.tight};
    font-weight: ${theme.typography.fontWeight.semibold};
  `,
  body: (theme: any) => `
    font-size: ${theme.typography.fontSize.sm};
    line-height: ${theme.typography.lineHeight.normal};
  `,
  'body-sm': (theme: any) => `
    font-size: ${theme.typography.fontSize.sm};
    line-height: ${theme.typography.lineHeight.normal};
    font-weight: ${theme.typography.fontWeight.normal};
  `,
  'body-xs': (theme: any) => `
    font-size: ${theme.typography.fontSize.xs};
    line-height: ${theme.typography.lineHeight.normal};
    font-weight: ${theme.typography.fontWeight.normal};
  `,
  caption: (theme: any) => `
    font-size: ${theme.typography.fontSize.xs};
    line-height: ${theme.typography.lineHeight.normal};
  `,
  overline: (theme: any) => `
    font-size: ${theme.typography.fontSize.xs};
    text-transform: uppercase;
    letter-spacing: 0.0625rem; /* 1px */
    font-weight: ${theme.typography.fontWeight.semibold};
  `,
  mono: (theme: any) => `
    font-size: ${theme.typography.fontSize.xs};
    line-height: ${theme.typography.lineHeight.normal};
    font-family: ${theme.typography.fontFamily.mono};
  `,
  nav: (theme: any) => `
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
  `,
};

const weightStyles = {
  regular: (theme: any) => `
    font-weight: ${theme.typography.fontWeight.normal};
  `,
  medium: (theme: any) => `
    font-weight: ${theme.typography.fontWeight.medium};
  `,
  semibold: (theme: any) => `
    font-weight: ${theme.typography.fontWeight.semibold};
  `,
  bold: (theme: any) => `
    font-weight: ${theme.typography.fontWeight.bold};
  `,
};

const TextElement = styled.span<StyledTextProps>`
  color: ${(p) => {
    if (p.$color) {
      if (p.$color.includes('.')) {
        const [cat, sub] = p.$color.split('.');
        return (p.theme as any).colors[cat][sub];
      }
      return p.$color;
    }
    return p.$muted ? (p.theme as any).colors.text.secondary : (p.theme as any).colors.text.primary;
  }};
  font-family: ${({ theme }) => (theme as any).typography.fontFamily.sans};

  /* Variant styles */
  ${(p) => (variantStyles[p.$variant || 'body'] || variantStyles.body)(p.theme)}

  /* Weight styles */
  ${(p) => (weightStyles[p.$weight || 'regular'] || weightStyles.regular)(p.theme)}
  
  /* Text align */
  ${(p) =>
    p.$align &&
    css`
      text-align: ${p.$align};
    `}
  
  /* Truncate */
  ${(p) =>
    p.$truncate &&
    css`
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `}
`;

export const S = {
  TextElement,
};
