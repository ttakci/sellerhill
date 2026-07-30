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
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: ${tkn('breakpoints.md')}) {
    grid-template-columns: minmax(9rem, 12rem) minmax(0, 1fr);
    align-items: start;
  }
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

export const ProfitHighlight = styled.div<{ $positive: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.md')};
  /* semanticTint carries the themed tint; the old code appended a raw "12" hex
     alpha onto a resolved token, which silently breaks if a token ever becomes
     rgb()/rgba() and produced a different opacity than the same effect elsewhere. */
  background: ${({ $positive, theme }) =>
    $positive ? theme.colors.semanticTint.success : theme.colors.semanticTint.error};
  border: 0.0625rem solid
    ${({ $positive, theme }) =>
      $positive ? theme.colors.semanticTintBorder.success : theme.colors.semanticTintBorder.error};
`;

export const ProfitLabelRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${tkn('spacing.sm')};
`;

export const EstimateNote = styled(Text)`
  line-height: ${tkn('typography.lineHeight.normal')};
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

export const SectionCard = styled(Card)`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  width: 100%;
  min-width: 0;
`;

/** Wrapper for the shared EmptyState on the loading / not-found screens. */
export const StateCard = styled(Card)`
  width: 100%;
`;

export const FormulaTerm = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const FormulaOperator = styled(Text)`
  align-self: flex-end;
  padding-bottom: ${tkn('spacing.2xs')};
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
  grid-template-columns: minmax(6rem, 45%) minmax(0, 1fr);
  gap: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  align-items: start;
  padding: ${tkn('spacing.sm')} 0;
  border-bottom: 0.0625rem solid ${tkn('colors.border.secondary')};

  &:last-child {
    border-bottom: none;
    padding-bottom: 0;
  }

  &:first-of-type {
    padding-top: 0;
  }

  @media (max-width: ${tkn('breakpoints.smBelow')}) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.2xs')};
  }
`;

export const AddressBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

/*
 * The derivation is now `earnings − total Amazon cost = net profit`. It used to
 * re-list purchase price, tax and shipping individually — the third appearance
 * of those same three numbers on one page (they live in the Amazon Costs card).
 */
export const FormulaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
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
