import styled from '@emotion/styled';
import { Card, PageContainerWithMobileBar, tkn } from '@repo/ui';

export const Container = PageContainerWithMobileBar;

/** Call-to-action strip for draft → publish */
export const DraftPublishBar = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  align-items: stretch;

  @media (min-width: ${tkn('breakpoints.sm')}) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

export const DraftPublishCopy = styled.div`
  min-width: 0;
  flex: 1;
`;

/**
 * Product hero: gallery + summary — stacks on phone, side-by-side tablet+.
 * Extends the Card atom; this was a hand-rolled copy of it (identical surface,
 * radius, shadow and padding), which is how it drifted onto the 6px radius.
 */
export const Hero = styled(Card)`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: minmax(11rem, 16rem) minmax(0, 1fr);
    align-items: start;
  }

  @media (min-width: ${tkn('breakpoints.lg')}) {
    grid-template-columns: minmax(12rem, 18rem) minmax(0, 1fr);
  }
`;

export const GalleryBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/** Transparent shell — match ListingCard / listings-all product image */
export const GalleryMain = styled.div`
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 20rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: ${tkn('radius.sm')};
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    color: ${tkn('colors.text.tertiary')};
  }

  @media (min-width: ${tkn('breakpoints.md')}) {
    max-height: none;
  }
`;

export const ThumbRow = styled.div`
  display: flex;
  gap: ${tkn('spacing.sm')};
  overflow-x: auto;
  padding-bottom: ${tkn('spacing.2xs')};
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
`;

export const ThumbButton = styled.button<{ $active: boolean }>`
  width: 3.25rem;
  height: 3.25rem;
  padding: 0;
  border-radius: ${tkn('radius.sm')};
  border: 0.125rem solid
    ${({ $active, theme }) => ($active ? theme.colors.brand.primary : 'transparent')};
  background: transparent;
  cursor: pointer;
  overflow: hidden;
  flex-shrink: 0;
  transition: border-color ${tkn('transitions.fast')};

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  &:hover {
    border-color: ${tkn('colors.brand.primary')};
  }
`;

export const HeroInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

export const TitleRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const IdRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
  align-items: center;
`;

/**
 * Single headline KPI in the hero. Replaces the old stock/sold/last-sale chip
 * row, whose three values were repeated verbatim by the Performance card.
 */
export const ProfitHighlight = styled.div<{ $positive: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: ${({ $positive, theme }) =>
    $positive ? theme.colors.semanticTint.success : theme.colors.semanticTint.error};
  border: 0.0625rem solid
    ${({ $positive, theme }) =>
      $positive ? theme.colors.semanticTintBorder.success : theme.colors.semanticTintBorder.error};
`;

export const QuickLinks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
`;

export const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const SectionCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
  min-width: 0;
`;

export const SectionCardFull = styled(SectionCard)`
  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-column: 1 / -1;
  }
`;

/** Wrapper for the shared EmptyState on the loading / not-found screens. */
export const StateCard = styled(Card)`
  width: 100%;
`;

export const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;
`;

export const CardHeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const MetaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

export const MetaRow = styled.div`
  display: grid;
  grid-template-columns: minmax(6rem, 40%) minmax(0, 1fr);
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  align-items: center;
  padding: ${tkn('spacing.sm')} 0;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-of-type {
    padding-top: 0;
  }

  @media (max-width: 22rem) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.2xs')};
  }
`;

export const AutomationBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding-bottom: ${tkn('spacing.md')};
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};

  &:last-of-type {
    border-bottom: none;
    padding-bottom: 0;
  }
`;

export const AutomationHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const AutomationFields = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};

  @media (min-width: ${tkn('breakpoints.sm')}) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const FeatureList = styled.ul`
  margin: 0;
  padding-left: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const FeatureItem = styled.li`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: ${tkn('typography.lineHeight.normal')};
  color: ${tkn('colors.text.secondary')};
`;

export const DescriptionBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

export const DescriptionText = styled.div<{ $expanded: boolean }>`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  line-height: ${tkn('typography.lineHeight.relaxed')};
  color: ${tkn('colors.text.secondary')};
  white-space: pre-wrap;
  word-break: break-word;

  ${({ $expanded }) =>
    !$expanded &&
    `
    display: -webkit-box;
    -webkit-line-clamp: 5;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `}
`;

export const FormStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

/** Single manage CTA on phones */
export const MobileActionBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: ${tkn('zIndex.sticky')};
  display: flex;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  padding-bottom: max(${tkn('spacing.sm')}, env(safe-area-inset-bottom));
  background: ${tkn('colors.surface.primary')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.lg')};
  box-sizing: border-box;

  @media (min-width: ${tkn('breakpoints.md')}) {
    display: none;
  }
`;
