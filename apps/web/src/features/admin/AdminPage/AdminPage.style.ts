import styled from '@emotion/styled';
import { Card, PageContainer, tkn } from '@repo/ui';

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

export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding-block: ${tkn('spacing.sm')};
`;

export const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding-block: ${tkn('spacing.sm')};
  border-bottom: 1px solid ${tkn('colors.border.primary')};
`;

export const RowMain = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const RowSide = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
  justify-content: flex-end;
`;

export const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: ${tkn('spacing.md')};
`;

export const FormActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  justify-content: flex-end;
`;

/** Bounded width so a settings value field never stretches the whole row. */
export const SettingInput = styled.div`
  width: 12rem;
`;
