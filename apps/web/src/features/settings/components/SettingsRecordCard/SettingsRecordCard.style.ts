import styled from '@emotion/styled';
import { Card, Text, tkn } from '@repo/ui';

import { CAROUSEL_CARD_MIN_HEIGHT } from '../cardMetrics';

/**
 * The settings records (eBay store, Amazon account, message template, listing
 * settings group) in the list cards' anatomy — the listing-jobs card: solid
 * badges top-left, a one-line title, label / value rows with no icons and
 * bold values, then one hairline strip on the glass tint holding the actions
 * and the "Detay ›" hint. One shell, so the four cannot drift apart again.
 *
 * `width: 100%` is load-bearing inside the carousel's row-flex slide (a flex
 * item without it shrinks to its content); the shared min-height keeps the
 * carousel from reflowing between slides of different richness.
 */
export const Wrapper = styled(Card, {
  shouldForwardProp: (prop) => prop !== '$selected' && prop !== '$clickable',
})<{ $selected: boolean; $clickable: boolean }>`
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 0;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: ${CAROUSEL_CARD_MIN_HEIGHT};
  overflow: hidden;
  border-color: ${({ $selected, theme }) => ($selected ? theme.colors.brand.primary : theme.colors.glass.edge)};
  cursor: ${({ $clickable }) => ($clickable ? 'pointer' : 'default')};
  transition:
    border-color ${tkn('transitions.fast')},
    box-shadow ${tkn('transitions.fast')},
    transform ${tkn('transitions.fast')};

  &:hover {
    box-shadow: ${tkn('shadows.glassHover')};
    transform: ${({ $clickable }) => ($clickable ? 'translateY(-0.125rem)' : 'none')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }
`;

export const Top = styled.div`
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm-md')};
  padding: ${tkn('spacing.md+')};
  min-width: 0;
  flex: 1;
`;

/** Status badge(s) on the left, an optional icon action pinned right. */
export const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
  min-height: 1.5rem;
`;

export const BadgeRowAction = styled.div`
  display: flex;
  align-items: center;
  margin-left: auto;
  flex-shrink: 0;
`;

export const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

/** One line, ellipsis. */
export const Title = styled(Text)`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

export const OneLine = styled(Text)`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
`;

/**
 * One or two fact lists. Narrow, both lists pour into this one label / value
 * grid (the lists are `display: contents`), so a second list's values line up
 * under the first's. Once the card is wide enough for two (a container query,
 * so the drawer, the hub carousel and a phone each decide by the card's own
 * width), a split card puts the second list beside the first.
 */
export const FactColumns = styled.div<{ $split: boolean }>`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: ${tkn('spacing.md')};
  row-gap: ${tkn('spacing.xs')};
  align-items: baseline;
  min-width: 0;

  & > dl {
    display: contents;
  }

  @container (min-width: 26rem) {
    ${({ $split, theme }) =>
      $split
        ? `
      grid-template-columns: repeat(2, minmax(0, 1fr));
      column-gap: ${theme.spacing.lg};
      align-items: start;

      & > dl {
        display: grid;
      }
    `
        : ''}
  }
`;

/** Label / value pairs, the same grid as ListingCard / the job card. */
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
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  overflow: hidden;

  & > * {
    min-width: 0;
  }
`;

/** Block host for the tooltip, so the preview keeps the card's full width. */
export const PreviewSlot = styled.div`
  display: flex;
  min-width: 0;

  & > * {
    width: 100%;
    min-width: 0;
  }
`;

/**
 * A template body on a light tint, six lines then an ellipsis — the full text
 * is on the tooltip.
 */
export const Preview = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
  white-space: pre-line;
  overflow-wrap: anywhere;
  box-sizing: border-box;
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.semanticTint.info')};
  border: 0.0625rem solid ${tkn('colors.semanticTintBorder.info')};
`;

/** Tooltip body — the whole template, line breaks kept, capped so it never covers the drawer. */
export const PreviewTooltip = styled.span`
  display: block;
  max-width: 22rem;
  max-height: 18rem;
  overflow: hidden;
  white-space: pre-line;
  overflow-wrap: anywhere;
`;

export const Notice = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.xs')};
  min-width: 0;

  & > svg {
    flex-shrink: 0;
    margin-top: ${tkn('spacing.2xs')};
  }
`;

/** Same strip as the job / listing card: actions left, the detail hint right. */
export const Footer = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm-md')} ${tkn('spacing.md+')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  background: ${tkn('colors.glass.tint')};
  flex-shrink: 0;
`;

export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const DetailHint = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
  white-space: nowrap;
  grid-column: 2;
`;
