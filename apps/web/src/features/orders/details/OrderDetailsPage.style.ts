import styled from '@emotion/styled';
import { Card, PageContainerWithMobileBar, Text, tkn } from '@repo/ui';

export const Container = PageContainerWithMobileBar;

/*
 * Hero and the section cards used to be hand-rolled copies of the Card atom
 * (same surface/radius/shadow/padding, retyped) — plus a third copy for the KPI
 * strip. They now extend the atom, so a change to the card language reaches
 * this page too.
 */
export const Hero = styled(Card)`
  position: relative;
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: minmax(9rem, 12rem) minmax(0, 1fr);
    align-items: start;
    gap: ${tkn('spacing.xl')};
  }
`;

/**
 * Status + fulfillment badges. Flows above the title on phones; pins to the
 * hero card's top-right corner from `md` up — the listing detail page's
 * StatusBadgeSlot pattern, widened to hold two or three badges.
 */
export const StatusBadgeSlot = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    position: absolute;
    top: ${tkn('spacing.lg')};
    right: ${tkn('spacing.lg')};
    z-index: 1;
    max-width: 45%;
    justify-content: flex-end;
  }
`;

/**
 * Wraps the fulfillment notices + product title. Given right padding from `md`
 * up so long lines clear the badge slot pinned to the card's top-right corner.
 */
export const HeroLede = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;

  @media (min-width: ${tkn('breakpoints.md')}) {
    padding-right: 45%;
  }
`;

/**
 * The product title heads the hero, not the page (see PageHeader). Clamped —
 * Amazon titles run long.
 */
export const ProductTitle = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-width: 0;
`;

export const ProductImage = styled.div`
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 14rem;
  /* Transparent, per the product-image rule — a grey plate behind a cut-out
     product shot reads as a broken image. */
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  @media (min-width: ${tkn('breakpoints.md')}) {
    max-height: none;
  }
`;

export const HeroInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;

  /* Small top padding nudges the first row clear of the badge slot pinned to
     the card's top-right corner from md up. */
  @media (min-width: ${tkn('breakpoints.md')}) {
    padding-top: ${tkn('spacing.md')};
  }
`;

/** Marketplace ids + record facts as labelled icon rows — the listing detail
 *  page's IdList pattern, so the two detail heroes read identically. */
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

/** Leading icon + label for an id / fact row. */
export const IdItemLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

/** A plain fact value (order #, buyer, date) sharing the IdList's right column. */
export const IdValue = styled(Text)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

export const EstimateNote = styled(Text)`
  line-height: ${tkn('typography.lineHeight.normal')};
`;

/**
 * The money story as ONE strip — Net Kâr, ROI, eBay earnings, total Amazon cost,
 * sale — sharing a single neutral surface separated by hairlines. Copied from
 * the listing detail hero's KpiStrip so the two pages are the same design.
 * Replaces the old standalone green "Net Kâr" box AND the separate "Net Kâr
 * Analizi" formula card, whose numbers all appear here now.
 */
export const KpiStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  row-gap: ${tkn('spacing.md')};
  margin-top: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.background.tertiary')};
`;

export const KpiItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  flex: 1 1 8rem;
  min-width: 8rem;
  padding: 0 ${tkn('spacing.sm')};
  border-left: 0.0625rem solid ${tkn('colors.border.secondary')};

  &:first-of-type {
    border-left: none;
  }
`;

/** Order KPI labels ("Toplam Amazon Maliyeti", "Sipariş Kazancı") run longer
 *  than the listing detail's, so they wrap rather than collide with a sibling. */
export const KpiLabel = styled(Text)`
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;

/** Net Kâr's label + its "Tahmini" badge, sharing the KpiItem's label line. */
export const KpiLabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: ${tkn('breakpoints.lg')}) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

/** Wrapper for the shared EmptyState on the loading / not-found screens. */
export const StateCard = styled(Card)`
  width: 100%;
`;

/** Vertical rhythm for a SettingsCard body with multiple top-level children
 *  (a sub-heading + its row list, a row list + its action button). */
export const SectionContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

/** Row list — matches the listing detail page's Meta rows exactly (same
 *  border, padding, icon+label pairing) so the two detail pages read as one
 *  design language. */
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
  padding: ${tkn('spacing.md')} 0;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  &:last-child {
    border-bottom: none;
  }
`;

/** Icon + label, left side of a Meta row. */
export const MetaLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const MetaValue = styled.div`
  min-width: 0;
  max-width: 60%;
  text-align: right;
  overflow-wrap: anywhere;
`;

/**
 * Same row chrome as MetaRow, but the value stacks BELOW the label instead
 * of beside it — for content that reads better left-aligned across several
 * lines (a shipping address, an email + phone pair) than squeezed right.
 */
export const MetaBlockRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.md')} 0;
  border-bottom: 0.0625rem solid ${tkn('colors.border.primary')};

  &:last-child {
    border-bottom: none;
  }
`;

export const MetaBlockValue = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const AddressBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
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

/* `FormLabel` and `InfoText` were unreachable dead styles and are gone.
   ErrorText now extends Text instead of hand-setting font-family/size. */
export const ErrorText = styled(Text)`
  display: block;
`;
