import styled from '@emotion/styled';
import { ListingStatus } from '@repo/shared';
import { Badge as UIBadge, Text as UIText, tkn, type AppTheme } from '@repo/ui';

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
  padding: ${tkn('spacing.xs')} 0.625rem; /* 4px 10px — 10px no exact token */
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
  gap: ${tkn('spacing.sm+')}; /* 10px */
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
  padding: ${tkn('spacing.xs+')}; /* 6px */
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
  gap: ${tkn('spacing.2xs')};
`;

export const ProductTitle = styled.div`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: ${tkn('typography.lineHeight.normal')}; /* 1.4 → normal(1.5) closest */
  cursor: default;
`;

export const ProductBrand = styled.div`
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};
  line-height: ${tkn('typography.lineHeight.normal')}; /* 1.3 → normal(1.5) closest */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

export const ProductMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const MetricValue = styled(UIText)<{ $positive?: boolean; $negative?: boolean; $bold?: boolean }>`
  color: ${({ $positive, $negative, theme }) => {
    const t = theme as AppTheme;
    if ($positive) {
      return t.colors.semantic.success;
    }
    if ($negative) {
      return t.colors.semantic.error;
    }
    return t.colors.text.primary;
  }};
`;

export const StatMain = styled(UIText)`
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const StockValue = styled.span<{ $outOfStock?: boolean }>`
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${({ $outOfStock, theme }) => {
    const t = theme as AppTheme;
    return $outOfStock ? t.colors.text.tertiary : t.colors.text.primary;
  }};
`;

export const StockInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const StockLabel = styled.span`
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.tertiary')};
`;

export const CompactText = styled.div`
  font-size: ${tkn('typography.fontSize.sm')};
  color: ${tkn('colors.text.secondary')};
  max-width: 9.375rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
