import { css, type Theme } from '@emotion/react';
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
  /* ── Headings: Inter, semibold/bold, tight tracking ── */
  display: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: ${theme.typography.fontSize['3xl']};
    line-height: ${theme.typography.lineHeight.tight};
    font-weight: ${theme.typography.fontWeight.bold};
    letter-spacing: ${theme.typography.letterSpacing.tighter};
  `,
  h1: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: ${theme.typography.fontSize.xxl};
    line-height: ${theme.typography.lineHeight.tight};
    font-weight: ${theme.typography.fontWeight.semibold};
    letter-spacing: ${theme.typography.letterSpacing.tight};
  `,
  h2: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: ${theme.typography.fontSize.xl};
    line-height: ${theme.typography.lineHeight.tight};
    font-weight: ${theme.typography.fontWeight.semibold};
    letter-spacing: ${theme.typography.letterSpacing.tight};
  `,
  h3: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: ${theme.typography.fontSize.lg};
    line-height: ${theme.typography.lineHeight.tight};
    font-weight: ${theme.typography.fontWeight.semibold};
    letter-spacing: ${theme.typography.letterSpacing.tight};
  `,
  h4: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: ${theme.typography.fontSize.md};
    line-height: ${theme.typography.lineHeight.normal};
    font-weight: ${theme.typography.fontWeight.semibold};
    letter-spacing: ${theme.typography.letterSpacing.normal};
  `,
  h5: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: ${theme.typography.fontSize.sm};
    line-height: ${theme.typography.lineHeight.normal};
    font-weight: ${theme.typography.fontWeight.semibold};
    letter-spacing: ${theme.typography.letterSpacing.normal};
  `,
  /* ── Body scale (must stay distinct — never collapse body === body-sm) ── */
  body: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.body};
    font-size: ${theme.typography.fontSize.md};
    line-height: ${theme.typography.lineHeight.normal};
    font-weight: ${theme.typography.fontWeight.normal};
    letter-spacing: ${theme.typography.letterSpacing.normal};
  `,
  'body-sm': (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.body};
    font-size: ${theme.typography.fontSize.sm};
    line-height: ${theme.typography.lineHeight.normal};
    font-weight: ${theme.typography.fontWeight.normal};
    letter-spacing: ${theme.typography.letterSpacing.normal};
  `,
  'body-xs': (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.body};
    font-size: ${theme.typography.fontSize['2xs']};
    line-height: ${theme.typography.lineHeight.tight};
    font-weight: ${theme.typography.fontWeight.normal};
    letter-spacing: ${theme.typography.letterSpacing.normal};
  `,
  caption: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.body};
    font-size: ${theme.typography.fontSize.xs};
    line-height: ${theme.typography.lineHeight.normal};
    font-weight: ${theme.typography.fontWeight.normal};
    letter-spacing: ${theme.typography.letterSpacing.normal};
  `,
  overline: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: ${theme.typography.fontSize['2xs']};
    text-transform: uppercase;
    letter-spacing: ${theme.typography.letterSpacing.widest};
    font-weight: ${theme.typography.fontWeight.semibold};
    line-height: ${theme.typography.lineHeight.tight};
  `,
  mono: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.mono};
    font-size: ${theme.typography.fontSize.xs};
    line-height: ${theme.typography.lineHeight.normal};
  `,
  nav: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.body};
    font-size: ${theme.typography.fontSize.sm};
    font-weight: ${theme.typography.fontWeight.medium};
    letter-spacing: ${theme.typography.letterSpacing.normal};
  `,
};

const weightStyles = {
  regular: (theme: Theme) => `
    font-weight: ${theme.typography.fontWeight.normal};
  `,
  medium: (theme: Theme) => `
    font-weight: ${theme.typography.fontWeight.medium};
  `,
  semibold: (theme: Theme) => `
    font-weight: ${theme.typography.fontWeight.semibold};
  `,
  bold: (theme: Theme) => `
    font-weight: ${theme.typography.fontWeight.bold};
  `,
};

const TextElement = styled.span<StyledTextProps>`
  color: ${(p) => {
    if (p.$color) {
      if (p.$color.includes('.')) {
        const [cat, sub] = p.$color.split('.');
        return (p.theme.colors as unknown as Record<string, Record<string, string>>)[cat][sub];
      }
      return p.$color;
    }
    return p.$muted ? p.theme.colors.text.secondary : p.theme.colors.text.primary;
  }};
  font-family: ${({ theme }) => theme.typography.fontFamily.body};

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
