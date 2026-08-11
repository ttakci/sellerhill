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
export const ColumnStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  min-width: 0;

  && > * {
    height: auto;
    flex: 0 0 auto;
  }
`;
