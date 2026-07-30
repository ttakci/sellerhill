import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

import type { CardPadding, CardVariant } from './Card.types';

export const CardContainer = styled.div<{
  $variant: CardVariant;
  $padding: CardPadding;
  $hoverable?: boolean;
}>`
  background: ${tkn('colors.surface.primary')};
  /* radius.lg (12px) is the documented card tier. This was radius.sm (6px), which
     put every card on the badge/table-cell radius and made surfaces read flat. */
  border-radius: ${tkn('radius.lg')};
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
        /* Borderless white card on soft canvas — shadow defines the edge */
        return `box-shadow: ${tkn('shadows.sm')(props)}; border: none;`;
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

  /* Padding styles.
     The lg step resolves to the SAME inset as CardBody (md+ / 20px) so a card
     padded via the prop and a card padded via CardBody are visually identical —
     they used to differ by 4px depending on which API the caller reached for. */
  ${(props) => {
    switch (props.$padding) {
      case 'none':
        return 'padding: 0;';
      case 'sm':
        return `padding: ${tkn('spacing.sm-md')(props)};`;
      case 'md':
        return `padding: ${tkn('spacing.md')(props)};`;
      case 'lg':
        return `padding: ${tkn('spacing.md+')(props)};`;
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

/*
 * Header used to restyle `h3, span` descendants by tag selector, forcing bold
 * 16px onto anything passed in — which silently overrode <Text variant>, and
 * contradicted the "card titles are semibold" rule. Titles now come in as
 * <Text> from the component, so this wrapper is layout-only.
 */
export const CardHeaderContainer = styled.div`
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  background: transparent;
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

export const CardHeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

/* Body/footer inset tightened lg (24px) -> md+ (20px): the shared SaaS density
   step. Header/footer stay 12px vertical so chrome reads lighter than content. */
export const CardBodyContainer = styled.div`
  padding: ${tkn('spacing.md+')};
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export const CardFooterContainer = styled.div`
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
`;

/*
 * Stat card — layout only. Typography and trend colour used to be driven by
 * `.card-stat-*` class rules with raw font-size/weight (bypassing <Text> and
 * rendering the value at 24px/bold instead of the `metric` tier). The component
 * now composes <Text variant="metric"> etc., so nothing here styles text.
 */
export const CardStatContainer = styled.div`
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

  .card-stat-footer {
    display: flex;
    align-items: center;
    gap: ${tkn('spacing.xs')};
    margin-top: ${tkn('spacing.2xs')};
  }
`;
