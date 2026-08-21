import styled from '@emotion/styled';
import { Card, PageContainer, tkn } from '@repo/ui';

/**
 * Listings overview — same visual system as Settings hub:
 * full-width, crisp cards, clear type hierarchy, 2-col desktop / 1-col mobile.
 * Columns are top-aligned (not stretch) so the carousel card stays content-height.
 */
export const Container = PageContainer;

export const TwoColumnLayout = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.lg')};
  align-items: start;
  width: 100%;

  & > * {
    min-width: 0;
  }

  @media (max-width: 48rem) {
    grid-template-columns: 1fr;
  }
`;

export const SliderColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const SliderContent = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

/**
 * Wraps the carousel's own empty state (a bare `EmptyState`, no surface of its
 * own) in the same white card the sibling "Yeni Liste Ekle"/"Diğer İşlemler"
 * panels use — otherwise the page background shows through behind it.
 * Mirrors the dashboard `CardsPanel`'s `EmptyCard`.
 */
export const EmptyCard = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const AddColumn = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

export const AddCardStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
`;
