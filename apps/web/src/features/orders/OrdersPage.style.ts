import styled from '@emotion/styled';
import { Card as RepoCard, Text, tkn } from '@repo/ui';

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

export const ActionsWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const SearchBoxWrapper = styled.div`
  width: 18.75rem; /* 300px */
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

export const StatSubText = styled(SecondaryText)`
  margin-top: ${tkn('spacing.xs')};
`;

export const BuyerDetails = styled.div`
  display: flex;
  flex-direction: column;
`;

export const BuyerEmailText = styled(SecondaryText)``;

// --- Grid Card Styles ---

export const GridCard = styled(RepoCard)`
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  position: relative;
`;

export const CardImageSection = styled.div`
  width: 100%;
  aspect-ratio: 16/9;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  background: ${tkn('colors.background.tertiary')};

  svg,
  .material-symbols-outlined {
    font-size: 2.5rem;
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  flex: 1;
`;

export const CardTitleRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${tkn('spacing.sm')};
`;

export const CardInfoRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.xs')};
`;

export const CardPriceRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: ${tkn('spacing.sm')};
`;

export const CardFooter = styled.div`
  margin-top: auto;
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
