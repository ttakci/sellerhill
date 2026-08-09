import styled from '@emotion/styled';
import { Text, tkn } from '@repo/ui';

export { FormCard } from '../shared/drawerSurfaces.style';

export const BodyHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
`;

export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;

export const PreviewTitle = styled(Text)`
  margin-top: ${tkn('spacing.sm')};
`;

export const PreviewBox = styled.div`
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
  min-height: ${tkn('spacing.xl')};
`;
