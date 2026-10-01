import styled from '@emotion/styled';
import { glassSurface, tkn } from '@repo/ui';

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
 * Form surface inside drawers — the same frosted pane every page card uses,
 * at the card radius, so a drawer's sections lift off the drawer the way
 * page cards lift off the canvas (the drawer panel itself is the strong pane).
 */
export const FormCard = styled.div`
  ${({ theme }) => glassSurface(theme)}
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-sizing: border-box;
  width: 100%;
`;
