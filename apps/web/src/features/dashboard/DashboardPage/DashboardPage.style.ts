/**
 * DashboardPage Styles
 * Follows OrdersPage design patterns with StatCard, Icon, etc.
 */

import styled from '@emotion/styled';
import { Card as RepoCard, Text, tkn } from '@repo/ui';

export const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.lg')};

  @media (max-width: 48rem) {
    padding: ${tkn('spacing.md')};
  }
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15.625rem, 1fr));
  gap: ${tkn('spacing.lg')};
`;

export const StatCard = styled(RepoCard)`
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  transition: box-shadow ${tkn('transitions.normal')}, transform ${tkn('transitions.normal')};
  border-top: 3px solid ${({ theme }: any) => theme.colors.brand.primary};

  &:hover {
    box-shadow: ${tkn('shadows.lg')};
    transform: translateY(-0.0625rem);
  }
`;

export const StatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${tkn('spacing.sm')};
`;

export const StatLabel = styled(Text)``;

export const StatIconWrapper = styled.div<{ $color?: string }>`
  width: 3rem;
  height: 3rem;
  background: ${({ $color, theme }) => $color || theme.colors.surface.secondary};
  border-radius: ${tkn('radius.lg')};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const StatValue = styled.div`
  font-size: 1.75rem;
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
  line-height: 1.2;
  letter-spacing: -0.02em;
`;

export const StatSubText = styled(Text)`
  margin-top: ${tkn('spacing.xs')};
`;

export const ChartCard = styled(RepoCard)`
  display: flex;
  flex-direction: column;
`;

export const ChartHeader = styled.div`
  padding: ${tkn('spacing.lg')};
  padding-bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const ChartTitle = styled(Text)``;

export const ChartLegend = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const LegendDot = styled.div<{ $color: string }>`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${({ $color }) => $color};
`;

export const LegendLabel = styled(Text)``;

export const ChartContainer = styled.div`
  width: 100%;
  height: 18rem;
  padding: ${tkn('spacing.md')};

  @media (max-width: 48rem) {
    height: 14rem;
  }
`;

export const RecentOrdersCard = styled(RepoCard)``;

export const RecentOrdersHeader = styled.div`
  padding: ${tkn('spacing.lg')};
  padding-bottom: ${tkn('spacing.md')};
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

export const RecentOrdersTitle = styled(Text)``;

export const OrderList = styled.div`
  padding: 0;
  display: flex;
  flex-direction: column;
`;

export const OrderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border-bottom: 1px solid ${tkn('colors.border.secondary')};
  cursor: pointer;
  transition: background ${tkn('transitions.fast')};
  border-radius: ${tkn('radius.sm')};

  &:hover {
    background: ${tkn('colors.surface.secondary')};
  }

  &:last-child {
    border-bottom: none;
  }

  @media (max-width: 48rem) {
    flex-direction: column;
    align-items: flex-start;
    gap: ${tkn('spacing.sm')};
  }
`;

export const OrderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex: 1;
  min-width: 0;
`;

export const OrderImage = styled.div<{ $imageUrl?: string }>`
  width: 2.5rem;
  height: 2.5rem;
  border-radius: ${tkn('radius.sm')};
  background: ${({ $imageUrl, theme }) =>
    $imageUrl ? `url(${$imageUrl}) center/cover` : theme.colors.surface.secondary};
  flex-shrink: 0;
`;

export const OrderInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const OrderTitle = styled(Text)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 20rem;

  @media (max-width: 48rem) {
    max-width: 100%;
  }
`;

export const OrderMeta = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const OrderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.lg')};
  flex-shrink: 0;

  @media (max-width: 48rem) {
    width: 100%;
    justify-content: space-between;
  }
`;

export const UntrackedBadge = styled.div`
  background: ${tkn('colors.semanticTint.warning')};
  color: ${tkn('colors.semantic.warning')};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  white-space: nowrap;
`;

export const EmptyState = styled.div`
  text-align: center;
  padding: ${tkn('spacing.xxl')};
  background: ${tkn('colors.background.secondary')};
  border-radius: ${tkn('radius.md')};
`;

export const EmptyStateText = styled(Text)`
  margin: 0 0 ${tkn('spacing.lg')} 0;
`;

export const EmptyStateCard = styled(RepoCard)`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${tkn('spacing.xxl')} ${tkn('spacing.lg')};
  text-align: center;
`;

export const EmptyStateIconWrapper = styled.div`
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 50%;
  background: ${tkn('colors.semanticTint.info')};
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: ${tkn('spacing.lg')};
`;

export const EmptyStateDesc = styled(Text)`
  margin: ${tkn('spacing.sm')} 0 ${tkn('spacing.lg')} 0;
  max-width: 26rem;
`;

export const ButtonContainer = styled.div`
  max-width: 20rem;
  width: 100%;
`;

export const ConnectButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.sm')};
  width: 100%;
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  background: ${tkn('colors.brand.primary')};
  color: ${tkn('colors.surface.primary')};
  border: none;
  border-radius: ${tkn('radius.md')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  cursor: pointer;
  transition: opacity ${tkn('transitions.fast')};

  &:hover {
    opacity: 0.9;
  }
`;

export const ViewAllButton = styled.button`
  background: none;
  border: none;
  color: ${tkn('colors.brand.primary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  cursor: pointer;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  border-radius: ${tkn('radius.sm')};
  transition: background ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.semanticTint.info')};
  }
`;
