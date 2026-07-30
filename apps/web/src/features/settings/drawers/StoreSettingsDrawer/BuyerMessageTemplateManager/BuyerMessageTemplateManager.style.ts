import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  /* List beside editor once the lg drawer gives us the width. */
  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: minmax(0, 15rem) minmax(0, 1fr);
    align-items: start;
  }
`;

export const ListColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const TemplateItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  cursor: pointer;
`;

export const EditorColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
`;

export const PreviewBox = styled.div`
  padding: ${tkn('spacing.sm')};
  background: ${tkn('colors.surface.secondary')};
  border-radius: ${tkn('radius.sm')};
  min-height: ${tkn('spacing.xl')};
`;
