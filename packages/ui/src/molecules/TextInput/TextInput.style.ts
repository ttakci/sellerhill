export const LabelText = styled.div`
  display: block;
  margin-bottom: ${tkn('spacing.xs')};
`;
import styled from 'styled-components';

import { tkn } from '../../theme/tkn';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  width: 100%;
`;

export const ErrorText = styled.span`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.semantic.error')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;
