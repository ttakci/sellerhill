import styled from '@emotion/styled';
import { Card, PageContainerWithMobileBar, SettingsCard, Text, tkn } from '@repo/ui';

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
  position: relative;
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

/** Status badge pinned to the hero card's top-right corner. */
export const StatusBadgeSlot = styled.div`
  position: absolute;
  top: ${tkn('spacing.md')};
  right: ${tkn('spacing.md')};
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
  border: 0.125rem solid ${({ $active, theme }) => ($active ? theme.colors.brand.primary : 'transparent')};
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

/** Product title + its edit pencil, side by side. */
export const TitleHeadingRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${tkn('spacing.sm')};
`;

export const BadgeRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

/**
 * The product title, which heads the hero rather than the page (see PageHeader).
 * Clamped: Amazon titles run to 200 characters and an unclamped one pushed the
 * whole hero column down past the gallery.
 */
export const ProductTitle = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-width: 0;
`;

/**
 * Record facts as labelled rows, stacked — the listing card's meta pattern.
 * Holds the marketplace ids plus the internal id and timestamps that used to
 * be a separate "system" card at the foot of the page.
 *
 * The label column is a fixed track rather than `auto` so every row's value
 * starts on the same x — with `auto` the widest label ("Güncellenme") would
 * set the column and the ids would sit at a different indent than the page's
 * other label/value pairs.
 */
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

/** The internal listing UUID — long, unwrappable, and never read in full. */
export const IdValue = styled(Text)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
`;

/** "Updated" value + its "Detay" action, sharing the row. */
export const UpdatedValueRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  flex-wrap: wrap;
`;

/**
 * The money story as ONE strip — profit, ROI, sale price, cost, margin — sharing
 * a single surface and separated by hairlines.
 *
 * Deliberately not one box per number: five filled boxes in a row read as five
 * competing objects, which is exactly the checkerboard this replaced. One
 * surface with rules says "these belong together and are read across", and the
 * only colour left in it is the profit value itself, so the eye lands there
 * first instead of on five equal grey rectangles.
 */
export const KpiStrip = styled.div`
  display: flex;
  flex-wrap: wrap;
  row-gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.background.tertiary')};
`;

export const KpiItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  flex: 1 1 7rem;
  min-width: 7rem;
  padding: 0 ${tkn('spacing.sm')};
  border-left: 0.0625rem solid ${tkn('colors.border.secondary')};

  &:first-of-type {
    border-left: none;
  }
`;

export const KpiLabel = styled(Text)`
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
  line-height: ${tkn('typography.lineHeight.tight')};
  white-space: nowrap;
`;

export const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

/**
 * Stacks eBay Politikaları + Otomasyon inside ONE grid column so the shorter
 * policies card doesn't stretch to Performance's height — same fix as
 * SettingsHubPage.style.ts's ColumnStack, for the identical cause (grid row
 * stretch + SettingsCard's own `height: 100%`). `&&` is deliberate: both
 * this rule and SettingsCard's height:100% sit at single-class specificity,
 * so a plain `& > *` would win or lose on Emotion injection order.
 */
export const SectionColumnStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  min-width: 0;

  && > * {
    height: auto;
    flex: 0 0 auto;
  }
`;

/** Full-width variant of the shared SettingsCard — layout only, spans both grid columns from `md` up. */
export const FullWidthSettingsCard = styled(SettingsCard)`
  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-column: 1 / -1;
  }
`;

/** Vertical rhythm for a SettingsCard body with multiple top-level children. */
export const SectionContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
`;

/** Wrapper for the shared EmptyState on the loading / not-found screens. */
export const StateCard = styled(Card)`
  width: 100%;
`;

/**
 * Facts as plain label-over-value pairs in columns — no fill, no border, the
 * card itself is the container.
 *
 * The card already establishes the surface; giving each fact its own filled box
 * inside it stacks a second container on a first and turns six numbers into six
 * objects to scan. Whitespace and a column rhythm group them just as clearly and
 * far more quietly. Two columns is the widest this goes: these labels ("Amazon
 * stok", "Son satış") are long enough that a 3rd column truncates them on a
 * laptop, and the card sits in a half-width grid track to begin with.
 */
export const DefGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')} ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.sm')}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const DefItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const DefLabel = styled(Text)`
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;

/**
 * Item specifics — a spec sheet, not cards. Two columns of `label · value` rows
 * separated by hairlines, which is the densest form that stays scannable when a
 * product carries 20+ of them (see the reference eBay/Amazon detail screens).
 */
export const SpecList = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  column-gap: ${tkn('spacing.xl')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const SpecRow = styled.div`
  display: grid;
  grid-template-columns: minmax(7rem, 38%) minmax(0, 1fr);
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  align-items: baseline;
  padding: ${tkn('spacing.sm')} 0;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
  min-width: 0;
  word-break: break-word;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.2xs')};
  }
`;

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

/** Description / features / specs, spaced generously apart — no icons, no
 *  card-header chrome, just clearly separated sections. */
export const ProductContentStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};
`;

/** One Product Content section: its heading + its own body. */
export const ProductContentBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

/** Spacing for the InfoMessage under the Automation card's summary rows —
 *  changes aren't pushed instantly, so this stays visible rather than
 *  hidden behind a hover tooltip. */
export const AutomationSyncNoteSlot = styled.div`
  margin-top: ${tkn('spacing.sm')};
`;

/** Stacks the boxed automation blocks with even spacing — matches the Store
 *  Settings buyer-messaging event list. */
export const AutomationBlockList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
`;

/** Each toggle area is its own bordered box — matches the Store Settings
 *  buyer-messaging event rows, so every box shares the same padding/edges
 *  and lines up top to bottom. */
export const AutomationBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.md')};
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
`;

export const AutomationHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

/** Label on the left, Toggle switch on the right — matches the Store
 *  Settings buyer-messaging event rows. */
export const ToggleRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.md')};
`;

export const AutomationFields = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.md')};

  @media (min-width: ${tkn('breakpoints.sm')}) {
    grid-template-columns: 1fr 1fr;
  }
`;

/** Always stacked — unlike AutomationFields, the two margin inputs never sit side by side. */
export const MarginFields = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
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
