import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { FormCard } from './shared/drawerSurfaces.style';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;
