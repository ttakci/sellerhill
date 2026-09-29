import styled from '@emotion/styled';
import { Card, PageContainer, Text, tkn } from '@repo/ui';

export const Container = PageContainer;

/** Header actions — "List selected (N)" + Clear — wrap under the title on a phone. */
export const HeaderActions = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')};
`;

/* Same surface as the Listings / Orders / Products filter bars. */
export const Toolbar = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-shadow: ${tkn('shadows.sm')};
  box-sizing: border-box;
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.md')};
  }
`;

/** Category picker + back link on the left, select-all on the right; wraps on narrow widths. */
export const FilterRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  min-width: 0;
`;

export const CategorySelect = styled.div`
  width: 22rem;
  max-width: 100%;
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.md')}) {
    width: 100%;
  }
`;

export const FilterSpacer = styled.div`
  flex: 1 1 auto;
`;

/** Allowance meter + its one-line explanation, muted under the filters. */
export const MetaRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: ${tkn('spacing.2xs')} ${tkn('spacing.md')};
`;

/* --- Grid card ------------------------------------------------------------ */

/**
 * One ranked product. The card carries `aria-pressed` for its ticked state, and
 * the brand outline keys off that attribute — the design system has no Card
 * variant for "selected", and an attribute selector needs no theme access from
 * a prop function (the web app's Emotion `Theme` is not typed for `theme.colors`).
 * The whole card is the tap surface; the checkbox is the keyboard-reachable control.
 */
export const GridCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  position: relative;
  height: 100%;
  cursor: pointer;
  box-sizing: border-box;
  transition:
    box-shadow ${tkn('transitions.fast')},
    border-color ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-0.125rem);
  }

  &[aria-pressed='true'] {
    border-color: ${tkn('colors.brand.primary')};
    box-shadow: inset 0 0 0 0.0625rem ${tkn('colors.brand.primary')};
  }
`;

export const CardTopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  min-height: 1.5rem;
`;

/** Wraps the checkbox so its click never doubles up with the card's own toggle. */
export const CardControl = styled.div`
  display: inline-flex;
  align-items: center;
`;

/** Transparent image plate — no grey mat, matching every other product image in the app. */
export const CardImageFrame = styled.div`
  width: 100%;
  height: 10rem;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: transparent;
`;

export const CardImage = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

/** Two-line clamp; the full title stays on the `title` tooltip. */
export const CardTitle = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 2.75rem;
`;

export const CardMetaRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
`;

/** ASIN badge pinned to the card foot; stops propagation so the Amazon link does not toggle the card. */
export const CardFooter = styled.div`
  margin-top: auto;
  display: flex;
  align-items: center;
`;

/** Every non-grid state (disabled feature, first load, refusals) shares one surface. */
export const StateCard = styled(Card)`
  display: flex;
  align-items: center;
  justify-content: center;
`;
