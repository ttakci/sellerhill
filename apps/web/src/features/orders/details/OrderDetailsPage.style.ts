import styled from '@emotion/styled';
import { Card, PageContainer, Text, tkn } from '@repo/ui';

export const Container = PageContainer;

/**
 * The hero — the listing detail's format: a blue wash over the glass, the stage
 * badge at the top-left, the photo on the left, the record facts and the
 * customer beside it, the order's action buttons stacked on the right, the
 * money strip under them and the seller's one-line note across the foot. The
 * product title has its own row under the badge, so the photo's top edge, the
 * first fact, the customer heading and the first button share one line.
 * Named areas so the order can change per width:
 *   phone   badge · title · image · info · kpi · customer · actions · note
 *   md      title, image | info, image | kpi, then customer | actions, note
 *   xl      title, image | info | customer | actions, image | kpi kpi kpi, note
 */
export const Hero = styled(Card)`
  position: relative;
  background-image: linear-gradient(135deg, ${tkn('colors.semanticTint.infoStrong')} 0%, transparent 65%);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'badge'
    'title'
    'image'
    'info'
    'kpi'
    'customer'
    'actions'
    'note';
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
    grid-template-areas:
      'badge badge'
      'title title'
      'image info'
      'image kpi'
      'customer actions'
      'note note';
    gap: ${tkn('spacing.md')} ${tkn('spacing.xl')};
    padding: ${tkn('spacing.xl')};
  }

  @media (min-width: ${tkn('breakpoints.xl')}) {
    /* The facts and the buttons share what the photo and the customer leave, 3:2,
       so the buttons column widens on a large screen instead of the facts
       taking it all; the buttons never go below 14rem. */
    grid-template-columns: 15rem minmax(0, 3fr) 12.5rem minmax(14rem, 2fr);
    column-gap: ${tkn('spacing.lg')};
    grid-template-areas:
      'badge badge badge badge'
      'title title title title'
      'image info customer actions'
      'image kpi kpi kpi'
      'note note note note';
  }
`;

/** Stage (and the estimate chip) — its own row at the hero's top-left. */
export const StatusBadgeSlot = styled.div`
  grid-area: badge;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

/** eBay's ship-by date at the badge row's right end: a small label over the
 *  date in bold. Wraps under the badges on a phone, still right-aligned. */
export const ShipByBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${tkn('spacing.2xs')};
  margin-left: auto;
  text-align: right;
  min-width: 0;
`;

/** The product photo — transparent, like the listing detail's gallery. From `md`
 *  it spans the facts and the money strip, so it ends on the strip's line. */
export const ProductImage = styled.div`
  grid-area: image;
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 20rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: ${tkn('radius.sm')};
  overflow: hidden;

  > img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center top;
  }

  > svg {
    color: ${tkn('colors.text.tertiary')};
  }

  @media (min-width: ${tkn('breakpoints.md')}) {
    aspect-ratio: auto;
    max-height: none;
    height: 100%;
    min-height: 14rem;
  }
`;

/* A size container: the facts stack (label over value) when this column is
   narrow — the four-column hero leaves it little room on a 1280–1400px screen. */
export const HeroInfo = styled.div`
  grid-area: info;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  container-type: inline-size;
`;

/** The product title heads the hero, not the page. Clamped — Amazon titles run long. */
export const ProductTitle = styled(Text)`
  grid-area: title;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-width: 0;
  line-height: ${tkn('typography.lineHeight.tight')};

  @media (min-width: ${tkn('breakpoints.lg')}) {
    font-size: ${tkn('typography.fontSize.xxl')};
  }
`;

/** The customer, inside the hero: a hairline above it below `xl`, beside it (left
 *  hairline) from `xl`, where it sits right of the facts. */
export const CustomerPanel = styled.div`
  grid-area: customer;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};

  @media (min-width: ${tkn('breakpoints.xl')}) {
    padding-top: 0;
    padding-left: ${tkn('spacing.lg')};
    border-top: none;
    border-left: 0.0625rem solid ${tkn('colors.border.primary')};
  }
`;

/** The order's action buttons, stacked full-width in the card's right column —
 *  beside the customer (left hairline) from `xl`, under a hairline below it. */
export const HeroActions = styled.div`
  grid-area: actions;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};

  /* A label never runs into the button's edge: the Button atom is one clipped
     line, so a long label (or a longer translation) wraps inside its own padding. */
  && button {
    height: auto;
    min-height: ${tkn('controls.height.small')};
    padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
    white-space: normal;
    text-align: center;
  }

  @media (min-width: ${tkn('breakpoints.xl')}) {
    padding-top: 0;
    padding-left: ${tkn('spacing.md')};
    border-top: none;
    border-left: 0.0625rem solid ${tkn('colors.border.primary')};
  }
`;

/** Record facts as labelled rows on a fixed label track, like the listing detail's id list. */
export const IdList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const IdItem = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 8rem) minmax(0, 1fr);
  gap: ${tkn('spacing.sm')};
  align-items: center;
  min-width: 0;

  /* From xl the facts share the row with the customer and the buttons. */
  @media (min-width: ${tkn('breakpoints.xl')}) {
    grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr);
  }

  /* Too narrow for label | value side by side: label over value. */
  @container (max-width: 18rem) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.2xs')};
  }

  /* A phone still has room for label | value side by side (stacking doubled
     the hero's height): only the label track narrows. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: minmax(0, 6.5rem) minmax(0, 1fr);
  }
`;

export const IdValue = styled.div`
  min-width: 0;
  overflow-wrap: anywhere;
`;

/** The money story as ONE strip on a blue tint with a brand-blue leading bar —
 *  the listing detail's KPI strip. Profit keeps its own green / red. */
export const KpiArea = styled.div`
  grid-area: kpi;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const KpiStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 6rem), 1fr));
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

export const KpiLabel = styled(Text)`
  line-height: ${tkn('typography.lineHeight.tight')};
  white-space: nowrap;
`;

export const EstimateNote = styled(Text)`
  line-height: ${tkn('typography.lineHeight.normal')};
`;

/** The seller's one-line note, across the hero's foot under a hairline. */
export const HeroNote = styled.div`
  grid-area: note;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  min-width: 0;
`;

/** Timeline card body: the deadline / multi-item notices, then the steps. */
export const TimelineBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

/**
 * Each card is as tall as its content (`align-items: start`): the grid used
 * to stretch all three to the tallest, and the customer card — four address
 * lines — carried a void under them. The row rhythm still lines the first
 * rows up across the cards; only the bottoms differ.
 */
/**
 * The eBay card (two columns of its own) beside the Amazon card from `lg`.
 * The cards keep SettingsCard's `height: 100%`, so both stretch to the row's
 * height and end on one line; stacked below `lg`.
 */
export const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  gap: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.lg')}) {
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  }
`;

/** The eBay card's body: what the buyer paid | what you earned — two panes
 *  with a gap between them, side by side from `md`, stacked on a phone. */
export const EbayColumns = styled.div`
  /* Fills the card body (a flex column the section grid stretches), so the
     panes of both summary cards end on one line. */
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  gap: ${tkn('spacing.md')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

/** One summary pane — a tinted, bordered box inside the card: the eBay card's
 *  two halves (operator request, 2026-10-09: they read as two separate parts)
 *  and the Amazon card's one (2026-10-10: the three sit side by side alike). */
export const SummaryPane = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0 ${tkn('spacing.md')} ${tkn('spacing.sm')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.glass.tint')};

  /* On a phone the pane's inset would push long values (order number,
     tracking chips) onto a second line inside the fixed-height rows. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    padding: 0 ${tkn('spacing.sm')} ${tkn('spacing.xs')};
  }
`;

/** Wrapper for the shared EmptyState on the loading / not-found screens. */
export const StateCard = styled(Card)`
  width: 100%;
`;

/**
 * ONE row unit for the three section cards (customer / eBay / Amazon).
 * Every row and group label is a whole multiple of it and the cards' bodies
 * all start at the same y, so a row (and its divider) in one card lines up
 * with the same-numbered row in its neighbours when the cards sit side by
 * side. Rows are `height`, not `padding`, for that reason — padding-driven
 * rows drift with font metrics.
 */
const ROW = tkn('controls.height.small');

export const SectionContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

/** The Amazon card's body: its one pane fills the card, which the section grid
 *  stretches to the eBay card's height, so the panes end on one line. */
export const AmazonPaneContent = styled(SectionContent)`
  flex: 1 1 auto;

  & > :first-child {
    flex: 1 1 auto;
  }
`;

/** Space above a card's action buttons, kept out of the row rhythm. */
export const SectionActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.md')};
`;

export const MetaList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0;

  /* Every row keeps its divider — including the last row of a list that a
     group label follows — so dividers line up across the three cards. Only
     the card's very last row drops it (nothing sits under it). */
  &:last-child > *:last-child {
    border-bottom: none;
  }
`;

export const MetaRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
  height: ${ROW};
  box-sizing: border-box;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
`;

/** A group label ("What your buyer paid", "Selling costs") — one full row
 *  unit tall so the rows after it stay on the shared grid. */
export const GroupLabel = styled.div`
  display: flex;
  align-items: flex-end;
  height: ${ROW};
  padding-bottom: ${tkn('spacing.xs+')};
  box-sizing: border-box;
`;

export const MetaLabel = styled.div`
  min-width: 0;
`;

export const MetaValue = styled.div`
  min-width: 0;
  max-width: 60%;
  text-align: right;
  overflow-wrap: anywhere;

  /* On a phone the label wraps before an order or tracking number does. */
  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    max-width: 72%;
  }
`;

export const AddressBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

/** The Amazon order number with its open-on-Amazon icon beside it. */
export const OrderIdValue = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  white-space: nowrap;
`;

/** Phone line under the ship-to address. */
export const AddressPhoneRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  margin-top: ${tkn('spacing.2xs')};
`;

/** AmazonDetailsModal layout helpers */
export const ModalFooter = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: ${tkn('spacing.sm')};
  width: 100%;
`;

export const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const FormRow = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};

  @media (min-width: ${tkn('breakpoints.sm')}) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const ErrorText = styled(Text)`
  display: block;
`;

/**
 * A tracking number as a solid coloured chip with white ink, so it stands out from
 * the cost rows: blue for Amazon's own number (the supplier's, never shown to
 * the buyer), green for the converted number eBay and the buyer see.
 */
export const TrackingChip = styled.span<{ $tone: 'amazon' | 'converted' }>`
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.md')};
  border-radius: ${tkn('radius.sm')};

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  }

  background: ${({ $tone }) => ($tone === 'amazon' ? tkn('colors.brand.primary') : tkn('colors.semantic.success'))};
  white-space: nowrap;

  /* The copy trigger's light hover wash would hide the white ink on a dark chip. */
  && [role='button']:hover,
  && [role='button']:focus-visible {
    background: transparent;
  }
`;
