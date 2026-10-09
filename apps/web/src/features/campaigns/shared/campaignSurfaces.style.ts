import styled from '@emotion/styled';
import { Card, Text as UIText, tkn } from '@repo/ui';

/**
 * Surfaces shared by the campaign list and the campaign detail page. Both pages
 * open with the hero every other summary screen uses (billing, listing and
 * order detail): one card with a blue wash, its actions in a right-hand column
 * behind a hairline, and the money as ONE blue strip with a brand bar on its
 * leading edge — never a row of free-standing stat boxes.
 */
export const Hero = styled(Card)`
  background-image: linear-gradient(135deg, ${tkn('colors.semanticTint.infoStrong')} 0%, transparent 65%);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'badge'
    'title'
    'facts'
    'actions'
    'kpi';
  align-content: start;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: minmax(0, 1fr) 18rem;
    grid-template-areas:
      'badge badge'
      'title actions'
      'facts actions'
      'kpi kpi';
    column-gap: ${tkn('spacing.xl')};
    padding: ${tkn('spacing.xl')};
  }
`;

/** Badges in their own row at the hero's top-left (the card standard). */
export const HeroBadges = styled.div`
  grid-area: badge;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;

  &:empty {
    display: none;
  }
`;

export const HeroTitle = styled.div`
  grid-area: title;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  overflow-wrap: anywhere;
`;

/** The record's name heads the hero; from `lg` it takes the page-title size. */
export const HeroHeading = styled(UIText)`
  line-height: ${tkn('typography.lineHeight.tight')};

  @media (min-width: ${tkn('breakpoints.lg')}) {
    font-size: ${tkn('typography.fontSize.xxl')};
  }
`;

/** Stacked full width on a phone; from `md` the hero's right column, behind a hairline. */
export const HeroActions = styled.div`
  grid-area: actions;
  align-self: start;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;

  & > * {
    width: 100%;
  }

  /* A label never runs into the button's edge: the Button atom is one clipped
     line, so a long label (or a longer translation) wraps inside its own padding
     — the order detail's HeroActions. */
  && button {
    height: auto;
    min-height: ${tkn('controls.height.small')};
    padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
    white-space: normal;
    text-align: center;
  }

  @media (min-width: ${tkn('breakpoints.md')}) {
    padding-left: ${tkn('spacing.xl')};
    border-left: 0.0625rem solid ${tkn('colors.border.primary')};
  }
`;

/** Label / value facts: a fixed label track so every value starts on the same x. */
export const FactList = styled.dl`
  grid-area: facts;
  display: grid;
  grid-template-columns: minmax(0, 10rem) minmax(0, 1fr);
  column-gap: ${tkn('spacing.md')};
  row-gap: ${tkn('spacing.xs')};
  align-items: baseline;
  margin: 0;
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: auto minmax(0, 1fr);
  }
`;

export const FactLabel = styled.dt`
  margin: 0;
  min-width: 0;
`;

export const FactValue = styled.dd`
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
`;

/** The period caption over the money strip. */
export const KpiSection = styled.div`
  grid-area: kpi;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  margin-top: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const KpiStrip = styled.div`
  display: grid;
  /* Two figures a line on a phone, all six in one line on a desk. */
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 6.5rem), 1fr));
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  padding-left: ${tkn('spacing.lg')};
  border: 0.0625rem solid ${tkn('colors.semanticTintBorder.info')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.semanticTint.infoStrong')};
  box-shadow:
    inset 0.25rem 0 0 ${tkn('colors.brand.primary')},
    ${tkn('shadows.sm')};
`;

export const KpiItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const KpiLabel = styled(UIText)`
  line-height: ${tkn('typography.lineHeight.tight')};
`;

/** Notices that close the hero (eligibility, read-only reason, last action's result). */
export const HeroNotices = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.xs')};
  min-width: 0;

  &:empty {
    display: none;
  }

  & > * {
    width: 100%;
  }
`;

/**
 * The campaign list's summary: the same hero surface, but only a heading row
 * (title on the left, the create action on the right behind a hairline) over
 * the money strip — a list has no record facts, so it does not borrow the
 * detail grid's empty rows.
 */
export const SummaryHero = styled(Card)`
  background-image: linear-gradient(135deg, ${tkn('colors.semanticTint.infoStrong')} 0%, transparent 65%);
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.xl')};
  }
`;

export const SummaryTop = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;

  @media (min-width: ${tkn('breakpoints.md')}) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: ${tkn('spacing.xl')};
  }
`;

export const SummaryActions = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  & > * {
    width: 100%;
  }

  @media (min-width: ${tkn('breakpoints.md')}) {
    flex: 0 0 16rem;
    align-self: stretch;
    justify-content: center;
    padding-left: ${tkn('spacing.xl')};
    border-left: 0.0625rem solid ${tkn('colors.border.primary')};
  }
`;

/** A section title under the hero (the campaign's listings). */
export const SectionHeading = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  margin-top: ${tkn('spacing.sm')};
  min-width: 0;
`;
