import styled from '@emotion/styled';
import { tkn } from '../theme/tkn';

/**
 * Shared Form Layout Styles
 * used by RadioGroup, CheckboxGroup and other non-floating-label inputs.
 */

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: ${tkn('spacing.xs')};
`;

export const LabelText = styled.label`
  display: block;
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.primary')};
`;

export const ErrorText = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.semantic.error')};
  font-weight: ${tkn('typography.fontWeight.medium')};
`;
