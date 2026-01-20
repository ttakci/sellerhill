import styled from '@emotion/styled';
import { tkn } from '../../theme/tkn';
import type { CardProps } from './Card.types';

export const CardContainer = styled.div<{ $variant: CardProps['variant']; $padding: CardProps['padding'] }>`
  background: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: all ${tkn('transitions.normal')} ease;
  
  ${(props) => {
    switch (props.$variant) {
      case 'bordered':
        return `border: 1px solid ${tkn('colors.border.primary')(props as any)};`;
      case 'elevated':
        return `
          border: 1px solid ${tkn('colors.border.primary')(props as any)};
          box-shadow: ${tkn('shadows.sm')(props as any)};
        `;
      default:
        return `border: 1px solid ${tkn('colors.border.primary')(props as any)};`;
    }
  }}
  
  ${(props) => {
    switch (props.$padding) {
      case 'none':
        return 'padding: 0;';
      case 'sm':
        return `padding: ${tkn('spacing.md')(props as any)};`;
      case 'md':
        return `padding: ${tkn('spacing.lg')(props as any)};`;
      case 'lg':
        return `padding: ${tkn('spacing.xl')(props as any)};`;
      default:
        return '';
    }
  }}
`;

export const CardHeaderContainer = styled.div`
  padding: ${tkn('spacing.lg')} ${tkn('spacing.xl')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  background: transparent;

  h3, span {
    font-weight: 700;
    color: ${tkn('colors.text.primary')};
    font-size: ${tkn('typography.fontSize.md')};
  }
`;

export const CardHeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  
  & > h3, & > p, & > span {
    margin: 0;
  }
`;

export const CardHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const CardBodyContainer = styled.div`
  padding: ${tkn('spacing.xl')};
  flex: 1;
  display: flex;
  flex-direction: column;
`;
