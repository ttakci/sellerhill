import styled from '@emotion/styled';
import { OrderStatus } from '@repo/shared';

export const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15.625rem, 1fr)); /* 250px */
  gap: ${({ theme }) => theme.spacing.lg};
`;

export const StatCard = styled.div`
  background: ${({ theme }) => theme.colors.surface.primary};
  border: 0.0625rem solid ${({ theme }) => theme.colors.border.primary}; /* 1px */
  border-radius: ${({ theme }) => theme.radius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;

export const StatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${({ theme }) => theme.spacing.sm};
`;

export const StatLabel = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

export const StatIconWrapper = styled.div<{ $color?: string }>`
  padding: ${({ theme }) => theme.spacing.sm};
  background: ${({ $color, theme }) => $color || theme.colors.surface.secondary};
  border-radius: ${({ theme }) => theme.radius.md};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const StatValue = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.xxl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

export const StatChange = styled.div<{ $positive?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ $positive, theme }) => ($positive ? theme.colors.semantic.success : theme.colors.semantic.error)};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

export const FiltersRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  flex-wrap: wrap;
`;

export const SearchWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  flex: 1;
  min-width: 18.75rem; /* 300px */
`;

export const ActionsWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const TableContainer = styled.div`
  background: ${({ theme }) => theme.colors.surface.primary};
  border: 0.0625rem solid ${({ theme }) => theme.colors.border.primary}; /* 1px */
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;

export const TableWrapper = styled.div`
  overflow-x: auto;

  &::-webkit-scrollbar {
    height: 0.375rem; /* 6px */
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border.secondary};
    border-radius: 0.625rem; /* 10px */
  }
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

export const TableHead = styled.thead`
  border-bottom: 0.0625rem solid ${({ theme }) => theme.colors.border.secondary}; /* 1px */
`;

export const TableHeaderCell = styled.th`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  text-align: left;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.secondary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const TableBody = styled.tbody``;

export const TableRow = styled.tr`
  border-bottom: 0.0625rem solid ${({ theme }) => theme.colors.border.secondary}; /* 1px */
  cursor: pointer;
  transition: background-color 0.2s;

  &:hover {
    background: ${({ theme }) => theme.colors.background.tertiary};
  }
`;

export const TableCell = styled.td`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.primary};
`;

export const OrderNumber = styled.span`
  font-family: 'Courier New', monospace;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.semantic.info};
`;

export const BuyerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export const BuyerAvatar = styled.div<{ $color?: string }>`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  border-radius: 50%;
  background: ${({ $color, theme }) => $color || theme.colors.surface.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.semantic.info};
`;

export const BuyerName = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
`;

const statusColors = {
  [OrderStatus.COMPLETED]: {
    bg: 'rgba(16, 185, 129, 0.1)',
    text: '#10b981',
  },
  [OrderStatus.SHIPPED]: {
    bg: 'rgba(245, 158, 11, 0.1)',
    text: '#f59e0b',
  },
  [OrderStatus.PROCESSING]: {
    bg: 'rgba(59, 130, 246, 0.1)',
    text: '#3b82f6',
  },
  [OrderStatus.CANCELLED]: {
    bg: 'rgba(239, 68, 68, 0.1)',
    text: '#ef4444',
  },
  [OrderStatus.PENDING]: {
    bg: 'rgba(107, 114, 128, 0.1)',
    text: '#6b7280',
  },
  [OrderStatus.WAITING_SHIPMENT]: {
    bg: 'rgba(249, 115, 22, 0.1)',
    text: '#f97316',
  },
};

export const StatusBadge = styled.span<{ $status: OrderStatus }>`
  display: inline-flex;
  align-items: center;
  padding: 0.25rem 0.625rem; /* 4px 10px */
  border-radius: ${({ theme }) => theme.radius.full};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  background: ${({ $status }) => statusColors[$status]?.bg || statusColors[OrderStatus.PENDING].bg};
  color: ${({ $status }) => statusColors[$status]?.text || statusColors[OrderStatus.PENDING].text};
`;

export const PriceText = styled.span<{ $profit?: boolean; $loss?: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ $profit, $loss, theme }) =>
    $profit || $loss ? theme.typography.fontWeight.bold : theme.typography.fontWeight.semibold};
  color: ${({ $profit, $loss, theme }) =>
    $profit ? theme.colors.semantic.success : $loss ? theme.colors.semantic.error : theme.colors.text.primary};
`;

export const SecondaryText = styled.span`
  color: ${({ theme }) => theme.colors.text.secondary};
`;
