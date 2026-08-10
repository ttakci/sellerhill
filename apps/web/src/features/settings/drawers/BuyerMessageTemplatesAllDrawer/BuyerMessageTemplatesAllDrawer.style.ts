import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { FormCard } from '../shared/drawerSurfaces.style';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const FilterRow = styled.div`
  display: flex;
  justify-content: flex-start;
`;

export const FilterSelectWrapper = styled.div`
  min-width: 12rem;
`;

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};
`;
