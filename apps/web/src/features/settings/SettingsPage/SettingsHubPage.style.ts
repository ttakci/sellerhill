import styled from '@emotion/styled';
import { PageContainer, tkn } from '@repo/ui';

/**
 * Full-width settings layout — Anadolu profile density:
 * soft canvas, generous gaps, cards fill the content column.
 */
export const Container = PageContainer;

export const TwoColGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.lg')};
  width: 100%;
  align-items: stretch;

  & > * {
    min-width: 0;
    height: 100%;
  }

  @media (max-width: 48rem) {
    grid-template-columns: 1fr;
  }
`;

/**
 * Stacks two short cards inside ONE grid column, so a one-row card doesn't get
 * stretched to the height of a three-row card beside it. `&&` is deliberate:
 * `TwoColGrid > *` and `SettingsCard`'s own container both set `height: 100%`
 * at single-class specificity, so a plain `& > *` would win or lose on Emotion
 * injection order. Doubling the class makes the reset unconditional — without
 * it each stacked card claims the full column height and they overflow.
 */
/**
 * Fills the leftover space in a card stretched by its taller \`TwoColGrid\`
 * sibling and centers the InfoMessage inside it, instead of the note
 * hugging the last row with dead space still hanging below.
 */
export const SectionInfoMessage = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  margin-top: ${tkn('spacing.sm')};

  & > * {
    width: 100%;
  }
`;

export const ColumnStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;

  /* The stack ends level with the card beside it (StackedGrid stretches both
     columns to one height). The cards below the first keep their natural
     height; the first takes whatever the column has left, its row centred. */
  && > * {
    height: auto;
    flex: 0 0 auto;
  }

  && > :first-child {
    flex: 1 1 auto;
  }

  && > :first-child > :last-child {
    justify-content: center;
  }

  /* One-row cards: tighter header, body and row insets than a long card, so
     three of them stack to the height of the card beside them. Card anatomy:
     header, divider, body > rows. The first card keeps the standard header,
     so its divider lines up with the divider of the card beside it. */
  && > :not(:first-child) > :first-of-type {
    padding-top: ${tkn('spacing.md')};
    padding-bottom: ${tkn('spacing.sm')};
  }

  && > * > :last-child {
    padding-bottom: ${tkn('spacing.xs')};
  }

  && > * > :last-child > * {
    padding-top: ${tkn('spacing.sm')};
    padding-bottom: ${tkn('spacing.sm')};
  }
`;

/**
 * The grid of a one-card column beside a `ColumnStack` (operator request,
 * 2026-10-10): both columns end on one line. The single card keeps a normal
 * foot; the stacked cards take their share of the same height.
 */
export const StackedGrid = styled(TwoColGrid)`
  && > :first-of-type > :last-child {
    padding-bottom: ${tkn('spacing.md')};
  }
`;
