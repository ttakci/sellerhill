import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { BodyStack, FormCard } from '../shared/drawerSurfaces.style';

/** Inline add form: type checkboxes + textarea + hint + error (use inside FormCard). */
export const AddStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

/**
 * A 2-column grid, not a wrapping flex row: one option label ("Özellikler ve
 * spesifikasyonlar") is long enough that a flex row let it overflow the drawer
 * instead of wrapping. `minmax(0, 1fr)` cells force the label to wrap inside
 * its own column; below `sm` the options stack.
 */
export const TypeOptionsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
  }
`;

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.xs')};
`;

export const ToolbarRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const ToolbarLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const ToolbarRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;
