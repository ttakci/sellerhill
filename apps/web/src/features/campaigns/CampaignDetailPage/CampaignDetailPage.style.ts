import styled from '@emotion/styled';
import { Card, PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;
export const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  overflow-wrap: anywhere;
`;
export const Row = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;
export const Panel = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;
export const Facts = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, calc(${tkn('spacing.xxxl')} * 3)), 1fr));
  gap: ${tkn('spacing.md')};
  @media (max-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: 1fr;
  }
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
