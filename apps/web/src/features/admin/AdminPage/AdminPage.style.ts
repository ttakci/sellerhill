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

/** One collapsible category group in the Settings tab accordion. */
export const SettingsCategoryCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
`;

/** Clickable header — the whole row toggles the category, chevron rotates with state. */
export const SettingsCategoryHeader = styled.button<{ $isOpen: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: ${tkn('spacing.sm')};
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;

  svg {
    transition: transform ${tkn('transitions.fast')};
    transform: ${({ $isOpen }) => ($isOpen ? 'rotate(180deg)' : 'rotate(0deg)')};
    color: ${tkn('colors.text.secondary')};
    flex-shrink: 0;
  }

  &:hover svg {
    color: ${tkn('colors.brand.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
    border-radius: ${tkn('radius.sm')};
  }
`;

/** Category title + setting count, grouped so they read as one label. */
export const SettingsCategoryHeaderTitle = styled.div`
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

/** Right-hand cluster of a settings-style row (badge + count + action). */
export const RowActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;
