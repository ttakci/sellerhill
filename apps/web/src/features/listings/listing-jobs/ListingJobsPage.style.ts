import styled from '@emotion/styled';
import { Button, Card as RepoCard, Badge as UIBadge, Text as UIText, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 90rem;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

export const JobIdBadge = styled(UIBadge)``;

export const ProgressContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 7.5rem;
`;

export const ProgressInfo = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: 0.625rem;
  font-weight: 700;
  color: ${tkn('colors.text.secondary')};
`;

export const ProgressBar = styled.div`
  width: 100%;
  height: 0.375rem;
  background: ${tkn('colors.background.tertiary')};
  border-radius: 9999px;
  overflow: hidden;
`;

export const ProgressFill = styled.div<{ $percent: number }>`
  width: ${({ $percent }) => $percent}%;
  height: 100%;
  background: ${tkn('colors.brand.primary')};
  border-radius: 9999px;
  transition: width 0.3s ease;
`;

export const StatsContainer = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

export const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
`;

export const StatLabel = styled(UIText)``;

export const SuccessText = styled(UIText)``;

export const FailedText = styled(UIText)``;

export const TotalText = styled(UIText)``;

export const DateText = styled(UIText)``;

export const ActionButton = styled(Button)``;

// --- Grid Card Styles ---

export const GridCard = styled(RepoCard)`
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  position: relative;
`;

export const GridCardHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`;

export const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  flex: 1;
`;

export const CardFooter = styled.div`
  margin-top: auto;
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

// --- Progress Section Styles ---

export const ProgressSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const ProgressHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const ProgressLabel = styled(UIText)``;

export const ProgressValue = styled(UIText)``;
