import styled from '@emotion/styled';
import { PageContainerWithMobileBar, Text, tkn } from '@repo/ui';

export const Container = PageContainerWithMobileBar;

export const HeaderActions = styled.div`
  display: none;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.sm')};

  @media (min-width: 48rem) {
    display: flex;
  }
`;

export const Hero = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.lg')};
  box-sizing: border-box;

  @media (min-width: 48rem) {
    grid-template-columns: minmax(10rem, 14rem) minmax(0, 1fr);
    align-items: start;
  }
`;

export const ProductImage = styled.div`
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 16rem;
  border-radius: ${tkn('radius.sm')};
  background: ${tkn('colors.background.tertiary')};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  @media (min-width: 48rem) {
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
  border-radius: ${tkn('radius.sm')};
  background: ${({ $positive, theme }) =>
    $positive ? `${theme.colors.semantic.success}12` : `${theme.colors.semantic.error}12`};
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

export const KpiStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${tkn('spacing.sm')};

  @media (min-width: 48rem) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: ${tkn('spacing.md')};
  }
`;

export const KpiCard = styled.div`
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.md')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
  box-sizing: border-box;
`;

export const SectionGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 48rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  @media (min-width: 64rem) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export const Card = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: none;
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
`;

export const CardFull = styled(Card)`
  @media (min-width: 48rem) {
    grid-column: 1 / -1;
  }
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

  @media (max-width: 22rem) {
    grid-template-columns: 1fr;
    gap: ${tkn('spacing.2xs')};
  }
`;

export const AddressBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const FormulaRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
`;

export const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${tkn('spacing.md')};
  padding: ${tkn('spacing.xxxl')} ${tkn('spacing.lg')};
  text-align: center;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.sm')};
  box-shadow: ${tkn('shadows.sm')};
`;

export const MobileActionBar = styled.div`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 40;
  display: flex;
  gap: ${tkn('spacing.sm')};
  padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  padding-bottom: max(${tkn('spacing.sm')}, env(safe-area-inset-bottom));
  background: ${tkn('colors.surface.primary')};
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  box-shadow: ${tkn('shadows.lg')};
  box-sizing: border-box;

  @media (min-width: 48rem) {
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

  @media (min-width: 30rem) {
    grid-template-columns: 1fr 1fr;
  }
`;

export const FormLabel = styled.div`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
`;

export const ErrorText = styled.div`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  color: ${tkn('colors.semantic.error')};
`;

export const InfoText = styled.div`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  line-height: ${tkn('typography.lineHeight.normal')};
`;
