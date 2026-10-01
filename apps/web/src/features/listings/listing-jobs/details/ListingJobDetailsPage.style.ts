import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

export const SummaryCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  box-sizing: border-box;
`;

/* Job id top-left, status badge alone top-right — opposite corners of the
   row, same convention the list card's JobCardHeader uses. Not clickable,
   so no hover/cursor treatment here (unlike the list card). The cancel
   action lives in its own footer row below (see SummaryFooter) — pairing a
   destructive-ish action with a status badge at the same height read as
   mismatched, and it crowded the corner. */
export const SummaryTop = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

/** Cancel action, bottom-right of the card — the standard trailing-action
    footer shape (border-top divider + right-aligned), matching Card's own
    CardFooter treatment. */
export const SummaryFooter = styled.div`
  margin-top: ${tkn('spacing.xs')};
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  justify-content: flex-end;
`;

/** Ring + count/percent on the left, the created date pushed to the far
    right — identical shape to the list card's ProgressRow, using the same
    shared JobProgressRing instead of a linear bar. */
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

/** Total / succeeded / failed — label over value, separated from the rows above by one hairline. */
export const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(5.5rem, 1fr));
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  margin-top: ${tkn('spacing.xs')};
`;

export const StatCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const StatLabel = styled(UIText)`
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

/* Icon+label / value rows — the same shape ListingDetailPage's Meta rows use
   (SettingsCard's own row convention), so ASIN / eBay ID / Sebep / Referans
   all read as ordinary rows instead of a boxed error + glued-together
   "Referans: x" line. */
export const MetaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

export const MetaRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.sm-md')} 0;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  &:last-child {
    border-bottom: none;
  }
`;

export const MetaValue = styled.div`
  min-width: 0;
  max-width: 60%;
  text-align: right;
  overflow-wrap: anywhere;
`;

/** Row icon + label, left side of a Meta row — matches SettingsInfoRow's icon/label pairing. */
export const MetaLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const ItemsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

/* Search-by-ASIN/error-message bar for the item list — same visual shape as
   the job list page's FilterBar. */
export const FilterBar = styled.div`
  /* The controls sit on the page canvas — no card of their own, so the first
     row of data is the first surface on the page (see the orders list). */
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 18rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    width: 100%;
  }
`;

/* Wider than the job list's status select: the options carry a count and the
   longest label ("Kara liste dışı hatalar (3)") must not truncate. */
export const SelectWrapper = styled.div`
  min-width: 0;
  width: 17rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.lg')}) {
    width: 100%;
  }
`;

export const FilterResultCount = styled(UIText)`
  margin-left: auto;
  flex-shrink: 0;
`;

/* Single child (the status badge) — flex-end pins it top-right, same as the
   list card's JobCardHeader. Card itself is SettingsCard now (standard
   molecule), so this is just the top row inside its body. */
export const ItemCardHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.sm-md')};
`;

export const EmptyWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 10rem;
`;

export const MonoId = styled(UIText)`
  font-family: ${tkn('typography.fontFamily.mono')};
`;

// `TechnicalDetails` was removed with the raw-error disclosure: the provider's
// own wording is operator diagnostics and now lives only in the admin
// listing-failures panel.

/** Localized reason stacked over the support reference — table view's reason
    column only (the grid card uses row-based Meta instead, see MetaRow). */
export const FailureCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;
