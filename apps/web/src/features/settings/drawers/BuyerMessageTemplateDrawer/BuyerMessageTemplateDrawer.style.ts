import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { FormCard } from '../shared/drawerSurfaces.style';

export const ResetRow = styled.div`
  display: flex;
  justify-content: flex-end;
`;

export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;
