import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

/**
 * The section stack every drawer body uses. It deliberately adds NO padding of
 * its own: `Drawer`'s `Body` already pads all four sides equally, so any extra
 * horizontal inset here makes that one drawer's content narrower than the rest
 * (the carousel drawers each carried `padding: 0 md` and visibly did not line
 * up with the others). Content that must clear the carousel arrows solves it
 * on the arrow, not by shrinking the body.
 */
export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

/**
 * White form surface inside drawers.
 * Drawer body uses a soft canvas (background.primary); this card is pure white
 * with a light border + shadow so fields read as one elevated block. The border
 * is what keeps the card's edge legible where the canvas behind it is nearly as
 * light as the card itself — the shadow alone disappears at that contrast.
 */
export const FormCard = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-sizing: border-box;
  width: 100%;
`;
