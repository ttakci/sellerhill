import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  padding-bottom: ${tkn('spacing.xxxl')};
`;

export const TwoColGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.lg')};

  @media (max-width: 48rem) {
    /* 768px */
    grid-template-columns: 1fr;
  }
`;
