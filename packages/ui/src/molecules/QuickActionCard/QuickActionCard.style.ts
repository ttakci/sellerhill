import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { QuickActionCardVariant } from './QuickActionCard.types';

export const QuickActionCardContainer = styled.div<{ $variant: QuickActionCardVariant }>`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  cursor: pointer;
  transition: box-shadow ${tkn('transitions.fast')}, border-color ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};
  user-select: none;

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-0.125rem);
    border-color: ${tkn('colors.text.tertiary')};
  }

  &:active {
    transform: translateY(0);
  }
`;

export const IconArea = styled.div<{ $variant: QuickActionCardVariant }>`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  ${(props) => {
    switch (props.$variant) {
      case 'brand':
        return `
          background: ${(props.theme as any).colors?.brand?.primary + '15'};
          color: ${tkn('colors.brand.primary')(props as any)};
          border: 0.0625rem solid ${(props.theme as any).colors?.brand?.primary + '30'};
        `;
      case 'default':
      default:
        return `
          background: ${tkn('colors.background.tertiary')(props as any)};
          color: ${tkn('colors.text.secondary')(props as any)};
          border: 0.0625rem solid ${tkn('colors.border.primary')(props as any)};
        `;
    }
  }}
`;

export const Title = styled.span`
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  line-height: 1.4;
`;

export const Subtitle = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.normal')};
  color: ${tkn('colors.text.tertiary')};
  line-height: 1.5;
`;
