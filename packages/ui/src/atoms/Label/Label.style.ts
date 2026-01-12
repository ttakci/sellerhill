import styled, { css } from 'styled-components';

import { tkn } from '../../theme/tkn';

import type { LabelSize } from './Label.types';

interface StyledLabelProps {
  $size?: LabelSize;
  $disabled?: boolean;
}

const sizeStyles = {
  sm: css`
    font-size: ${tkn('typography.fontSize.sm')};
  `,

  md: css`
    font-size: ${tkn('typography.fontSize.md')};
  `,

  lg: css`
    font-size: ${tkn('typography.fontSize.md')};
  `,
};

const LabelText = styled.label<StyledLabelProps>`
  display: block;
  color: ${tkn('colors.text.primary')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  margin-bottom: ${tkn('spacing.sm')};
  line-height: 1.5;

  /* Size styles */
  ${(p) => sizeStyles[p.$size || 'md']}

  /* Disabled state */
  ${(p) =>
    p.$disabled &&
    css`
      opacity: 0.6;
      cursor: not-allowed;
    `}
`;

const RequiredIndicator = styled.span`
  color: ${tkn('colors.semantic.error')};
  margin-left: ${tkn('spacing.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
`;

export const S = {
  LabelText,
  RequiredIndicator,
};
