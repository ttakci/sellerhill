import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

// --- Layout ---

export const Container = styled.div`
  width: 100%;
  max-width: 90rem;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

// --- Two-column overview (slider + add-new-listing section) ---

export const TwoColumnLayout = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.lg')};
  align-items: stretch;

  @media (max-width: 64rem) {
    grid-template-columns: 1fr;
  }
`;

export const SliderColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  height: 100%;
`;

export const SliderContent = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
`;

export const AddColumn = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;

  @media (max-width: 64rem) {
    position: static;
  }
`;

/** Stacked quick-action cards inside the add-new-listing column. */
export const AddCardStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  height: 100%;

  .other-actions-card {
    flex: 1;
    min-height: 0;
  }
`;
