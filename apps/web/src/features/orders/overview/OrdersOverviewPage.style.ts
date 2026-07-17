import styled from '@emotion/styled';
import { PageContainer, tkn } from '@repo/ui';

/**
 * Orders overview — same layout system as Listings overview:
 * full-width, 2-col desktop / 1-col mobile, carousel left + actions right.
 */
export const Container = PageContainer;

export const TwoColumnLayout = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.lg')};
  align-items: stretch;
  width: 100%;

  & > * {
    min-width: 0;
    height: 100%;
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
`;

export const AddCardStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  height: 100%;

  .other-actions-card {
    flex: 1;
    min-height: 0;
  }
`;
