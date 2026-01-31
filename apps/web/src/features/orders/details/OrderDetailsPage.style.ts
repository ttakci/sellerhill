import styled from '@emotion/styled';

export const PageWrapper = styled.main`
  max-width: 80rem; /* 1280px */
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.xl};
`;

export const Header = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  margin-bottom: ${({ theme }) => theme.spacing.xl};

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
  }
`;

export const TitleWrapper = styled.div``;

export const PageTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.xxl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
`;

export const Metadata = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
`;

export const MetadataItem = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const Separator = styled.span`
  display: none;
  @media (min-width: 48rem) {
    /* 768px */
    display: inline;
    color: ${({ theme }) => theme.colors.border.primary};
  }
`;

export const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
`;

// Product Card
export const Card = styled.div`
  background: ${({ theme }) => theme.colors.background.secondary};
  border: 0.0625rem solid ${({ theme }) => theme.colors.border.primary}; /* 1px */
  border-radius: ${({ theme }) => theme.radius.xl};
  padding: ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  box-shadow: ${({ theme }) => theme.shadows.sm};
`;

export const ProductWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
  }
`;

export const ProductImage = styled.div`
  width: 100%;
  height: 8rem; /* 128px */
  background: ${({ theme }) => theme.colors.background.tertiary};
  border-radius: ${({ theme }) => theme.radius.lg};
  overflow: hidden;
  flex-shrink: 0;

  @media (min-width: 48rem) {
    /* 768px */
    width: 8rem; /* 128px */
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

export const ProductInfo = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const ProductTitle = styled.h2`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

export const ProductMetadata = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
`;

export const Badge = styled.span<{ $color?: string; $bg?: string }>`
  background: ${({ $bg, theme }) => $bg || theme.colors.background.tertiary};
  color: ${({ $color, theme }) => $color || theme.colors.text.primary};
  padding: 0.125rem 0.5rem; /* 2px 8px */
  border-radius: ${({ theme }) => theme.radius.sm};
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

export const LabelValueGroup = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xl};
`;

export const LabelValue = styled.div`
  .label {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    color: ${({ theme }) => theme.colors.text.secondary};
    margin-bottom: 0.125rem; /* 2px */
  }
  .value {
    font-size: ${({ theme }) => theme.typography.fontSize.sm};
    font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  }
`;

// Grid Sections
export const Grid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.xl};
  margin-bottom: ${({ theme }) => theme.spacing.xxl};

  @media (min-width: 64rem) {
    /* 1024px */
    grid-template-columns: repeat(3, 1fr);
  }
`;

export const SectionCard = styled(Card)`
  margin-bottom: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.md};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  margin-bottom: ${({ theme }) => theme.spacing.xl};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.colors.text.primary};
`;

export const ContentRow = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing.lg};

  .label {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: ${({ theme }) => theme.colors.text.secondary};
    margin-bottom: 0.25rem; /* 4px */
  }
`;

export const BoldText = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
`;

export const AddressText = styled.p`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: 1.6;
`;

export const SummaryRow = styled.div<{ $bold?: boolean; $total?: boolean }>`
  display: flex;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  margin-bottom: ${({ theme }) => theme.spacing.md};

  ${({ $bold }) =>
    $bold &&
    `
    font-weight: 600;
  `}

  ${({ $total, theme }) =>
    $total &&
    `
    padding-top: 0.75rem; /* 12px */
    border-top: 0.0625rem solid ${theme.colors.border.secondary}; /* 1px */
    font-weight: 700;
    font-size: 1rem; /* 16px */
  `}

  span:first-child {
    color: ${({ theme, $bold, $total }) => ($bold || $total ? theme.colors.text.primary : theme.colors.text.secondary)};
  }
`;

export const PaymentMethod = styled.div`
  margin-top: auto;
  background: ${({ theme }) => theme.colors.background.tertiary};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.lg};
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};

  .label {
    font-size: 0.625rem; /* 10px */
    color: ${({ theme }) => theme.colors.text.secondary};
    font-weight: 500;
  }
  .value {
    font-size: ${({ theme }) => theme.typography.fontSize.xs};
    font-weight: 500;
  }
`;

export const FeesSection = styled.div`
  padding-left: ${({ theme }) => theme.spacing.md};
  border-left: 0.125rem solid ${({ theme }) => theme.colors.border.secondary}; /* 2px */
  margin: ${({ theme }) => theme.spacing.md} 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};

  .fees-label {
    font-size: 0.6875rem; /* 11px */
    color: ${({ theme }) => theme.colors.text.secondary};
    text-transform: uppercase;
    font-weight: 700;
    margin-bottom: 0.25rem; /* 4px */
  }
`;

export const FeeRow = styled.div`
  display: flex;
  justify-content: space-between;
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.secondary};

  span:last-child {
    color: ${({ theme }) => theme.colors.semantic.error};
  }
`;

export const EarningsLink = styled.div`
  display: flex;
  justify-content: space-between;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.semantic.info};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: 0.0625rem solid ${({ theme }) => theme.colors.border.secondary}; /* 1px */
`;

// Analysis Section
export const AnalysisCard = styled.div`
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.colors.semantic.info}22 0%,
    ${({ theme }) => theme.colors.semantic.success}22 100%
  );
  border: 0.0625rem solid ${({ theme }) => theme.colors.semantic.info}33; /* 1px */
  border-radius: ${({ theme }) => theme.radius.xl};
  padding: ${({ theme }) => theme.spacing.xl};
  position: relative;
  overflow: hidden;
`;

export const AnalysisMetadata = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xl};
  position: relative;
  z-index: 1;

  @media (min-width: 48rem) {
    /* 768px */
    flex-direction: row;
    justify-content: space-between;
  }
`;

export const AnalysisTitle = styled.div`
  color: ${({ theme }) => theme.colors.semantic.info};
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-bottom: ${({ theme }) => theme.spacing.xs};
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

export const AnalysisValues = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};

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
    color: ${({ theme }) => theme.colors.text.secondary};
    margin-bottom: 0.25rem; /* 4px */
  }
  .formula {
    display: flex;
    align-items: center;
    gap: 0.5rem; /* 8px */
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text.secondary};
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
    color: ${({ theme }) => theme.colors.semantic.success};
    margin-bottom: 0.25rem; /* 4px */
  }
  .value {
    font-size: ${({ theme }) => theme.typography.fontSize.xxxl};
    font-weight: 900;
    color: ${({ theme }) => theme.colors.semantic.success};
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
    color: ${({ theme }) => theme.colors.text.secondary};
    margin-bottom: 0.25rem; /* 4px */
  }
  .value {
    font-size: ${({ theme }) => theme.typography.fontSize.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text.primary};
  }
`;

export const Divider = styled.div`
  width: 0.0625rem; /* 1px */
  height: 3rem; /* 48px */
  background: ${({ theme }) => theme.colors.border.secondary};
  display: none;
  @media (min-width: 48rem) {
    /* 768px */
    display: block;
  }
`;
