import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { FormCard } from './shared/drawerSurfaces.style';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;
