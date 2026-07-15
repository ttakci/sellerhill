import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { CardPadding, CardVariant } from './Card.types';

export const CardContainer = styled.div<{
  $variant: CardVariant;
  $padding: CardPadding;
  $hoverable?: boolean;
}>`
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.sm')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow ${tkn('transitions.fast')}, border-color ${tkn('transitions.fast')}, transform ${tkn('transitions.fast')};

  /* Variant styles */
  ${(props) => {
    switch (props.$variant) {
      case 'bordered':
        return `border: 1px solid ${tkn('colors.border.primary')(props)};`;
      case 'elevated':
        return `box-shadow: ${tkn('shadows.md')(props)}; border: 1px solid ${tkn('colors.border.secondary')(props)};`;
      case 'flat':
        return '';
      case 'interactive':
        return `
          border: 1px solid ${tkn('colors.border.primary')(props)};
          cursor: pointer;
          &:hover {
            box-shadow: ${tkn('shadows.lg')(props)};
            transform: translateY(-0.125rem);
          }
          &:active {
            transform: translateY(0);
            box-shadow: ${tkn('shadows.sm')(props)};
          }
        `;
      case 'stat':
        return `border: 1px solid ${tkn('colors.border.primary')(props)};`;
      case 'section':
        return `border: 1px solid ${tkn('colors.border.primary')(props)};`;
      default:
        return `
          border: 1px solid ${tkn('colors.border.primary')(props)};
          box-shadow: ${tkn('shadows.sm')(props)};
        `;
    }
  }}

  /* Padding styles */
  ${(props) => {
    switch (props.$padding) {
      case 'none':
        return 'padding: 0;';
      case 'sm':
        return `padding: ${tkn('spacing.sm')(props)};`;
      case 'md':
        return `padding: ${tkn('spacing.md')(props)};`;
      case 'lg':
        return `padding: ${tkn('spacing.lg')(props)};`;
      default:
        return '';
    }
  }}

  /* Hoverable effect */
  ${(props) =>
    props.$hoverable &&
    !props.$variant?.includes('interactive') &&
    `
    cursor: pointer;
    &:hover {
      box-shadow: ${tkn('shadows.md')(props)};
      transform: translateY(-0.0625rem);
    }
  `}
`;

export const CardHeaderContainer = styled.div`
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  background: transparent;

  h3,
  span {
    font-weight: ${tkn('typography.fontWeight.bold')};
    color: ${tkn('colors.text.primary')};
    font-size: ${tkn('typography.fontSize.md')};
  }
`;

export const CardHeaderContent = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};

  & > h3,
  & > p,
  & > span {
    margin: 0;
  }
`;

export const CardHeaderTextContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const CardHeaderDescription = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.text.secondary')};
  line-height: ${tkn('typography.lineHeight.normal')};
`;

export const CardHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const CardBodyContainer = styled.div`
  padding: ${tkn('spacing.lg')};
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export const CardFooterContainer = styled.div`
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.lg')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
`;

/* Stat Card styles */
export const CardStatContainer = styled.div<{
  $trend?: 'up' | 'down' | 'neutral';
}>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};

  .card-stat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .card-stat-icon {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: ${tkn('radius.md')};
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${tkn('colors.brand.secondary')};
    color: ${tkn('colors.brand.primary')};
  }

  .card-stat-value {
    font-size: ${tkn('typography.fontSize.xxl')};
    font-weight: ${tkn('typography.fontWeight.bold')};
    color: ${tkn('colors.text.primary')};
    line-height: ${tkn('typography.lineHeight.tight')};
  }

  .card-stat-label {
    font-size: ${tkn('typography.fontSize.xs')};
    color: ${tkn('colors.text.secondary')};
    font-weight: ${tkn('typography.fontWeight.medium')};
  }

  .card-stat-footer {
    display: flex;
    align-items: center;
    gap: ${tkn('spacing.xs')};
    margin-top: 0.125rem;
  }

  .card-stat-trend {
    font-size: ${tkn('typography.fontSize.xs')};
    font-weight: ${tkn('typography.fontWeight.medium')};
    color: ${(props) => {
      switch (props.$trend) {
        case 'up': return tkn('colors.semantic.success')(props);
        case 'down': return tkn('colors.semantic.error')(props);
        default: return tkn('colors.text.tertiary')(props);
      }
    }};
  }

  .card-stat-subtitle {
    font-size: ${(props) => props.theme.typography.fontSize['2xs']};
    color: ${tkn('colors.text.tertiary')};
  }
`;
