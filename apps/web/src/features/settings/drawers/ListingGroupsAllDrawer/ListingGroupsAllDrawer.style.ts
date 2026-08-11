import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { BodyStack, FormCard } from '../shared/drawerSurfaces.style';

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};
`;
