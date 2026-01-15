/**
 * DashboardPage Styles
 */

import { Theme } from '@emotion/react';
import styled from '@emotion/styled';

export const Container = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: ${({ theme }: { theme: Theme }) => theme.spacing.xl};
`;

export const Header = styled.div`
  margin-bottom: ${({ theme }: { theme: Theme }) => theme.spacing.xxl};
`;

export const Title = styled.h1`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.xxxl};
  font-weight: ${({ theme }: { theme: Theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }: { theme: Theme }) => theme.spacing.sm} 0;
`;

export const Subtitle = styled.p`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.secondary};
  margin: 0;
`;

export const Greeting = styled.h2`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }: { theme: Theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }: { theme: Theme }) => theme.spacing.lg} 0;
`;

export const Content = styled.div`
  display: grid;
  gap: ${({ theme }: { theme: Theme }) => theme.spacing.lg};
`;

export const Card = styled.div`
  background: ${({ theme }: { theme: Theme }) => theme.colors.surface.primary};
  border-radius: ${({ theme }: { theme: Theme }) => theme.radius.lg};
  box-shadow: ${({ theme }: { theme: Theme }) => theme.shadows.md};
  padding: ${({ theme }: { theme: Theme }) => theme.spacing.xl};
`;

export const CardTitle = styled.h3`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }: { theme: Theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.primary};
  margin: 0 0 ${({ theme }: { theme: Theme }) => theme.spacing.md} 0;
`;

export const CardDescription = styled.p`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.md};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.secondary};
  margin: 0 0 ${({ theme }: { theme: Theme }) => theme.spacing.lg} 0;
  line-height: ${({ theme }: { theme: Theme }) => theme.typography.lineHeight.relaxed};
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: ${({ theme }: { theme: Theme }) => theme.spacing.xxl};
  background: ${({ theme }: { theme: Theme }) => theme.colors.background.secondary};
  border-radius: ${({ theme }: { theme: Theme }) => theme.radius.md};
`;

export const EmptyStateText = styled.p`
  font-size: ${({ theme }: { theme: Theme }) => theme.typography.fontSize.lg};
  color: ${({ theme }: { theme: Theme }) => theme.colors.text.secondary};
  margin: 0 0 ${({ theme }: { theme: Theme }) => theme.spacing.lg} 0;
`;

export const ButtonContainer = styled.div`
  max-width: 320px;
  margin: 0 auto;
`;
