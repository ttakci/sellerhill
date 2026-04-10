import styled from '@emotion/styled';
import { AppTheme, Badge as UIBadge, Button, Card as RepoCard, IconButton as UIIconButton, Text as UIText, tkn } from '@repo/ui';

export const Container = styled.div`
  width: 100%;
  max-width: 90rem;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

export const Toolbar = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

export const IconButton = styled(UIIconButton)`
  display: flex;
  align-items: center;
  justify-content: center;

  & svg {
    width: 1.25rem;
    height: 1.25rem;
  }
`;

export const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  text-align: left;
`;

export const THead = styled.thead`
  background: ${tkn('colors.background.tertiary')};
`;

export const TH = styled.th`
  padding: 1rem 1.5rem;
  font-size: 0.6875rem;
  font-weight: 700;
  color: ${tkn('colors.text.tertiary')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};
`;

export const TBody = styled.tbody`
  & > tr {
    border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
    transition: background ${tkn('transitions.fast')};

    &:hover {
      background: ${tkn('colors.background.tertiary')}80;
    }

    &:last-child {
      border-bottom: none;
    }
  }
`;

export const TD = styled.td`
  padding: 1.25rem 1.5rem;
  font-size: 0.875rem;
  color: ${tkn('colors.text.primary')};
  vertical-align: middle;
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
  gap: 0.375rem;
  font-size: 0.75rem;
`;

export const SuccessText = styled(UIText)``;

export const FailedText = styled(UIText)``;

export const TotalText = styled(UIText)``;

export const DateText = styled(UIText)``;

export const ActionButton = styled(Button)``;

// --- Grid View Styles ---

export const ToolbarGroup = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

export const ViewToggleGroup = styled.div`
  display: flex;
  align-items: center;
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  padding: 0.25rem;
  border-radius: ${tkn('radius.md')};
  gap: 0.25rem;
`;

export const ToggleButton = styled(Button)<{ $active?: boolean }>`
  background: ${({ $active, theme }) =>
    $active ? (theme as AppTheme).colors.brand.secondary : 'transparent'};
  color: ${({ $active, theme }) =>
    $active ? (theme as AppTheme).colors.brand.primary : (theme as AppTheme).colors.text.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const ViewLabel = styled(UIText)`
  margin-left: ${tkn('spacing.sm')};

  strong {
    font-weight: 600;
  }
`;

export const GridContainer = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 48rem) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (min-width: 64rem) {
    grid-template-columns: repeat(3, 1fr);
  }
`;

export const GridCard = styled(RepoCard)`
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
  gap: ${tkn('spacing.sm')};
`;

export const CardFooter = styled.div`
  margin-top: auto;
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const GridPagination = styled.div`
  margin-top: 2rem;
`;
