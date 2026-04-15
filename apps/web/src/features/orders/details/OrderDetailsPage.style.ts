import styled from '@emotion/styled';
import { Button as RepoButton, Card as RepoCard, Text, tkn } from '@repo/ui';

export const BackLink = styled(RepoButton)`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
  padding: 0;
  margin-bottom: ${tkn('spacing.lg')};
`;

export const PageWrapper = styled.main`
  max-width: 80rem; /* 1280px */
  margin: 0 auto;
  padding: ${tkn('spacing.md')};

  @media (min-width: 48rem) {
    padding: ${tkn('spacing.xl')};
  }
`;

export const Metadata = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${tkn('spacing.md')};
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
`;

export const MetadataItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const Separator = styled.span`
  display: none;
  @media (min-width: 48rem) {
    /* 768px */
    display: inline;
    color: ${tkn('colors.border.primary')};
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: ${tkn('spacing.md')};

  @media (max-width: 30rem) {
    /* 480px */
    flex-direction: column;
    width: 100%;

    button {
      width: 100%;
    }
  }
`;

// Product Card
export const ProductCard = styled(RepoCard)`
  padding: ${tkn('spacing.xl')};
  margin-bottom: ${tkn('spacing.xl')};

  @media (max-width: 48rem) {
    padding: ${tkn('spacing.lg')};
  }
`;

export const ProductWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xl')};

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
  }
`;

export const ProductImage = styled.div`
  width: 100%;
  height: 10rem; /* 160px */
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.lg')};
  overflow: hidden;
  flex-shrink: 0;

  @media (min-width: 48rem) {
    /* 768px */
    width: 8rem; /* 128px */
    height: 8rem; /* 128px */
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

export const ProductInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
`;

export const ProductTitle = styled(Text)`
  @media (max-width: 48rem) {
    font-size: 1rem;
  }
`;

export const ProductMetadata = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.md')};
`;

export const LabelValueGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${tkn('spacing.xl')};

  @media (max-width: 30rem) {
    gap: ${tkn('spacing.lg')};
  }
`;

export const LabelValue = styled.div`
  .label {
    font-size: ${tkn('typography.fontSize.xs')};
    color: ${tkn('colors.text.secondary')};
    margin-bottom: 0.125rem; /* 2px */
  }
  .value {
    font-size: ${tkn('typography.fontSize.sm')};
    font-weight: ${tkn('typography.fontWeight.semibold')};
  }
`;

// Grid Sections
export const Grid = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.lg')};
  margin-bottom: ${tkn('spacing.xl')};
  width: 100%;

  @media (min-width: 64rem) {
    /* 1024px */
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${tkn('spacing.xl')};
  }
`;

export const SectionCard = styled(RepoCard)`
  display: flex;
  flex-direction: column;
  padding: ${tkn('spacing.lg')};
  margin-bottom: 0;
  height: 100%;
`;

export const SectionTitle = styled(Text)`
  margin-bottom: ${tkn('spacing.xl')};
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
`;

export const ContentRow = styled.div`
  margin-bottom: ${tkn('spacing.lg')};

  .label {
    font-size: ${tkn('typography.fontSize.xs')};
    font-weight: ${tkn('typography.fontWeight.bold')};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${tkn('colors.text.secondary')};
    margin-bottom: 0.25rem; /* 4px */
  }
`;

export const BoldText = styled(Text)``;

export const AddressText = styled(Text)`
  line-height: 1.6;
`;

export const SummaryRow = styled.div<{ $bold?: boolean; $total?: boolean; $bordered?: boolean }>`
  display: flex;
  justify-content: space-between;
  font-size: ${tkn('typography.fontSize.sm')};
  margin-bottom: ${tkn('spacing.md')};

  ${({ $bold }) =>
    $bold &&
    `
    font-weight: 600;
  `}

  ${({ $total }) =>
    $total &&
    `
    padding-top: 0.75rem; /* 12px */
    border-top: 0.0625rem solid currentColor;
    border-top-color: ${String(tkn('colors.border.secondary'))};
    font-weight: 700;
    font-size: 1rem; /* 16px */
  `}

  ${({ $bordered }) =>
    $bordered &&
    `
    padding-top: 0.5rem;
    border-top: 0.0625rem solid ${String(tkn('colors.border.secondary'))};
  `}

  span:first-child {
    color: ${({ $bold, $total }) =>
      $bold || $total ? String(tkn('colors.text.primary')) : String(tkn('colors.text.secondary'))};
  }
`;

export const PaymentMethod = styled.div`
  margin-top: auto;
  background: ${tkn('colors.background.tertiary')};
  padding: ${tkn('spacing.md')};
  border-radius: ${tkn('radius.lg')};
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};

  .label {
    font-size: 0.625rem; /* 10px */
    color: ${tkn('colors.text.secondary')};
    font-weight: 500;
  }
  .value {
    font-size: ${tkn('typography.fontSize.xs')};
    font-weight: 500;
  }
`;

export const FeesSection = styled.div`
  padding-left: ${tkn('spacing.md')};
  border-left: 0.125rem solid ${tkn('colors.border.secondary')}; /* 2px */
  margin: ${tkn('spacing.md')} 0;
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};

  .fees-label {
    font-size: 0.6875rem; /* 11px */
    color: ${tkn('colors.text.secondary')};
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 0.25rem; /* 4px */
  }
`;

export const FeeRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};

  span:last-child {
    color: ${tkn('colors.semantic.error')};
  }
`;

export const EarningsLink = styled.div`
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  color: ${tkn('colors.semantic.info')};
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
`;

// Analysis Section
export const AnalysisCard = styled.div`
  background: linear-gradient(
    135deg,
    ${tkn('colors.semanticTint.info')} 0%,
    ${tkn('colors.semanticTint.success')} 100%
  );
  border: 0.0625rem solid ${tkn('colors.semanticTintBorder.info')}; /* 1px */
  border-radius: ${tkn('radius.xl')};
  padding: ${tkn('spacing.xl')};
  position: relative;
  overflow: hidden;
  width: 100%;
  box-sizing: border-box;
  margin-top: ${tkn('spacing.xl')};
`;

export const AnalysisMetadata = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.xl')};
  position: relative;
  z-index: 1;

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
    justify-content: space-between;
  }
`;

export const AnalysisTitle = styled.div`
  color: ${tkn('colors.semantic.info')};
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.xs')};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const AnalysisValues = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
    gap: 3rem; /* 48px */
  }
`;

export const Calculation = styled.div`
  text-align: center;
  @media (min-width: 48rem) {
    /* 768px */
    text-align: right;
  }

  .label {
    font-size: 0.625rem; /* 10px */
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${tkn('colors.text.secondary')};
    margin-bottom: 0.25rem; /* 4px */
  }
  .formula {
    display: flex;
    align-items: center;
    gap: 0.5rem; /* 8px */
    font-weight: 500;
    color: ${tkn('colors.text.secondary')};
  }
`;

export const ProfitResult = styled.div`
  text-align: center;
  @media (min-width: 48rem) {
    /* 768px */
    text-align: right;
  }

  .label {
    font-size: 0.625rem; /* 10px */
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${tkn('colors.semantic.success')};
    margin-bottom: 0.25rem; /* 4px */
  }
  .value {
    font-size: ${tkn('typography.fontSize.xxxl')};
    font-weight: 900;
    color: ${tkn('colors.semantic.success')};
    display: flex;
    align-items: center;
    gap: 0.5rem; /* 8px */

    span {
      font-size: 1.5rem; /* 24px */
    }
  }
`;

export const Roi = styled.div`
  text-align: center;
  @media (min-width: 48rem) {
    /* 768px */
    text-align: right;
  }

  .label {
    font-size: 0.625rem; /* 10px */
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: ${tkn('colors.text.secondary')};
    margin-bottom: 0.25rem; /* 4px */
  }
  .value {
    font-size: ${tkn('typography.fontSize.xl')};
    font-weight: 700;
    color: ${tkn('colors.text.primary')};
  }
`;

export const Divider = styled.div`
  width: 0.0625rem; /* 1px */
  height: 3rem; /* 48px */
  background: ${tkn('colors.border.secondary')};
  display: none;
  @media (min-width: 48rem) {
    /* 768px */
    display: block;
  }
`;

// Amazon Details Modal
export const ModalFooter = styled.div`
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
  width: 100%;
`;

export const ModalBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

export const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
`;

export const FormLabel = styled(Text)`
  margin-bottom: 0.375rem;
  display: block;
`;

export const ErrorText = styled(Text)`
  margin-top: 0.25rem;
`;

export const FormRow = styled.div`
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;

  > ${FormGroup} {
    flex: 1 1 12rem;
  }
`;

export const InfoText = styled.div`
  font-size: 0.8125rem;
  color: ${tkn('colors.text.secondary')};
  margin-top: 0.5rem;
`;

export const EmptyImagePlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

export const BadgeLabel = styled.span`
  font-weight: 600;
`;

export const SummaryFlex = styled.div`
  flex: 1;
`;

export const PaymentIconWrapper = styled.div`
  width: 2.5rem;
  height: 1.5rem;
  background: ${tkn('colors.background.tertiary')};
  border-radius: 0.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const SectionHeader = styled.div`
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  color: ${tkn('colors.text.tertiary')};
  margin-bottom: 0.75rem;
`;

export const SectionHeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
`;

export const DottedUnderline = styled.span`
  text-decoration: underline dotted;
  cursor: help;
`;

export const AmazonUpdateButton = styled(RepoButton)`
  margin-top: auto;
  background: ${tkn('colors.background.tertiary')};
  color: ${tkn('colors.semantic.info')};
  font-size: 0.625rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

export const DecorativeBlur = styled.div<{ $position: 'top-right' | 'bottom-left' }>`
  position: absolute;
  width: 12rem;
  height: 12rem;
  border-radius: 50%;
  filter: blur(4rem);
  ${({ $position }) =>
    $position === 'top-right'
      ? `
    right: -3rem;
    top: -3rem;
    background: ${String(tkn('colors.semanticTint.success'))};
  `
      : `
    left: -3rem;
    bottom: -3rem;
    background: ${String(tkn('colors.semanticTint.info'))};
  `}
`;

export const AnalysisDescription = styled.p`
  font-size: 0.8125rem;
  color: ${tkn('colors.text.tertiary')};
  max-width: 27.5rem;
  line-height: 1.5;
  margin: 0;
`;

export const FormulaMinus = styled.span`
  color: ${tkn('colors.border.secondary')};
`;

export const SummarySection = styled.div`
  margin-bottom: 1.5rem;
`;

export const SummarySectionSmall = styled.div`
  margin-bottom: 1rem;
`;
