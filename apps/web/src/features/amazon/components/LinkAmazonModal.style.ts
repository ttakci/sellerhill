import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
`;

export const AccountLabel = styled(Text)`
  margin-bottom: ${tkn('spacing.xs')};
  display: block;
`;

export const NativeSelect = styled.select`
  width: 100%;
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.sm')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.surface.primary')};
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-family: ${tkn('typography.fontFamily.body')};
  box-sizing: border-box;
  min-height: 2.75rem;
`;
