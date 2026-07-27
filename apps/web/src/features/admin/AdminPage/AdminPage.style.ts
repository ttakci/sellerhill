import { PageContainer, tkn } from '@repo/ui';
import styled from '@emotion/styled';
import { Card } from '@repo/ui';

export const Container = PageContainer;

export const Tabs = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: ${tkn('spacing.md')};
`;

export const SummaryCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
`;

export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding-block: ${tkn('spacing.sm')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
`;
