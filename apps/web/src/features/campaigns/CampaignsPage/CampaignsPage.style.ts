import styled from '@emotion/styled';
import { Card, PageContainer, Text as UIText, tkn } from '@repo/ui';

export const Container = PageContainer;

/** The status tabs sit on the canvas, like the returns and orders lists. */
export const TabsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const FilterBarRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;

  @media (max-width: ${tkn('breakpoints.md')}) {
    flex-direction: column;
    align-items: stretch;
    gap: ${tkn('spacing.sm')};
  }
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 20rem;
  flex-shrink: 0;

  @media (max-width: ${tkn('breakpoints.md')}) {
    width: 100%;
  }
`;

export const FilterActions = styled.div`
  display: flex;
  align-items: center;
  margin-left: auto;

  @media (max-width: ${tkn('breakpoints.md')}) {
    margin-left: 0;
  }
`;

/** A table cell that stacks the campaign's name over its qualifying badges. */
export const NameCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  overflow-wrap: anywhere;
`;

export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/*
 * The campaign card has the listing-jobs card's anatomy (a campaign has no
 * photo): the title row with its badges on the right, label / value facts with
 * the one large figure (ROAS) on the right, then the figures row under one
 * hairline ending in "Details ›". The whole card is the button.
 */
export const CampaignCard = styled(Card)`
  display: flex;
  flex-direction: column;
  padding: 0;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  overflow: hidden;
  cursor: pointer;
  transition:
    box-shadow ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.glassHover')};
    transform: translateY(-0.125rem);
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }

  @media (prefers-reduced-motion: reduce) {
    &:hover {
      transform: none;
    }
  }
`;

export const CardTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;
`;

/** Badges in their own row at the card's top-left (the card standard), the title under them. */
export const CardHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${tkn('spacing.sm-md')};
  min-width: 0;
`;

/** A flex host so the tooltip wrapper lets the one-line title shrink (the order card's TitleSlot). */
export const TitleSlot = styled.div`
  display: flex;
  min-width: 0;

  & > * {
    min-width: 0;
    max-width: 100%;
  }
`;

/** One line, ellipsis — the full name is on the tooltip (the listing card's Title). */
export const CardTitle = styled(UIText)`
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

export const CardBadges = styled(BadgeRow)`
  justify-content: flex-start;
`;

export const CardBody = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(7rem, auto);
  align-items: center;
  gap: ${tkn('spacing.lg')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
    align-items: stretch;
  }
`;

export const MetaList = styled.dl`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: ${tkn('spacing.md')};
  row-gap: ${tkn('spacing.xs')};
  align-items: baseline;
  margin: 0;
  min-width: 0;
`;

export const MetaLabel = styled.dt`
  margin: 0;
  white-space: nowrap;
`;

export const MetaValue = styled.dd`
  margin: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** ROAS: the card's one large figure, on the right edge. */
export const Signal = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    align-items: flex-start;
  }
`;

export const StatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    align-items: start;
  }
`;

export const StatCell = styled.div`
  flex: 1 1 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const StatLabel = styled(UIText)`
  line-height: ${tkn('typography.lineHeight.tight')};
`;

/** Tells the seller the whole card opens the campaign. */
export const DetailHint = styled.span`
  display: inline-flex;
  align-items: center;
  flex: 0 0 auto;
  margin-left: auto;
  gap: ${tkn('spacing.2xs')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-column: 1 / -1;
    margin-left: 0;
  }
`;
