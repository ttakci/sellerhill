import styled, { css } from 'styled-components';

import { tkn } from '../../theme/tkn';

import type { TextVariant, TextWeight, TextAlign } from './Text.types';

interface StyledTextProps {
  $variant?: TextVariant;
  $weight?: TextWeight;
  $align?: TextAlign;
  $muted?: boolean;
  $truncate?: boolean;
}

const variantStyles = {
  body: css`
    font-size: ${tkn('typography.fontSize.md')};
  `,

  caption: css`
    font-size: ${tkn('typography.fontSize.sm')};
  `,

  overline: css`
    font-size: ${tkn('typography.fontSize.sm')};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `,
};

const weightStyles = {
  regular: css`
    font-weight: ${tkn('typography.fontWeight.normal')};
  `,

  medium: css`
    font-weight: ${tkn('typography.fontWeight.medium')};
  `,

  semibold: css`
    font-weight: ${tkn('typography.fontWeight.semibold')};
  `,
};

const TextElement = styled.span<StyledTextProps>`
  color: ${(p) => (p.$muted ? tkn('colors.text.secondary') : tkn('colors.text.primary'))};

  /* Variant styles */
  ${(p) => variantStyles[p.$variant || 'body']}

  /* Weight styles */
  ${(p) => weightStyles[p.$weight || 'regular']}
  
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
