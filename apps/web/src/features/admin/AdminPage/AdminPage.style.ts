import styled from '@emotion/styled';
import { Card, IconButton, PageContainer, tkn } from '@repo/ui';

export const Container = PageContainer;

/* Section navigation lives in the real operator sidebar (OperatorLayout), not
   here — each admin section is its own sidebar entry (`/admin?tab=...`), so
   this page renders only the content for whichever tab the URL selects. */

/** Info-icon trigger next to a settings row label — opens the description tooltip. */
export const InfoButton = styled(IconButton)`
  flex-shrink: 0;
`;

/** Settings-row label + info icon, kept on one line. */
export const LabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
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

/**
 * A KPI figure paired with an emphasis badge (e.g. the Aquiline profile
 * count's "never resets" badge) — the figure and its callout read as one
 * unit instead of stacking as two separate lines.
 */
export const FigureRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
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

/**
 * A list of hairline rows on its own pane — warnings, queues, quota bands,
 * aspect coverage. Rows used to sit bare on the canvas; every other list in
 * the app lives inside a pane, and the console must read as the same product.
 */
export const ListPane = styled(Card)`
  display: flex;
  flex-direction: column;
  padding: 0 ${tkn('spacing.md+')};
`;

export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding-block: ${tkn('spacing.sm-md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  &:last-child {
    border-bottom: none;
  }
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

/** Right-hand cluster of a settings-style row (badge + count + action). */
export const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;
