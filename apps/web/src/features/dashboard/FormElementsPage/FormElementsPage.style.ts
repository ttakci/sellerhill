import { Theme } from '@emotion/react';
import styled from '@emotion/styled';
import { tkn } from '@repo/ui';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.xl')({ theme })};
`;

export const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.xl')({ theme })};

  @media (min-width: 1024px) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const Card = styled.div`
  background: ${({ theme }: { theme: Theme }) => tkn('colors.background.primary')({ theme })};
  border-radius: ${({ theme }: { theme: Theme }) => tkn('radius.lg')({ theme })};
  border: 1px solid ${({ theme }: { theme: Theme }) => tkn('colors.border.primary')({ theme })};
  overflow: hidden;
  box-shadow: ${({ theme }: { theme: Theme }) => tkn('shadows.sm')({ theme })};
`;

export const CardHeader = styled.div`
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })} ${({ theme }: { theme: Theme }) => tkn('spacing.lg')({ theme })};
  border-bottom: 1px solid ${({ theme }: { theme: Theme }) => tkn('colors.border.primary')({ theme })};
`;

export const CardBody = styled.div`
  padding: ${({ theme }: { theme: Theme }) => tkn('spacing.lg')({ theme })};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.lg')({ theme })};
`;

export const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }: { theme: Theme }) => tkn('spacing.md')({ theme })};
`;

export const SectionTitle = styled.div`
  margin-bottom: ${({ theme }: { theme: Theme }) => tkn('spacing.sm')({ theme })};
`;
