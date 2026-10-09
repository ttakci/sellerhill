import styled from '@emotion/styled';
import { PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  overflow-wrap: anywhere;
`;
/** "Back to campaigns" sits on the canvas at the start of the page, never stretched. */
export const BackRow = styled.div`
  display: flex;
  margin-top: calc(-1 * ${tkn('spacing.sm')});
`;
export const Fact = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;
/** Rate text (and its note) with the edit control beside it, right-aligned like the column. */
export const RateCell = styled.div`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  text-align: right;
`;
