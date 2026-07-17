import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/**
 * White, borderless form surface inside drawers.
 * Drawer body uses a soft canvas (background.primary); this card is pure white
 * with a light shadow so fields read as one elevated block.
 */
export const FormCard = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: none;
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-sizing: border-box;
  width: 100%;
`;
