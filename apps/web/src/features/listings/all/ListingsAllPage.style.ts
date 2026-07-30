import styled from '@emotion/styled';
import { PageContainer, Text as UIText, tkn, type AppTheme } from '@repo/ui';

export const Container = PageContainer;

// --- Filter Bar (SettingsCard surface language) ---

export const FilterBarWrapper = styled.div`
  margin-bottom: 0;
`;

export const FilterBar = styled.div`
  background: ${tkn('colors.surface.primary')};
  border: 0.0625rem solid ${tkn('colors.border.primary')};
  border-radius: ${tkn('radius.lg')};
  padding: ${tkn('spacing.md')} ${tkn('spacing.md+')};
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.md')};
  box-shadow: ${tkn('shadows.sm')};
  overflow: visible;
  box-sizing: border-box;

  @media (max-width: ${tkn('breakpoints.md')}) {
    padding: ${tkn('spacing.md')};
  }
`;

export const FilterBarRow = styled.div`
  display: flex;
  align-items: center;
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

  @media (max-width: 64rem) {
    width: 100%;
  }
`;

export const SelectWrapper = styled.div`
  width: 12rem;
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
  min-height: ${tkn('controls.height.medium')};

  @media (max-width: 64rem) {
    margin-left: 0;
    min-height: auto;
  }
`;

export const ResultCount = styled(UIText)`
  white-space: nowrap;
  padding: ${tkn('spacing.xs')} ${tkn('spacing.sm')};
  background: ${tkn('colors.background.tertiary')};
  border-radius: ${tkn('radius.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
`;

export const AdvancedDivider = styled.div`
  border-top: 0.0625rem solid ${tkn('colors.border.primary')};
  margin: 0;
`;

export const AdvancedHeader = styled.button<{ $isOpen: boolean }>`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  background: none;
  border: none;
  cursor: pointer;
  padding: ${tkn('spacing.sm')} 0;
  color: ${tkn('colors.text.primary')};
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  transition: color ${tkn('transitions.fast')};

  &:hover {
    color: ${tkn('colors.brand.primary')};
  }
`;

export const AdvancedChevron = styled.span<{ $isOpen: boolean }>`
  display: inline-flex;
  transition: transform ${tkn('transitions.fast')};
  transform: rotate(${({ $isOpen }) => ($isOpen ? '180deg' : '0deg')});
  color: inherit;
  margin-left: auto;
`;

export const NumericFilterGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${tkn('spacing.md')} ${tkn('spacing.lg')};
  padding-top: ${tkn('spacing.sm')};

  @media (max-width: 48rem) {
    grid-template-columns: 1fr;
  }
`;

export const NumericFilterField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.xs')};
  min-width: 0;
`;

export const NumericRangeRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${tkn('spacing.sm')};
  min-width: 0;
`;

export const RangeSeparator = styled(UIText)`
  flex-shrink: 0;
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.secondary')};
`;

// --- Table Cell Styles ---

export const ProductCell = styled.div`
  display: flex;
  align-items: flex-start;
  /* Image ↔ copy separation (was tight at spacing.sm) */
  gap: ${tkn('spacing.md')};
  /* Primary column — title needs room for 2-line clamp */
  width: 20.5rem;
  min-width: 20.5rem;
  max-width: 22rem;
`;

/** Transparent shell — match grid ListingCard image (no gray plate / border). */
export const ProductImageWrapper = styled.div`
  width: 4.5rem;
  height: 4.5rem;
  border-radius: ${tkn('radius.sm')};
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
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
  gap: ${tkn('spacing.xs')};
`;

/** Two-line clamp; overflow becomes ellipsis. */
export const ProductTitle = styled.div`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: ${tkn('typography.lineHeight.normal')};
  cursor: default;
  word-break: break-word;
  overflow-wrap: anywhere;
`;

export const ProductMeta = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
  min-width: 0;
`;

export const ProductMetaRow = styled.div`
  display: grid;
  grid-template-columns: 2.75rem minmax(0, 1fr);
  column-gap: ${tkn('spacing.xs')};
  align-items: center;
  min-width: 0;
`;

export const ProductMetaLabel = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.xs')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
  line-height: ${tkn('typography.lineHeight.tight')};
`;

export const MetricValue = styled(UIText)<{ $positive?: boolean; $negative?: boolean; $bold?: boolean }>`
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${({ $positive, $negative, theme }) => {
    const th = theme as AppTheme;
    if ($positive) {
      return th.colors.semantic.success;
    }
    if ($negative) {
      return th.colors.semantic.error;
    }
    return th.colors.text.primary;
  }};
`;

export const StatMain = styled(UIText)`
  line-height: ${tkn('typography.lineHeight.tight')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${tkn('colors.text.primary')};
`;

export const StockValue = styled.span<{ $outOfStock?: boolean }>`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.md')};
  font-weight: ${tkn('typography.fontWeight.semibold')};
  color: ${({ $outOfStock, theme }) => {
    const th = theme as AppTheme;
    return $outOfStock ? th.colors.text.secondary : th.colors.text.primary;
  }};
`;

export const StockInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${tkn('spacing.2xs')};
`;

export const StockLabel = styled.span`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.secondary')};
`;

export const CompactText = styled.div`
  font-family: ${tkn('typography.fontFamily.body')};
  font-size: ${tkn('typography.fontSize.sm')};
  font-weight: ${tkn('typography.fontWeight.medium')};
  color: ${tkn('colors.text.primary')};
  max-width: 6.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

/** Numeric / date cells — keep secondary columns tight */
export const CompactMetric = styled.div`
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

