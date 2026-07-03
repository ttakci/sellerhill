import styled from '@emotion/styled';
import { Button as RepoButton, Card as RepoCard, Text, tkn, type AppTheme } from '@repo/ui';

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
    font-size: ${tkn('typography.fontSize.md')};
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
    margin-bottom: ${tkn('spacing.2xs')};
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
    letter-spacing: ${tkn('typography.letterSpacing.widest')};
    color: ${tkn('colors.text.secondary')};
    margin-bottom: ${tkn('spacing.xs')};
  }
`;

export const BoldText = styled(Text)``;

export const AddressText = styled(Text)`
  line-height: ${tkn('typography.lineHeight.relaxed')}; /* 1.6 → relaxed(1.625) closest */
`;

export const AddressBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  margin-top: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.sm')};
  background: ${tkn('colors.surface.elevated')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.md')};
  position: relative;
`;

export const AddressLine = styled(Text)`
  line-height: ${tkn('typography.lineHeight.normal')};
  user-select: text;
`;

export const CopyButton = styled(RepoButton)`
  align-self: flex-end;
  margin-top: ${tkn('spacing.xs')};
  font-size: ${tkn('typography.fontSize.xs')};
  gap: ${tkn('spacing.xs')};
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
`;

export const SummaryRow = styled.div<{ $bold?: boolean; $total?: boolean; $bordered?: boolean }>`
  display: flex;
  justify-content: space-between;
  font-size: ${tkn('typography.fontSize.sm')};
  margin-bottom: ${tkn('spacing.md')};

  ${({ $bold, theme }) =>
    $bold &&
    `font-weight: ${(theme as AppTheme).typography.fontWeight.semibold};`}

  ${({ $total, theme }) =>
    $total &&
    `
    padding-top: 0.75rem; /* 12px — no exact token */
    border-top: 0.0625rem solid currentColor;
    border-top-color: ${(theme as AppTheme).colors.border.secondary};
    font-weight: ${(theme as AppTheme).typography.fontWeight.bold};
    font-size: ${(theme as AppTheme).typography.fontSize.md};
  `}

  ${({ $bordered, theme }) =>
    $bordered &&
    `
    padding-top: ${(theme as AppTheme).spacing.sm};
    border-top: 0.0625rem solid ${(theme as AppTheme).colors.border.secondary};
  `}

  span:first-child {
    color: ${({ $bold, $total, theme }) =>
      $bold || $total
        ? (theme as AppTheme).colors.text.primary
        : (theme as AppTheme).colors.text.secondary};
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
    font-size: ${tkn('typography.fontSize.2xs')};
    color: ${tkn('colors.text.secondary')};
    font-weight: ${tkn('typography.fontWeight.medium')};
  }
  .value {
    font-size: ${tkn('typography.fontSize.xs')};
    font-weight: ${tkn('typography.fontWeight.medium')};
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
    font-size: ${tkn('typography.fontSize.2xs')}; /* 0.6875rem (11px) → 2xs (10px) closest */
    color: ${tkn('colors.text.secondary')};
    text-transform: uppercase;
    font-weight: ${tkn('typography.fontWeight.bold')};
    margin-bottom: ${tkn('spacing.xs')};
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
  font-weight: ${tkn('typography.fontWeight.bold')};
  color: ${tkn('colors.semantic.info')};
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')}; /* 1px */
`;

// Analysis Section
export const AnalysisCard = styled(RepoCard)`
  padding: ${tkn('spacing.xl')};
  margin-bottom: ${tkn('spacing.xl')};

  @media (max-width: 48rem) {
    padding: ${tkn('spacing.lg')};
  }
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
  font-weight: 800; /* no token (beyond bold=700) */
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  margin-bottom: ${tkn('spacing.xs')};
  text-transform: uppercase;
  letter-spacing: ${tkn('typography.letterSpacing.widest')};
`;

export const AnalysisValues = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${tkn('spacing.lg')};

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
    gap: ${tkn('spacing.xxl')};
  }
`;

export const Calculation = styled.div`
  text-align: center;
  @media (min-width: 48rem) {
    /* 768px */
    text-align: right;
  }

  .label {
    font-size: ${tkn('typography.fontSize.2xs')};
    font-weight: ${tkn('typography.fontWeight.bold')};
    text-transform: uppercase;
    letter-spacing: 0.1em; /* no exact token — wider than widest(0.05em) */
    color: ${tkn('colors.text.secondary')};
    margin-bottom: ${tkn('spacing.xs')};
  }
  .formula {
    display: flex;
    align-items: center;
    gap: ${tkn('spacing.sm')};
    font-weight: ${tkn('typography.fontWeight.medium')};
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
    font-size: ${tkn('typography.fontSize.2xs')};
    font-weight: ${tkn('typography.fontWeight.bold')};
    text-transform: uppercase;
    letter-spacing: 0.1em; /* no exact token — wider than widest(0.05em) */
    color: ${tkn('colors.semantic.success')};
    margin-bottom: ${tkn('spacing.xs')};
  }
  .value {
    font-size: ${tkn('typography.fontSize.xxxl')};
    font-weight: 900; /* no token (beyond bold=700) */
    color: ${tkn('colors.semantic.success')};
    display: flex;
    align-items: center;
    gap: ${tkn('spacing.sm')};

    span {
      font-size: ${tkn('typography.fontSize.xxl')};
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
    font-size: ${tkn('typography.fontSize.2xs')};
    font-weight: ${tkn('typography.fontWeight.bold')};
    text-transform: uppercase;
    letter-spacing: 0.1em; /* no exact token — wider than widest(0.05em) */
    color: ${tkn('colors.text.secondary')};
    margin-bottom: ${tkn('spacing.xs')};
  }
  .value {
    font-size: ${tkn('typography.fontSize.xl')};
    font-weight: ${tkn('typography.fontWeight.bold')};
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
  gap: 0.75rem; /* 12px — no exact token */
  justify-content: flex-end;
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
`;

export const FormLabel = styled(Text)`
  margin-bottom: 0.375rem; /* 6px — no exact token */
  display: block;
`;

export const ErrorText = styled(Text)`
  margin-top: ${tkn('spacing.xs')};
`;

export const FormRow = styled.div`
  display: flex;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;

  > ${FormGroup} {
    flex: 1 1 12rem;
  }
`;

export const InfoText = styled.div`
  font-size: ${tkn('typography.fontSize.sm')}; /* 0.8125rem (13px) → sm (14px) closest */
  color: ${tkn('colors.text.secondary')};
  margin-top: ${tkn('spacing.sm')};
`;

export const EmptyImagePlaceholder = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
`;

export const BadgeLabel = styled.span`
  font-weight: ${tkn('typography.fontWeight.semibold')};
`;

export const SummaryFlex = styled.div`
  flex: 1;
`;

export const PaymentIconWrapper = styled.div`
  width: 2.5rem;
  height: 1.5rem;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.sm')};
  display: flex;
  align-items: center;
  justify-content: center;
`;

export const SectionHeader = styled.div`
  font-size: ${tkn('typography.fontSize.2xs')}; /* 0.6875rem (11px) → 2xs (10px) closest */
  font-weight: ${tkn('typography.fontWeight.bold')};
  text-transform: uppercase;
  color: ${tkn('colors.text.tertiary')};
  margin-bottom: 0.75rem; /* 12px — no exact token */
`;

export const SectionHeaderRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem; /* 12px — no exact token */
`;

export const DottedUnderline = styled.span`
  text-decoration: underline dotted;
  cursor: help;
`;

export const AmazonUpdateButton = styled(RepoButton)`
  margin-top: auto;
  background: ${tkn('colors.background.tertiary')};
  color: ${tkn('colors.semantic.info')};
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: 800; /* no token (beyond bold=700) */
  text-transform: uppercase;
  letter-spacing: 0.1em; /* no exact token — wider than widest(0.05em) */
`;

export const AnalysisDescription = styled.div`
  max-width: 27.5rem;
  margin: 0;
`;

export const FormulaMinus = styled.span`
  color: ${tkn('colors.border.secondary')};
  margin: 0 ${tkn('spacing.xs')};
`;

export const SummarySection = styled.div`
  margin-bottom: ${tkn('spacing.lg')};
`;

export const SummarySectionSmall = styled.div`
  margin-bottom: ${tkn('spacing.md')};
`;
