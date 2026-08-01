import styled from '@emotion/styled';

import { tkn } from '../../theme/tkn';

export const Container = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  color: ${tkn('colors.semantic.error')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  line-height: ${tkn('typography.lineHeight.normal')};
`;

export const IconWrapper = styled.span`
  display: inline-flex;
  flex-shrink: 0;
`;
