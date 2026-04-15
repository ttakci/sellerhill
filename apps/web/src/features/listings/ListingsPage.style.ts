import styled from '@emotion/styled';
import { ListingStatus } from '@repo/shared';
import { Badge as UIBadge, Card, Text as UIText, tkn, type AppTheme } from '@repo/ui';

// --- Layout ---

export const Container = styled.div`
  width: 100%;
  max-width: 90rem;
  margin: 0 auto;
  padding: 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
`;

// --- Filter Bar ---

export const FilterBarWrapper = styled.div`
  margin-bottom: ${tkn('spacing.lg')};
`;

export const FilterBar = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  border-radius: ${tkn('radius.xl')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.sm')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: hidden;

  @media (max-width: 64rem) {
    padding: ${tkn('spacing.sm')} ${tkn('spacing.md')};
  }
`;

export const FilterBarRow = styled.div`
  display: flex;
  align-items: stretch;
  gap: ${tkn('spacing.md')};
  flex-wrap: wrap;

  @media (max-width: 64rem) {
    flex-direction: column;
    align-items: stretch;
    gap: ${tkn('spacing.sm')};
  }
`;

export const SearchWrapper = styled.div`
  min-width: 0;
  width: 16rem;
  flex-shrink: 0;
  position: relative;
  z-index: 1;

  & > div {
    height: 2.75rem;
  }

  @media (max-width: 64rem) {
    width: 100%;
  }
`;

export const SelectWrapper = styled.div`
  width: 10.5rem;
  flex-shrink: 0;
  position: relative;
  z-index: 2;

  @media (max-width: 64rem) {
    width: 100%;
  }
`;

export const FilterActions = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.md')};
  margin-left: auto;

  @media (max-width: 64rem) {
    margin-left: 0;
  }
`;

export const ResultCount = styled(UIText)`
  white-space: nowrap;
  font-size: ${tkn('typography.fontSize.xs')};
  padding: 0.25rem 0.625rem;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.full')};
`;

export const AdvancedDivider = styled.div`
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  margin: ${tkn('spacing.sm')} 0;
`;

export const AdvancedHeader = styled.button`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  background: none;
  border: none;
  cursor: pointer;
  padding: ${tkn('spacing.sm')} 0;
  color: ${tkn('colors.text.secondary')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  font-family: ${tkn('typography.fontFamily.body')};

  &:hover {
    color: ${tkn('colors.text.primary')};
  }

  svg {
    transition: transform ${tkn('transitions.fast')};
    transform: rotate(${({ $isOpen }: { $isOpen: boolean }) => ($isOpen ? '180deg' : '0deg')});
  }
`;

export const NumericFilterGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  padding-top: ${tkn('spacing.md')};

  @media (max-width: 48rem) {
    grid-template-columns: 1fr;
  }
`;

export const NumericFilterField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const NumericFilterLabel = styled(UIText)``;

export const NumericRangeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.xs')};
`;

export const RangeSeparator = styled(UIText)`
  flex-shrink: 0;
  color: ${tkn('colors.text.tertiary')};
`;

// --- Table Cell Styles (used by container column renders) ---

export const ProductCell = styled.div`
  display: flex;
  align-items: center;
  gap: 0.625rem;
`;

export const ProductImageWrapper = styled.div`
  width: 4rem; /* 64px */
  height: 4rem; /* 64px */
  border-radius: ${tkn('radius.md')};
  background: ${tkn('colors.background.tertiary')};
  border: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.375rem; /* 6px padding */
  flex-shrink: 0;
  overflow: hidden;

  svg {
    color: ${tkn('colors.text.tertiary')};
  }
`;

export const ProductImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

export const ProductMainInfo = styled.div`
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

export const ProductTitle = styled.div`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
  cursor: default;
`;

export const ProductBrand = styled.div`
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ProductMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

export const IDLink = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;

  span {
    font-family: ${tkn('typography.fontFamily.mono')};
    font-size: ${tkn('typography.fontSize.2xs')};
    color: ${tkn('colors.text.tertiary')};
    letter-spacing: 0.01em;
    transition: color ${tkn('transitions.fast')};
  }

  a {
    color: ${tkn('colors.text.tertiary')};
    transition: color ${tkn('transitions.fast')};
    display: flex;
    align-items: center;

    svg {
      width: 0.75rem;
      height: 0.75rem;
    }
  }

  &:hover span {
    color: ${tkn('colors.brand.primary')};
  }

  &:hover a {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const MonoText = styled(UIText)``;

export const MetricValue = styled(UIText)<{ $positive?: boolean; $negative?: boolean; $bold?: boolean }>`
  color: ${({ $positive, $negative, theme }) => {
    const t = theme as AppTheme;
    if ($positive) {return t.colors.semantic.success;}
    if ($negative) {return t.colors.semantic.error;}
    return t.colors.text.primary;
  }};
`;

export const StatBadge = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
`;

export const StockSource = styled.span`
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};
  line-height: 1;
  white-space: nowrap;
`;

export const StatMain = styled(UIText)`
  line-height: 1;
`;

export const StatSub = styled.span`
  font-size: ${tkn('typography.fontSize.2xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};
  line-height: 1;
`;

export const StockValue = styled.span<{ $outOfStock?: boolean }>`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${({ $outOfStock, theme }) => {
    const t = theme as AppTheme;
    return $outOfStock ? t.colors.text.tertiary : t.colors.text.primary;
  }};
`;

export const CompactText = styled.div`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  max-width: 9.375rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

// --- Grid View ---

export const ListingCard = styled(Card)`
  padding: ${tkn('spacing.lg')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  position: relative;
`;

export const CardImageSection = styled.div`
  width: 100%;
  aspect-ratio: 16/9;
  background: ${tkn('colors.surface.primary')};
  border-radius: ${tkn('radius.md')};
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 0.0625rem solid ${tkn('colors.border.secondary')};

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  svg {
    color: ${tkn('colors.text.disabled')};
  }
`;

export const CardContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
`;

export const CardTitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${tkn('spacing.xs')};
`;

export const CardTitle = styled.div`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
  min-width: 0;
`;

export const CardBrand = styled.div`
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};
  line-height: 1.3;
`;

export const CardBadgeRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
`;

export const CardStatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0;
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.md')};
  padding: 0.375rem;
`;

export const StatItem = styled.div`
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding: 0.125rem 0.25rem;

  &:not(:last-child) {
    border-right: 0.0625rem solid ${tkn('colors.border.secondary')};
  }
`;

export const StatLabel = styled(UIText)`
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1;
`;

export const StatValue = styled(UIText)<{ $type?: 'price' | 'profit' | 'roi' }>`
  color: ${({ $type, theme }) => {
    const t = theme as AppTheme;
    if ($type === 'profit') {return t.colors.semantic.success;}
    if ($type === 'roi') {return t.colors.semantic.info;}
    return t.colors.text.primary;
  }};
`;

export const CardFooter = styled.div`
  margin-top: auto;
  padding-top: ${tkn('spacing.md')};
  border-top: 0.0625rem solid ${tkn('colors.border.secondary')};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

export const StockInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
`;

export const StockLabel = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};
`;

export const StatusBadge = styled(UIBadge)<{ $status: ListingStatus }>`
  white-space: nowrap;

  ${({ $status, theme }) => {
    const t = theme as AppTheme;
    if ($status === ListingStatus.ACTIVE) {
      return `
        background: ${t.colors.semanticTint.success};
        color: ${t.colors.semantic.success};
        border-color: ${t.colors.semanticTintBorder.success};
      `;
    }
    return `
      background: ${t.colors.semanticTint.neutral};
      color: ${t.colors.text.secondary};
      border-color: ${t.colors.semanticTintBorder.neutral};
    `;
  }}
`;
