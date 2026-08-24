import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { FormCard } from '../shared/drawerSurfaces.style';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

export const FieldGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};
`;

export const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

/** Bordered box grouping the ship-from address fields — matches the
 *  buyer-messaging event rows / listing-detail automation blocks so every
 *  boxed sub-section in the app shares the same edges and padding. */
export const ShipFromSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
`;
