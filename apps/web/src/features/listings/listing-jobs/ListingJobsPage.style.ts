import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

export const FilterBarWrapper = styled.div`
  margin-bottom: 0;
`;

export const FilterBar = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: visible;
  box-sizing: border-box;

  @media (max-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.md')};
  }
`;

export const FilterBarRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    flex-direction: column;
    align-items: stretch;
    gap: ${tkn('spacing.sm')};
  }
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 16rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    width: 100%;
  }
`;

export const SelectWrapper = styled.div`
  width: 12rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    width: 100%;
  }
`;

export const FilterActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  margin-left: auto;
  min-height: ${tkn('controls.height.medium')};

  @media (max-width: ${tkn('breakpoints.lg')}) {
    margin-left: 0;
    width: 100%;
    justify-content: space-between;
  }
`;

export const ResultCount = styled(UIText)``;

/**
 * Dense job card — compact padding, inline stats, no large empty metric tiles.
 * Horizontal feel on tablet+ (meta left, progress fills).
 */
export const JobCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  cursor: pointer;
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    border-color: ${tkn('colors.brand.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

/* Short job id top-left, status badge top-right — opposite corners of the
   same row instead of a separate labeled meta row further down the card. */
export const JobCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const JobCardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/*
 * Replaces the old full-width bar: a horizontal line pinned the card into a
 * "header / line / stats / footer" stack with four equal-weight rows and no
 * focal point. The shared JobProgressRing puts the one number that matters
 * in the centre and frees the row beside it for the count, so the card reads
 * in one glance. Ring + counts on the left, the created date on the right.
 */
export const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const ProgressMain = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const ProgressCounts = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

/* Success / failed / remaining — label above value, matching ListingCard's
   StatsGrid so every card family reads a stat the same way. auto-fit (not a
   fixed repeat(3)) so 2 cells split the row evenly instead of leaving a dead
   third column when "remaining" is hidden (job fully processed). */
export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
  gap: 0;
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.sm')};
  /* Roomier interior so it reads as a real box, not a thin strip. */
  padding: ${tkn('spacing.sm-md')};
  /* Only above — it is the last element in JobCardBody now, so the space
     after it is owned by Footer below, kept tight there instead. */
  margin-top: ${tkn('spacing.xs')};
  flex-shrink: 0;
`;

export const StatCell = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.2xs')} ${tkn('spacing.xs')};
  min-width: 0;

  &:not(:last-child) {
    border-right: 0.0625rem solid ${tkn('colors.border.secondary')};
  }
`;

export const StatLabel = styled(UIText)`
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const StatValue = styled(UIText)<{ $tone?: 'default' | 'positive' | 'negative' }>`
  color: ${({ $tone, theme }) => {
    if ($tone === 'positive') {
      return theme.colors.semantic.success;
    }
    if ($tone === 'negative') {
      return theme.colors.semantic.error;
    }
    return theme.colors.text.primary;
  }};
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const Footer = styled.div`
  margin-top: auto;
  /* JobCard's own flex gap already separates this from the stats box above —
     no extra padding on top of it, so the gap after the box stays tight. */
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-shrink: 0;
`;

/** "Detay" label + arrow — the same trailing affordance ListingCard/OrderCard use. */
export const DetailAction = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

/** Compact progress cell for table */
export const TableProgress = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 7.5rem;
  max-width: 11rem;
`;

export const TableStats = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const MonoId = styled(UIText)`
  font-family: ${tkn('typography.fontFamily.mono')};
`;

