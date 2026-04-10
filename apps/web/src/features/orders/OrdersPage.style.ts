import styled from '@emotion/styled';
import { Card as RepoCard, IconButton as RepoIconButton, Text, tkn } from '@repo/ui';

export const IconButton = styled(RepoIconButton)`
  & svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

export const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem; /* 8px */
`;

export const GridContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 48rem) {
    /* 768px */
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 64rem) {
    /* 1024px */
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 80rem) {
    /* 1280px */
    grid-template-columns: repeat(4, 1fr);
  }
`;

export const GridCard = styled(RepoCard)`
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  position: relative;
  transition: all ${tkn('transitions.normal')};
  cursor: pointer;

  &:hover {
    transform: translateY(-0.25rem);
    box-shadow: ${tkn('shadows.md')};
  }
`;

export const GridCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

export const GridCardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const GridCardFooter = styled.div`
  margin-top: auto;
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.lg')};
`;

export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15.625rem, 1fr)); /* 250px */
  gap: ${tkn('spacing.lg')};
`;

export const StatCard = styled(RepoCard)`
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
`;

export const StatHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${tkn('spacing.sm')};
`;

export const StatLabel = styled(Text)``;

export const StatIconWrapper = styled.div<{ $color?: string }>`
  padding: ${tkn('spacing.sm')};
  background: ${({ $color, theme }) => $color || theme.colors.surface.secondary};
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const StatValue = styled.div`
  font-size: ${tkn('typography.fontSize.xxl')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.text.primary')};
`;

export const StatChange = styled.div<{ $positive?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${({ $positive, theme }) => ($positive ? theme.colors.semantic.success : theme.colors.semantic.error)};
  margin-top: ${tkn('spacing.xs')};
`;

export const FiltersRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

export const SearchWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex: 1;
  min-width: 18.75rem; /* 300px */
`;

export const ActionsWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const TableContainer = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')}; /* 1px */
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
  box-shadow: ${tkn('shadows.sm')};
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
    background: ${tkn('colors.border.secondary')};
    border-radius: 0.625rem; /* 10px */
  }
`;

export const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
`;

export const TableHead = styled.thead`
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
`;

export const TableHeaderCell = styled.th`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  text-align: left;
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.secondary')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const TableBody = styled.tbody``;

export const TableRow = styled.tr`
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
  cursor: pointer;
  transition: background-color ${tkn('transitions.fast')};

  &:hover {
    background: ${tkn('colors.background.tertiary')};
  }
`;

export const TableCell = styled.td`
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.primary')};
`;

export const OrderNumber = styled(Text)``;

export const BuyerInfo = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const BuyerAvatar = styled.div<{ $color?: string }>`
  width: 2rem; /* 32px */
  height: 2rem; /* 32px */
  border-radius: 50%;
  background: ${({ $color, theme }) => $color || theme.colors.surface.secondary};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.semantic.info')};
`;

export const BuyerName = styled(Text)``;

export const PriceText = styled(Text)<{ $profit?: boolean; $loss?: boolean }>`
  font-weight: ${({ $profit, $loss, theme }) =>
    $profit || $loss ? theme.typography.fontWeight.bold : theme.typography.fontWeight.semibold};
  color: ${({ $profit, $loss, theme }) =>
    $profit ? theme.colors.semantic.success : $loss ? theme.colors.semantic.error : theme.colors.text.primary};
`;

export const SecondaryText = styled(Text)``;

/* --- Styled components extracted from inline styles in OrdersPage.component.tsx --- */

export const StatSubText = styled(SecondaryText)`
  margin-top: ${tkn('spacing.xs')};
`;

export const FiltersBar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${tkn('spacing.lg')};
  flex-wrap: wrap;
  gap: ${tkn('spacing.md')};
`;

export const FiltersLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
`;

export const SearchBoxWrapper = styled.div`
  width: 18.75rem; /* 300px */
`;

export const BuyerDetails = styled.div`
  display: flex;
  flex-direction: column;
`;

export const BuyerEmailText = styled(SecondaryText)``;

export const CardPriceRow = styled.div`
  margin-top: ${tkn('spacing.sm')};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const PaginationWrapper = styled.div`
  margin-top: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  display: flex;
  align-items: center;
  justify-content: flex-end;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.lg')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

export const AlignedTableCell = styled(TableCell)<{ $align?: string }>`
  text-align: ${({ $align }) => $align || 'left'};
`;

export const AlignedHeaderCell = styled(TableHeaderCell)<{ $align?: string }>`
  text-align: ${({ $align }) => $align || 'left'};
`;
