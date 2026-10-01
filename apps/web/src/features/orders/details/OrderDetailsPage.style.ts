import styled from '@emotion/styled';
import { Card, PageContainerWithMobileBar, Text, tkn } from '@repo/ui';

export const Container = PageContainerWithMobileBar;

/**
 * The hero is one card with two halves: the product on the left, the money
 * on the right. The right half is the page's one memorable element — the
 * profit explained as a receipt (sale → earnings → cost → profit) rather than
 * five equal-sized figures in a grey strip. Everything else on the page is
 * quiet so this reads first.
 */
export const Hero = styled(Card)`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  padding: 0;
  overflow: hidden;

  @media (min-width: ${tkn('breakpoints.lg')}) {
    grid-template-columns: minmax(0, 1fr) 20rem;
  }
`;

/** Image beside the product facts. Stacks on a phone. */
export const Product = styled.div`
  display: flex;
  gap: ${tkn('spacing.lg')};
  padding: ${tkn('spacing.lg')};
  min-width: 0;

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    flex-direction: column;
  }
`;

export const ProductImage = styled.div`
  width: 10rem;
  height: 10rem;
  flex-shrink: 0;
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

  svg {
    color: ${tkn('colors.text.disabled')};
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    width: 100%;
    height: 11rem;
  }
`;

export const ProductInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
  flex: 1;
`;

/** The product title heads the hero, not the page. Clamped — Amazon titles run long. */
export const ProductTitle = styled(Text)`
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-width: 0;
`;

/** Record facts as a label / value grid — no icons, the label column is the ornament. */
export const FactList = styled.dl`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: ${tkn('spacing.lg')};
  row-gap: ${tkn('spacing.xs')};
  align-items: baseline;
  margin: 0;
  min-width: 0;
`;

export const FactLabel = styled.dt`
  margin: 0;
  white-space: nowrap;
`;

export const FactValue = styled.dd`
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
`;

/**
 * The receipt. A tinted panel off the product half by one hairline, the
 * headline figure on top and the lines that produce it underneath.
 */
export const Ledger = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.lg')};
  background: ${tkn('colors.surface.secondary')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  min-width: 0;

  @media (min-width: ${tkn('breakpoints.lg')}) {
    border-top: none;
    border-left: 0.0625rem solid ${tkn('colors.border.primary')};
  }
`;

export const LedgerHead = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const LedgerLabelRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  flex-wrap: wrap;
`;

/** Margin and ROI — two small labelled figures under the headline. */
export const LedgerRatios = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.sm')};
  margin-top: ${tkn('spacing.xs')};
`;

export const LedgerRatio = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const LedgerLines = styled.div`
  display: flex;
  flex-direction: column;
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
`;

/** One line of the receipt: label left, figure right, a dotted leader between. */
export const LedgerLine = styled.div<{ $total?: boolean }>`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} 0;
  border-top: ${({ $total, theme }) => ($total ? `0.0625rem solid ${theme.colors.border.control}` : 'none')};
  margin-top: ${({ $total, theme }) => ($total ? theme.spacing.xs : '0')};
`;

export const LedgerLeader = styled.span`
  flex: 1;
  min-width: ${tkn('spacing.md')};
  border-bottom: 0.0625rem dotted ${tkn('colors.border.control')};
  transform: translateY(-0.25rem);
`;

export const EstimateNote = styled(Text)`
  line-height: ${tkn('typography.lineHeight.normal')};
`;

/** Timeline card body: the deadline / multi-item notices, then the steps. */
export const TimelineBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  min-width: 0;
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

/**
 * Same row chrome as MetaRow, but the value stacks BELOW the label — for
 * content that reads better left-aligned across several lines (an address).
 */
export const MetaBlockRow = styled.div<{ $rows?: number }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  /* min-height, not height: an address longer than its slot grows the row
     instead of overflowing it. */
  min-height: calc(${ROW} * ${({ $rows = 1 }) => $rows});
  padding: ${tkn('spacing.sm-md')} 0;
  box-sizing: border-box;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};
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
