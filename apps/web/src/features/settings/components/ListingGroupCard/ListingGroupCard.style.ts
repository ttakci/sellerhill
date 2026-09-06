import styled from '@emotion/styled';
import { Badge, Card, IconButton, Text, tkn } from '@repo/ui';

import { CAROUSEL_CARD_MIN_HEIGHT } from '../cardMetrics';

/**
 * Shared carousel height — every card is the same size regardless of whether
 * the group has a description, so the carousel never reflows between slides and
 * this card matches the other carousels' cards. `width: 100%` is load-bearing:
 * inside the carousel's row-flex slide, a flex item without an explicit width
 * shrinks to its content instead of filling the slide, so the card renders
 * narrower than the slide (and than the "add new" card below it) and the arrows,
 * pinned to the slide's edges, end up off the card.
 */
export const InteractiveCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected?: boolean }>`
  cursor: pointer;
  transition: all ${tkn('transitions.normal')};
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 100%;
  min-height: ${CAROUSEL_CARD_MIN_HEIGHT};
  /* White surface on drawer canvas (elevated = surface.primary + border + sm shadow) */
  background: ${tkn('colors.surface.primary')};

  &:hover {
    box-shadow: ${tkn('shadows.md')};
    transform: translateY(-0.125rem); /* -2px */
  }

  &:hover .card-title {
    color: ${tkn('colors.brand.primary')};
  }

  &:focus-visible {
    outline: 0.125rem solid ${tkn('colors.brand.primary')};
    outline-offset: 0.125rem;
  }

  ${({ $selected, theme }) =>
    $selected
      ? `border-color: ${tkn('colors.brand.primary')({ theme })}; box-shadow: ${tkn('shadows.md')({ theme })};`
      : ''}
`;

export const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.xl')};
  flex: 1;
`;

/** Group name on the left, template badge on the same line pinned right — the
 *  name flexes and truncates first (`CardName` is `flex: 1`), the badge keeps
 *  its own capped width. */
export const TitleRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  flex-shrink: 0;
`;

export const CardName = styled(Text)`
  flex: 1;
  min-width: 0;
  transition: color ${tkn('transitions.normal')};
`;

/**
 * The listing detail page's compact fact grid, reused here so a group reads the
 * same in Settings as it does on the listing it governs: icon + label left, the
 * value right-aligned. It replaced two stacked `OVERLINE` column headings whose
 * captions glued label and value into one run ("Stok: 1"), which had neither a
 * value column to scan nor room for the labels to be spelled out.
 *
 * Single column always — every row stacks, nothing pairs 2-up.
 */
export const MetaList = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  margin-top: ${tkn('spacing.2xs')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
`;

/** One fact per line, divider between each; the last row drops its border. */
export const MetaRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} 0;
  min-width: 0;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  &:last-of-type {
    border-bottom: none;
  }
`;

/** Row icon + label — matches `SettingsInfoRow`'s icon/label pairing. */
export const MetaLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const MetaValue = styled(Text)`
  flex-shrink: 0;
  text-align: right;
`;

/** Kâr Marjı row: summary value + its info-tooltip trigger on one line.
 *  Same `2xs` text↔icon gap and same ghost `IconButton` (hover included) as the
 *  listing detail card's `MarginValueRow`. */
export const MarginValueRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.2xs')};
`;

/** `styled(IconButton)` so the ghost hover / focus ring stay identical to the
 *  listing detail card. The negative right margin cancels the button's own
 *  right padding so the info glyph lands on the same column as the plain
 *  numeric values in the rows above. */
export const MarginInfoButton = styled(IconButton)`
  margin-right: calc(-1 * ${tkn('spacing.sm')});
`;

/** Tooltip body — one price range per line, each kept on a single unbroken
 *  line so the box widens to fit instead of the portal's `word-break` chopping
 *  every range into a vertical stack of fragments in the narrow drawer. */
export const MarginTooltipList = styled.span`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  white-space: nowrap;
`;

/** "Detay →" pinned bottom-right — `DetailAction`'s auto margin keeps it at the
 *  end. The template badge lives on the title row now, not here. */
export const BottomRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  margin-top: auto;
  padding-top: ${tkn('spacing.sm')};
  flex-shrink: 0;
`;

/** "Detay" label + arrow, flush to the card's content edge so it sits in the
 *  same vertical column as the row values / the Kâr Marjı info icon above.
 *  (The other carousel cards inset this arrow by `CARD_ACTION_ARROW_INSET` to
 *  line up with the "add new" card's arrow instead — this one aligns to its own
 *  data column.) */
export const DetailAction = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  margin-left: auto;
`;

export const ArrowSlot = styled.span`
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
`;

/** Shares the title line with the group name, pinned right — capped so a long
 *  template name ellipsizes rather than pushing the name out. */
export const TemplateBadge = styled(Badge)`
  max-width: 9rem; /* 144px — shares the title line, so cap tighter; name truncates first */
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
`;
