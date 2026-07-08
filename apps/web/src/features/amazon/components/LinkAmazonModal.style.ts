import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

export const FooterRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.xs')};
`;

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 20rem;
`;

export const AccountLabel = styled(Text)`
  margin-bottom: ${tkn('spacing.xs')};
`;

export const NativeSelect = styled.select`
  width: 100%;
  padding: ${tkn('spacing.xs')};
  border-radius: ${tkn('radius.sm')};
  border: 1px solid ${tkn('colors.border.secondary')};
  background: ${tkn('colors.surface.primary')};
  color: ${tkn('colors.text.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
`;
