import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const BodyStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
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
  border: 1px solid ${tkn('colors.border.primary')};
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
