import { css, type Theme } from '@emotion/react';
import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const BadgeContainer = styled.a<{ $size: 'sm' | 'md'; $isHovered?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  text-decoration: none;
  color: inherit;
  transition: all ${tkn('transitions.fast')};

  &:hover {
    color: ${(p) => p.theme.colors.brand.primary};
  }

  ${({ $size, theme }) => {
    switch ($size) {
      case 'sm':
        return css`
          font-size: ${tkn('typography.fontSize.xs')({ theme })};
        `;
      case 'md':
        return css`
          font-size: ${tkn('typography.fontSize.sm')({ theme })};
        `;
      default:
        return '';
    }
  }}
`;

export const IdText = styled.span<{ $size: 'sm' | 'md'; $isHovered?: boolean }>`
  font-family: ${tkn('typography.fontFamily.mono')};
  font-weight: ${tkn('typography.fontWeight.normal')};
  color: ${({ $isHovered }) =>
    $isHovered ? (p: { theme: Theme }) => p.theme.colors.brand.primary : tkn('colors.text.secondary')};
  transition: color ${tkn('transitions.fast')};
`;

export const ExternalIcon = styled.span<{ $size: 'sm' | 'md'; $isHovered?: boolean }>`
  display: inline-flex;
  align-items: center;
  color: ${({ $isHovered }) =>
    $isHovered ? (p: { theme: Theme }) => p.theme.colors.brand.primary : tkn('colors.text.tertiary')};
  opacity: ${({ $isHovered }) => ($isHovered ? 1 : 0.6)};
  transition: all ${tkn('transitions.fast')};

  svg {
    stroke: currentColor !important;
  }

  ${({ $size }) => {
    switch ($size) {
      case 'sm':
        return css`
          svg {
            width: 0.875rem;
            height: 0.875rem;
          }
        `;
      case 'md':
        return css`
          svg {
            width: 1rem;
            height: 1rem;
          }
        `;
      default:
        return '';
    }
  }}
`;
