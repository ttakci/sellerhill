import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export { FormCard } from '../shared/drawerSurfaces.style';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;

/** Inline add form: type checkboxes + textarea + hint + error (use inside FormCard). */
export const AddStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const TypeOptionsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.md')};
`;

export const CardGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};
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
