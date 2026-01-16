import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import type { CardProps } from './Card.types';

export const CardContainer = styled.div<{ $variant: CardProps['variant']; $padding: CardProps['padding'] }>`
  background: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.xl')};
  overflow: hidden;
  
  ${({ $variant }) => {
    switch ($variant) {
      case 'bordered':
        return `border: 1px solid ${tkn('colors.border.primary')};`;
      case 'elevated':
        return `box-shadow: ${tkn('shadows.md')};`;
      default:
        return `border: 1px solid ${tkn('colors.border.primary')};`;
    }
  }}
  
  ${({ $padding }) => {
    switch ($padding) {
      case 'none':
        return 'padding: 0;';
      case 'sm':
        return `padding: ${tkn('spacing.sm')};`;
      case 'md':
        return `padding: ${tkn('spacing.md')};`;
      case 'lg':
        return `padding: ${tkn('spacing.lg')};`;
      default:
        return '';
    }
  }}
`;

export const CardHeaderContainer = styled.div`
  padding: ${tkn('spacing.md')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const CardHeaderContent = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const CardHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const CardBodyContainer = styled.div`
  padding: ${tkn('spacing.lg')};
`;
