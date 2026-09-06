import styled from '@emotion/styled';
import { IconButton, tkn } from '@repo/ui';

export { FormCard } from '../shared/drawerSurfaces.style';

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
  margin-block: ${tkn('spacing.xs')};
`;

export const ToggleTitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const InfoButton = styled(IconButton)`
  flex-shrink: 0;
`;
