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
