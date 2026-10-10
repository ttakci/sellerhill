import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { FormCard } from '../shared/drawerSurfaces.style';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

/** The "change time zone" link sits at the card's leading edge, not centred under it. */
export const LinkRow = styled.div`
  display: flex;
  justify-content: flex-start;
`;

export const ToggleRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;
