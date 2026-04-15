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
  /* ── Headings: Inter Bold ── */
  display: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: 2.5rem;
    line-height: 3rem;
    font-weight: ${theme.typography.fontWeight.bold};
    letter-spacing: 0;
  `,
  h1: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: 1.5rem;
    line-height: 2rem;
    font-weight: ${theme.typography.fontWeight.bold};
    letter-spacing: 0;
  `,
  h2: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: 1.25rem;
    line-height: 1.75rem;
    font-weight: ${theme.typography.fontWeight.bold};
    letter-spacing: 0;
  `,
  h3: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: 1.125rem;
    line-height: 1.5rem;
    font-weight: ${theme.typography.fontWeight.bold};
    letter-spacing: 0;
  `,
  h4: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: 1rem;
    line-height: 1.5rem;
    font-weight: ${theme.typography.fontWeight.bold};
    letter-spacing: 0;
  `,
  h5: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: ${theme.typography.fontWeight.semibold};
    letter-spacing: 0;
  `,
  /* ── Body: Lexend Regular ── */
  body: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.body};
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: ${theme.typography.fontWeight.normal};
    letter-spacing: 0;
  `,
  'body-sm': (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.body};
    font-size: 0.875rem;
    line-height: 1.25rem;
    font-weight: ${theme.typography.fontWeight.normal};
    letter-spacing: 0;
  `,
  'body-xs': (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.body};
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: ${theme.typography.fontWeight.normal};
    letter-spacing: 0;
  `,
  caption: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.body};
    font-size: 0.75rem;
    line-height: 1rem;
    font-weight: ${theme.typography.fontWeight.normal};
    letter-spacing: 0;
  `,
  overline: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.heading};
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: ${theme.typography.letterSpacing.widest};
    font-weight: ${theme.typography.fontWeight.semibold};
  `,
  mono: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.mono};
    font-size: ${theme.typography.fontSize.xs};
    line-height: ${theme.typography.lineHeight.normal};
  `,
  nav: (theme: Theme) => `
    font-family: ${theme.typography.fontFamily.body};
    font-size: 0.875rem;
    font-weight: ${theme.typography.fontWeight.medium};
    letter-spacing: 0;
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
