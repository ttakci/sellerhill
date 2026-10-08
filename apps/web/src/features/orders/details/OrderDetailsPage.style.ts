import styled from '@emotion/styled';
import { Card, PageContainerWithMobileBar, Text, tkn } from '@repo/ui';

export const Container = PageContainerWithMobileBar;

/**
 * The hero — the listing detail's format: a blue wash over the glass, the stage
 * badge at the top-left, the photo on the left, the record facts and the
 * customer beside it, the money strip under them and the seller's one-line
 * note across the foot. Named areas so the order can change per width:
 *   phone   badge · image · info · kpi · customer · note
 *   md      image | info, image | kpi, then customer and note full width
 *   xl      image | info | customer, image | kpi kpi, note
 */
export const Hero = styled(Card)`
  position: relative;
  background-image: linear-gradient(135deg, ${tkn('colors.semanticTint.infoStrong')} 0%, transparent 65%);
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'badge'
    'image'
    'info'
    'kpi'
    'customer'
    'note';
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: minmax(14rem, 18rem) minmax(0, 1fr);
    grid-template-areas:
      'badge badge'
      'image info'
      'image kpi'
      'customer customer'
      'note note';
    gap: ${tkn('spacing.md')} ${tkn('spacing.xl')};
    padding: ${tkn('spacing.xl')};
  }

  @media (min-width: ${tkn('breakpoints.xl')}) {
    grid-template-columns: minmax(12rem, 16rem) minmax(0, 1fr) minmax(16rem, 20rem);
    grid-template-areas:
      'badge badge badge'
      'image info customer'
      'image kpi kpi'
      'note note note';
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

export const HeroInfo = styled.div`
  grid-area: info;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

/** The product title heads the hero, not the page. Clamped — Amazon titles run long. */
export const ProductTitle = styled(Text)`
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
    padding-left: ${tkn('spacing.xl')};
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

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.2xs')};
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
export const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  align-items: start;
  gap: ${tkn('spacing.lg')};

  /* SettingsCard fills its slot (height: 100%), which under a grid resolves
     to the row's height and stretches it anyway; each card here is content-high. */
  & > * {
    height: auto;
  }

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
`;

export const AddressBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

/** Phone line under the ship-to address. */
export const AddressPhoneRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  margin-top: ${tkn('spacing.2xs')};
`;

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
